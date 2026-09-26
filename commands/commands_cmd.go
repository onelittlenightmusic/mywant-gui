package commands

import "mywant-gui/clikit"

func init() {
	rootCmd.AddCommand(clikit.NewCommandsCmd("mywant-gui"))
}
