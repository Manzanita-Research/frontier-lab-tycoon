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

# Headless Chromium for `pnpm shot` screenshots. Optional: never fail setup.
pnpm exec playwright install chromium-headless-shell >/dev/null 2>&1 \
  && echo "flt: chromium-headless-shell ready" \
  || echo "flt: chromium install skipped (run: pnpm exec playwright install chromium-headless-shell)"

# Headless Blender for the FLT-13 generated-model experiment. Opt-in only (about 360 MB); never in the shared image.
if [[ "${FLT_BLENDER:-0}" == "1" ]]; then
  bash scripts/fal3d/install-blender.sh >/dev/null && echo "flt: blender ready (~/.cache/blender/blender-headless)" || echo "flt: blender install failed"
fi

# Git identity for commits made on cloud machines, only if none is set.
git config user.name >/dev/null 2>&1 || git config user.name "FLT builder"
git config user.email >/dev/null 2>&1 || git config user.email "591643+jem-computer@users.noreply.github.com"

echo "flt: setup done (node $(node --version), pnpm $(pnpm --version))"
