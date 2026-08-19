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
brew "neovim"  # Modern Vim (system /usr/bin/vim remains as fallback)
brew "grep"

# Development tools
brew "git"
brew "imagemagick"
brew "nmap"
brew "pigz"
brew "pv"
brew "sevenzip"  # Official 7-Zip (p7zip is a fork frozen at the 2016 sources)
brew "tree"

# Shell and Terminal
brew "zsh"
brew "starship"  # Shell prompt
brew "zoxide"  # Smarter cd
brew "just"  # Command runner
brew "direnv"  # Directory-specific envs
brew "dash"  # POSIX shell
brew "zsh-autosuggestions"  # Suggest completions from history
brew "zsh-syntax-highlighting"  # Highlight the command line as you type
cask "warp"  # Default terminal used by the linked editor and shell settings

# Modern CLI Tools
brew "bat"  # Better cat
brew "eza"  # Modern ls (replacement for deprecated exa)
brew "ripgrep"  # Better grep
brew "fd"  # Better find
brew "lazygit"  # Terminal UI for git
brew "jq"  # JSON processor
brew "yq"  # YAML/XML processor, jq's counterpart
brew "btop"  # System monitor (supersedes htop)
brew "scc"  # Code counter (supersedes cloc/sloc)
brew "hyperfine"  # Command-line benchmarking with warmup and stats
brew "terminal-notifier"  # macOS notifications

# Development Tools (Pre-Xcode)
brew "gh"  # GitHub CLI
brew "git-lfs"  # Git large file storage
brew "git-cliff"  # Changelog generator
brew "gitleaks"  # Secrets scanner, backs `just public-scan` (supersedes git-secrets)
brew "gnupg"  # GNU Privacy Guard
brew "mise"  # Runtime version manager
brew "shellcheck"  # Shell script linter
brew "cmake"  # Build system
brew "mas"  # Mac App Store CLI, lets brew bundle cover App Store installs

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
# Runtime versions, git-delta, fzf, and shfmt are managed by mise
# (see .tool-versions), not Homebrew, so versions pin per-project and match each
# repo's packageManager. A second brew copy of a runtime would shadow the mise
# shim on PATH, so only toolchain installers and Go live here.
brew "go"  # Go language
brew "rustup-init"  # Rust toolchain installer (preferred over direct rust installation)
brew "uv"  # Fast Python package installer and virtualenv manager

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

# 1Password CLI is required for secret-backed setup. Other GUI apps and fonts
# live in Brewfile.apps so the default bootstrap has a smaller disk footprint.
cask "1password-cli"
