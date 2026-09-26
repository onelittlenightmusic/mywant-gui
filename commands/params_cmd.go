package commands

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"mywant-gui/client"
)

// paramsCmd groups want parameter inspection/modification commands.
var paramsCmd = &cobra.Command{
	Use:   "params",
	Short: "Inspect or modify want parameters with robot cursor animation",
	Long: `Inspect or set parameters in a want's settings tab.
The robot cursor will navigate to the settings tab and highlight the specified parameter field.

The --want flag specifies the want ID. If omitted, operates on the currently open sidebar want.

Examples:
  mywant gui params show temperature --want abc-123
  mywant gui params set temperature 0.8 --want abc-123
  mywant gui params show interval_seconds`,
}

var paramsShowCmd = &cobra.Command{
	Use:   "show <key>",
	Short: "Navigate to settings and highlight a parameter field",
	Long: `Open the want's settings tab and animate the robot cursor to the specified parameter field.

Examples:
  mywant gui params show temperature --want abc-123
  mywant gui params show interval_seconds --message "This controls the polling rate"`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		paramKey := strings.TrimPrefix(args[0], "params.")
		wantID, _ := cmd.Flags().GetString("want")
		msg, _ := cmd.Flags().GetString("message")
		if msg == "" {
			msg = fmt.Sprintf("Parameter: %s", paramKey)
		}

		c := client.New(backendURL())

		// Resolve want ID from current GUI state if not specified
		if wantID == "" {
			var err error
			wantID, err = getCurrentSidebarWant(c)
			if err != nil || wantID == "" {
				fmt.Println("Error: --want <ID> is required when no want is open in the sidebar")
				os.Exit(1)
			}
		}

		robotCmd := client.RobotCommand{
			Visible:    true,
			Message:    msg,
			TargetType: "param_field",
			TargetID:   paramKey,
			Action:     "hover",
			Nonce:      robotNonce(),
		}
		extra := map[string]any{
			"sidebar_open":             true,
			"sidebar_want_id":          wantID,
			"sidebar_active_tab":       "settings",
			"sidebar_settings_subtab":  "params",
		}

		if err := c.SendRobotCommand(robotCmd, extra); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("GUI: robot highlighting param %q on want %s\n", paramKey, wantID)
	},
}

var paramsSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a want parameter value with robot cursor animation",
	Long: `Open the want's settings tab, animate the robot cursor to the specified parameter field,
and update the parameter value via the API.

Examples:
  mywant gui params set temperature 0.8 --want abc-123
  mywant gui params set interval_seconds 30 --want abc-123 --message "Updating polling rate"`,
	Args: cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		paramKey := strings.TrimPrefix(args[0], "params.")
		paramValue := args[1]
		wantID, _ := cmd.Flags().GetString("want")
		msg, _ := cmd.Flags().GetString("message")
		if msg == "" {
			msg = fmt.Sprintf("Setting %s = %s", paramKey, paramValue)
		}

		c := client.New(backendURL())

		// Resolve want ID from current GUI state if not specified
		if wantID == "" {
			var err error
			wantID, err = getCurrentSidebarWant(c)
			if err != nil || wantID == "" {
				fmt.Println("Error: --want <ID> is required when no want is open in the sidebar")
				os.Exit(1)
			}
		}

		// 1. Update the want's parameter via API
		if err := c.UpdateWantParam(wantID, paramKey, parseParamValue(paramValue)); err != nil {
			fmt.Printf("Error updating param: %v\n", err)
			os.Exit(1)
		}

		// 2. Send robot cursor animation to highlight the updated field
		robotCmd := client.RobotCommand{
			Visible:       true,
			Message:       msg,
			TargetType:    "param_field",
			TargetID:      paramKey,
			Action:        "type",
			ActionPayload: paramValue,
			Nonce:         robotNonce(),
		}
		extra := map[string]any{
			"sidebar_open":            true,
			"sidebar_want_id":         wantID,
			"sidebar_active_tab":      "settings",
			"sidebar_settings_subtab": "params",
		}

		if err := c.SendRobotCommand(robotCmd, extra); err != nil {
			fmt.Printf("Error sending robot command: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("GUI: set param %q = %q on want %s\n", paramKey, paramValue, wantID)
	},
}

// getCurrentSidebarWant fetches the current sidebar want ID from GUI state.
func getCurrentSidebarWant(c *client.Client) (string, error) {
	state, err := c.GetCurrentGUIState()
	if err != nil {
		return "", err
	}
	id, _ := state["sidebar_want_id"].(string)
	return id, nil
}

// parseParamValue attempts to parse the string value as a number or bool,
// falling back to string if neither matches.
func parseParamValue(s string) any {
	// Try bool
	if s == "true" {
		return true
	}
	if s == "false" {
		return false
	}
	// Try int
	var i int64
	if _, err := fmt.Sscanf(s, "%d", &i); err == nil && fmt.Sprintf("%d", i) == s {
		return i
	}
	// Try float
	var f float64
	if _, err := fmt.Sscanf(s, "%f", &f); err == nil {
		return f
	}
	// Default: string
	return s
}

func init() {
	paramsShowCmd.Flags().String("want", "", "Want ID (defaults to currently open sidebar want)")
	paramsShowCmd.Flags().String("message", "", "Robot speech bubble message")
	paramsShowCmd.RegisterFlagCompletionFunc("want", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		c := client.New(backendURL())
		ids, err := c.ListWantIDs()
		if err != nil {
			return nil, cobra.ShellCompDirectiveNoFileComp
		}
		return ids, cobra.ShellCompDirectiveNoFileComp
	})

	paramsSetCmd.Flags().String("want", "", "Want ID (defaults to currently open sidebar want)")
	paramsSetCmd.Flags().String("message", "", "Robot speech bubble message")
	paramsSetCmd.RegisterFlagCompletionFunc("want", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		c := client.New(backendURL())
		ids, err := c.ListWantIDs()
		if err != nil {
			return nil, cobra.ShellCompDirectiveNoFileComp
		}
		return ids, cobra.ShellCompDirectiveNoFileComp
	})

	paramsCmd.AddCommand(paramsShowCmd)
	paramsCmd.AddCommand(paramsSetCmd)
	rootCmd.AddCommand(paramsCmd)
}
