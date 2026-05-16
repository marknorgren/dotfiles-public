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
