package commands

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"mywant-gui/server"
)

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the GUI server",
	Long: `Start the mywant-gui server.

The GUI server serves the React frontend and proxies /api/* requests to the
MyWant backend (default: http://localhost:8080).

Examples:
  mywant-gui start
  mywant-gui start -D
  mywant-gui start --port 8081 --backend http://myserver:8080`,
	Run: func(cmd *cobra.Command, args []string) {
		port, _ := cmd.Flags().GetInt("port")
		host, _ := cmd.Flags().GetString("host")
		detach, _ := cmd.Flags().GetBool("detach")

		if !cmd.Flags().Changed("port") {
			port = viper.GetInt("gui_port")
			if port <= 0 {
				port = 8081
			}
		}
		if !cmd.Flags().Changed("host") {
			host = viper.GetString("gui_host")
			if host == "" {
				host = "localhost"
			}
		}

		// Check port availability before forking.
		// Probe both IPv4 and IPv6 wildcard because on macOS a process bound to
		// 127.0.0.1 does NOT block an IPv6 wildcard bind, so a stale process on
		// 127.0.0.1:port would otherwise go undetected and both would coexist.
		for _, probeAddr := range []string{
			fmt.Sprintf("0.0.0.0:%d", port),
			fmt.Sprintf("[::]:%d", port),
		} {
			ln, err := net.Listen("tcp", probeAddr)
			if err != nil {
				fmt.Printf("Error: Port %d is already in use. Stop the existing process first.\n", port)
				os.Exit(1)
			}
			ln.Close()
		}

		if detach {
			executable, _ := os.Executable()
			newArgs := []string{"start", "--port", strconv.Itoa(port), "--host", host}
			if b := viper.GetString("backend"); b != "" {
				newArgs = append(newArgs, "--backend", b)
			}

			logPath := filepath.Join(myWantDir(), "gui.log")
			logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
			if err != nil {
				fmt.Printf("Failed to open log file: %v\n", err)
				os.Exit(1)
			}

			proc := exec.Command(executable, newArgs...)
			proc.Stdout = logFile
			proc.Stderr = logFile
			// Detach from the shell's process group so zsh/bash don't report
			// the child as a killed job if it exits unexpectedly.
			proc.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
			if err := proc.Start(); err != nil {
				fmt.Fprintf(os.Stderr, "Error: Failed to start mywant-gui: %v\n", err)
				os.Exit(1)
			}

			// Wait briefly to detect immediate startup failures (e.g. port conflict
			// that slipped past the pre-fork check).
			time.Sleep(300 * time.Millisecond)
			if err := proc.Process.Signal(syscall.Signal(0)); err != nil {
				fmt.Fprintf(os.Stderr, "Error: mywant-gui exited immediately after start.\n")
				fmt.Fprintf(os.Stderr, "       See logs for details: %s\n", logPath)
				os.Exit(1)
			}

			pidPath := filepath.Join(myWantDir(), "gui.pid")
			os.WriteFile(pidPath, []byte(strconv.Itoa(proc.Process.Pid)), 0644)

			fmt.Printf("mywant-gui started in background (PID: %d)\n", proc.Process.Pid)
			fmt.Printf("Logs: %s\n", logPath)
			fmt.Printf("URL:  http://%s:%d\n", host, port)
			os.Exit(0)
		}

		cfg := server.Config{
			Port:         port,
			Host:         host,
			BackendURL:   backendURL(),
			AuthUser:     authUser(),
			AuthPassword: viper.GetString("auth_password"),
		}

		fmt.Printf("Starting mywant-gui on http://%s:%d  →  backend %s\n", host, port, backendURL())
		s := server.New(cfg)
		if err := s.Start(); err != nil {
			fmt.Printf("Server error: %v\n", err)
			os.Exit(1)
		}
	},
}

func init() {
	startCmd.Flags().IntP("port", "p", 8081, "Port to listen on")
	startCmd.Flags().StringP("host", "H", "localhost", "Host to bind to")
	startCmd.Flags().BoolP("detach", "D", false, "Run server in background")
	rootCmd.AddCommand(startCmd)
}
