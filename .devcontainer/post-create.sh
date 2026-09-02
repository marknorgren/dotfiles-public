#!/usr/bin/env bash
set -euo pipefail

just check
./install --skip-packages --force
just verify
