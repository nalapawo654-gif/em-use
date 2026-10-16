<script setup lang="ts">
import { ref, computed } from 'vue'
import { api, appState as state } from '../bridge'
import { POTATO_SKINS, type PotatoSkin } from '../potato/catalog'
import PotatoThumbnail from './PotatoThumbnail.vue'
const error=ref(''),category=ref('全部')
const categories=['全部','机甲英雄','特别机体','异色节日']
const skins=computed(()=>POTATO_SKINS.filter(s=>category.value==='全部'||s.group===category.value))
async function choose(skin:PotatoSkin){try{await api.settings({potatoSkin:skin});error.value=''}catch{error.value='装备未能保存，请重试。'}}
</script>
<template><div class="potato-wardrobe"><nav class="potato-skin-filters" aria-label="土豆装备分类"><button v-for="item in categories" :key="item" :aria-pressed="category===item" @click="category=item">{{item}}<small v-if="item==='全部'">20</small></button></nav><div class="potato-skins"><button v-for="skin in skins" :key="skin.id" :data-skin="skin.id" :aria-label="'装备'+skin.label" :aria-pressed="state.settings.potatoSkin===skin.id" @click="choose(skin.id)"><PotatoThumbnail :skin="skin.id"/><b>{{skin.label}}</b><small>{{skin.adapted ? '参考：' + skin.reference : skin.group}}</small><span v-if="state.settings.potatoSkin===skin.id" class="potato-equipped">已装备</span></button></div><p v-if="error" role="alert">{{error}}</p></div></template>
