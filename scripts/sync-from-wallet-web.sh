#!/usr/bin/env bash
#
# Pull the framework-agnostic parts of wallet_web (the Vue web component the wallet repositories
# maintain, upstream: nl-wallet) into packages/core, and show what changed in the parts that
# were ported by hand (styles, components, translations, device detection) so they can be
# ported again.
#
#   scripts/sync-from-wallet-web.sh [path-to-wallet_web]      (default ../business-wallet/wallet_web)
#
# Copied verbatim:  lib/l10n/*.json, lib/util/qrcodegen.ts, lib/util/draw_qr.ts,
#                   lib/models/openid4vc.ts, lib/models/relying_party.ts, lib/non-free/fonts.ts
# Shown as a diff against the last synced commit (packages/core/UPSTREAM.txt):
#                   lib/style.css, lib/components/*.vue, lib/util/translations.ts,
#                   lib/util/useragent.ts, lib/util/store_links.ts, lib/models/state.ts

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WW="${1:-${WALLET_WEB_DIR:-$ROOT/../business-wallet/wallet_web}}"
[[ -d "$WW/lib" ]] || { echo "❌ wallet_web not found at $WW" >&2; exit 1; }
WW="$(cd "$WW" && pwd)"
CORE="$ROOT/packages/core"
REPO="$(cd "$WW/.." && pwd)"

LAST="$(cut -d' ' -f1 "$CORE/UPSTREAM.txt" 2>/dev/null || true)"
NOW="$(git -C "$REPO" log -1 --format=%H -- wallet_web)"
echo "wallet_web: $WW"
echo "last synced: ${LAST:-never}   current: $NOW"

cp "$WW/lib/l10n/en.json" "$WW/lib/l10n/nl.json" "$CORE/src/i18n/"
cp "$WW/lib/util/qrcodegen.ts" "$CORE/src/qr/qrcodegen.ts"
sed 's|from "@/util/qrcodegen"|from "./qrcodegen"|' "$WW/lib/util/draw_qr.ts" > "$CORE/src/qr/draw_qr.ts"
cp "$WW/lib/models/openid4vc.ts" "$WW/lib/models/relying_party.ts" "$CORE/src/session/"
cp "$WW/lib/non-free/fonts.ts" "$CORE/src/fonts/ro-sans.ts"
node -e 'const fs=require("fs");const en=JSON.parse(fs.readFileSync(process.argv[1]+"/src/i18n/en.json","utf8"));const keys=Object.keys(en).sort();fs.writeFileSync(process.argv[1]+"/src/i18n/words.ts","// Generated from en.json by scripts/sync-from-wallet-web.sh; checked by test/translations.test.ts.\nexport const WORDS = [\n"+keys.map(k=>`  "${k}",`).join("\n")+"\n] as const\n\nexport type Word = (typeof WORDS)[number]\n")' "$CORE"
echo "✅ copied l10n (+ words.ts), qrcodegen, draw_qr, models, fonts"

if [[ -n "$LAST" && "$LAST" != "$NOW" ]]; then
  echo
  echo "=== hand-ported files changed upstream since $LAST (port these by hand) ==="
  git -C "$REPO" diff --stat "$LAST" "$NOW" -- \
    wallet_web/lib/style.css wallet_web/lib/components wallet_web/lib/util/translations.ts \
    wallet_web/lib/util/useragent.ts wallet_web/lib/util/store_links.ts wallet_web/lib/models/state.ts
  echo "(full diff: git -C $REPO diff $LAST $NOW -- wallet_web/lib)"
fi

git -C "$REPO" log -1 --format='%H %ad %s' --date=short -- wallet_web > "$CORE/UPSTREAM.txt"
echo "📝 $CORE/UPSTREAM.txt updated"
echo "Now: npm test && npm run build"
