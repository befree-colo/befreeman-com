#!/usr/bin/env bash
# Shared setup for every Bitbucket Pipelines step (Playwright image: Node + browsers preinstalled).
set -euo pipefail

PNPM_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1]")"
echo "node $(node --version), installing pnpm ${PNPM_VERSION}"
npm install -g --silent "pnpm@${PNPM_VERSION}"

# Keep the pnpm store inside the clone so the Pipelines cache can persist it.
pnpm config set store-dir "$PWD/.pnpm-store"
pnpm install --frozen-lockfile
