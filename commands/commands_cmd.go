package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

// This CLI's table of contents, in the form the core CLI asks for.
//
// `mywant commands --json` is how anything driving MyWant learns what it can
// do — the on-device robot builds its whole tool from it. Plugins are reached
// by exec, so they are not in the tree that walk covers, and the core now asks
// each plugin on PATH for its own commands and merges the answer in under the
// name you would type (`mywant guiex tile set`).
//
// Answering is this file. Without it, `mywant-guiex tile set` — the one command
// that moves a tile on the canvas — stays invisible to everything that could
// use it, and the robot goes on saying it cannot arrange the board while the
// verb sits on the same PATH.
//
// The shape is the core's CommandInfo, deliberately: it is the format being
// asked for, and copying it is cheaper for both sides than a shared module
// between two repositories that otherwise share nothing.

type commandInfo struct {
	Path     string     `json:"path"`
	Short    string     `json:"short,omitempty"`
	Use      string     `json:"use,omitempty"`
	Long     string     `json:"long,omitempty"`
	Example  string     `json:"example,omitempty"`
	Flags    []flagInfo `json:"flags,omitempty"`
	ReadOnly bool       `json:"readOnly"`
	Risk     string     `json:"risk"`
	// What it is for: "observe" or "control".
	Kind string `json:"kind"`
	// Whether it is about what is drawn on the canvas. Only the tile commands
	// are: the rest of this CLI moves a viewer's screen and cursor, which is
	// not the board.
	Canvas bool `json:"canvas"`
}

type flagInfo struct {
	Name      string `json:"name"`
	Shorthand string `json:"shorthand,omitempty"`
	Usage     string `json:"usage,omitempty"`
	Default   string `json:"default,omitempty"`
	Type      string `json:"type,omitempty"`
}

// The verbs here that only look.
//
// Fewer than the core's, and on purpose: this CLI's job is to move what is on
// screen, so most of its commands change something a person can see. Navigating
// to a page changes what the user is looking at, which is a change even though
// nothing on the board moves — so `show` and the page commands are not reads.
var readOnlyVerbs = map[string]bool{
	"get": true, "list": true, "version": true, "commands": true, "help": true,
}

// The verbs here that take something away. Navigating and moving a cursor are
// changes you can make again; removing a character's cursor entry is not.
var destructiveVerbs = map[string]bool{
	"delete": true, "remove": true, "stop": true, "drop": true,
}

// commandRisk says what running a command costs if it was the wrong one, in the
// three words the core CLI's own classification uses: "read", "change",
// "destroy".
func commandRisk(path string) string {
	fields := strings.Fields(path)
	if len(fields) == 0 {
		return "change"
	}
	verb := fields[len(fields)-1]
	switch {
	case readOnlyVerbs[verb]:
		return "read"
	case destructiveVerbs[verb]:
		return "destroy"
	default:
		return "change"
	}
}

// commandKind says what a command is for. Navigating is a change to what
// somebody is looking at, so only the plain readers observe.
func commandKind(path string) string {
	if readOnlyCommand(path) {
		return "observe"
	}
	return "control"
}

// commandCanvas reports whether a command is about the board itself. Only the
// tile commands are, and those are mywant-guiex's; this binary has none.
func commandCanvas(path string) bool {
	return strings.HasPrefix(path, "tile ")
}

func readOnlyCommand(path string) bool {
	fields := strings.Fields(path)
	if len(fields) == 0 {
		return false
	}
	return readOnlyVerbs[fields[len(fields)-1]]
}

// NewCommandsCmd returns a `commands` command for a binary's own tree. Every
// mywant-gui binary answers it the same way — mywant-gui and mywant-guiex both
// — so the core CLI merges each in under the name you would type.
func NewCommandsCmd(binary string) *cobra.Command {
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "commands",
		Short: "List every command this CLI has, for a person or a program",
		Long: `Walks this binary's own command tree and prints it.

--json is the form the core CLI reads when it collects the plugins on PATH, so
what this binary can do appears in "mywant commands --json" under its plugin
name.`,
		Example: "  " + binary + " commands\n  " + binary + " commands --json",
		Args:    cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			infos := collectCommands(cmd.Root(), "")
			sort.Slice(infos, func(i, j int) bool { return infos[i].Path < infos[j].Path })

			if asJSON {
				enc := json.NewEncoder(os.Stdout)
				enc.SetIndent("", "  ")
				if err := enc.Encode(infos); err != nil {
					fmt.Fprintf(os.Stderr, "Error encoding commands: %v\n", err)
					os.Exit(1)
				}
				return
			}
			for _, info := range infos {
				mark := " "
				if info.ReadOnly {
					mark = "r"
				}
				fmt.Printf("%s  %-28s %s\n", mark, info.Path, info.Short)
			}
		},
	}
	cmd.Flags().BoolVar(&asJSON, "json", false, "Print the tree as JSON, with flags and arguments")
	return cmd
}

// collectCommands walks the tree, skipping what nobody can usefully run: the
// root, hidden commands, and the shell-completion machinery.
func collectCommands(cmd *cobra.Command, prefix string) []commandInfo {
	var infos []commandInfo
	for _, child := range cmd.Commands() {
		if child.Hidden || child.Name() == "completion" || child.Name() == "help" {
			continue
		}
		path := strings.TrimSpace(prefix + " " + child.Name())
		if child.Runnable() {
			infos = append(infos, commandInfo{
				Path:     path,
				Short:    child.Short,
				Use:      child.Use,
				Long:     strings.TrimSpace(child.Long),
				Example:  strings.TrimSpace(child.Example),
				Flags:    collectFlags(child),
				ReadOnly: readOnlyCommand(path),
				Risk:     commandRisk(path),
				Kind:     commandKind(path),
				Canvas:   commandCanvas(path),
			})
		}
		infos = append(infos, collectCommands(child, path)...)
	}
	return infos
}

func collectFlags(cmd *cobra.Command) []flagInfo {
	var flags []flagInfo
	cmd.LocalNonPersistentFlags().VisitAll(func(f *pflag.Flag) {
		if f.Hidden {
			return
		}
		flags = append(flags, flagInfo{
			Name:      f.Name,
			Shorthand: f.Shorthand,
			Usage:     f.Usage,
			Default:   f.DefValue,
			Type:      f.Value.Type(),
		})
	})
	return flags
}

func init() {
	rootCmd.AddCommand(NewCommandsCmd("mywant-gui"))
}
