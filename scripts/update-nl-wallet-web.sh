#!/usr/bin/env bash
#
# Build the wallet_web lib in the business-wallet repo and copy the generated
# nl-wallet-web.js to vendor/nl-wallet-web.js, the single copy all button
# packages build from.
#
# Usage:
#   scripts/update-nl-wallet-web.sh [path-to-wallet_web]
#
# The wallet_web directory can also be set via the WALLET_WEB_DIR env var.
# Default: a sibling checkout at ../business-wallet/wallet_web (relative to this repo).
#
# Set SKIP_INSTALL=1 to skip dependency installation (assumes node_modules is ready).
# Set SKIP_BUILD=1 to skip the build and just copy the existing dist artifact.
#
# The wallet_web vite build requires VITE_HELP_BASE_URL (a valid URL) at build
# time. A production build loads .env/.env.production, which the repo does not
# ship, so this script supplies it. Override with the VITE_HELP_BASE_URL env var;
# it defaults to the same placeholder used in the repo's .env.development.
# The button libs set help-base-url at runtime, so this default is just a stub.

set -euo pipefail

# --- Resolve paths ---------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# wallet_web location: 1st CLI arg > WALLET_WEB_DIR env > default sibling repo.
WALLET_WEB_DIR="${1:-${WALLET_WEB_DIR:-$REPO_ROOT/../business-wallet/wallet_web}}"

if [[ ! -d "$WALLET_WEB_DIR" ]]; then
  echo "❌ wallet_web directory not found: $WALLET_WEB_DIR" >&2
  echo "   Pass it as an argument or set WALLET_WEB_DIR." >&2
  exit 1
fi
WALLET_WEB_DIR="$(cd "$WALLET_WEB_DIR" && pwd)"  # normalize to absolute

ARTIFACT="$WALLET_WEB_DIR/dist/nl-wallet-web.js"

# The one vendored copy every button package builds from.
DESTS=(
  "$REPO_ROOT/vendor"
)

echo "📁 wallet_web:   $WALLET_WEB_DIR"
echo "📦 artifact:     $ARTIFACT"
echo ""

# --- Build -----------------------------------------------------------------
if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  echo "⏭️  SKIP_BUILD=1 — using existing dist artifact"
else
  pushd "$WALLET_WEB_DIR" >/dev/null

  if [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
    if [[ ! -d node_modules ]]; then
      echo "📥 Installing dependencies (npm ci)..."
      npm ci
    else
      echo "✓ node_modules present — skipping install (SKIP_INSTALL=1 to force skip)"
    fi
  fi

  # wallet_web's vite.config.ts requires a valid VITE_HELP_BASE_URL at build time.
  export VITE_HELP_BASE_URL="${VITE_HELP_BASE_URL:-http://example.com/}"
  echo "🔨 Building wallet_web (npm run build, VITE_HELP_BASE_URL=$VITE_HELP_BASE_URL)..."
  npm run build

  popd >/dev/null
fi

# --- Verify artifact -------------------------------------------------------
if [[ ! -f "$ARTIFACT" ]]; then
  echo "❌ Expected build output not found: $ARTIFACT" >&2
  exit 1
fi

SIZE="$(wc -c < "$ARTIFACT" | tr -d ' ')"
echo ""
echo "✅ Built nl-wallet-web.js (${SIZE} bytes)"
echo ""

# --- Copy to each destination ----------------------------------------------
for dest in "${DESTS[@]}"; do
  if [[ ! -d "$dest" ]]; then
    echo "⚠️  Skipping missing destination: $dest" >&2
    continue
  fi
  cp "$ARTIFACT" "$dest/nl-wallet-web.js"
  echo "📋 Copied → ${dest#$REPO_ROOT/}/nl-wallet-web.js"
done

echo ""
echo "🎉 Done."
