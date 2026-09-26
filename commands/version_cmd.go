package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"mywant-gui/buildinfo"
	"mywant-gui/client"

	"github.com/spf13/cobra"
)

var versionJSON bool

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Show the version of this CLI, the GUI server and the backend",
	Long: `Print build versions.

Three processes are involved and they are versioned separately: this CLI, the
mywant-gui server it drives, and the MyWant backend behind that. All three come
from the git tag their build was made at, never from a value written by hand,
so an upgrade that replaced only one of them shows up here as a mismatch.

A line reads "unreachable" when nothing answers, rather than failing the
command — the versions that could be read are still worth printing.`,
	Args: cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		version, commit := buildinfo.Get()
		gui, guiErr := client.New(guiBaseURL()).GUIVersion()
		backend, backendErr := client.New(backendURL()).BackendHealth()

		if versionJSON {
			out := map[string]any{"client": client.BuildInfo{Version: version, Commit: commit}}
			if guiErr == nil {
				out["gui"] = map[string]any{"version": gui.Version, "commit": gui.Commit, "url": guiBaseURL()}
			}
			if backendErr == nil {
				out["backend"] = map[string]any{"version": backend.Version, "commit": backend.Commit, "url": backendURL()}
			}
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			_ = enc.Encode(out)
			return
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintf(w, "Client:\t%s\n", describeBuild(version, commit))
		writeRemote(w, "GUI", gui, guiErr, guiBaseURL())
		writeRemote(w, "Backend", backend, backendErr, backendURL())
		w.Flush()
	},
}

func writeRemote(w *tabwriter.Writer, label string, info *client.BuildInfo, err error, url string) {
	if err != nil {
		fmt.Fprintf(w, "%s:\t(unreachable)\t%s\n", label, url)
		return
	}
	fmt.Fprintf(w, "%s:\t%s\t%s\n", label, describeBuild(info.Version, info.Commit), url)
}

func describeBuild(version, commit string) string {
	if commit == "" || version == commit {
		return version
	}
	return fmt.Sprintf("%s (%s)", version, commit)
}

func init() {
	versionCmd.Flags().BoolVar(&versionJSON, "json", false, "output as JSON")
	rootCmd.AddCommand(versionCmd)
}
