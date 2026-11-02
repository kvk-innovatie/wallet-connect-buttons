<script setup lang="ts">
import { useT } from "../keys"
import HelpLink from "./HelpLink.vue"

const t = useT()
</script>

<template>
  <section class="wcb-text">
    <h2 data-testid="confirm_stop">{{ t("confirm_stop_title") }}</h2>
    <p>{{ t("confirm_stop_body") }}</p>
  </section>
  <help-link></help-link>
</template>
