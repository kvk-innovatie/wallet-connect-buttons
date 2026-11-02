<script setup lang="ts">
import { onboardingLink, type InstallRole } from "@wallet-connect/core"
import { computed } from "vue"
import { clientIdKey, helpBaseUrlKey, injectStrict, useT } from "../keys"
import { inject } from "vue"
import QrCode from "./QrCode.vue"

// Desktop hand-off to the phone: the onboarding link as a QR code; scanned with the camera it opens
// the app when installed and otherwise the app store, carrying service id and role.
const props = defineProps<{ role: InstallRole }>()
const helpBaseUrl = injectStrict(helpBaseUrlKey)
const clientId = inject(clientIdKey, undefined)
const t = useT()
const qrLink = computed(() => onboardingLink(helpBaseUrl, clientId as string, props.role, true))
</script>

<template>
  <section class="wcb-install" data-testid="install_section" :data-role="role">
    <div v-if="role === 'employee'" class="wcb-intro" data-testid="install_employee_intro">
      <p class="wcb-intro-title">{{ t("help_employee_title") }}</p>
      <p>{{ t("help_employee_description") }}</p>
    </div>
    <qr-code :ul="qrLink" :title="t('install_title')"></qr-code>
    <p>{{ t("install_body") }}</p>
  </section>
</template>
