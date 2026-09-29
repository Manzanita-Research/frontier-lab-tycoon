#!/usr/bin/env bash
# bb runs this after creating a new worktree/checkout of this repo.
# Builders work on Modal (Linux). The Mini (macOS, 8 GB, tiny disk) must stay
# light, so on macOS we skip the install unless FLT_FORCE_INSTALL=1.
set -euo pipefail

if [[ "$(uname -s)" == "Darwin" && "${FLT_FORCE_INSTALL:-0}" != "1" ]]; then
  echo "flt: macOS host detected; skipping pnpm install (set FLT_FORCE_INSTALL=1 to override)."
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "flt: pnpm missing; enabling it through corepack"
  corepack enable pnpm || npm install -g pnpm@9.15.0
fi

if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile --prefer-offline
else
  pnpm install
fi

# Git identity for commits made on cloud machines, only if none is set.
git config user.name >/dev/null 2>&1 || git config user.name "FLT builder"
git config user.email >/dev/null 2>&1 || git config user.email "591643+jem-computer@users.noreply.github.com"

echo "flt: setup done (node $(node --version), pnpm $(pnpm --version))"
