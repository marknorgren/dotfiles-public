# Public dotfiles base

Portable development setup for macOS and Linux. This repository installs tools
and owns the base shell, Git, editor, runtime, and package configuration.

It works on its own. An optional private overlay can add personal and work
configuration through defined extension points without replacing files owned
here.

## Install

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/marknorgren/dotfiles-public/main/install)"
```

Preview first:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/marknorgren/dotfiles-public/main/install)" -- --dry-run
```

The installer uses `~/.dotfiles-public` by default. Set `DOTFILES_TARGET` to
override that path.

## Ownership

This repository owns the primary shell, Git, editor, terminal, runtime, and
package configuration installed on the machine.

Private configuration composes through these extension points:

| Concern | Extension point                       |
| ------- | ------------------------------------- |
| Shell   | `~/.config/dotfiles/overlays.d/*.zsh` |
| Git     | `~/.gitconfig.local`                  |
| SSH     | `~/.ssh/config.d/`                    |

Do not put secrets, private hosts, work identities, or machine-specific paths in
this repository. Use 1Password or the OS keychain for credentials, ignored
`local/` files for machine-specific settings, and the private overlay for
personal or work configuration.

## macOS

Review and apply the optional per-user macOS defaults:

```bash
just macos-review
just setup-macos
```

Ghostty and VS Code are installed by default. Add personal applications and
fonts when needed:

```bash
just install-apps
```

Other tools use explicit [package profiles](docs/package-profiles.md), including
cloud, Swift, media, alternative editors, local models, and transcription.

See [macOS settings](docs/macos-settings.md) for the settings managed here.

## Toolchain

`mise` manages Node.js, Python, Ruby, .NET, and pinned development tools from
`.tool-versions`. Python packaging uses `uv`. See
[tool alternatives](docs/tool-alternatives.md) for rationale and migration
notes. The installer also uses the vendors' native installers for Codex CLI and
Claude Code; both binaries live in `~/.local/bin` and update independently of
Homebrew.

## Commands

| Command                                   | Purpose                               |
| ----------------------------------------- | ------------------------------------- |
| `just install`                            | Install packages and managed files    |
| `just verify`                             | Verify the installed setup            |
| `just check`                              | Run repository checks                 |
| `just public-scan`                        | Scan the tree and history for secrets |
| `just container-check`                    | Test the installer in Docker          |
| `just devcontainer-list`                  | List devcontainer templates           |
| `just devcontainer-init <stack> <target>` | Add a devcontainer to a project       |

Running repository checks requires `just`, `deno`, `shellcheck`, and `shfmt` on
`PATH`. The installer bootstraps its own requirements.

## License

[MIT](LICENSE).
