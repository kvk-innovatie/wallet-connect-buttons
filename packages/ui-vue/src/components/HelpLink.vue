<script setup lang="ts">
import { ICONS } from "@wallet-connect/core"
import { helpBaseUrlKey, injectStrict, useT } from "../keys"
import Icon from "./Icon.vue"

const helpUrl = new URL("/help", injectStrict(helpBaseUrlKey)).toString()
const t = useT()
</script>

<template>
  <a :href="helpUrl" class="wcb-link" data-testid="help">
    <span>{{ t("need_help") }}</span>
    <icon :d="ICONS.external"></icon>
  </a>
</template>
