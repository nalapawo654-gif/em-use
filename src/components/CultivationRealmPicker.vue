<script setup lang="ts">
import { ref } from 'vue'
import { PhSun, PhCloudRain, PhMoonStars, PhLightning, PhSparkle, PhFlowerLotus, PhShuffle } from '@phosphor-icons/vue'
import { CULTIVATION_REALMS, type CultivationRealm } from '../shared/types'
import { api, appState as state } from '../bridge'
import CultivationMaterial from './CultivationMaterial.vue'
import { islandForRealm } from '../cultivation/training'
defineProps<{ currentRealm?: CultivationRealm; canShuffle?: boolean }>()
const emit=defineEmits<{shuffle:[]}>()
const scenicRealms = CULTIVATION_REALMS.filter(r=>!['tribulation','enlightened'].includes(r.id))
const icons = [PhSun, PhCloudRain, PhMoonStars, PhLightning, PhSparkle, PhFlowerLotus]
const notice = ref('')
async function choose(cultivationRealm: CultivationRealm) { try { await api.settings({ cultivationRealm, cultivationRandom:false }); notice.value = '' } catch { notice.value = '仙境暂未保存，请重试' } }
async function randomize(){try{await api.settings({cultivationRandom:!state.settings.cultivationRandom});notice.value=''}catch{notice.value='随机设置暂未保存，请重试'}}
</script>
<template><div class="cultivation-realm-controls"><div class="cultivation-random-controls"><button role="switch" :aria-checked="state.settings.cultivationRandom" aria-label="随机修炼仙境" @click="randomize"><PhShuffle/><span>随缘修炼<small>{{state.settings.cultivationRandom?'随功法偶遇日常与奇遇':'固定仙境'}}</small></span><i>{{state.settings.cultivationRandom?'开':'关'}}</i></button><button v-if="canShuffle" aria-label="换一段修炼机缘" @click="emit('shuffle')">换一段机缘 ↻</button></div><p class="cultivation-random-hint">{{state.settings.reducedMotion?'轻柔模式中，自动轮换暂停，可手动换机缘。':state.settings.cultivationRandom?'功法各有小插曲，偶尔遇见渡劫与顿悟。互动时暂停。':'点击随缘修炼，恢复随机轮换。'}} 点击下方仙境可固定。</p><div class="cultivation-realms"><button v-for="(realm, i) in scenicRealms" :key="realm.id" :class="'realm-' + realm.id" :aria-label="'固定仙境'+realm.label" :aria-pressed="(currentRealm ?? state.settings.cultivationRealm) === realm.id" @click="choose(realm.id)"><CultivationMaterial atlas="islands" :index="islandForRealm(realm.id)"/><component :is="icons[i]" weight="duotone"/><b>{{ realm.label }}</b><small>{{ realm.hint }}</small></button><p v-if="notice" role="status">{{ notice }}</p></div></div></template>
