<script setup lang="ts">
import { ICONS } from "@wallet-connect/core"
import { useT } from "../keys"
import Icon from "./Icon.vue"

// With `back`, a back arrow in the top-left corner (the install QR code screen uses it).
defineProps<{ back?: boolean }>()
const emit = defineEmits<{ back: [] }>()
const t = useT()
</script>

<template>
  <header>
    <button v-if="back" type="button" class="wcb-back" :aria-label="t('back')" data-testid="back_header_button" @click="emit('back')">
      <icon :d="ICONS.back" :size="24" aria-hidden="true"></icon>
    </button>
    <h1>{{ t("modal_header") }}</h1>
  </header>
</template>
