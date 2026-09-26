package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"mywant-gui/client"
)

// ── Navigation commands with robot cursor ─────────────────────────────────────
// These commands navigate the web GUI to a specific page while animating
// the robot cursor to the corresponding nav item.

var agentsNavCmd = &cobra.Command{
	Use:   "agents",
	Short: "Navigate to the Agents page with robot cursor animation",
	Long: `Navigate the web GUI to the Agents page.
The robot cursor will animate to the Agents navigation item and click it.

Examples:
  mywant gui agents
  mywant gui agents --message "Let me show you the agents"`,
	Run: func(cmd *cobra.Command, args []string) {
		msg, _ := cmd.Flags().GetString("message")
		if msg == "" {
			msg = "Navigating to Agents..."
		}
		runNavigate(cmd, "/agents", "nav_agents", "nav_agents", msg)
	},
}

var typesNavCmd = &cobra.Command{
	Use:   "types",
	Short: "Navigate to the Want Types page with robot cursor animation",
	Long: `Navigate the web GUI to the Want Types page.
The robot cursor will animate to the Want Types navigation item and click it.

Examples:
  mywant gui types
  mywant gui types --message "Exploring available want types"`,
	Run: func(cmd *cobra.Command, args []string) {
		msg, _ := cmd.Flags().GetString("message")
		if msg == "" {
			msg = "Navigating to Want Types..."
		}
		runNavigate(cmd, "/want-types", "nav_types", "nav_types", msg)
	},
}

var recipesNavCmd = &cobra.Command{
	Use:   "recipes",
	Short: "Navigate to the Recipes page with robot cursor animation",
	Long: `Navigate the web GUI to the Recipes page.
The robot cursor will animate to the Recipes navigation item and click it.

Examples:
  mywant gui recipes
  mywant gui recipes --message "Let me browse the recipes"`,
	Run: func(cmd *cobra.Command, args []string) {
		msg, _ := cmd.Flags().GetString("message")
		if msg == "" {
			msg = "Navigating to Recipes..."
		}
		runNavigate(cmd, "/recipes", "nav_recipes", "nav_recipes", msg)
	},
}

var dashboardNavCmd = &cobra.Command{
	Use:   "dashboard",
	Short: "Navigate to the Wants dashboard with robot cursor animation",
	Long: `Navigate the web GUI to the main Wants dashboard.
The robot cursor will animate to the Wants navigation item and click it.

Examples:
  mywant gui dashboard
  mywant gui dashboard --message "Back to wants dashboard"`,
	Run: func(cmd *cobra.Command, args []string) {
		msg, _ := cmd.Flags().GetString("message")
		if msg == "" {
			msg = "Going to dashboard..."
		}
		runNavigate(cmd, "/dashboard", "nav_wants", "nav_wants", msg)
	},
}

// runNavigate is the shared implementation for page navigation commands.
func runNavigate(cmd *cobra.Command, route, targetType, targetID, message string) {
	c := client.New(backendURL())

	robotCmd := client.RobotCommand{
		Visible:    true,
		Message:    message,
		TargetType: targetType,
		TargetID:   targetID,
		Action:     "click",
		NavRoute:   route,
		Nonce:      robotNonce(),
	}
	extra := map[string]any{}

	if err := c.SendRobotCommand(robotCmd, extra); err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("GUI: robot cursor navigating to %s\n", route)
}

func init() {
	// Add --message flag to all nav commands
	for _, navCmd := range []*cobra.Command{agentsNavCmd, typesNavCmd, recipesNavCmd, dashboardNavCmd} {
		navCmd.Flags().String("message", "", "Robot speech bubble message")
	}

	rootCmd.AddCommand(agentsNavCmd)
	rootCmd.AddCommand(typesNavCmd)
	rootCmd.AddCommand(recipesNavCmd)
	rootCmd.AddCommand(dashboardNavCmd)
}
