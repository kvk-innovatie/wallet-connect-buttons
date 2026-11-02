<script setup lang="ts">
import { useT } from "../keys"
import LoadingIndicator from "./LoadingIndicator.vue"

const t = useT()
</script>

<template>
  <section data-testid="loading" class="wcb-text">
    <h2>{{ t("loading_title") }}</h2>
    <p>{{ t("loading_body") }}</p>
  </section>
  <loading-indicator></loading-indicator>
</template>
