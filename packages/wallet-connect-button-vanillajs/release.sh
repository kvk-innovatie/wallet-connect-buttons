#!/bin/bash
# 1.x vanilla releases are served by jsDelivr from GitHub tags of the ORIGINAL
# repository (github.com/kvk-innovatie/wallet-connect-button-vanillajs). Tags in
# this monorepo do not reach that CDN URL, and the old script's `git add .` /
# `git push origin main` would act on the whole monorepo.
#
# Until 2.0 moves the vanilla button to npm (scripts/release.sh at the repo
# root), publish 1.x hotfixes from a checkout of the original repository.
echo "❌ release.sh is disabled inside the monorepo; see the comment at the top of this file." >&2
exit 1
