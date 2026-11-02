import type { Brand } from "./types"

export const bw: Brand = {
  id: "bw",
  name: "Business Wallet",
  cssClass: "wcb-business",
  translations: {
    en: {
      wallet_button_text: "Login with Business Wallet",
      modal_header: "Business Wallet",
      device_choice_title: "On which device is your Business Wallet app installed?",
      help_title: "No Business Wallet App yet? Or need help?",
      help_to_website: "To Business Wallet website",
      help_issuance_title: "No Business Wallet app yet?",
      in_progress_title: "Follow the steps in your Business Wallet app",
      qr_code_title: "Scan the QR code with your Business Wallet app",
    },
    nl: {
      wallet_button_text: "Inloggen met Business Wallet",
      modal_header: "Business Wallet",
      device_choice_title: "Op welk apparaat staat je Business Wallet app?",
      help_title: "Nog geen Business Wallet app? Of hulp nodig?",
      help_to_website: "Naar Business Wallet website",
      help_issuance_title: "Nog geen Business Wallet app?",
      in_progress_title: "Volg de stappen in de Business Wallet app",
      qr_code_title: "Scan de QR-code met je Business Wallet app",
    },
  },
  hosts: {
    disclosure: "https://bw.wallet-connect.eu",
    issuance: "https://bw.issuance.wallet-connect.eu",
    localDisclosure: "http://bw.localhost:5021",
    localIssuance: "http://localhost:5017",
  },
  deepLinkScheme: "businesswalletdebuginteraction://ebwallet.org",
  idParam: "client_id",
  idPath: "client",
  helpBaseUrl: "https://ebwallet.org/download",
}
