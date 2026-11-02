<script setup lang="ts">
import { ICONS, type SessionType } from "@wallet-connect/core"
import { useT } from "../keys"
import Icon from "./Icon.vue"

defineProps<{ ul: URL }>()
const emit = defineEmits<{ choice: [sessionType: SessionType] }>()
const t = useT()
</script>

<template>
  <h2>{{ t("device_choice_title") }}</h2>
  <section class="wcb-buttons" data-testid="device_choice">
    <a
      role="button"
      :href="ul.toString()"
      target="_blank"
      class="wcb-action wcb-primary"
      data-testid="same_device_button"
      @click="emit('choice', 'same_device')"
    >
      <icon :d="ICONS.forward"></icon>
      <span>{{ t("device_choice_same_device") }}</span>
    </a>
    <button type="button" class="wcb-action wcb-secondary" data-testid="cross_device_button" @click="emit('choice', 'cross_device')">
      <icon :d="ICONS.forward"></icon>
      <span>{{ t("device_choice_cross_device") }}</span>
    </button>
  </section>
</template>
