<script setup lang="ts">
import {
  WalletConnectController,
  ensureFonts,
  ensureStyles,
  selectBrand,
  type SessionDriver,
} from "@wallet-connect/core"
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type PropType } from "vue"
import { warnedConfigs, type ButtonConfig } from "../config"
import { buttonProps } from "../props"
import WalletModal from "./WalletModal.vue"

// The button, the "checking attributes" / error cards, and the dialog (teleported to <body>).
// Attributes such as `class` and `style` fall through to the <button>.
defineOptions({ inheritAttrs: false })

const props = defineProps({
  ...buttonProps,
  config: { type: Object as PropType<ButtonConfig>, required: true },
})

const controller = computed(() => {
  const flags = { business: props.business, over18: props.over18, nbwallet: props.nbwallet }
  if (flags.nbwallet && !props.config.brands.nbwallet && props.config.nbwalletWarning && !warnedConfigs.has(props.config)) {
    warnedConfigs.add(props.config)
    console.warn(props.config.nbwalletWarning)
  }
  return new WalletConnectController({
    brand: selectBrand(props.config.brands, flags),
    clientId: props.serviceId ?? props.clientId,
    apiKey: props.apiKey,
    useLocalWcServer: props.useLocalWcServer,
    issuance: props.issuance,
    lang: props.lang,
    helpBaseUrl: props.helpBaseUrl,
    returnUrl: props.returnUrl,
    label: props.label,
    fetch: props.config.fetch,
    onSuccess: (attributes) => props.onSuccess?.(attributes),
    onFailed: (outcome) => props.onFailed?.(outcome),
  })
})

const mounted = ref(false)

// phase + credentials of whichever controller is current
const connect = shallowRef(controller.value.getState())
watch(
  controller,
  (current, previous, onCleanup) => {
    previous?.unmount()
    connect.value = current.getState()
    const off = current.subscribe((state) => (connect.value = state))
    if (mounted.value) current.mount()
    onCleanup(off)
  },
  { immediate: true },
)
onMounted(() => {
  ensureStyles(document)
  if (props.config.fonts) ensureFonts(document)
  mounted.value = true
  controller.value.mount()
})
onBeforeUnmount(() => {
  controller.value.unmount()
  session.value?.dispose()
  session.value = null
})

const trigger = ref<HTMLButtonElement | null>(null)
const session = shallowRef<SessionDriver | null>(null)
const open = () => {
  if (session.value) return
  const c = controller.value
  session.value = c.createSession(() => {
    session.value?.dispose()
    session.value = null
    void nextTick(() => trigger.value?.focus())
  })
}
</script>

<template>
  <template v-if="connect.phase.kind === 'idle'">
    <button
      ref="trigger"
      type="button"
      class="wcb-button"
      data-part="button"
      data-testid="wallet_button"
      v-bind="$attrs"
      :aria-hidden="session ? 'true' : undefined"
      @click="open"
    >
      <span class="wcb-button__label" data-part="button-span">{{ controller.label }}</span>
    </button>
  </template>
  <div v-else-if="connect.phase.kind === 'checking'" class="attributes" data-testid="checking_attributes">
    <div class="verification-card">
      <h2>Checking attributes...</h2>
      <p>Please wait while we verify your attributes.</p>
    </div>
  </div>
  <div v-else class="attributes" data-testid="attributes_error">
    <div class="verification-card">
      <h2>Error</h2>
      <p>An error occurred while verifying your attributes: {{ connect.phase.message }}</p>
    </div>
  </div>
  <Teleport to="body">
    <wallet-modal v-if="session" :controller :session></wallet-modal>
  </Teleport>
</template>
