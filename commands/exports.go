package commands

import "github.com/spf13/cobra"

// What the other mywant-gui binaries share with this one. mywant-guiex (the
// canvas commands, see guiex/) reads the same config, talks to the same
// backend and nudges the same robot cursor, so it borrows these rather than
// keeping copies that could drift.

// InitConfig reads ~/.mywant/config.yaml and MYWANT_* into viper.
func InitConfig() { initConfig() }

// MyWantDir is ~/.mywant.
func MyWantDir() string { return myWantDir() }

// BackendURL is the mywant server this CLI talks to.
func BackendURL() string { return backendURL() }

// RobotNonce is a fresh nonce for a robot-cursor request.
func RobotNonce() int64 { return robotNonce() }

// ServerCommands are the commands that run the GUI server itself — start,
// stop, version. An edition that embeds its own frontend (mywant-guiex)
// offers these too, so it can serve that frontend: the server package serves
// whatever the `mywant-gui/web` module embeds, and that edition replaces it.
func ServerCommands() []*cobra.Command {
	return []*cobra.Command{startCmd, stopCmd, versionCmd}
}
