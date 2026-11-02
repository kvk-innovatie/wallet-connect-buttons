<script setup lang="ts">
import {
  modalClassNames,
  showBackArrow,
  showHelpSection,
  type FooterCommand,
  type InstallRole,
  type SessionDriver,
  type WalletConnectController,
} from "@wallet-connect/core"
import { onMounted, provide, ref, watch } from "vue"
import { brandKey, clientIdKey, deviceKey, helpBaseUrlKey, issuanceKey, languageKey, translateKey } from "../keys"
import { useConnectState, useSessionState } from "../useSession"
import HelpSection from "./HelpSection.vue"
import ModalFooter from "./ModalFooter.vue"
import ModalHeader from "./ModalHeader.vue"
import ModalMain from "./ModalMain.vue"
import RequestedCredentials from "./RequestedCredentials.vue"

// One opening of the dialog: renders the session's state, owns the install-view toggle.
const props = defineProps<{ controller: WalletConnectController; session: SessionDriver }>()

const state = useSessionState(props.session)
const connect = useConnectState(props.controller)

// Install QR code shown instead of the created screen; purely a view on top of the created state.
const installRole = ref<InstallRole | null>(null)
watch(
  () => state.value.kind,
  (kind) => {
    if (kind !== "created") installRole.value = null
  },
)

const c = props.controller
provide(translateKey, c.t)
provide(languageKey, c.lang)
provide(deviceKey, c.device)
provide(brandKey, c.brand)
provide(helpBaseUrlKey, c.helpBaseUrl)
provide(clientIdKey, c.clientId || undefined)
provide(issuanceKey, c.issuance)

const command = (command: FooterCommand) => {
  switch (command) {
    case "confirmStop":
      return props.session.confirmStop()
    case "stop":
      return void props.session.stop()
    case "retry":
      return void props.session.retry()
    case "installed":
      installRole.value = null
      return
    case "close":
      return props.session.close()
    case "back":
      return void props.session.back()
  }
}

onMounted(() => {
  void props.session.start()
  void props.controller.loadRequestedCredentials()
})
</script>

<template>
  <div class="wcb-overlay" :class="controller.brand.cssClass">
    <aside
      aria-modal="true"
      role="dialog"
      :aria-label="controller.brand.name"
      class="wcb-modal"
      :class="modalClassNames(state, installRole)"
      data-testid="wallet_modal"
    >
      <modal-header :back="showBackArrow(state, installRole)" @back="installRole = null"></modal-header>
      <modal-main :state :install-role="installRole" @choice="session.choose($event)"></modal-main>
      <help-section v-if="showHelpSection(state, installRole)" @install="installRole = $event"></help-section>
      <requested-credentials v-if="showHelpSection(state, installRole)" :credentials="connect.credentials"></requested-credentials>
      <modal-footer :state :install-role="installRole" @command="command"></modal-footer>
    </aside>
  </div>
</template>
