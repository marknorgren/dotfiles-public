# Agent Instructions

This dotfiles repo should stay portable, minimal, and free of private or
work-specific data.

## Entry Points

- `./install --dry-run` previews setup.
- `./install` installs packages and symlinks dotfiles.
- `just check` is the full gate: Deno format, lint, type-check, and tests, plus
  `bash -n`, ShellCheck, and shfmt over the shell entry points. It needs `deno`,
  `shellcheck`, and `shfmt` on PATH; see the README's Toolchain table.
- `just public-scan` scans the working tree and commit history for secrets.
- `just container-check` builds the devcontainer image and verifies the
  installer inside Docker.
- `just devcontainer-list` lists reusable devcontainer stack templates.
- `just devcontainer-init <stack> [target]` writes a stack template into a
  project.
- `just verify` verifies the current shell setup.

## Rules

- Do not add secrets, tokens, private hostnames, private repo paths, work
  account names, or developer-machine absolute home paths.
- Keep machine-specific configuration in ignored `local/` files.
- Use 1Password or the OS keychain for credentials.
- Prefer small, testable changes and verify with `just check`,
  `just container-check`, and `just verify` when Docker is relevant.
