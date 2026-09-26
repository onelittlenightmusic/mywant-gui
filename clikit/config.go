// Package clikit is what every mywant-gui CLI shares — the config it reads,
// the backend it talks to, the `commands` command the core CLI asks plugins
// for — without the GUI server. mywant-gui's own commands use it, and so can
// a CLI that extends it (mywant-guiex) without carrying the server along.
package clikit

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/viper"
)

// InitConfig reads ~/.mywant/config.yaml and MYWANT_* into viper — the
// configuration every mywant-gui CLI shares.
func InitConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(MyWantDir())
	viper.SetEnvPrefix("MYWANT")
	viper.AutomaticEnv()

	// Defaults
	viper.SetDefault("server_port", 8080)
	viper.SetDefault("server_host", "localhost")
	viper.SetDefault("gui_port", 8081)

	_ = viper.ReadInConfig()
}

// MyWantDir is ~/.mywant.
func MyWantDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".mywant")
}

// AuthUser is the Basic auth username, read from MYWANT_AUTH_USER (or
// auth_user in config.yaml). Defaults to "mywant" so only the password needs
// configuring.
func AuthUser() string {
	if u := viper.GetString("auth_user"); u != "" {
		return u
	}
	return "mywant"
}

// BackendURL is the mywant server the CLI talks to.
func BackendURL() string {
	if b := viper.GetString("backend"); b != "" {
		return b
	}
	return fmt.Sprintf("http://%s:%d", viper.GetString("server_host"), viper.GetInt("server_port"))
}

// RobotNonce returns a unique nonce for robot commands.
func RobotNonce() int64 {
	return time.Now().UnixMilli()*1000 + rand.Int63n(1000)
}
