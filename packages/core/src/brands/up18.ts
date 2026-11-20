import { np } from "./np"
import type { Brand } from "./types"

/** 18up: the NP Wallet servers and links, its own name, colours and help page. */
export const up18: Brand = {
  id: "up18",
  name: "18up",
  cssClass: "wcb-over18",
  translations: {
    en: {
      wallet_button_text: "Login with 18up",
      modal_header: "18up",
      device_choice_title: "On which device is your 18up app installed?",
      help_title: "No 18up App yet? Or need help?",
      help_to_website: "To 18up website",
      help_issuance_title: "No 18up app yet?",
      in_progress_title: "Follow the steps in your 18up app",
      qr_code_title: "Scan the QR code with your 18up app",
    },
    nl: {
      wallet_button_text: "Inloggen met 18up",
      modal_header: "18up",
      device_choice_title: "Op welk apparaat staat je 18up app?",
      help_title: "Nog geen 18up app? Of hulp nodig?",
      help_to_website: "Naar 18up website",
      help_issuance_title: "Nog geen 18up app?",
      in_progress_title: "Volg de stappen in de 18up app",
      qr_code_title: "Scan de QR-code met je 18up app",
    },
  },
  hosts: np.hosts,
  // no issuance host of its own: it issues through NP Wallet's wallet-connect.eu, so on the lane as well
  issuanceFlow: np.issuanceFlow,
  deepLinkScheme: np.deepLinkScheme,
  idParam: "client_id",
  idPath: "client",
  helpBaseUrl: "https://18up.eu/nl/install/",
}
