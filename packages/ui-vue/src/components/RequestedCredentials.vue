<script setup lang="ts">
import type { RequestedCredential } from "@wallet-connect/core"
import { injectStrict, languageKey } from "../keys"

// The credentials the registration asks for, with a link to where each can be obtained.
defineProps<{ credentials: RequestedCredential[] }>()
const nl = injectStrict(languageKey) === "nl"
</script>

<template>
  <section v-if="credentials.length > 0" class="wcb-credentials" data-testid="required_credentials">
    <h3>{{ nl ? "Benodigde Attestaties:" : "Required Credentials:" }}</h3>
    <div v-for="c in credentials" :key="c.credentialKey" class="wcb-credential">
      <span>{{ nl ? c.credentialName.nl : c.credentialName.en }}</span>
      <a v-if="c.websiteUrl" :href="c.websiteUrl" target="_blank" rel="noopener noreferrer">
        {{ nl ? "→ Verkrijg attestatie" : "→ Get credential" }}
      </a>
    </div>
  </section>
</template>
