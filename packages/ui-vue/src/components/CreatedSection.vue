<script setup lang="ts">
import type { SessionType } from "@wallet-connect/core"
import CopyLink from "./CopyLink.vue"
import DeviceChoice from "./DeviceChoice.vue"
import QrCode from "./QrCode.vue"

defineProps<{ sameDeviceUl: URL; crossDeviceUl: URL; sessionType: SessionType }>()
const emit = defineEmits<{ choice: [sessionType: SessionType] }>()
</script>

<template>
  <device-choice v-if="sessionType === 'same_device'" :ul="sameDeviceUl" @choice="emit('choice', $event)"></device-choice>
  <template v-if="sessionType === 'cross_device'">
    <qr-code :ul="crossDeviceUl"></qr-code>
    <copy-link :ul="crossDeviceUl"></copy-link>
  </template>
</template>
