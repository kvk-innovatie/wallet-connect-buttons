#!/usr/bin/env bash
#
# Publish all wallet-connect button libraries by invoking each folder's own
# release/publish script:
#
#   vanillajs -> vanillajs/wallet-connect-button-vanillajs/release.sh
#                  (builds, bumps patch, commits, tags, and GIT PUSHes to main
#                   for the jsDelivr CDN release)
#   react     -> react/wallet-connect-button-react/publish.sh
#                  (requires a clean git tree, builds, bumps patch, NPM PUBLISH,
#                   commits + tags locally)
#   vue       -> vue/wallet-connect-button-vue/publish.sh   (same as react)
#
# ⚠️  These are real, outward-facing, hard-to-undo actions (npm publish / git
#     push / version bumps). Review before running.
#
# Usage:
#   scripts/publish-all-buttons.sh [targets...]
#
#   targets    Optional subset of: vanillajs react vue   (default: all three)
#
# Options / env:
#   --yes | -y | YES=1        Skip the confirmation prompt.
#   CONTINUE_ON_ERROR=1       Keep going if one library's script fails
#                             (default: stop at the first failure).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Target registry: key -> "relative-dir|script-name" --------------------
target_spec() {
  case "$1" in
    vanillajs) echo "vanillajs/wallet-connect-button-vanillajs|release.sh" ;;
    react)     echo "react/wallet-connect-button-react|publish.sh" ;;
    vue)       echo "vue/wallet-connect-button-vue|publish.sh" ;;
    *)         return 1 ;;
  esac
}

ALL_TARGETS=(vanillajs react vue)

# --- Parse args ------------------------------------------------------------
ASSUME_YES="${YES:-0}"
TARGETS=()

for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    -h|--help)
      sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      if target_spec "$arg" >/dev/null 2>&1; then
        TARGETS+=("$arg")
      else
        echo "❌ Unknown target: '$arg' (valid: ${ALL_TARGETS[*]})" >&2
        exit 1
      fi ;;
  esac
done

# Default to all targets when none were named.
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  TARGETS=("${ALL_TARGETS[@]}")
fi

# --- Pre-flight: verify each target's script exists ------------------------
echo "The following libraries will be published, each via its own script:"
for key in "${TARGETS[@]}"; do
  spec="$(target_spec "$key")"
  dir="${spec%%|*}"
  script="${spec##*|}"
  path="$REPO_ROOT/$dir/$script"
  if [[ ! -f "$path" ]]; then
    echo "❌ Missing publish script: $dir/$script" >&2
    exit 1
  fi
  echo "  • $key  ->  $dir/$script"
done
echo ""
echo "⚠️  This runs REAL publishes (npm publish / git push / version bumps)."
echo ""

# --- Confirmation ----------------------------------------------------------
if [[ "$ASSUME_YES" != "1" ]]; then
  read -r -p "Proceed with publishing? [y/N] " reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

# --- Run each target's script (from inside its own folder) -----------------
FAILED=()
for key in "${TARGETS[@]}"; do
  spec="$(target_spec "$key")"
  dir="${spec%%|*}"
  script="${spec##*|}"

  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "▶  Publishing '$key'  ($dir/$script)"
  echo "════════════════════════════════════════════════════════════"

  # Run in a subshell so cd and any script-local state don't leak between targets.
  if ( cd "$REPO_ROOT/$dir" && bash "./$script" ); then
    echo "✅ '$key' finished."
  else
    status=$?
    echo "❌ '$key' failed (exit $status)." >&2
    FAILED+=("$key")
    if [[ "${CONTINUE_ON_ERROR:-0}" != "1" ]]; then
      echo "Stopping. Set CONTINUE_ON_ERROR=1 to keep going past failures." >&2
      exit "$status"
    fi
  fi
done

# --- Summary ---------------------------------------------------------------
echo ""
if [[ ${#FAILED[@]} -eq 0 ]]; then
  echo "🎉 All requested libraries published: ${TARGETS[*]}"
else
  echo "⚠️  Completed with failures: ${FAILED[*]}" >&2
  exit 1
fi
