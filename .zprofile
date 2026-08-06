# Login-shell bootstrap.

export DOTFILES="${DOTFILES:-$HOME/.dotfiles-public}"

path=(
    "$HOME/.local/bin"
    "$HOME/bin"
    "/opt/homebrew/bin"
    "/opt/homebrew/sbin"
    "/usr/local/bin"
    "/usr/local/sbin"
    "${path[@]}"
)
export PATH

[[ -f "$DOTFILES/.exports" ]] && source "$DOTFILES/.exports"

# Login and GUI shells never read .zshrc, so without this the tools mise owns
# are missing from PATH. That matters most for git-delta: .gitconfig names it
# as the global pager, and git reports "cannot run delta" when it is absent.
#
# Shim activation is PATH-only. .zshrc separately runs `mise activate zsh`,
# which adds the directory-change hook and puts the real tool paths ahead of
# these shims. Activating last keeps mise-managed runtimes ahead of any
# Homebrew copy that .exports added.
if command -v mise >/dev/null 2>&1; then
    eval "$(mise activate zsh --shims)"
fi
