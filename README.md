# Dotfiles

Development bootstrap for macOS and Linux. It installs common developer tools,
links shell/editor defaults, and leaves private account, credential, work, and
machine-specific configuration to local overlays.

## Quick Start

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/marknorgren/dotfiles-public/main/install)"
```

Preview changes first:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/marknorgren/dotfiles-public/main/install)" -- --dry-run
```

The installer clones or updates this repo at `~/.dotfiles-public` by default.
Override that path with `DOTFILES_TARGET=/path/to/dotfiles-public`.

## macOS Settings

Review optional macOS defaults before applying them:

```bash
just macos-review
```

Apply the settings:

```bash
just setup-macos
```

The script writes per-user Finder, Dock, keyboard, pointer, region, appearance,
battery status, and scrollbar defaults. It does not configure FileVault,
screensaver security, power management, or private app preferences.

Reference: [macOS settings](docs/macos-settings.md).

## Terminal and Editors

On macOS, the Brewfile installs Warp, VS Code, Sublime Text, and Ghostty. The
linked VS Code and Cursor settings use Warp as the external terminal and zsh as
the integrated terminal profile. The shell exports `TERMINAL=Warp.app` as a hint
for tools that honor it.

macOS does not provide a reliable global "default terminal app" setting for
automation. This repo sets the defaults it can control without taking over
private app preferences.

Optional GUI apps live in `Brewfile.apps` and install with `just install-apps`.

## Private Setup Boundary

Do not put secrets, private hostnames, work account config, or machine-specific
paths in this repo. Use:

- 1Password for secrets and SSH keys.
- The macOS keychain for local service-account tokens when needed.
- `local/` inside the checkout for ignored machine-specific shell snippets.
- A separate private overlay repo for work-specific Git, SSH, editor, and agent
  config.

## Commands

```bash
just install
just macos-review
just setup-macos
just verify
just check
just container-check
just devcontainer-list
just devcontainer-init node-pnpm ~/working/example
just devcontainer-shell node-pnpm ~/working/example
```

`just verify` checks the linked shell files and a few core commands.
`just check` runs formatting, linting, type-checking, and Deno tests.
`just container-check` builds the devcontainer image and runs the same checks in
Docker. `just devcontainer-init` writes a reusable `.devcontainer/` for common
stacks: `base`, `deno`, `node-pnpm`, `python-uv`, `go`, `dotnet`, and `infra`.
`just lint` runs Deno lint and checks the macOS settings script.
