<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CultivationSkin } from '../shared/types'
import { cultivatorFrameOffset } from '../cultivation/motion'
const props=withDefaults(defineProps<{ frame?: number; skin?: CultivationSkin }>(), { frame: 0, skin: 'classic' })
const failed=ref(false)
const source=computed(()=>`./assets/cultivation/skins/${props.skin}.png`)
watch(source,()=>failed.value=false)
</script>
<template>
  <span class="cultivator-sprite" :data-frame="frame" :data-skin="skin">
    <Transition name="cultivation-pose">
      <span v-if="!failed" :key="source+':'+frame" class="cultivator-frame" :style="{ transform: `translateX(${100 * cultivatorFrameOffset(skin, frame)}%)` }">
        <img :src="source" alt="" draggable="false" :style="{ transform: `translate(${-100/3 * (frame % 3)}%, ${-50 * Math.floor(frame / 3)}%)` }" @error="failed = true"/>
      </span>
      <span v-else class="cultivation-asset-error">仙人素材未加载，请重新打开</span>
    </Transition>
  </span>
</template>
<style scoped>
.cultivator-frame{position:absolute;inset:0;overflow:hidden}
</style>
