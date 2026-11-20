// Words of this repository that wallet_web does not have. They live here, not in en.json / nl.json, because
// scripts/sync-from-wallet-web.sh overwrites those two files; translations.ts layers these over them.
export const LOCAL_WORDS = {
  en: {
    copy_link: "Copy link",
    copy_link_copied: "Copied",
    copy_link_manual: "Copy this link:",
  },
  nl: {
    copy_link: "Kopieer link",
    copy_link_copied: "Gekopieerd",
    copy_link_manual: "Kopieer deze link:",
  },
} as const

export type LocalWord = keyof (typeof LOCAL_WORDS)["en"]
