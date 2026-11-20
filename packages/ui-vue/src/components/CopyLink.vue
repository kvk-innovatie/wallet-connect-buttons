<script setup lang="ts">
import { COPIED_MS, ICONS, copyToClipboard } from "@wallet-connect/core"
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { useT } from "../keys"
import Icon from "./Icon.vue"

// "Copy link" under the session's QR code: puts the link the code encodes on the clipboard (e.g. for a wallet on
// this computer or a test wallet that cannot scan). Without clipboard access it shows the link to copy by hand.
const props = defineProps<{ ul: URL }>()
const t = useT()
const link = computed(() => props.ul.toString())
const copied = ref(false)
const manual = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const clearTimer = () => {
  if (timer) clearTimeout(timer)
  timer = undefined
}
// an ID step hands out a new link every few seconds: "Copied" belongs to the link that was copied
watch(link, () => {
  clearTimer()
  copied.value = false
})
onBeforeUnmount(clearTimer)

const copy = async () => {
  if (await copyToClipboard(link.value)) {
    copied.value = true
    clearTimer()
    timer = setTimeout(() => (copied.value = false), COPIED_MS)
  } else {
    manual.value = true
  }
}
const select = (event: FocusEvent) => (event.target as HTMLInputElement).select()
</script>

<template>
  <div class="wcb-copy">
    <button type="button" class="wcb-action wcb-link" data-testid="copy_link_button" @click="copy">
      <icon :d="copied ? ICONS.check : ICONS.copy"></icon>
      <span aria-live="polite">{{ copied ? t("copy_link_copied") : t("copy_link") }}</span>
    </button>
    <label v-if="manual">
      <span>{{ t("copy_link_manual") }}</span>
      <input readonly :value="link" data-testid="copy_link_manual" autofocus @focus="select" />
    </label>
  </div>
</template>
