default:
    @just --list

# Install or verify one optional macOS package group (see docs/package-profiles.md).
install-apps: (install-profile "apps")

[positional-arguments]
install-profile profile:
    #!/usr/bin/env bash
    set -euo pipefail
    case "$1" in
        *[!a-z-]*|"") echo "Invalid profile: $1" >&2; exit 2 ;;
    esac
    [ -f "Brewfile.$1" ] || { echo "Unknown profile: $1; see docs/package-profiles.md" >&2; exit 2; }
    brew bundle --file "Brewfile.$1"

[positional-arguments]
check-profile profile:
    #!/usr/bin/env bash
    set -euo pipefail
    case "$1" in
        *[!a-z-]*|"") echo "Invalid profile: $1" >&2; exit 2 ;;
    esac
    [ -f "Brewfile.$1" ] || { echo "Unknown profile: $1; see docs/package-profiles.md" >&2; exit 2; }
    brew bundle check --file "Brewfile.$1"


install:
    ./install

dry-run:
    ./install --dry-run

check:
    deno task check
    @just shell-check

fmt-check:
    deno task fmt:check

lint:
    deno task lint
    @just shell-check

test:
    deno task test

container-check:
    bash scripts/container-check.sh

devcontainer-list:
    bin/devcontainer-stack list

devcontainer-init stack target=".":
    bin/devcontainer-stack init {{stack}} {{target}}

devcontainer-build stack target=".":
    bin/devcontainer-stack build {{stack}} {{target}}

devcontainer-shell stack target=".":
    bin/devcontainer-stack shell {{stack}} {{target}}

devcontainer-up stack target=".":
    bin/devcontainer-stack up {{stack}} {{target}}

verify:
    bin/verify

macos-review:
    ./.macos --dry-run

setup-macos:
    ./.macos

macos-check:
    bash -n .macos
    shellcheck --shell=bash -x .macos

SHELL_SOURCES := "install bin/devcontainer-stack scripts/container-check.sh .devcontainer/post-create.sh .macos"

shell-check:
    bash -n {{SHELL_SOURCES}}
    shellcheck --shell=bash -x {{SHELL_SOURCES}}
    @just shell-fmt-check

# shfmt takes its settings from .editorconfig (indent_style, indent_size,
# switch_case_indent), so the CLI and any editor integration agree.
shell-fmt-check:
    @command -v shfmt >/dev/null 2>&1 || { echo "shfmt is not installed. Run 'mise install' in this repository and activate mise." >&2; exit 1; }
    shfmt --diff {{SHELL_SOURCES}}

# Apply the formatting shell-fmt-check enforces.
shell-fmt:
    shfmt --write {{SHELL_SOURCES}}

# Secret scan. Scans commit history as well as the working tree, matching the
# CI job; `--no-git` would pass on a secret that is already committed.
public-scan:
    gitleaks detect --source . --redact --verbose
