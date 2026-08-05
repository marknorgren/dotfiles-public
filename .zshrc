# Interactive zsh configuration.

export DOTFILES="${DOTFILES:-$HOME/.dotfiles-public}"

[[ -f "$DOTFILES/.exports" ]] && source "$DOTFILES/.exports"
[[ -f "$DOTFILES/.aliases" ]] && source "$DOTFILES/.aliases"
[[ -f "$DOTFILES/.functions" ]] && source "$DOTFILES/.functions"

# Cache each `<tool> init zsh` result under ~/.cache/zsh and zcompile it, so a
# new shell sources a compiled file instead of forking the tool. The cache is
# regenerated whenever the tool binary is newer than the cached output.
_zsh_cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/zsh"
[[ -d "$_zsh_cache_dir" ]] || mkdir -p "$_zsh_cache_dir"

_zsh_cache_init() {
    local name="$1" bin="$2"
    shift 2
    [[ -n "$bin" && -x "$bin" ]] || return 1
    local cache="$_zsh_cache_dir/${name}.zsh"
    if [[ ! -s "$cache" || "$bin" -nt "$cache" ]]; then
        "$bin" "$@" >| "$cache" 2>/dev/null || { rm -f "$cache"; return 1; }
    fi
    if [[ ! -s "${cache}.zwc" || "$cache" -nt "${cache}.zwc" ]]; then
        zcompile -R "${cache}.zwc" "$cache" 2>/dev/null || true
    fi
    source "$cache"
}

# starship stats the working directory for git state. On a network volume those
# calls can stall the prompt for seconds, so use a plain prompt there instead.
if [[ "$PWD" == /Volumes/* ]]; then
    PROMPT='%F{blue}%~%f > '
else
    _zsh_cache_init starship "$(command -v starship)" init zsh
fi

_zsh_cache_init zoxide "$(command -v zoxide)" init zsh
_zsh_cache_init mise "$(command -v mise)" activate zsh

for local_file in "$DOTFILES"/local/*.sh(N); do
    [[ -f "$local_file" ]] && source "$local_file"
done
unset local_file

# Collapse duplicate PATH entries added by the tool inits above.
typeset -U path PATH
export PATH
