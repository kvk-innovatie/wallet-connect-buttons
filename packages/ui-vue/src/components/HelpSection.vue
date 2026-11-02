<script setup lang="ts">
import { ICONS, onboardingParams, storeForDevice, storeUrl, type InstallRole } from "@wallet-connect/core"
import { computed, inject } from "vue"
import { brandKey, clientIdKey, deviceKey, helpBaseUrlKey, injectStrict, issuanceKey, useT } from "../keys"
import Icon from "./Icon.vue"
import StoreBadge from "./StoreBadge.vue"

// Download badges per role for brands with store links (NB) and a registration id; an issuance
// shows one badge for any wallet holder; every other case the website link.
const emit = defineEmits<{ install: [role: InstallRole] }>()

const brand = injectStrict(brandKey)
const device = injectStrict(deviceKey)
const helpBaseUrl = injectStrict(helpBaseUrlKey)
const clientId = inject(clientIdKey, undefined)
const issuance = inject(issuanceKey, false)
const t = useT()

const showRoleBadges = computed(() => !!brand.store && !!clientId && !issuance)
const showHolderBadge = computed(() => !!brand.store && !!clientId && issuance)
const store = computed(() => storeForDevice(device.isMobile, device.isAndroid))
const badgeHref = (role: InstallRole) =>
  device.isMobile && brand.store ? storeUrl(brand.store, store.value, onboardingParams(clientId as string, role)) : undefined
const onBadgeClick = (role: InstallRole) => {
  if (!device.isMobile) emit("install", role)
}
</script>

<template>
  <section v-if="showRoleBadges" class="wcb-download" data-testid="download_section">
    <div class="wcb-options">
      <div class="wcb-option" data-testid="download_director">
        <p class="wcb-option-title">{{ t("help_director_title") }}</p>
        <p>{{ t("help_director_description") }}</p>
        <store-badge
          :store
          :href="badgeHref('director')"
          :label="t('help_director_link')"
          data-testid="download_director_badge"
          @click="onBadgeClick('director')"
        ></store-badge>
      </div>
    </div>
    <p class="wcb-employee">
      <component
        :is="device.isMobile ? 'a' : 'button'"
        class="wcb-link"
        :href="badgeHref('employee')"
        :target="device.isMobile ? '_blank' : undefined"
        :rel="device.isMobile ? 'noopener noreferrer' : undefined"
        :type="device.isMobile ? undefined : 'button'"
        data-testid="download_employee_link"
        @click="onBadgeClick('employee')"
      >
        {{ t("help_employee_link") }}
      </component>
    </p>
  </section>
  <section v-else-if="showHolderBadge" class="wcb-download" data-testid="download_section">
    <div class="wcb-options">
      <div class="wcb-option" data-testid="download_holder">
        <p class="wcb-option-title">{{ t("help_issuance_title") }}</p>
        <p>{{ t("help_issuance_description") }}</p>
        <store-badge
          :store
          :href="badgeHref('holder')"
          :label="t('help_issuance_link')"
          data-testid="download_holder_badge"
          @click="onBadgeClick('holder')"
        ></store-badge>
      </div>
    </div>
  </section>
  <section v-else class="wcb-website" data-testid="website_link">
    <p>{{ t("help_title") }}</p>
    <p>
      <a :href="helpBaseUrl.toString()" class="wcb-link">
        <icon :d="ICONS.external"></icon>
        <span>{{ t("help_to_website") }}</span>
      </a>
    </p>
  </section>
</template>
