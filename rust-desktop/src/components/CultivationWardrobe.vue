<script setup lang="ts">
import { ref } from 'vue'
import { PhCheck, PhMinus } from '@phosphor-icons/vue'
import { CULTIVATION_SKINS, CULTIVATION_ACCESSORIES, CULTIVATION_TREASURES, type Settings } from '../shared/types'
import { api, appState as state } from '../bridge'
import CultivatorSprite from './CultivatorSprite.vue'
import CultivationMaterial from './CultivationMaterial.vue'
const notice=ref('')
async function choose(patch:Partial<Settings>){try{await api.settings(patch);notice.value=''}catch{notice.value='装扮暂未保存，请重试'}}
</script>
<template><div class="cultivation-wardrobe"><h3>仙衣 · 各有风骨</h3><div class="cultivation-skins"><button v-for="skin in CULTIVATION_SKINS" :key="skin.id" :aria-label="'穿上'+skin.label" :aria-pressed="state.settings.cultivationSkin===skin.id" @click="choose({cultivationSkin:skin.id})"><CultivatorSprite :skin="skin.id"/><b>{{skin.label}}</b><small>{{skin.hint}}</small><PhCheck v-if="state.settings.cultivationSkin===skin.id"/></button></div><h3>发饰 · 一点仙缘</h3><div class="cultivation-accessory-options"><button v-for="item in CULTIVATION_ACCESSORIES" :key="item.id" :aria-label="'佩戴'+item.label" :aria-pressed="state.settings.cultivationAccessory===item.id" @click="choose({cultivationAccessory:item.id})"><CultivationMaterial v-if="item.prop!==null" :index="item.prop"/><PhMinus v-else/><span>{{item.label}}</span></button></div><h3>随身物 · 相伴修行</h3><div class="cultivation-accessory-options"><button v-for="item in CULTIVATION_TREASURES" :key="item.id" :aria-label="'携带'+item.label" :aria-pressed="state.settings.cultivationTreasure===item.id" @click="choose({cultivationTreasure:item.id})"><CultivationMaterial v-if="item.prop!==null" :index="item.prop"/><PhMinus v-else/><span>{{item.label}}</span></button></div><p v-if="notice" role="status">{{notice}}</p></div></template>
