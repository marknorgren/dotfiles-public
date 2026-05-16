# Agent Instructions

This dotfiles repo should stay portable, minimal, and free of private or
work-specific data.

## Entry Points

- `./install --dry-run` previews setup.
- `./install` installs packages and symlinks dotfiles.
- `just check` type-checks installer code.
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
