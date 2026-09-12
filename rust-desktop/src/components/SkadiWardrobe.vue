<script setup lang="ts">
import { computed, ref } from 'vue'
import { PhCheck } from '@phosphor-icons/vue'
import { api, appState as state } from '../bridge'
import { SKADI_SKINS, SKADI_FORMS, skadiSelectedSkin, type SkadiSkin, type SkadiForm } from '../shared/types'
import SkadiVisual from './SkadiVisual.vue'
const notice = ref(''),selected=computed(()=>skadiSelectedSkin(state.settings))
async function choose(skin:SkadiSkin) { try { await api.settings(state.settings.skadiForm==='adult'?{skadiAdultSkin:skin}:{skadiSkin:skin});notice.value='' }catch{notice.value='装扮暂未保存，请重试。'} }
async function form(skadiForm:SkadiForm){try{await api.settings({skadiForm});notice.value=''}catch{notice.value='形态暂未保存，请重试。'}}
</script>
<template><div class="skadi-form-picker" aria-label="月汐形态"><button v-for="item in SKADI_FORMS" :key="item.id" :aria-pressed="state.settings.skadiForm===item.id" @click="form(item.id)"><span>{{item.label}}</span><small>{{item.hint}}</small></button></div><div class="skadi-skins"><button v-for="(skin,index) in SKADI_SKINS" :key="`${state.settings.skadiForm}-${skin.id}`" :aria-pressed="selected===skin.id" @click="choose(skin.id)"><span class="skadi-outfit-number">0{{index+1}}<PhCheck v-if="selected===skin.id"/></span><span class="skadi-outfit-art"><SkadiVisual :percent="100" :form="state.settings.skadiForm" :skin="skin.id" :show-weapon="false" gentle paused/></span><b>{{skin.label}}</b><small>{{skin.hint}}</small></button></div><p v-if="notice" role="status">{{notice}}</p></template>
