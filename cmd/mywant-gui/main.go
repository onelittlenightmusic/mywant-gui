package main

import "mywant-gui/commands"

var version = "dev"

func main() {
	commands.SetVersion(version)
	commands.Execute()
}
