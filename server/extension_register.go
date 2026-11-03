package server

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"go.yaml.in/yaml/v3"
)

// What an extension defines for the backend, put there when this server starts.
//
// An extension's manifest may name a directory (Register, "register") of YAML
// documents in the backend's own Kubernetes flavour — the canvas's skills, say
// (kind: CharacterSkill) — which the backend must know but which belong to the
// extension, not to the engine. Each document is PUT to its kind's resource by
// its name (kind CharacterSkill, name throw → PUT /api/v1/character-skills/throw), again until it
// is taken: the backend may come up after this server, or be restarted while
// it runs (it keeps what it was given, so once is enough per start). PUT, so
// sending it again changes nothing.

// registerRetry is how long between tries while the backend does not answer,
// and registerFor how long to keep trying.
const (
	registerRetry = 5 * time.Second
	registerFor   = 10 * time.Minute
)

// registerExtensionResources applies every loadable extension's register/
// documents to the backend, in the background.
func (s *Server) registerExtensionResources() {
	for name, m := range loadableExtensions(false) {
		if m.Register == "" {
			continue
		}
		dir := filepath.Join(m.dir, filepath.FromSlash(m.Register))
		files, _ := filepath.Glob(filepath.Join(dir, "*.yaml"))
		sort.Strings(files)
		for _, f := range files {
			go s.applyToBackend(name, f)
		}
	}
}

func (s *Server) applyToBackend(ext, file string) {
	data, err := os.ReadFile(file)
	if err != nil {
		log.Printf("[gui-extensions] %s: %s: %v", ext, filepath.Base(file), err)
		return
	}
	docs, err := resourceDocs(data)
	if err != nil {
		log.Printf("[gui-extensions] %s: %s: %v", ext, filepath.Base(file), err)
		return
	}
	for _, d := range docs {
		url := strings.TrimRight(s.config.BackendURL, "/") + "/api/v1/" + d.plural + "/" + d.name
		deadline := time.Now().Add(registerFor)
		for {
			err := s.putYAML(url, d.body)
			if err == nil {
				log.Printf("[gui-extensions] %s: put %s/%s", ext, d.kind, d.name)
				break
			}
			if time.Now().After(deadline) {
				log.Printf("[gui-extensions] %s: gave up putting %s/%s: %v", ext, d.kind, d.name, err)
				break
			}
			time.Sleep(registerRetry)
		}
	}
}

// resourceDoc is one YAML document of a register/ file: what it is, and itself.
type resourceDoc struct {
	kind, name, plural string
	body               []byte
}

// resourceDocs splits a file into its documents, each with its kind and name;
// a kind's resource is its plural in kebab case (CharacterSkill → character-skills).
func resourceDocs(data []byte) ([]resourceDoc, error) {
	dec := yaml.NewDecoder(bytes.NewReader(data))
	var out []resourceDoc
	for {
		var node yaml.Node
		if err := dec.Decode(&node); err != nil {
			if errors.Is(err, io.EOF) {
				return out, nil
			}
			return nil, err
		}
		var head struct {
			Kind     string `yaml:"kind"`
			Metadata struct {
				Name string `yaml:"name"`
			} `yaml:"metadata"`
		}
		if err := node.Decode(&head); err != nil {
			return nil, err
		}
		if head.Kind == "" && head.Metadata.Name == "" {
			continue // an empty document between separators
		}
		if head.Kind == "" || head.Metadata.Name == "" {
			return nil, fmt.Errorf("a document needs kind and metadata.name")
		}
		body, err := yaml.Marshal(&node)
		if err != nil {
			return nil, err
		}
		out = append(out, resourceDoc{
			kind: head.Kind, name: head.Metadata.Name,
			plural: kindResource(head.Kind), body: body,
		})
	}
}

func (s *Server) putYAML(url string, data []byte) error {
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/yaml")
	// The same credentials the browser reaches the backend with through here.
	if s.config.AuthPassword != "" {
		req.SetBasicAuth(s.config.AuthUser, s.config.AuthPassword)
	}
	res, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		return fmt.Errorf("HTTP %d", res.StatusCode)
	}
	return nil
}

// kindResource is a kind's resource path: kebab case, plural
// (CharacterSkill → character-skills).
func kindResource(kind string) string {
	var b strings.Builder
	for i, r := range kind {
		if r >= 'A' && r <= 'Z' {
			if i > 0 {
				b.WriteByte('-')
			}
			r += 'a' - 'A'
		}
		b.WriteRune(r)
	}
	return b.String() + "s"
}
