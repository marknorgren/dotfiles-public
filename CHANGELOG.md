# Changelog

All notable changes to this repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- An MIT `LICENSE`. The README points people at a public installer, so the
  repository should not be all-rights-reserved by default.
- `.gitattributes` pinning `* text=auto eol=lf`. The repo ships shell scripts a
  CRLF checkout breaks on the shebang line.
- `.github/dependabot.yml`, so the SHA-pinned workflow actions still get
  updates. A test fails if a pin is added without an update path.
- Shell formatting via shfmt, enforced by `just check` and applied by
  `just shell-fmt`. Settings come from `.editorconfig`, so the CLI and editor
  integrations agree. CI installs the pinned release and verifies its SHA-256.
- `bin/verify` checks the tools mise owns (git-delta, fzf) and the shell wiring
  other parts depend on. They are skipped on a plain checkout and required under
  `VERIFY_INSTALLED=1`.
- `scripts/repo_test.ts`, covering the secret scan, formatting agreement, line
  endings, the Deno pin, and Dependabot coverage.
- git-delta is now configured, not just installed: it is the git pager and
  `interactive.diffFilter`, with `zdiff3` conflict style and moved-line
  coloring. mise installs one pinned release across macOS and Linux.
- `bat` is used as `MANPAGER` when available, for syntax-highlighted man pages.
  `less -X` is deliberately not used because it breaks the alt-screen on modern
  terminals.
- Locale, history, and color defaults in `.exports`.
- Shell startup caching: `starship`, `zoxide`, and `mise` init output is cached
  under `~/.cache/zsh` and zcompiled, so a new shell sources a compiled file
  instead of forking each tool.
- A default-deny Codex state rule in `.gitignore_global`. Shareable project
  config and skills remain visible to Git.
- `ghostty` cask, which the README already described as installed.
- Zed: telemetry off, 80-column wrap guide, sticky scroll, VS Code keymap, and
  `.jsonl` files treated as JSON.
- `docs/tool-alternatives.md`, recording what each tool replaced and how to
  migrate an existing machine.
- fzf key bindings and completion. mise installs one pinned upstream release
  across macOS and Linux, and `.zshrc` loads its `fzf --zsh` setup.
- `zsh-autosuggestions` and `zsh-syntax-highlighting` on macOS and Linux.
- Line-editor setup (fzf bindings and both plugins) loads only when a terminal
  is attached. A script-driven `zsh -i -c` skips it, which also avoids the
  "can't change option: zle" warning fzf prints with no terminal.
- `hyperfine`, `shfmt`, `yq`, and `mas`.

### Fixed

- `.zprofile` activates mise shims, so login and GUI shells can resolve the
  tools mise owns. Without it, git reported "cannot run delta" everywhere
  outside an interactive zsh.
- `just public-scan` scans commit history. It passed `--no-git`, so a secret
  that was committed and later deleted passed locally and failed in CI.
- The installer pins the Deno version it fetches. CI pins the toolchain because
  `deno fmt` output moves between minor versions, so an unpinned bootstrap let a
  fresh machine format code the gate then rejected.
- `.editorconfig` declares 2-space indentation for the files deno fmt owns. It
  declared 4, so an editor honouring it produced diffs `just check` rejected.

### Changed

- `.tool-versions` pins `npm:pnpm` instead of `pnpm`. mise's default `aqua`
  backend uses a stale asset template (`pnpm-macos-arm64`) and fails to install
  pnpm on Apple silicon.
- The installer runs `mise install` after trusting `.tool-versions`, so pinned
  runtimes and developer tools are present after setup.
- fzf is managed by mise instead of Homebrew or Linux package managers, so its
  Zsh integration and version are consistent on every supported platform.
- Brewfile: `git-secrets` to `gitleaks`, `vim` to `neovim`, `p7zip` to
  `sevenzip`, Docker Desktop to OrbStack. `just public-scan` calls `gitleaks`,
  which the Brewfile did not install, and `p7zip` is a fork built from the 2016
  7-Zip sources.
- Linux package lists: `htop` to `btop`, matching the Brewfile.
- CI pins third-party actions to commit SHAs rather than moving tags.
- `.exports` prefers `nvim` over `vim` for `EDITOR` when it is present.

### Removed

- `cloc` from the Brewfile; `scc` already covers it.
- `lynx`, `rename`, `zopfli`, and `watchman`, none of which this setup uses.
- The `iterm2` cask. Warp and Ghostty are both installed and configured.
- Homebrew `python@3.12` and `ruby`. Runtimes are managed by mise, and a brew
  copy shadows the mise shim on PATH.
- A stale pinned agent model from the Zed settings.
- An empty, unused `core/` directory.
