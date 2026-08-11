# Interactive zsh configuration.

export DOTFILES="${DOTFILES:-$HOME/.dotfiles-public}"

[[ -f "$DOTFILES/.exports" ]] && source "$DOTFILES/.exports"
[[ -f "$DOTFILES/.aliases" ]] && source "$DOTFILES/.aliases"
[[ -f "$DOTFILES/.functions" ]] && source "$DOTFILES/.functions"

# Cache each `<tool> init zsh` result under ~/.cache/zsh and zcompile it, so a
# new shell sources a compiled file instead of forking the tool. The cache is
# regenerated whenever the tool binary is newer than the cached output.
_zsh_cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/zsh"
[[ -d "$_zsh_cache_dir" ]] || mkdir -p "$_zsh_cache_dir" 2>/dev/null

_zsh_cache_init() {
    local name="$1" bin="$2"
    shift 2
    [[ -n "$bin" && -x "$bin" ]] || return 1
    if [[ ! -d "$_zsh_cache_dir" || ! -w "$_zsh_cache_dir" ]]; then
        eval "$("$bin" "$@" 2>/dev/null)"
        return
    fi
    local cache="$_zsh_cache_dir/${name}.zsh"
    if [[ ! -s "$cache" || "$bin" -nt "$cache" ]]; then
        local cache_tmp="${cache}.tmp.$$.$RANDOM"
        if "$bin" "$@" >| "$cache_tmp" 2>/dev/null && [[ -s "$cache_tmp" ]]; then
            command mv -f "$cache_tmp" "$cache"
        else
            command rm -f "$cache_tmp"
            return 1
        fi
    fi
    if [[ ! -s "${cache}.zwc" || "$cache" -nt "${cache}.zwc" ]]; then
        local compiled_tmp="${cache}.tmp.$$.$RANDOM.zwc"
        if zcompile -R "$compiled_tmp" "$cache" 2>/dev/null; then
            command mv -f "$compiled_tmp" "${cache}.zwc"
        else
            command rm -f "$compiled_tmp"
        fi
    fi
    source "$cache"
}

# Starship stats the working directory for git state. On a network volume those
# calls can stall the prompt for seconds, so select a plain prompt before each
# prompt is rendered. This follows directory changes during a shell session.
_zsh_plain_prompt='%F{blue}%~%f > '
if _zsh_cache_init starship "$(command -v starship)" init zsh; then
    _zsh_starship_prompt="$PROMPT"
    _zsh_starship_rprompt="$RPROMPT"

    _zsh_select_prompt() {
        if [[ "$PWD" == /Volumes/* ]]; then
            PROMPT="$_zsh_plain_prompt"
            RPROMPT=''
        else
            PROMPT="$_zsh_starship_prompt"
            RPROMPT="$_zsh_starship_rprompt"
        fi
    }

    autoload -Uz add-zsh-hook
    add-zsh-hook precmd _zsh_select_prompt
    _zsh_select_prompt
else
    PROMPT="$_zsh_plain_prompt"
fi

_zsh_cache_init zoxide "$(command -v zoxide)" init zsh
_zsh_cache_init mise "$(command -v mise)" activate zsh

# Line-editor setup only matters when a terminal is driving the line editor.
# In a script-driven `zsh -i -c ...` it costs startup time for nothing, and
# fzf's option save/restore prints "can't change option: zle" with no terminal
# attached.
if [[ -o interactive && -t 0 ]]; then
    _zsh_line_editor=1
fi

# `fzf --zsh` emits both the key bindings and the completion setup.
if (( ${_zsh_line_editor:-0} )); then
    _zsh_cache_init fzf "$(command -v fzf)" --zsh
fi

for local_file in "$DOTFILES"/local/*.sh(N); do
    [[ -f "$local_file" ]] && source "$local_file"
done
unset local_file

# Line-editor plugins: Homebrew on macOS, distro packages on Linux.
_zsh_source_plugin() {
    local name="$1" file
    for file in \
        "${HOMEBREW_PREFIX:-/opt/homebrew}/share/$name/$name.zsh" \
        "/usr/local/share/$name/$name.zsh" \
        "/usr/share/$name/$name.zsh" \
        "/usr/share/zsh/plugins/$name/$name.zsh"; do
        if [[ -r "$file" ]]; then
            source "$file"
            return 0
        fi
    done
    return 1
}

if (( ${_zsh_line_editor:-0} )); then
    _zsh_source_plugin zsh-autosuggestions
    # Must be sourced last. It wraps the line editor and only highlights
    # widgets that already exist when it loads.
    _zsh_source_plugin zsh-syntax-highlighting
fi
unset _zsh_line_editor

# Collapse duplicate PATH entries added by the tool inits above.
typeset -U path PATH
export PATH
