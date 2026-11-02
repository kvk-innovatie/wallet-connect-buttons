import type { Brand } from "./types"

/** NB Wallet. Users see the app as "ZZP Garantie app". */
export const nb: Brand = {
  id: "nb",
  name: "ZZP Garantie app",
  cssClass: "nbwallet",
  translations: {
    en: {
      wallet_button_text: "Login with the ZZP Garantie app",
      modal_header: "ZZP Garantie app",
      device_choice_title: "On which device is your ZZP Garantie app installed?",
      help_title: "No ZZP Garantie app yet? Or need help?",
      help_to_website: "To the ZZP Garantie website",
      help_director_description: "And don't have the ZZP Garantie app yet?",
      help_employee_description:
        "With the ZZP Garantie app you can request an authorisation for this service from the owner or a director of your organisation.",
      help_issuance_title: "No ZZP Garantie app yet?",
      help_issuance_description:
        "Download the ZZP Garantie app and set up your wallet. After that you can add this data to your wallet.",
      in_progress_title: "Follow the steps in your ZZP Garantie app",
      qr_code_title: "Scan the QR code with your ZZP Garantie app",
    },
    nl: {
      wallet_button_text: "Inloggen met de ZZP Garantie app",
      modal_header: "ZZP Garantie app",
      device_choice_title: "Op welk apparaat staat je ZZP Garantie app?",
      help_title: "Nog geen ZZP Garantie app? Of hulp nodig?",
      help_to_website: "Naar de ZZP Garantie website",
      help_director_description: "En heb je de ZZP Garantie app nog niet?",
      help_employee_description:
        "Je kunt via de ZZP Garantie app een machtiging aanvragen voor deze service bij de eigenaar of bestuurder van je organisatie.",
      help_issuance_title: "Nog geen ZZP Garantie app?",
      help_issuance_description:
        "Download de ZZP Garantie app en zet je wallet op. Daarna kun je deze gegevens toevoegen aan je wallet.",
      in_progress_title: "Volg de stappen in de ZZP Garantie app",
      qr_code_title: "Scan de QR-code met je ZZP Garantie app",
    },
  },
  hosts: {
    disclosure: "https://connect.nbwallet.org",
    issuance: "https://issuance.connect.nbwallet.org",
    localDisclosure: "http://localhost:5021",
    localIssuance: "http://localhost:5017",
  },
  deepLinkScheme: "https://nbwallet.org/deeplink",
  idParam: "service_id",
  idPath: "service",
  helpBaseUrl: "https://nbwallet.org/download",
  // The same listings the download page on nbwallet.org uses: the App Store listing of
  // ZZP Garantie (org.nbwallet.app, Dutch storefront only) and the Play listing of org.nbwallet.wallet.
  store: {
    appStoreUrl: "https://apps.apple.com/nl/app/zzp-garantie/id6828780267",
    playStoreBaseUrl: "https://play.google.com/store/apps/details?id=org.nbwallet.wallet",
  },
}
