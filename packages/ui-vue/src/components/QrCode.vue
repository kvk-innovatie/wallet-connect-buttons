<script setup lang="ts">
import { drawCanvas, qrcodegen } from "@wallet-connect/core"
import { ref, watch } from "vue"
import { useT } from "../keys"

const props = defineProps<{
  ul: URL
  // Heading above the code; defaults to "scan with your wallet app".
  title?: string
}>()

const t = useT()
const canvas = ref<HTMLCanvasElement | null>(null)

watch(
  [() => props.ul.toString(), canvas],
  ([text, cv]) => {
    if (cv) {
      // MEDIUM recovers 15% of the code: the logo overlay hides about 5% of the modules, which LOW (7%) cannot reliably absorb.
      drawCanvas(qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM), cv)
    }
  },
  { immediate: true },
)
</script>

<template>
  <h2>{{ title ?? t("qr_code_title") }}</h2>
  <div class="wcb-qr" data-testid="qr">
    <canvas ref="canvas"></canvas>
    <div role="img" class="wcb-logo" :aria-label="t('qr_code_label')"></div>
  </div>
</template>
