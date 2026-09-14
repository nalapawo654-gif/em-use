<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { loadImage } from '../aquarium/sprites'
const canvas=ref<HTMLCanvasElement>(), ready=ref(false), failed=ref(false)
// The source uses the same color-key artwork pipeline as the newer pet rigs.
// Decode once, retain cream paper / blue leather, and remove green edge spill.
let sprite: HTMLCanvasElement | undefined
onMounted(async()=>{
 try {
  const source=await loadImage('./assets/buddy/message-bag.png')
  if(!canvas.value)return
  sprite=canvas.value;sprite.width=source.naturalWidth;sprite.height=source.naturalHeight
  const ctx=sprite.getContext('2d',{willReadFrequently:true})!
  ctx.drawImage(source,0,0)
  const frame=ctx.getImageData(0,0,sprite.width,sprite.height), d=frame.data
  for(let i=0;i<d.length;i+=4){
   const matte=Math.max(0,Math.min(1,(d[i+1]-Math.max(d[i],d[i+2])-25)/85))
   d[i+3]=Math.round(d[i+3]*(1-matte))
   if(matte>0&&matte<1)d[i+1]=Math.min(d[i+1],Math.max(d[i],d[i+2]))
  }
  ctx.putImageData(frame,0,0);ready.value=true
 }catch{failed.value=true}
})
</script>
<template>
 <canvas ref="canvas" class="buddy-mail-art" :data-ready="ready" aria-hidden="true"/>
 <span v-if="failed" class="buddy-mail-fallback" aria-hidden="true">信</span>
</template>
