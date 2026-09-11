<script setup lang="ts">
import { ref } from 'vue'
import { PhCheck } from '@phosphor-icons/vue'
import PlaySprite from './PlaySprite.vue'
import { api, appState } from '../bridge'
import { OUTFITS, type Outfit } from '../shared/types'
const emit = defineEmits<{ selected: [label: string] }>()
const error = ref(''), saving = ref(false)
async function select(id: Outfit, label: string) {
  saving.value = true; error.value = ''
  try { await api.settings({ outfit: id }); emit('selected', label) }
  catch { error.value = '装扮未能保存，请重试' }
  finally { saving.value = false }
}
</script>
<template>
  <div class="outfit-options" aria-label="小鱼装扮">
    <button v-for="item in OUTFITS" :key="item.id" :aria-pressed="appState.settings.outfit === item.id" :disabled="saving" :class="{ selected: appState.settings.outfit === item.id }" @click="select(item.id, item.label)">
      <span class="outfit-preview"><PlaySprite name="fish"/><PlaySprite v-if="item.id !== 'classic'" :name="item.id" class="accessory" :class="item.id"/></span>
      <span>{{ item.label }}</span><PhCheck v-if="appState.settings.outfit === item.id" class="outfit-check"/>
    </button>
  </div>
  <p v-if="error" class="inline-notice" role="alert">{{ error }}</p>
</template>
