<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { FoxSkin } from '../shared/types'
import { foxPose, type FoxAction } from '../fox/play'
import { loadFox } from '../fox/sprites'
import type { FoxMotion } from '../fox/ambient'
import FoxAmbient from './FoxAmbient.vue'
const props = withDefaults(defineProps<{ percent?: number | null; action?: FoxAction; skin?: FoxSkin; gentle?: boolean; paused?: boolean; ambient?: boolean; ambientAllowed?: boolean; sample?: { motion: FoxMotion; progress: number } }>(), { percent: null, action: 'idle', skin: 'classic', gentle: false, paused: false, ambient: false, ambientAllowed: true })
const frames = ref<string[]>([]), error = ref(false), idleMotion = ref<FoxMotion | null>(null), tailFlourish = ref(0)
const pose = computed(() => foxPose(props.percent, props.action))
let disposed = false, loadVersion = 0
async function load() { const version = ++loadVersion; error.value = false; try { const result = await loadFox(props.skin); if (!disposed && version === loadVersion) frames.value = result } catch { if (!disposed && version === loadVersion) error.value = true } }
watch(() => props.skin, load)
onMounted(load); onUnmounted(() => { disposed = true })
</script>
<template>
  <div class="fox-visual" :class="[`fox-${pose}`, `fox-skin-${skin}`, `fox-action-${action}`, { gentle, paused, 'has-ambient': ambient && action === 'idle' }]" :data-loaded="!!frames.length" :data-pose="pose" :data-motion="idleMotion" :style="{ '--fox-tail-flourish': `${tailFlourish}deg` }" aria-hidden="true">
    <div v-if="frames.length" class="fox-motion">
      <template v-if="pose === 'full' || pose === 'unknown'">
        <img class="fox-tail" :src="frames[0]" alt="" draggable="false"/>
        <FoxAmbient v-if="ambient && action === 'idle'" class="fox-body" :level="pose" :skin="skin" :allowed="ambientAllowed" :gentle="gentle" :paused="paused" :sample="sample" @motion="idleMotion = $event" @tail="tailFlourish = $event"/>
        <div v-else class="fox-body"><img class="fox-eyes-open" :src="frames[1]" alt="" draggable="false"/><img class="fox-eyes-closed" :src="frames[2]" alt="" draggable="false"/></div>
      </template>
      <FoxAmbient v-else-if="ambient && action === 'idle'" class="fox-whole" :level="pose" :skin="skin" :allowed="ambientAllowed" :gentle="gentle" :paused="paused" :sample="sample" @motion="idleMotion = $event" @tail="tailFlourish = $event"/>
      <img v-else class="fox-whole" :src="frames[pose === 'medium' ? 3 : pose === 'low' ? 4 : 5]" alt="" draggable="false"/>
    </div>
    <span v-if="!frames.length" class="fox-load">{{ error ? '小狐狸素材未能加载，请切换场景重试。' : '小狐狸正从墨里走来…' }}</span>
    <span v-if="action === 'tail'" class="fox-seal fox-read">阅</span>
    <span v-if="action === 'paper'" class="fox-paper"><b>加班</b><i></i></span>
    <span v-if="action === 'butterfly'" class="fox-butterfly"><i></i><i></i><i></i><i></i></span>
    <span v-if="action === 'bloom'" class="fox-ink-ring"></span>
    <span v-if="action === 'rest' || pose === 'empty'" class="fox-seal fox-blank">留白中</span>
  </div>
</template>
