# Brewfile - Homebrew Bundle Configuration
#
# This file is a dependency file for Homebrew Bundle, which allows you to:
# 1. Install multiple Homebrew packages, casks, and taps in a single command
# 2. Create reproducible macOS development environments
# 3. Share your setup with others
#
# Usage:
#   brew bundle        # Install all dependencies
#   brew bundle check  # Check if all dependencies are installed
#   brew bundle dump   # Create a Brewfile from currently-installed packages
#   brew bundle clean  # Remove all dependencies not listed in Brewfile
#   brew bundle list   # List all dependencies
#
# Options:
#   --force           # Override warnings and enable conflicting options
#   --no-upgrade      # Don't upgrade outdated dependencies
#   --verbose         # Print more details during installation
#
# See `brew bundle --help` for more options

# Install command-line tools using Homebrew
# Usage: `brew bundle`

# Taps
tap "1password/tap"
tap "hashicorp/tap"  # HashiCorp's official tap

# Core GNU utilities
brew "coreutils"
brew "moreutils"
brew "findutils"
brew "gnu-sed"
brew "bash"

# Essential tools
brew "wget"
brew "vim"
brew "grep"

# Development tools
brew "ack"
brew "git"
brew "imagemagick"
brew "lynx"
brew "nmap"
brew "p7zip"
brew "pigz"
brew "pv"
brew "rename"
brew "tree"
brew "zopfli"

# Shell and Terminal
brew "zsh"
brew "starship"  # Shell prompt
brew "fzf"  # Fuzzy finder
brew "zoxide"  # Smarter cd
brew "just"  # Command runner
brew "direnv"  # Directory-specific envs
brew "dash"  # POSIX shell

# Modern CLI Tools
brew "bat"  # Better cat
brew "eza"  # Modern ls (replacement for deprecated exa)
brew "ripgrep"  # Better grep
brew "fd"  # Better find
brew "git-delta"  # Better git diff
brew "lazygit"  # Terminal UI for git
brew "jq"  # JSON processor
brew "htop"  # Process viewer
brew "btop"  # System monitor
brew "cloc"  # Code line counter
brew "scc"  # Code counter
brew "sloc"  # Code counter
brew "terminal-notifier"  # macOS notifications

# Development Tools (Pre-Xcode)
brew "gh"  # GitHub CLI
brew "git-lfs"  # Git large file storage
brew "git-cliff"  # Changelog generator
brew "git-secrets"  # Secrets scanner
brew "gnupg"  # GNU Privacy Guard
brew "mise"  # Runtime version manager
brew "shellcheck"  # Shell script linter
brew "cmake"  # Build system
brew "watchman"  # File watcher

# Development Applications
cask "visual-studio-code"
cask "zed"
cask "sublime-text"
cask "iterm2"
cask "warp"
cask "xcodes-app"  # Install this first to manage Xcode
cask "docker-desktop"
cask "fork"
cask "proxyman"
cask "dbeaver-community"
cask "dash"

# Xcode-dependent tools
# Note: Install these after installing Xcode from the App Store
# brew "xcbeautify"  # Uncomment after Xcode installation
# brew "swiftformat"  # Uncomment after Xcode installation
# brew "swiftlint"  # Uncomment after Xcode installation
# brew "tuist"  # Uncomment after Xcode installation

# Cloud & Infrastructure
brew "awscli"  # AWS CLI
brew "aws-sam-cli"  # AWS SAM CLI
brew "tailscale"  # VPN client
brew "hashicorp/tap/terraform"  # HashiCorp's official Terraform package

# Languages and runtime tooling
brew "node"  # JavaScript runtime
brew "python@3.12"  # Python runtime
brew "go"  # Go language
brew "ruby"  # Ruby language
brew "rustup-init"  # Rust toolchain installer (preferred over direct rust installation)
brew "uv"  # Fast Python package installer

# iOS & macOS Development
brew "mint"  # Swift package manager

# Media Tools
brew "ffmpeg"  # Media processor
brew "yt-dlp"  # YouTube downloader
brew "pandoc"  # Document converter

# AI & ML Tools
brew "ollama"  # Local LLM runner

# Database Tools
brew "sqlite"  # SQLite database

# Fonts (no longer needs tap specification)
cask "font-fira-code"  # Programming font
cask "font-jetbrains-mono"  # Programming font

# Productivity & Utilities
# cask "rectangle"  # Window management
# cask "raycast"  # Spotlight replacement
cask "cleanshot"  # Screenshot tool
cask "hiddenbar"  # Menu bar manager (Open source alternative to Bartender)
cask "stats"  # System monitor (Open source alternative to iStat Menus)

# Browsers
cask "google-chrome"  # Web browser
cask "microsoft-edge"  # Web browser
cask "firefox"  # Web browser

# Only install 1Password if not already present
if !File.exist?("/Applications/1Password.app")
  cask "1password"
end
cask "1password-cli"
