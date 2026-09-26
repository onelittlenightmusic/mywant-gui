package commands

import (
	"fmt"
	"math/rand"
	"os"
	"time"

	"github.com/spf13/cobra"
	"mywant-gui/client"
)

// wantsCmd groups want-card navigation commands with robot cursor support.
var wantsCmd = &cobra.Command{
	Use:   "wants",
	Short: "Navigate want cards in the GUI with robot cursor animation",
	Long: `Navigate and interact with want cards in the web dashboard.
The robot cursor animates to the target card and performs a click animation.`,
}

// wantsOpenCmd opens/selects a want card and animates the robot cursor to it.
var wantsOpenCmd = &cobra.Command{
	Use:   "open <ID>",
	Short: "Open a want card with robot cursor animation",
	Long: `Navigate to the dashboard, animate the robot cursor to the specified want card,
and open its sidebar. The robot will perform a click animation.

Examples:
  mywant gui wants open abc-123
  mywant gui wants open abc-123 --tab settings
  mywant gui wants open abc-123 --message "Let me show you this want"`,
	Args: cobra.ExactArgs(1),
	ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		c := client.New(backendURL())
		ids, err := c.ListWantIDs()
		if err != nil {
			return nil, cobra.ShellCompDirectiveNoFileComp
		}
		return ids, cobra.ShellCompDirectiveNoFileComp
	},
	Run: func(cmd *cobra.Command, args []string) {
		nameOrID := args[0]
		tab, _ := cmd.Flags().GetString("tab")
		msg, _ := cmd.Flags().GetString("message")

		c := client.New(backendURL())

		// Resolve name → ID so the robot cursor and sidebar both work
		wantID, err := c.ResolveWantID(nameOrID)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}

		if msg == "" {
			msg = fmt.Sprintf("Opening want: %s", nameOrID)
		}

		// Build robot command
		cmd2 := client.RobotCommand{
			Visible:    true,
			Message:    msg,
			TargetType: "want_card",
			TargetID:   wantID,
			Action:     "click",
			Nonce:      robotNonce(),
		}
		extra := map[string]any{
			"sidebar_open":       true,
			"sidebar_want_id":    wantID,
			"sidebar_active_tab": tab,
		}
		if err := c.SendRobotCommand(cmd2, extra); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("GUI: animating robot cursor to want card %s (tab: %s)\n", wantID, tab)
	},
}

// wantsCloseCmd closes the want sidebar with a robot animation.
var wantsCloseCmd = &cobra.Command{
	Use:   "close",
	Short: "Close the want sidebar with robot cursor animation",
	Long: `Animate the robot cursor to close the currently open want sidebar.

Examples:
  mywant gui wants close
  mywant gui wants close --message "Closing the sidebar now"`,
	Run: func(cmd *cobra.Command, args []string) {
		msg, _ := cmd.Flags().GetString("message")
		if msg == "" {
			msg = "Closing sidebar..."
		}

		c := client.New(backendURL())
		cmd2 := client.RobotCommand{
			Visible:    true,
			Message:    msg,
			TargetType: "sidebar_close",
			TargetID:   "close_btn",
			Action:     "click",
			Nonce:      robotNonce(),
		}
		extra := map[string]any{
			"sidebar_open":     false,
			"sidebar_want_id":  "",
			"expanded_want_id": "",
		}
		if err := c.SendRobotCommand(cmd2, extra); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("GUI: robot cursor closing sidebar")
	},
}

// wantsMaximizeCmd maximizes (expands) a want card to full-screen view.
var wantsMaximizeCmd = &cobra.Command{
	Use:     "maximize [ID]",
	Aliases: []string{"max"},
	Short:   "Maximize a want card to full-screen view",
	Long: `Expand a want card to the full-screen maximized view.
If no ID is given, the currently open sidebar want is maximized.
Use --collapse to return to normal card view.

Examples:
  mywant gui wants maximize abc-123
  mywant gui wants maximize choice-instance
  mywant gui wants maximize --collapse`,
	Args: cobra.MaximumNArgs(1),
	ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		c := client.New(backendURL())
		ids, err := c.ListWantIDs()
		if err != nil {
			return nil, cobra.ShellCompDirectiveNoFileComp
		}
		return ids, cobra.ShellCompDirectiveNoFileComp
	},
	Run: func(cmd *cobra.Command, args []string) {
		collapse, _ := cmd.Flags().GetBool("collapse")
		msg, _ := cmd.Flags().GetString("message")

		c := client.New(backendURL())

		// --collapse: clear expanded_want_id
		if collapse {
			if msg == "" {
				msg = "Collapsing want card..."
			}
			cmd2 := client.RobotCommand{
				Visible:    true,
				Message:    msg,
				TargetType: "none",
				TargetID:   "",
				Action:     "",
				Nonce:      robotNonce(),
			}
			extra := map[string]any{
				"expanded_want_id": "",
			}
			if err := c.SendRobotCommand(cmd2, extra); err != nil {
				fmt.Printf("Error: %v\n", err)
				os.Exit(1)
			}
			fmt.Println("GUI: want card collapsed")
			return
		}

		// Require an ID when not collapsing
		if len(args) == 0 {
			// Try to maximize the currently open sidebar want
			state, err := c.GetCurrentGUIState()
			if err != nil {
				fmt.Printf("Error: %v\n", err)
				os.Exit(1)
			}
			wantID, _ := state["sidebar_want_id"].(string)
			if wantID == "" {
				fmt.Println("Error: no want ID given and no want is currently open in the sidebar")
				os.Exit(1)
			}
			if msg == "" {
				msg = "Maximizing want card..."
			}
			cmd2 := client.RobotCommand{
				Visible:    true,
				Message:    msg,
				TargetType: "want_card",
				TargetID:   wantID,
				Action:     "click",
				Nonce:      robotNonce(),
			}
			extra := map[string]any{
				"expanded_want_id": wantID,
			}
			if err := c.SendRobotCommand(cmd2, extra); err != nil {
				fmt.Printf("Error: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("GUI: maximized want card %s\n", wantID)
			return
		}

		nameOrID := args[0]
		wantID, err := c.ResolveWantID(nameOrID)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}

		if msg == "" {
			msg = fmt.Sprintf("Maximizing want: %s", nameOrID)
		}

		cmd2 := client.RobotCommand{
			Visible:    true,
			Message:    msg,
			TargetType: "want_card",
			TargetID:   wantID,
			Action:     "click",
			Nonce:      robotNonce(),
		}
		extra := map[string]any{
			"expanded_want_id": wantID,
		}
		if err := c.SendRobotCommand(cmd2, extra); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("GUI: maximized want card %s\n", wantID)
	},
}

// wantsLatestCmd returns the ID of the most recently created want of a given type.
// Useful for test scripts that need to locate a just-deployed want.
var wantsLatestCmd = &cobra.Command{
	Use:   "latest",
	Short: "Print the ID of the most recently created want of a given type",
	Long: `Print the want ID of the most recently created want matching --type.
Exits with code 1 if no matching want is found.

Example:
  WANT_ID=$(mywant gui wants latest --type weather)
  mywant gui say "デプロイしました！" --target want_card --target-id "$WANT_ID"`,
	Args: cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		typeName, _ := cmd.Flags().GetString("type")
		c := client.New(backendURL())
		id, err := c.LatestWantByType(typeName)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		if id == "" {
			fmt.Fprintf(os.Stderr, "No want of type %q found\n", typeName)
			os.Exit(1)
		}
		fmt.Print(id)
	},
}

// robotNonce returns a unique nonce for robot commands.
func robotNonce() int64 {
	return time.Now().UnixMilli()*1000 + rand.Int63n(1000)
}

func init() {
	wantsOpenCmd.Flags().String("tab", "results", "Sidebar tab to open (settings|results|logs|agents|chat)")
	wantsOpenCmd.Flags().String("message", "", "Robot speech bubble message")
	wantsOpenCmd.RegisterFlagCompletionFunc("tab", func(_ *cobra.Command, _ []string, _ string) ([]string, cobra.ShellCompDirective) {
		return []string{"settings", "results", "logs", "agents", "chat"}, cobra.ShellCompDirectiveNoFileComp
	})

	wantsCloseCmd.Flags().String("message", "", "Robot speech bubble message")

	wantsMaximizeCmd.Flags().Bool("collapse", false, "Collapse the maximized want card back to normal view")
	wantsMaximizeCmd.Flags().String("message", "", "Robot speech bubble message")

	wantsLatestCmd.Flags().String("type", "", "Filter by want type (required)")
	wantsLatestCmd.MarkFlagRequired("type")

	wantsCmd.AddCommand(wantsOpenCmd)
	wantsCmd.AddCommand(wantsCloseCmd)
	wantsCmd.AddCommand(wantsMaximizeCmd)
	wantsCmd.AddCommand(wantsLatestCmd)
	rootCmd.AddCommand(wantsCmd)
}
