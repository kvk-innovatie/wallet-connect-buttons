#!/usr/bin/env bash
#
# Release the public button packages of this repository in lockstep.
#
#   scripts/release.sh <patch|minor|major|prerelease|x.y.z> [--dry-run] [--yes]
#
# Steps: clean tree check -> install -> typecheck -> test -> build -> bump every public
# workspace to the same version -> npm publish each -> commit + tag -> push.
#
# ⚠️  Real, outward-facing actions (npm publish, git push). --dry-run runs everything except
#     publish, commit, tag and push, and uses `npm publish --dry-run`.
#
# TAG_PREFIX (default "v") names the git tag: this repository tags v2.x.y; the NB Wallet
# repository sets TAG_PREFIX=nb-v.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BUMP="${1:-}"
DRY_RUN=0
ASSUME_YES="${YES:-0}"
for arg in "${@:2}"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -y|--yes) ASSUME_YES=1 ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done
if [[ -z "$BUMP" ]]; then
  sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 1
fi
TAG_PREFIX="${TAG_PREFIX:-v}"

# Public (non-private) workspaces under packages/.
mapfile -t PACKAGES < <(for f in packages/*/package.json; do
  node -e 'const p=require(process.argv[1]); if(!p.private) console.log(require("path").dirname(process.argv[1]))' "$PWD/$f"
done)
echo "Packages: ${PACKAGES[*]}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ Working tree is not clean." >&2
  exit 1
fi

npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run build

# Bump: npm version in each workspace without tagging; all get the same version.
for dir in "${PACKAGES[@]}"; do
  (cd "$dir" && npm version "$BUMP" --no-git-tag-version >/dev/null)
done
VERSION="$(node -p "require('./${PACKAGES[0]}/package.json').version")"
echo "📦 Version $VERSION"
npm install --no-audit --no-fund --package-lock-only >/dev/null

# Keep the major in the CDN URLs of the docs in step.
MAJOR="${VERSION%%.*}"
grep -rl "cdn.jsdelivr.net/npm/[a-z-]*wallet-connect-button-vanillajs@[0-9]" packages/*/README.md examples/static 2>/dev/null \
  | xargs -r sed -i -E "s#(cdn.jsdelivr.net/npm/[a-z-]*wallet-connect-button-vanillajs@)[0-9]+#\1${MAJOR}#g"

# Rebuild so the bundles and declarations carry the new version.
npm run build

if [[ "$ASSUME_YES" != "1" && "$DRY_RUN" != "1" ]]; then
  read -r -p "Publish ${#PACKAGES[@]} packages as $VERSION and push tag ${TAG_PREFIX}${VERSION}? [y/N] " reply
  case "$reply" in y|Y|yes|YES) ;; *) echo "Aborted (version bump left in the working tree)."; exit 1 ;; esac
fi

for dir in "${PACKAGES[@]}"; do
  if [[ "$DRY_RUN" == "1" ]]; then
    (cd "$dir" && npm publish --dry-run --access public)
  else
    (cd "$dir" && npm publish --access public)
  fi
done

if [[ "$DRY_RUN" == "1" ]]; then
  echo "🧪 Dry run done; nothing published, committed or pushed. The version bump is in the working tree."
  exit 0
fi

git add -A
git commit -m "Release ${VERSION}"
git tag "${TAG_PREFIX}${VERSION}"
git push origin HEAD
git push origin "${TAG_PREFIX}${VERSION}"
echo "🎉 Released ${VERSION} (${TAG_PREFIX}${VERSION})"
