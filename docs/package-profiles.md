# Package profiles

The shared baseline uses Ghostty and VS Code on macOS, Neovim for terminal
editing, and mise for runtime versions. Both dotfiles repositories carry the
same Brewfiles, runtime pins, and npm/pnpm policy. Their installers and shell
layouts remain independent.

## Install and verify

Run from the repository you use as your base:

```sh
brew bundle --file Brewfile
mise install
just install-profile cloud
just check-profile cloud
```

Replace `cloud` with a profile below. `just install-apps` installs `apps`. To
install only one application from a group, use `brew install --cask <name>`.

| Profile        | Installs                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| `apps`         | Personal apps, Chrome, Firefox, JetBrains Mono, 1Password desktop        |
| `cloud`        | AWS CLI, SAM, Tailscale, Terraform and its HashiCorp tap                 |
| `swift`        | Mint and Xcodes; install Xcode before project-specific Swift tooling     |
| `media`        | ImageMagick, ffmpeg, yt-dlp, Pandoc, 7-Zip, pigz, VLC                    |
| `development`  | Native builds, Git extras, databases, OrbStack, network debugging        |
| `extras`       | GNU compatibility tools, wget, pipeline progress, counters, benchmarking |
| `editors`      | Zed and Cursor; choose individually if you need only one                 |
| `warp`         | Optional alternative terminal                                            |
| `ollama`       | Local models for scripts and services                                    |
| `lm-studio`    | Desktop model exploration and agents                                     |
| `macwhisper`   | Recording, file, and meeting transcription                               |
| `superwhisper` | Dictation and voice-driven text entry                                    |
| `menubar`      | Thaw on macOS 26+, Hidden Bar on older macOS                             |
| `direnv`       | Projects requiring `.envrc`; hook setup is explicit                      |

Choose between Ollama and LM Studio, and between MacWhisper and Superwhisper,
according to the workflow above. Installing both should serve a specific need.
The menu-bar profile is optional so Thaw can be evaluated before adopting it.
[Thaw's cask requires macOS 26](https://formulae.brew.sh/cask/thaw).

The default bundle excludes MakeMKV, Sublime Text, the dash shell, and mas.
Existing installations are left in place. This is a curated package selection:
do not use `brew bundle cleanup` to apply it to an existing machine.

## Runtime and package ownership

`.tool-versions` is the executable source of truth for exact pins. Defaults are
Node 24 LTS, Python 3.14, Ruby 3.4, .NET 10 LTS, pnpm 11.25, fzf 0.74.3, and
shfmt 3.14.0. Ruby 3.4 and pnpm 11 keep the migration smaller than Ruby 4 and
pnpm 12. Use project-local pins when dependencies require older versions. Distro
Python stays installed.

Mise installs pnpm through its explicit npm backend. This keeps the installation
route consistent; it does not assume that other backends are currently broken.
The global pnpm setting respects a project's `packageManager` version.

pnpm 11 reads its settings from `~/.config/pnpm/config.yaml`; `.npmrc` retains
the npm no-install-scripts setting. The managed YAML file preserves the same
policy for pnpm. Authentication belongs in private local configuration.
[pnpm 11 migration guide](https://pnpm.io/blog/releases/11.0).

Homebrew installs the keg-only `rustup` formula. Shell startup adds its
`opt/rustup/bin` directory and preserves existing Cargo tools. Existing
`rust-toolchain.toml` files continue to select project toolchains.
[Homebrew Rust instructions](https://formulae.brew.sh/formula/rustup).

Use `eza --tree` on macOS; the interactive `tree` alias supplies a two-level
view. Linux retains the `tree` package until eza is installed. Linux uses
`iproute2` on Debian/Ubuntu and `iproute` on Fedora for `ip` and `ss`. Neither
Linux list explicitly installs Vim or net-tools.

## Directory environments

Mise supplies the default directory environment hook. Installing direnv does not
enable it automatically. For a project requiring `.envrc`, use a local shell
override and follow the
[mise/direnv integration guidance](https://mise.jdx.dev/direnv.html): use mise
shims when direnv owns directory activation, and avoid running both environment
hooks. Do not remove a working `.envrc` setup before migrating it.

## Validation

Run `just check` in each repository. In the public repository, also run
`just container-check` after changing Linux packages or container templates.
`just verify` checks the installed shell and links. None of these commands
installs the optional profiles.

The public devcontainer templates use Node 24, Python 3.14, and .NET 10 images;
the Node template pins the same pnpm version as `.tool-versions`. shfmt's local,
CI, and container versions match, including the Linux release checksums.
Template changes affect newly generated containers; regenerate or update
existing projects explicitly.
