<script setup lang="ts">
import { ICONS } from "@wallet-connect/core"
import { useT } from "../keys"
import Icon from "./Icon.vue"

const t = useT()
</script>

<template>
  <icon class="wcb-status" :d="ICONS.phoneArrow" :size="24"></icon>
  <h2 data-testid="in_progress">{{ t("in_progress_title") }}</h2>
</template>
