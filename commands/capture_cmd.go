package commands

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"mywant-gui/client"
)

var captureCmd = &cobra.Command{
	Use:   "capture",
	Short: "Capture GUI screenshots of want cards",
}

var captureWantCmd = &cobra.Command{
	Use:   "want <ID>",
	Short: "Screenshot a want card (sidebar by default, --max for maximized view)",
	Long: `Open a want card in the GUI and save a screenshot as PNG.
By default captures the sidebar panel. Use --max to capture the full-screen
maximized view instead.

Examples:
  mywant-gui capture want abc-123
  mywant-gui capture want abc-123 --max
  mywant-gui capture want my-want --output ~/Desktop/want.png
  mywant-gui capture want abc-123 --max --output card_max.png --wait 2000`,
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
		max, _ := cmd.Flags().GetBool("max")
		output, _ := cmd.Flags().GetString("output")
		waitMS, _ := cmd.Flags().GetInt("wait")

		c := client.New(backendURL())
		wantID, err := c.ResolveWantID(nameOrID)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}

		// For --max, set expanded_want_id in GUI state so the overlay renders
		if max {
			if err := c.UpdateGUIState(map[string]any{
				"source":           "cli",
				"expanded_want_id": wantID,
				"sidebar_open":     false,
				"sidebar_want_id":  "",
			}); err != nil {
				fmt.Printf("Error setting GUI state: %v\n", err)
				os.Exit(1)
			}
		}

		// Resolve output path
		if output == "" {
			if max {
				output = nameOrID + "_max.png"
			} else {
				output = nameOrID + ".png"
			}
		}
		if !filepath.IsAbs(output) {
			cwd, _ := os.Getwd()
			output = filepath.Join(cwd, output)
		}

		// Selector: grid card for default, maximized overlay for --max
		var selector string
		if max {
			selector = `[data-maximized-want-id="` + wantID + `"]`
		} else {
			selector = `[data-want-id="` + wantID + `"]`
		}

		// Launch headless Chrome and take screenshot
		fmt.Printf("Capturing %s → %s\n", wantID, output)
		if err := screenshotElement(guiBaseURL(), selector, time.Duration(waitMS)*time.Millisecond, output); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Saved: %s\n", output)
	},
}

// captureTimeout is how long a capture may take, its extra wait aside.
const captureTimeout = 60 * time.Second

// screenshotElement navigates to url in a headless Chrome, waits for selector,
// then saves a screenshot of that element to outputPath.
func screenshotElement(url, selector string, extraWait time.Duration, outputPath string) error {
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.WindowSize(1440, 900),
	)

	// The Chrome launched here never outlives the capture. Left running, a
	// headless Chrome is still Chrome to macOS, and links opened anywhere on
	// the Mac (open, an app's "open in the browser") went to it and were never
	// seen. So: a time it may take at most — a selector that never shows no
	// longer waits forever — and Ctrl-C or a kill from whatever ran us cancels
	// the run, which closes Chrome, rather than ending us with it still up.
	base, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM, syscall.SIGHUP)
	defer stop()
	base, cancelTimeout := context.WithTimeout(base, captureTimeout+extraWait)
	defer cancelTimeout()

	fmt.Println("  [1/5] Launching headless Chrome...")
	allocCtx, cancelAlloc := chromedp.NewExecAllocator(base, opts...)
	defer cancelAlloc()

	ctx, cancelCtx := chromedp.NewContext(allocCtx)
	defer cancelCtx()

	// Force Chrome to start now so we can report when it's ready
	if err := chromedp.Run(ctx); err != nil {
		return fmt.Errorf("chrome launch failed: %w", err)
	}
	fmt.Println("  [2/5] Chrome ready, navigating to", url)

	var buf []byte
	if err := chromedp.Run(ctx,
		chromedp.Navigate(url),
		chromedp.ActionFunc(func(_ context.Context) error {
			fmt.Println("  [3/5] Page loaded, waiting for element...")
			return nil
		}),
		chromedp.WaitVisible(selector, chromedp.ByQuery),
		chromedp.ActionFunc(func(_ context.Context) error {
			fmt.Printf("  [4/5] Element visible, waiting %v for animations...\n", extraWait)
			return nil
		}),
		chromedp.Sleep(extraWait),
		chromedp.ActionFunc(func(_ context.Context) error {
			fmt.Println("  [5/5] Taking screenshot...")
			return nil
		}),
		chromedp.Screenshot(selector, &buf, chromedp.NodeVisible, chromedp.ByQuery),
	); err != nil {
		return fmt.Errorf("screenshot failed: %w", err)
	}
	return os.WriteFile(outputPath, buf, 0644)
}

// guiBaseURL returns the base URL of the mywant-gui web server.
func guiBaseURL() string {
	port := viper.GetInt("gui_port")
	host := viper.GetString("gui_host")
	if host == "" {
		host = "localhost"
	}
	return fmt.Sprintf("http://%s:%d", host, port)
}

func init() {
	captureWantCmd.Flags().Bool("max", false, "Capture the maximized (full-screen) card view")
	captureWantCmd.Flags().String("output", "", "Output PNG file path (default: <id>.png or <id>_max.png)")
	captureWantCmd.Flags().Int("wait", 1500, "Extra wait time in ms after element appears (for animations)")

	captureCmd.AddCommand(captureWantCmd)
	rootCmd.AddCommand(captureCmd)
}
