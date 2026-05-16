default:
    @just --list

install:
    ./install

install-apps:
    brew bundle --file Brewfile.apps

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

shell-check:
    bash -n install bin/devcontainer-stack scripts/container-check.sh .devcontainer/post-create.sh .macos
    shellcheck --shell=bash -x install bin/devcontainer-stack scripts/container-check.sh .devcontainer/post-create.sh .macos

public-scan:
    gitleaks detect --source . --no-git --redact --verbose
