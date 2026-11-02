<script setup lang="ts">
// One of the dialog's icons: a path, several paths, or [fill, path] pairs (Google Play).
defineProps<{
  d: string | readonly string[] | ReadonlyArray<readonly [string, string]>
  size?: number
  width?: number
  height?: number
  viewBox?: string
}>()
</script>

<template>
  <svg :width="width ?? size ?? 16" :height="height ?? size ?? 16" fill="currentColor" :viewBox="viewBox ?? '0 0 24 24'">
    <template v-if="typeof d === 'string'">
      <path :d="d" />
    </template>
    <template v-else>
      <template v-for="(p, i) in d" :key="i">
        <path v-if="typeof p === 'string'" :d="p" />
        <path v-else :fill="p[0]" :d="p[1]" />
      </template>
    </template>
  </svg>
</template>
