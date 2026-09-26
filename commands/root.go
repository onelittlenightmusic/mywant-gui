package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"mywant-gui/buildinfo"

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

func initConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(myWantDir())
	viper.SetEnvPrefix("MYWANT")
	viper.AutomaticEnv()

	// Defaults
	viper.SetDefault("server_port", 8080)
	viper.SetDefault("server_host", "localhost")
	viper.SetDefault("gui_port", 8081)

	_ = viper.ReadInConfig()
}

func myWantDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".mywant")
}

// authUser is the Basic auth username, read from MYWANT_AUTH_USER (or
// auth_user in config.yaml). Defaults to "mywant" so only the password needs
// configuring.
func authUser() string {
	if u := viper.GetString("auth_user"); u != "" {
		return u
	}
	return "mywant"
}

func backendURL() string {
	if b := viper.GetString("backend"); b != "" {
		return b
	}
	return fmt.Sprintf("http://%s:%d", viper.GetString("server_host"), viper.GetInt("server_port"))
}
