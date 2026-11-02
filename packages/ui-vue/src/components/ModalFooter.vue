<script setup lang="ts">
import { ICONS, footerActions, type FooterCommand, type InstallRole, type ModalState } from "@wallet-connect/core"
import { computed } from "vue"
import { helpBaseUrlKey, injectStrict, useT } from "../keys"
import Icon from "./Icon.vue"

const props = defineProps<{ state: ModalState; installRole: InstallRole | null }>()
const emit = defineEmits<{ command: [command: FooterCommand] }>()
const t = useT()
const helpUrl = new URL("/help", injectStrict(helpBaseUrlKey)).toString()
const actions = computed(() => footerActions(props.state, props.installRole))
const iconFor = (name: string) => ICONS[name as "cancel" | "retry" | "check" | "close" | "back"]
</script>

<template>
  <footer>
    <template v-for="action in actions" :key="action.testId">
      <a v-if="action.kind === 'help'" :href="helpUrl" class="wcb-action wcb-link" data-testid="help">
        <icon :d="ICONS.external"></icon>
        <span>{{ t("need_help") }}</span>
      </a>
      <button
        v-else
        type="button"
        class="wcb-action"
        :class="`wcb-${action.variant}`"
        :data-testid="action.testId"
        @click="emit('command', action.command)"
      >
        <icon :d="iconFor(action.icon)"></icon>
        <span>{{ t(action.word) }}</span>
      </button>
    </template>
  </footer>
</template>
