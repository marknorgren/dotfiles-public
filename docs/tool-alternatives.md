# Tool Alternatives and Rationale

Why this repo installs the tools it does, what each one replaced, and how to
migrate an existing machine. The Brewfile, `.tool-versions`, and
`packages/{apt,dnf}.txt` reflect the right-hand column of each table.

## Version managers: mise (plus uv)

`mise` replaces the per-language version managers with one runtime manager. It
reads `.tool-versions` and `mise.toml`, switches versions per directory, and
installs the configured runtimes. Python packaging goes through `uv`.

| Retired                           | Replacement                            | Why                                                                                                        |
| --------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `nvm`                             | `mise use node@<v>`                    | nvm is a shell-sourced script that adds startup latency; mise resolves Node.js without sourcing a runtime. |
| `rbenv`                           | `mise use ruby@<v>`                    | One manager for every language instead of one per language, and no `rbenv init` eval per shell.            |
| `pyenv`                           | `mise use python@<v>`                  | Same reason, and `uv` covers the virtualenv and packaging work that pyenv-virtualenv handled.              |
| `rvm`                             | `mise use ruby@<v>`                    | rvm overrides `cd` and rewrites PATH aggressively; mise is non-invasive.                                   |
| `sdkman`                          | `mise use java@<v>`                    | mise has a JVM backend, so there is no `sdkman-init.sh` to source.                                         |
| brew `node`, `ruby`, `python@3.x` | mise-managed runtimes, `uv` for Python | A brew copy of a runtime shadows the mise shim on PATH; mise pins per-project instead of one global copy.  |

`uv` handles installs, lockfiles, virtual environments, and PEP 723 scripts in
one workflow with reproducible locks.

Caveat: anything that hardcodes a Homebrew runtime path (for example a launchd
plist pointing at `/opt/homebrew/opt/python@3.12/bin/python3`) must be repointed
at the mise shim or at an absolute path from `mise which`.

### pnpm needs the npm backend

`.tool-versions` pins `npm:pnpm`, not plain `pnpm`. mise's default `aqua`
backend uses a stale asset template for pnpm: it looks for `pnpm-macos-arm64`,
while pnpm now ships `pnpm-darwin-arm64.tar.gz`. With the default backend
`mise install` fails on Apple silicon.

## CLI tool swaps

| Old            | New               | Why                                                                                                                                              |
| -------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `htop`         | `btop`            | btop is actively developed and shows CPU, memory, network, and disk in one TUI with mouse support and theming.                                   |
| `cloc`, `sloc` | `scc`             | `scc` counts lines and reports language complexity and COCOMO estimates. `sloc` is an npm package, while `cloc` uses Perl.                       |
| `ack`          | `ripgrep` (`rg`)  | rg respects `.gitignore` and supports Unicode and regular expressions.                                                                           |
| `git-secrets`  | `gitleaks`        | gitleaks is maintained, ships a managed ruleset, scans history, and works as a pre-commit or CI gate. `git-secrets` is effectively unmaintained. |
| `vim`          | `neovim` (`nvim`) | Neovim is the actively developed fork with built-in LSP, Tree-sitter, Lua config, and async. The system `/usr/bin/vim` stays as a fallback.      |
| `p7zip`        | `sevenzip`        | `p7zip` is a community fork at 17.06, built from the 2016 7-Zip sources. `sevenzip` is the official upstream and tracks current releases.        |
| Docker Desktop | OrbStack          | OrbStack provides Docker compatibility and Linux virtual machines on macOS. See the license note below.                                          |

OrbStack license: free for personal use, paid for some commercial use. Check the
terms before using it on a work machine. Review Docker Desktop's current terms
separately before choosing between them.

## Dropped without a replacement

| Removed    | Why                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| `lynx`     | A text-mode web browser. `curl` covers fetching and `rg` covers searching the result.                          |
| `rename`   | The Perl batch renamer. `fd -x` does the same job with the finder already installed here.                      |
| `zopfli`   | A niche recompressor for squeezing the last few percent out of gzip and PNG output. Nothing here needs it.     |
| `watchman` | Removed because this setup does not include React Native or a large Jest suite, where Watchman is most useful. |
| `iterm2`   | Removed because Warp and Ghostty already provide the configured terminal workflows.                            |

## Newly wired, not a swap

| Tool                | Why                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git-delta`         | mise installs the pinned GitHub release on every platform. It is the git pager and `interactive.diffFilter`, with `zdiff3` and moved-line coloring.     |
| `bat` as `MANPAGER` | Replaces `less -X`, which breaks the alt-screen on modern terminals and leaves man page output in the scrollback. Man pages are now syntax-highlighted. |
| `fzf` key bindings  | mise installs one pinned upstream release on every platform, and `.zshrc` loads its supported `fzf --zsh` integration.                                  |

## Added

| Tool                                             | Why                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `zsh-autosuggestions`, `zsh-syntax-highlighting` | Adds inline history suggestions and syntax highlighting. Both load only when a terminal is attached. |
| `hyperfine`                                      | Benchmarks commands with warmup runs and summary statistics.                                         |
| `shfmt`                                          | A formatter to pair with `shellcheck`. The repo linted shell but never formatted it.                 |
| `yq`                                             | `jq` for YAML and XML, useful for workflow and configuration files.                                  |
| `mas`                                            | The Mac App Store CLI, so `brew bundle` can cover App Store installs such as Xcode.                  |

## Terraform and the HashiCorp tap

Homebrew 6.x refuses to load `hashicorp/tap/terraform` until the tap is trusted:

```bash
brew trust hashicorp/tap
```

Alternative: **OpenTofu** (`opentofu`) is an MPL-2.0, community-governed fork of
Terraform created after HashiCorp moved Terraform to the BUSL in 2023. Its
`tofu` binary is a drop-in for the `terraform` CLI for most configurations.
Choose OpenTofu if the BUSL terms matter for your use; stay on `terraform` if
you depend on HashiCorp-specific features or registry behavior. This repo keeps
`terraform`. To switch, replace the Brewfile line with `brew "opentofu"` and use
`tofu` in place of `terraform`.

## Migrating an existing machine

Editing the Brewfile only changes future `brew bundle` runs. Formulae that were
already installed stay until you remove them.

Do **not** run `brew bundle cleanup` for this. The Brewfile is a curated subset,
not a full manifest of an existing machine, so cleanup targets every unlisted
formula as well. Remove the retired tools and Homebrew copies now managed by
mise instead:

```bash
brew uninstall git-secrets cloc vim p7zip lynx rename zopfli watchman
brew uninstall fzf git-delta python@3.12 ruby
brew uninstall --cask docker-desktop iterm2
```

Then install the replacements:

```bash
brew bundle
```
