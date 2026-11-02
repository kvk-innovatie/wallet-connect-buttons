# The two button repositories

`wallet-connect-buttons` (NP Wallet, Business Wallet, 18up) and `nb-wallet-connect-buttons` (NB Wallet /
ZZP Garantie) were one repository until the `pre-split` tag, and are kept deliberately independent since:
no shared packages, workspaces or releases, so each can evolve on its own.

They still have the same shape (`packages/core`, `packages/ui-*`, the public packages, `examples/`,
`scripts/`), so a fix in one can usually be carried to the other as a patch for as long as the code stays
similar:

```bash
# in the repository that has the fix
git format-patch -1 <commit> --stdout > /tmp/fix.patch
# in the other repository
git am -3 /tmp/fix.patch        # resolve conflicts if the files have drifted
```

Core and UI changes port well; brand files (`packages/core/src/brands/*`) and the public packages are
different by design and should not be ported.
