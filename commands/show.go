package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"mywant-gui/client"
)

var showCmd = &cobra.Command{
	Use:   "show",
	Short: "Navigate the web GUI to a specific view",
}

var showWantCmd = &cobra.Command{
	Use:   "want <ID>",
	Short: "Open the sidebar for a specific want",
	Args:  cobra.ExactArgs(1),
	ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		c := client.New(backendURL())
		ids, err := c.ListWantIDs()
		if err != nil {
			return nil, cobra.ShellCompDirectiveNoFileComp
		}
		return ids, cobra.ShellCompDirectiveNoFileComp
	},
	Run: func(cmd *cobra.Command, args []string) {
		wantID := args[0]
		tab, _ := cmd.Flags().GetString("tab")
		filter, _ := cmd.Flags().GetString("filter")
		search, _ := cmd.Flags().GetString("search")

		c := client.New(backendURL())
		if err := c.ShowWant(wantID, tab, filter, search); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("GUI: opened sidebar for want %s (tab: %s)\n", wantID, tab)
	},
}

var showGlobalCmd = &cobra.Command{
	Use:   "global",
	Short: "Open the Global sidebar with robot cursor animation",
	Long: `Animate the robot cursor to the Global button in the header and open the
Global sidebar. When --param is given, the robot then moves to that parameter
card and highlights it.

Examples:
  mywant gui show global
  mywant gui show global --param otp_data_dir
  mywant gui show global --param otp_data_dir --message "このパラメータを確認しましょう"`,
	Args: cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		paramKey, _ := cmd.Flags().GetString("param")
		msg, _ := cmd.Flags().GetString("message")

		if msg == "" {
			if paramKey != "" {
				msg = fmt.Sprintf("Global parameter: %s", paramKey)
			} else {
				msg = "Opening Global sidebar..."
			}
		}

		c := client.New(backendURL())

		extra := map[string]any{
			"open_global_sidebar":    true,
			"focus_global_param_key": paramKey,
		}

		var robotCmd client.RobotCommand
		if paramKey != "" {
			// Target the param card directly — same pattern as params_cmd.go.
			// The 300 ms retry in RobotCursor handles the sidebar-not-yet-open case.
			robotCmd = client.RobotCommand{
				Visible:    true,
				Message:    msg,
				TargetType: "global_param_card",
				TargetID:   paramKey,
				Action:     "hover",
				Nonce:      robotNonce(),
			}
		} else {
			// No specific card — point at the Global header button
			robotCmd = client.RobotCommand{
				Visible:    true,
				Message:    msg,
				TargetType: "header_btn",
				TargetID:   "memo",
				Action:     "click",
				Nonce:      robotNonce(),
			}
		}

		if err := c.SendRobotCommand(robotCmd, extra); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}

		if paramKey != "" {
			fmt.Printf("GUI: opening Global sidebar → param card %q\n", paramKey)
		} else {
			fmt.Println("GUI: opening Global sidebar")
		}
	},
}

var showDashboardCmd = &cobra.Command{
	Use:   "dashboard",
	Short: "Navigate to the dashboard (close sidebar)",
	Run: func(cmd *cobra.Command, args []string) {
		filter, _ := cmd.Flags().GetString("filter")
		search, _ := cmd.Flags().GetString("search")

		c := client.New(backendURL())
		if err := c.ShowDashboard(filter, search); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		msg := "GUI: navigated to dashboard"
		if filter != "" {
			msg += fmt.Sprintf(" (filter: %s)", filter)
		}
		if search != "" {
			msg += fmt.Sprintf(" (search: %q)", search)
		}
		fmt.Println(msg)
	},
}

var getCmd = &cobra.Command{
	Use:   "get",
	Short: "Show the current GUI state",
	Run: func(cmd *cobra.Command, args []string) {
		c := client.New(backendURL())
		snap, err := c.GetGUIState()
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}

		cur := snap.State // flat map returned by the server
		if cur == nil {
			cur = map[string]any{}
		}
		fmt.Printf("Source:                  %v\n", cur["source"])
		fmt.Printf("Dashboard status filter: %v\n", cur["dashboard_status_filter"])
		fmt.Printf("Dashboard search query:  %v\n", cur["dashboard_search_query"])
		fmt.Printf("Sidebar open:            %v\n", cur["sidebar_open"])
		fmt.Printf("Sidebar want ID:         %v\n", cur["sidebar_want_id"])
		fmt.Printf("Sidebar active tab:      %v\n", cur["sidebar_active_tab"])
		if v, ok := cur["robot_visible"]; ok && v != false {
			fmt.Printf("Robot visible:           %v\n", v)
			fmt.Printf("Robot message:           %v\n", cur["robot_message"])
			fmt.Printf("Robot target:            %v / %v\n", cur["robot_target_type"], cur["robot_target_id"])
		}
	},
}

func init() {
	showWantCmd.Flags().String("tab", "results", "Sidebar tab (settings|results|logs|agents|versions|chat)")
	showWantCmd.Flags().String("filter", "", "Dashboard status filter")
	showWantCmd.Flags().String("search", "", "Dashboard search query")
	showWantCmd.RegisterFlagCompletionFunc("tab", func(_ *cobra.Command, _ []string, _ string) ([]string, cobra.ShellCompDirective) {
		return []string{"settings", "results", "logs", "agents", "versions", "chat"}, cobra.ShellCompDirectiveNoFileComp
	})

	showDashboardCmd.Flags().String("filter", "", "Status filter (e.g. reaching, stopped, achieved)")
	showDashboardCmd.Flags().String("search", "", "Search query")

	showGlobalCmd.Flags().String("param", "", "Param key to highlight in the Global sidebar")
	showGlobalCmd.Flags().String("message", "", "Robot speech bubble message")

	showCmd.AddCommand(showWantCmd)
	showCmd.AddCommand(showDashboardCmd)
	showCmd.AddCommand(showGlobalCmd)
	rootCmd.AddCommand(showCmd)
	rootCmd.AddCommand(getCmd)
}
