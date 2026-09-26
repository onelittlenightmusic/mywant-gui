.PHONY: build build-web install uninstall install-skills uninstall-skills gui-restart

# Install destination (override with: make install INSTALL_DIR=/usr/local/bin)
INSTALL_DIR ?= $(HOME)/.local/bin

# Build version reported by `mywant-gui version` and /api/v1/gui-version.
# Release builds get this from goreleaser; locally it comes from the git tag.
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

# Claude skills install destination
SKILLS_DIR ?= $(HOME)/.claude/skills

# Output directory for the built binary
OUT_DIR ?= ./bin

build-web:
	@echo "📦 Building mywant-gui frontend assets..."
	cd web && npm install && npm run build

build: build-web
	@echo "🔨 Building mywant-gui binary..."
	@mkdir -p $(OUT_DIR)
	go build -ldflags "-X main.version=$(VERSION)" -o $(OUT_DIR)/mywant-gui ./cmd/mywant-gui
	@echo "✅ Built: $(OUT_DIR)/mywant-gui"

install: build
	@echo "📦 Installing mywant-gui to $(INSTALL_DIR)..."
	@mkdir -p $(INSTALL_DIR)
	@cp $(OUT_DIR)/mywant-gui $(INSTALL_DIR)/mywant-gui
	@codesign --sign - --force $(INSTALL_DIR)/mywant-gui 2>/dev/null || true
	@echo "✅ Installed: $(INSTALL_DIR)/mywant-gui"

gui-restart: install
	@echo "🔄 Restarting mywant-gui..."
	@mywant gui stop || true
	@mywant gui start -D -H 0.0.0.0
	@echo "✅ mywant-gui restarted"

uninstall:
	@echo "🗑️  Uninstalling mywant-gui from $(INSTALL_DIR)..."
	@rm -f $(INSTALL_DIR)/mywant-gui
	@echo "✅ Uninstalled: mywant-gui"

install-skills:
	@echo "🔗 Installing Claude skills from ./skills/ → $(SKILLS_DIR)/"
	@mkdir -p $(SKILLS_DIR)
	@for skill in skills/*/; do \
		name=$$(basename $$skill); \
		target=$(SKILLS_DIR)/$$name; \
		src=$$(pwd)/$$skill; \
		if [ -L "$$target" ]; then \
			echo "  ↻ $$name (already linked, updating)"; \
			ln -sfn "$$src" "$$target"; \
		elif [ -e "$$target" ]; then \
			echo "  ⚠️  $$name already exists at $$target (not a symlink, skipping)"; \
		else \
			ln -s "$$src" "$$target"; \
			echo "  ✅ $$name → $$target"; \
		fi \
	done

uninstall-skills:
	@echo "🗑️  Removing Claude skill symlinks from $(SKILLS_DIR)/"
	@for skill in skills/*/; do \
		name=$$(basename $$skill); \
		target=$(SKILLS_DIR)/$$name; \
		if [ -L "$$target" ]; then \
			rm "$$target"; \
			echo "  ✅ Removed: $$name"; \
		else \
			echo "  — $$name not installed, skipping"; \
		fi \
	done
