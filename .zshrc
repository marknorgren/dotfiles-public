# Interactive zsh configuration.

export DOTFILES="${DOTFILES:-$HOME/.dotfiles-public}"

[[ -f "$DOTFILES/.exports" ]] && source "$DOTFILES/.exports"
[[ -f "$DOTFILES/.aliases" ]] && source "$DOTFILES/.aliases"
[[ -f "$DOTFILES/.functions" ]] && source "$DOTFILES/.functions"

if command -v starship >/dev/null 2>&1; then
    eval "$(starship init zsh)"
fi

if command -v zoxide >/dev/null 2>&1; then
    eval "$(zoxide init zsh)"
fi

if command -v mise >/dev/null 2>&1; then
    eval "$(mise activate zsh)"
fi

for local_file in "$DOTFILES"/local/*.sh(N); do
    [[ -f "$local_file" ]] && source "$local_file"
done
unset local_file
