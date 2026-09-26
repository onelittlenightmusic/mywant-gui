package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"mywant-gui/client"
)

// formCmd is the parent command for Add Want form automation.
var formCmd = &cobra.Command{
	Use:   "form",
	Short: "Control the Add Want form programmatically",
}

// formOpenCmd opens the Add Want form (type-selection view).
var formOpenCmd = &cobra.Command{
	Use:   "open",
	Short: "Open the Add Want form (type-selection view)",
	Long: `Open the Add Want form. The form will show the inventory/type picker.
Combine with 'mywant gui say --target add_want_btn' for robot cursor animation.

Example:
  mywant gui say "フォームを開きます" --target add_want_btn --action click
  sleep 0.8
  mywant gui form open`,
	Args: cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		c := client.New(backendURL())
		if err := c.UpdateGUIState(map[string]any{
			"add_form_open": true,
			"add_form_type": "",
		}); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Form opened.")
	},
}

// formSelectCmd selects a want type in the currently open form.
var formSelectCmd = &cobra.Command{
	Use:   "select <type>",
	Short: "Select a want type in the open Add Want form",
	Long: `Select a want type in the open Add Want form (moves to params view).
Combine with 'mywant gui say --target want_type_card --target-id <type>' for robot animation.

Example:
  mywant gui say "weatherを選択します" --target want_type_card --target-id weather --action click
  sleep 0.8
  mywant gui form select weather`,
	Args: cobra.ExactArgs(1),
	ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		c := client.New(backendURL())
		ids, err := c.ListWantTypeIDs()
		if err != nil {
			return nil, cobra.ShellCompDirectiveNoFileComp
		}
		return ids, cobra.ShellCompDirectiveNoFileComp
	},
	Run: func(cmd *cobra.Command, args []string) {
		typeID := args[0]
		c := client.New(backendURL())
		if err := c.UpdateGUIState(map[string]any{
			"add_form_type": typeID,
		}); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Type %q selected.\n", typeID)
	},
}

// formSuggestDeployCmd moves the robot cursor to the Deploy button and
// asks the user to click it. Deploy itself is intentionally left to the
// human — it is a non-idempotent action that should not be triggered
// programmatically.
var formSuggestDeployCmd = &cobra.Command{
	Use:   "suggest-deploy",
	Short: "Point robot cursor at Deploy button and ask user to click",
	Long: `Point the robot cursor at the Deploy button and display a prompt asking
the user to click it. The deploy action itself is NOT triggered automatically —
that requires a human gesture to prevent accidental duplicate deployments.

Example:
  mywant gui say "設定を確認してください" --target form_deploy_btn
  sleep 1.5
  mywant gui form suggest-deploy`,
	Args: cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		c := client.New(backendURL())
		robotCmd := client.RobotCommand{
			Visible:    true,
			Message:    "デプロイボタンを押してください 👆",
			TargetType: "form_deploy_btn",
			TargetID:   "",
			Action:     "none",
			Nonce:      robotNonce(),
		}
		if err := c.SendRobotCommand(robotCmd, nil); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Suggested deploy — waiting for user to click.")
	},
}

func init() {
	formCmd.AddCommand(formOpenCmd)
	formCmd.AddCommand(formSelectCmd)
	formCmd.AddCommand(formSuggestDeployCmd)
	rootCmd.AddCommand(formCmd)
}
