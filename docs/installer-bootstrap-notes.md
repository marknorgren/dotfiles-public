# Installer Bootstrap Notes

This repo supports a remote one-liner install:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/marknorgren/dotfiles-public/main/install)"
```

That path has a few sharp edges because the shell script is delivered through
stdin, then clones or updates the repo, installs Deno, and runs the TypeScript
installer.

## Homebrew Needs Real Stdin

Homebrew's macOS installer needs sudo access and may need to prompt for the
user's password. When the dotfiles installer is launched through `curl | bash`
or `bash -c "$(curl ...)"`, stdin can be consumed by the bootstrap script
instead of pointing at the terminal.

Two layers need to preserve terminal input:

- `install` runs the Deno installer with stdin attached to `/dev/tty` when a
  terminal is available.
- `scripts/lib/log.ts` runs child commands with inherited stdin, so commands
  like Homebrew can prompt.

If either layer drops stdin, Homebrew reports:

```text
Warning: Running in non-interactive mode because `stdin` is not a TTY.
Need sudo access on macOS
```

## Admin Group Is Not Enough

Membership in the macOS `admin` group does not mean a non-interactive process
can use sudo. The installer should check the actual capability it needs:

```bash
sudo -n -v
```

That succeeds only when sudo can be used without prompting. In an interactive
terminal install, let Homebrew prompt instead of forcing `NONINTERACTIVE=1`.

## Deno Can Dirty the Checkout

The bootstrap checkout symlinks `.zshrc` into the user's home directory. Deno's
curl installer can edit shell startup files, which means installing Deno can
modify the tracked `.zshrc` through the symlink. That leaves
`~/.dotfiles-public` dirty and blocks later `git pull --ff-only` runs.

To avoid this:

- Reuse `$HOME/.deno/bin/deno` when it already exists, even if PATH has not been
  refreshed yet.
- Run Deno's curl installer with `CI=1` and `--no-modify-path` so it does not
  attempt shell setup.
- Keep durable PATH setup in the dotfiles, not in tool installers.

If the checkout is already dirty from generated Deno shell edits, inspect before
cleaning:

```bash
git -C ~/.dotfiles-public status --short
git -C ~/.dotfiles-public diff -- .zshrc
```

The generated lines can be stashed before pulling:

```bash
git -C ~/.dotfiles-public stash push -m "Preserve generated Deno shell edits" -- .zshrc
git -C ~/.dotfiles-public pull --ff-only
```

## Desired Behavior

Repeated installer runs should be idempotent:

- The bootstrap checkout can fast-forward cleanly.
- Deno is reused if already installed in `$HOME/.deno/bin`.
- Homebrew can prompt for a password in an interactive terminal.
- Non-interactive runs skip Homebrew bootstrap when sudo cannot be used without
  prompting.
- Generated machine-specific or tool-specific edits stay out of tracked files.
