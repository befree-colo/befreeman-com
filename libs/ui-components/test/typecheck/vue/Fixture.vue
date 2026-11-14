<script setup lang="ts">
/// <reference path="../../../types/vue.d.ts" />
import type { ChipToggleDetail, ThemeChangeDetail } from '../../../src/types';

function onToggle(e: CustomEvent<ChipToggleDetail>) {
  return e.detail.selected;
}
function onTheme(e: CustomEvent<ThemeChangeDetail>) {
  return e.detail.theme;
}
</script>

<template>
  <div>
    <bf-button variant="ghost" size="sm">Save</bf-button>
    <bf-chip interactive :selected="true" value="aws" @bf-toggle="onToggle">AWS</bf-chip>
    <bf-card variant="outline" highlighted><span slot="heading">Card</span></bf-card>
    <bf-theme-toggle theme="light" @bf-theme-change="onTheme" />
    <!-- @vue-expect-error invalid variant -->
    <bf-button variant="huge">Bad</bf-button>
  </div>
</template>
