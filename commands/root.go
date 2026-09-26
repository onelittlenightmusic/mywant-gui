package commands

import (
	"fmt"
	"os"

	"mywant-gui/buildinfo"
	"mywant-gui/clikit"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var version = "dev"

var rootCmd = &cobra.Command{
	Use:     "mywant-gui",
	Short:   "MyWant GUI server and control CLI",
	Long:    `mywant-gui serves the MyWant web frontend and proxies API requests to the backend.`,
	Version: version,
}

func SetVersion(v string) {
	version = v
	rootCmd.Version = v
	// The server reports the same build on /api/v1/gui-version, and it is this
	// binary that starts it.
	buildinfo.SetVersion(v)
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	// Accept commands and aliases in any case, so `mywant-gui I say ...` works
	// the same as `i say ...`. The single-letter commands (`i`) are the ones
	// that matter: these get typed through voice input and phone keyboards that
	// autocapitalize the first word, which cobra would otherwise reject with
	// "unknown command \"I\"".
	cobra.EnableCaseInsensitive = true

	cobra.OnInitialize(initConfig)
	rootCmd.PersistentFlags().String("backend", "", "Backend API URL (overrides config)")
	viper.BindPFlag("backend", rootCmd.PersistentFlags().Lookup("backend"))
}

func initConfig()        { clikit.InitConfig() }
func myWantDir() string  { return clikit.MyWantDir() }
func authUser() string   { return clikit.AuthUser() }
func backendURL() string { return clikit.BackendURL() }
