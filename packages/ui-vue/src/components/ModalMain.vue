<script setup lang="ts">
import { mainView, type InstallRole, type ModalState, type SessionType } from "@wallet-connect/core"
import { computed, inject, onMounted, ref } from "vue"
import { clientIdKey } from "../keys"
import ConfirmStopSection from "./ConfirmStopSection.vue"
import CreatedSection from "./CreatedSection.vue"
import ErrorSection from "./ErrorSection.vue"
import InProgressSection from "./InProgressSection.vue"
import InstallSection from "./InstallSection.vue"
import LoadingSection from "./LoadingSection.vue"
import SuccessSection from "./SuccessSection.vue"

const props = defineProps<{ state: ModalState; installRole: InstallRole | null }>()
const emit = defineEmits<{ choice: [sessionType: SessionType] }>()

const clientId = inject(clientIdKey, undefined)
const view = computed(() => mainView(props.state, props.installRole, clientId))

const main = ref<HTMLElement | null>(null)
onMounted(() => setTimeout(() => main.value?.focus(), 0))
</script>

<template>
  <main ref="main" tabindex="0">
    <loading-section v-if="view === 'loading'"></loading-section>
    <install-section v-else-if="view === 'install' && installRole" :role="installRole"></install-section>
    <created-section
      v-else-if="view === 'created' && state.kind === 'created'"
      :same-device-ul="state.sameDeviceUl"
      :cross-device-ul="state.crossDeviceUl"
      :session-type="state.session.sessionType"
      @choice="emit('choice', $event)"
    ></created-section>
    <in-progress-section v-else-if="view === 'in-progress'"></in-progress-section>
    <confirm-stop-section v-else-if="view === 'confirm-stop'"></confirm-stop-section>
    <success-section v-else-if="view === 'success' && state.kind === 'success'" :session-type="state.session.sessionType"></success-section>
    <error-section v-else-if="view === 'error' && state.kind === 'error'" :error-type="state.errorType"></error-section>
  </main>
</template>
