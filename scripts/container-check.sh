#!/usr/bin/env bash
set -euo pipefail

image="${DOTFILES_DEVCONTAINER_IMAGE:-dotfiles-public-devcontainer:local}"

docker build -f .devcontainer/Dockerfile -t "$image" .
docker run --rm \
  --user vscode \
  -e DOTFILES=/workspace \
  -v "$PWD":/workspace \
  -w /workspace \
  "$image" \
  bash .devcontainer/post-create.sh
