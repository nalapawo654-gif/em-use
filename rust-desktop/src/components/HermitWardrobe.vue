<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api, appState as state } from '../bridge'
import { evolution } from '../evolution/controller'
import type { HermitSkin, Settings } from '../shared/types'
import { HERMIT_SKINS, HERMIT_ACCESSORIES, HERMIT_PROPS } from '../hermit/catalog'
import { beginHermit } from '../hermit/play'
import HermitVisual from './HermitVisual.vue'
import HermitSprite from './HermitSprite.vue'
const emit = defineEmits<{ saved: [] }>()
const candidate = ref<HermitSkin>(state.settings.hermitSkin), error = ref(''), saving = ref(false), inspecting = ref(false)
const label = computed(() => HERMIT_SKINS.find(s => s.id === candidate.value)!)
watch(() => state.settings.hermitSkin, value => { candidate.value = value })
function inspect(skin: HermitSkin) { candidate.value = skin; inspecting.value = true; error.value = '' }
async function save(patch: Partial<Settings>, close = false) {
  if (saving.value) return
  saving.value = true; error.value = ''
  try { await api.settings(patch); if (close) { inspecting.value = false; emit('saved') } } catch { error.value = '装扮未能保存，请重试。' } finally { saving.value = false }
}
</script>
<template><div class="hermit-wardrobe"><div class="hermit-home-options"><button v-for="item in HERMIT_SKINS" :key="item.id" :disabled="saving" :aria-pressed="candidate === item.id" :aria-label="'试住' + item.label" @click="inspect(item.id)"><HermitVisual :percent="100" :skin="item.id" gentle/><b>{{ evolution.awake ? item.awake : item.label }}</b><small>{{ state.settings.hermitSkin === item.id ? '现在住这里' : '试住看看' }}</small></button></div><div class="hermit-try-home" :key="candidate"><HermitVisual :skin="candidate" :percent="70" :accessory="state.settings.hermitAccessory" :play="beginHermit('knock', 0)" :now="1000" gentle/><HermitSprite v-if="inspecting" prop :frame="6" class="hermit-ruler"/><div><b>{{ evolution.awake ? label.awake : label.label }}</b><p>{{ label.hint }}</p><small>试住不会保存，确认后才搬家。</small><button class="hermit-save" :disabled="saving" @click="save({ hermitSkin: candidate }, true)">{{ saving ? '正在保存…' : '住这里' }}</button></div></div><fieldset :disabled="saving"><legend>随身装饰 · 选一件</legend><div class="hermit-prop-options"><button v-for="item in HERMIT_ACCESSORIES" :key="item.id" :aria-pressed="state.settings.hermitAccessory === item.id" @click="save({ hermitAccessory: item.id })"><HermitSprite v-if="item.frame !== null" prop :frame="item.frame"/><span v-else class="hermit-none">—</span><span>{{ item.label }}</span></button></div></fieldset><fieldset :disabled="saving"><legend>门前摆件 · 选一件</legend><div class="hermit-prop-options"><button v-for="item in HERMIT_PROPS" :key="item.id" :aria-pressed="state.settings.hermitProp === item.id" @click="save({ hermitProp: item.id })"><HermitSprite v-if="item.frame !== null" prop :frame="item.frame"/><span v-else class="hermit-none">—</span><span>{{ item.label }}</span></button></div></fieldset><p v-if="error" role="alert">{{ error }}</p></div></template>
