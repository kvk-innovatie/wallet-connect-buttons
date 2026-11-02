<script setup lang="ts">
import { ICONS, type ErrorType } from "@wallet-connect/core"
import { useT } from "../keys"
import HelpLink from "./HelpLink.vue"
import Icon from "./Icon.vue"

defineProps<{ errorType: ErrorType }>()
const t = useT()
</script>

<template>
  <icon class="wcb-status" :d="ICONS.phoneCross" :size="24"></icon>
  <section class="wcb-text">
    <template v-if="errorType === 'expired'">
      <h2 data-testid="expired_header">{{ t("expired_title") }}</h2>
      <p>{{ t("expired_body") }}</p>
    </template>
    <template v-else-if="errorType === 'failed'">
      <h2 data-testid="failed_header">{{ t("failed_title") }}</h2>
      <p>{{ t("failed_body") }}</p>
    </template>
    <template v-else-if="errorType === 'cancelled'">
      <h2 data-testid="cancelled_header">{{ t("cancelled_title") }}</h2>
      <p>{{ t("cancelled_body") }}</p>
    </template>
    <template v-else-if="errorType === 'network'">
      <h2 data-testid="network_header">{{ t("network_title") }}</h2>
      <p>{{ t("network_body") }}</p>
    </template>
  </section>
  <help-link></help-link>
</template>
