package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"
)

var stopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop the GUI server",
	Run: func(cmd *cobra.Command, args []string) {
		port, _ := cmd.Flags().GetInt("port")

		pidPath := filepath.Join(myWantDir(), "gui.pid")
		data, err := os.ReadFile(pidPath)
		if err != nil {
			// PID ファイルがない場合はプロセス名で探してkill
			_ = killByName()
		} else {
			pid, err := strconv.Atoi(string(data))
			if err == nil {
				process, err := os.FindProcess(pid)
				if err == nil {
					fmt.Printf("Stopping mywant-gui (PID: %d)...\n", pid)
					process.Signal(syscall.SIGTERM)

					graceful := waitForDead(process, 5*time.Second)
					if graceful {
						fmt.Println("Done.")
					} else {
						fmt.Println("Timeout — sending SIGKILL...")
						process.Kill()
						waitForDead(process, 2*time.Second)
						fmt.Println("Done.")
					}
				}
			}
			os.Remove(pidPath)

			// Sweep for orphaned processes that slipped past the PID file.
			_ = killByName()
		}

		// Final safety net: kill anything still holding the port (same as mywant stop).
		fmt.Printf("Ensuring port %d is free...\n", port)
		if killed := killProcessOnPort(port); killed {
			fmt.Printf("Terminated lingering process on port %d.\n", port)
		}
	},
}

// waitForDead polls until the process exits or the timeout elapses.
// Returns true if the process died within the timeout.
func waitForDead(process *os.Process, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		time.Sleep(100 * time.Millisecond)
		if err := process.Signal(syscall.Signal(0)); err != nil {
			return true // process is gone
		}
	}
	return false
}

// killProcessOnPort finds and kills any process listening on port (lsof-based, same as mywant stop).
func killProcessOnPort(port int) bool {
	out, err := exec.Command("lsof", "-t", fmt.Sprintf("-i:%d", port), "-sTCP:LISTEN").Output()
	if err != nil || len(strings.TrimSpace(string(out))) == 0 {
		return false
	}
	killedAny := false
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		pid, err := strconv.Atoi(strings.TrimSpace(line))
		if err != nil || pid == os.Getpid() {
			continue
		}
		p, err := os.FindProcess(pid)
		if err != nil {
			continue
		}
		fmt.Printf("Stopping process on port %d (PID: %d)...\n", port, pid)
		p.Signal(syscall.SIGTERM)
		if !waitForDead(p, 3*time.Second) {
			p.Kill()
			waitForDead(p, 2*time.Second)
		}
		killedAny = true
	}
	return killedAny
}

// killByName kills all running mywant-gui processes by name (fallback when no PID file).
func killByName() error {
	out, err := exec.Command("pgrep", "-f", "mywant-gui start").Output()
	if err != nil || len(strings.TrimSpace(string(out))) == 0 {
		return fmt.Errorf("not found")
	}
	killed := 0
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		pid, err := strconv.Atoi(strings.TrimSpace(line))
		if err != nil {
			continue
		}
		p, err := os.FindProcess(pid)
		if err != nil {
			continue
		}
		fmt.Printf("Stopping mywant-gui (PID: %d, found by name)...\n", pid)
		p.Signal(syscall.SIGTERM)
		waitForDead(p, 5*time.Second)
		killed++
	}
	if killed == 0 {
		return fmt.Errorf("not found")
	}
	fmt.Println("Done.")
	return nil
}

func init() {
	stopCmd.Flags().IntP("port", "p", 8081, "Port the GUI server is listening on")
	rootCmd.AddCommand(stopCmd)
}
