<script setup lang="ts">
import { ICONS, type Store, type Word } from "@wallet-connect/core"
import { useT } from "../keys"
import Icon from "./Icon.vue"

// The usual black App Store / Google Play download badge. With an `href` it is a link that opens
// the store in a new tab (a phone); without one it is a button that lets the parent show the
// install QR code instead (a desktop, whose badge says "on your phone").
const props = defineProps<{ store: Store; href?: string; label: string }>()
const emit = defineEmits<{ click: [] }>()
const t = useT()
const line = (n: 1 | 2) => t(`${props.store}_store_line${n}` as Word)
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    class="wcb-store-badge"
    :class="`wcb-${store}`"
    :href="href"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener noreferrer' : undefined"
    :type="href ? undefined : 'button'"
    :aria-label="label"
    @click="emit('click')"
  >
    <icon v-if="store === 'apple'" class="wcb-store-badge-icon" :d="ICONS.apple" aria-hidden="true"></icon>
    <icon v-else-if="store === 'google'" class="wcb-store-badge-icon" :d="ICONS.google" aria-hidden="true"></icon>
    <icon v-else class="wcb-store-badge-icon" :d="ICONS.download" aria-hidden="true"></icon>
    <span class="wcb-store-badge-text">
      <small>{{ line(1) }}</small>
      <strong>{{ line(2) }}</strong>
    </span>
  </component>
</template>
