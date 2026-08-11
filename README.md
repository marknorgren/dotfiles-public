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

On macOS, `just install-apps` installs Warp, VS Code, Sublime Text, and Ghostty.
The linked VS Code and Cursor settings use Warp as the external terminal and zsh
as the integrated terminal profile. The shell exports `TERMINAL=Warp.app` as a
hint for tools that honor it.

macOS does not provide a reliable global "default terminal app" setting for
automation. This repo sets the defaults it can control without taking over
private app preferences.

GUI apps and fonts live in `Brewfile.apps` and install with `just install-apps`.
The default installer keeps `just`, mise, and other command line tools in the
required `Brewfile`.

## Tool Choices

Runtimes (Node.js, Python, Ruby, and .NET) are managed by `mise` from
`.tool-versions`, not Homebrew, so a brew copy does not shadow the mise shim on
PATH. Python packaging goes through `uv`.

Reference: [tool alternatives and rationale](docs/tool-alternatives.md), which
records what each tool replaced and how to migrate an existing machine.

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
just public-scan
just shell-fmt
just container-check
just devcontainer-list
just devcontainer-init node-pnpm ~/working/example
just devcontainer-shell node-pnpm ~/working/example
```

`just verify` checks the linked shell files, the tools mise installs, and a few
core commands. `just check` runs Deno formatting, linting, type-checking, and
tests, then `bash -n`, ShellCheck, and shfmt over the shell entry points.
`just public-scan` scans the working tree and commit history for secrets.
`just shell-fmt` applies the formatting `just check` enforces.
`just container-check` builds the devcontainer image and runs the same checks in
Docker. `just devcontainer-init` writes a reusable `.devcontainer/` for common
stacks: `base`, `deno`, `node-pnpm`, `python-uv`, `go`, `dotnet`, and `infra`.
`just lint` runs Deno lint and checks the macOS settings script.

### Toolchain

Running the repo's own checks needs these on PATH:

| Tool         | Used by                        | Installed by             |
| ------------ | ------------------------------ | ------------------------ |
| `just`       | every recipe                   | Homebrew, distro package |
| `deno`       | `just check`, the installer    | `./install`              |
| `shellcheck` | `just check`, `just lint`      | Homebrew, distro package |
| `shfmt`      | `just check`, `just shell-fmt` | `mise install`           |
| `gitleaks`   | `just public-scan`             | Homebrew, distro package |

`shfmt` is pinned in `.tool-versions` rather than installed by a package
manager, because its formatting can change between versions and `just check`
must agree with CI. `./install` needs none of these: it installs Deno and then
runs the TypeScript installer, which trusts `.tool-versions` and runs
`mise install`.

## License

[MIT](LICENSE).
