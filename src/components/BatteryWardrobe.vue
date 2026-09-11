<script setup lang="ts">
import { ref } from 'vue'
import { api, appState as state } from '../bridge'
import { BATTERY_SKINS, BATTERY_REALMS, type Settings } from '../shared/types'
import BatteryVisual from './BatteryVisual.vue'
import BatteryProp from './BatteryProp.vue'
const notice = ref('')
async function choose(patch: Partial<Settings>) { try { await api.settings(patch); notice.value = '' } catch { notice.value = '装扮保存失败，请重试' } }
</script>
<template>
  <div class="battery-wardrobe">
    <div class="battery-skins"><button v-for="skin in BATTERY_SKINS" :key="skin.id" :aria-label="'电池皮肤：' + skin.label" :aria-pressed="state.settings.batterySkin === skin.id" @click="choose({ batterySkin: skin.id })"><div class="battery-skin-thumb"><BatteryVisual :percent="100" :skin="skin.id" :reduced-motion="true"/></div><span class="battery-fictional-mark" :style="{ color: skin.color }">{{ skin.mark }}</span><b><i :style="{ background: skin.color }"></i>{{ skin.label }}</b><small>{{ skin.hint }}</small></button></div>
    <h3>今天在哪儿锻炼？</h3>
    <div class="battery-realms"><button v-for="realm in BATTERY_REALMS" :key="realm.id" :aria-pressed="state.settings.batteryRealm === realm.id" @click="choose({ batteryRealm: realm.id })"><BatteryProp :index="realm.prop"/><span><b>{{ realm.label }}</b><small>{{ realm.hint }}</small></span></button></div>
    <p class="battery-brand-note">原创趣味名字与字标。装扮与场景独立保存。</p><p v-if="notice" role="alert">{{ notice }}</p>
  </div>
</template>
