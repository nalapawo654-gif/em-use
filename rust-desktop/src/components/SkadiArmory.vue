<script setup lang="ts">
import { ref } from 'vue'
import { api, appState as state } from '../bridge'
import { SKADI_WEAPONS, type SkadiWeapon as WeaponId } from '../shared/types'
import SkadiWeapon from './SkadiWeapon.vue'
const notice = ref('')
async function choose(skadiWeapon: WeaponId) { try { await api.settings({ skadiWeapon }); notice.value = '' } catch { notice.value = '武器暂未保存，请重试。' } }
</script>
<template><div class="skadi-armory"><button v-for="weapon in SKADI_WEAPONS" :key="weapon.id" :aria-pressed="state.settings.skadiWeapon===weapon.id" @click="choose(weapon.id)"><span><SkadiWeapon :weapon="weapon.id" gentle paused thumbnail/></span><b>{{weapon.label}}</b><small>{{weapon.hint}}</small><i>{{state.settings.skadiWeapon===weapon.id?'已装备':'装备'}}</i></button></div><p class="skadi-armory-note">武器握在手中，换装或切换形态也会保留。释放技能时随手臂一起运动。</p><p v-if="notice" role="status">{{notice}}</p></template>
