# Changelog

All notable changes to this repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- git-delta is now configured, not just installed: it is the git pager and
  `interactive.diffFilter`, with `zdiff3` conflict style and moved-line
  coloring. `git-delta` was added to the Linux package lists so the setting
  works there too.
- `bat` is used as `MANPAGER` when available, for syntax-highlighted man pages.
  `less -X` is deliberately not used because it breaks the alt-screen on modern
  terminals.
- Locale, history, and color defaults in `.exports`.
- Shell startup caching: `starship`, `zoxide`, and `mise` init output is cached
  under `~/.cache/zsh` and zcompiled, so a new shell sources a compiled file
  instead of forking each tool.
- `**/.codex/` in `.gitignore_global`, because Codex local state can contain
  authentication and session data.
- `ghostty` cask, which the README already described as installed.
- Zed: telemetry off, 80-column wrap guide, sticky scroll, VS Code keymap, and
  `.jsonl` files treated as JSON.
- `docs/tool-alternatives.md`, recording what each tool replaced and how to
  migrate an existing machine.

### Changed

- `.tool-versions` pins `npm:pnpm` instead of `pnpm`. mise's default `aqua`
  backend uses a stale asset template (`pnpm-macos-arm64`) and fails to install
  pnpm on Apple silicon.
- Brewfile: `git-secrets` to `gitleaks`, `vim` to `neovim`, Docker Desktop to
  OrbStack. `just public-scan` calls `gitleaks`, which the Brewfile did not
  install.
- Linux package lists: `htop` to `btop`, matching the Brewfile.
- CI pins third-party actions to commit SHAs rather than moving tags.
- `.exports` prefers `nvim` over `vim` for `EDITOR` when it is present.

### Removed

- `cloc` from the Brewfile; `scc` already covers it.
- Homebrew `python@3.12` and `ruby`. Runtimes are managed by mise, and a brew
  copy shadows the mise shim on PATH.
- A stale pinned agent model from the Zed settings.
- An empty, unused `core/` directory.
