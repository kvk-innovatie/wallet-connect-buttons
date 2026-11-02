<script setup lang="ts">
import { ICONS, type SessionType } from "@wallet-connect/core"
import { useT } from "../keys"
import Icon from "./Icon.vue"

defineProps<{ sessionType: SessionType }>()
const t = useT()
</script>

<template>
  <template v-if="sessionType === 'same_device'">
    <icon class="wcb-status" :d="ICONS.phoneCheck" :size="24"></icon>
    <section class="wcb-text" data-testid="success_same_device">
      <h2>{{ t("success_title") }}</h2>
      <p>{{ t("success_body") }}</p>
    </section>
  </template>
  <template v-else>
    <icon class="wcb-status" :d="ICONS.circleCheck" :size="72" view-box="0 0 72 72"></icon>
    <section class="wcb-text" data-testid="success_cross_device">
      <h2>{{ t("success_title") }}</h2>
    </section>
  </template>
</template>
