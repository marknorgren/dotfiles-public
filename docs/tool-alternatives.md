# Tool Alternatives and Rationale

Why this repo installs the tools it does, what each one replaced, and how to
migrate an existing machine. The Brewfile and `packages/{apt,dnf}.txt` reflect
the right-hand column of each table.

## Version managers: mise (plus uv)

`mise` is one polyglot runtime manager that replaces the per-language version
managers. It reads `.tool-versions` and `mise.toml`, switches per directory, and
installs faster than the tools below. Python packaging goes through `uv`.

| Retired                           | Replacement                            | Why                                                                                                       |
| --------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `nvm`                             | `mise use node@<v>`                    | nvm is a shell-sourced script that adds startup latency; mise resolves node without sourcing a runtime.   |
| `rbenv`                           | `mise use ruby@<v>`                    | One manager for every language instead of one per language, and no `rbenv init` eval per shell.           |
| `pyenv`                           | `mise use python@<v>`                  | Same reason, and `uv` covers the virtualenv and packaging work that pyenv-virtualenv handled.             |
| `rvm`                             | `mise use ruby@<v>`                    | rvm overrides `cd` and rewrites PATH aggressively; mise is non-invasive.                                  |
| `sdkman`                          | `mise use java@<v>`                    | mise has a JVM backend, so there is no `sdkman-init.sh` to source.                                        |
| brew `node`, `ruby`, `python@3.x` | mise-managed runtimes, `uv` for Python | A brew copy of a runtime shadows the mise shim on PATH; mise pins per-project instead of one global copy. |

`uv` is a single tool for installs, lockfiles, virtualenvs, and PEP 723 scripts,
with reproducible locks and a large speed advantage over pip plus virtualenv.

Caveat: anything that hardcodes a Homebrew runtime path (for example a launchd
plist pointing at `/opt/homebrew/opt/python@3.12/bin/python3`) must be repointed
at the mise shim or at an absolute path from `mise which`.

### pnpm needs the npm backend

`.tool-versions` pins `npm:pnpm`, not plain `pnpm`. mise's default `aqua`
backend uses a stale asset template for pnpm: it looks for `pnpm-macos-arm64`,
while pnpm now ships `pnpm-darwin-arm64.tar.gz`. With the default backend
`mise install` fails on Apple silicon.

## CLI tool swaps

| Old            | New               | Why                                                                                                                                                  |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `htop`         | `btop`            | btop is actively developed and shows CPU, memory, network, and disk in one TUI with mouse support and theming.                                       |
| `cloc`, `sloc` | `scc`             | scc counts faster, handles more languages, and adds complexity and COCOMO estimates. `sloc` is an abandoned npm package and `cloc` (Perl) is slower. |
| `ack`          | `ripgrep` (`rg`)  | rg is faster, respects `.gitignore`, and has better Unicode and regex support. ack offered nothing rg lacks.                                         |
| `git-secrets`  | `gitleaks`        | gitleaks is maintained, ships a managed ruleset, scans history, and works as a pre-commit or CI gate. `git-secrets` is effectively unmaintained.     |
| `vim`          | `neovim` (`nvim`) | neovim is the actively developed fork with built-in LSP, Treesitter, Lua config, and async. The system `/usr/bin/vim` stays as a fallback.           |
| Docker Desktop | OrbStack          | OrbStack starts in seconds, uses far less RAM, CPU, and disk, has faster filesystem I/O, and runs Linux VMs. See the license note below.             |

OrbStack license: free for personal use, paid for some commercial use. Check the
terms before deploying it on a work machine. Docker Desktop has comparable
commercial terms, so this is usually a lateral license move with a large
performance win.

## Newly wired, not a swap

| Tool                | Why                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git-delta`         | It was installed but never configured. It is now the git pager and `interactive.diffFilter`, with `zdiff3` conflict style and moved-line coloring.      |
| `bat` as `MANPAGER` | Replaces `less -X`, which breaks the alt-screen on modern terminals and leaves man page output in the scrollback. Man pages are now syntax-highlighted. |

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
formula as well. Remove the retired tools one at a time instead:

```bash
brew uninstall git-secrets cloc vim
brew uninstall --cask docker-desktop
```

Then install the replacements:

```bash
brew bundle
```
