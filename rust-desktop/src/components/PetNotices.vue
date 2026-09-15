<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import PetUpdateNotice from './PetUpdateNotice.vue'
import PetMessageNotice from './PetMessageNotice.vue'
// Entry visibility and arrival interruptions are separate: a busy pet can still carry mail.
const props=withDefaults(defineProps<{externalBlocked?:boolean;externalDeferred?:boolean;blocked?:boolean;messageBlocked?:boolean;messageDeferred?:boolean}>(),{messageBlocked:undefined})
const emit=defineEmits<{openChange:[value:boolean]}>()
const update=ref(false),message=ref(false),bubble=ref(false)
const anyOpen=computed(()=>update.value||message.value)
watch(anyOpen,v=>emit('openChange',v))
</script>
<template>
  <PetUpdateNotice :blocked="props.externalBlocked||props.externalDeferred||props.blocked||message||bubble" @open-change="update=$event"/>
  <PetMessageNotice :blocked="props.externalBlocked||(props.messageBlocked ?? props.blocked)||update" :deferred="props.externalDeferred||props.messageDeferred" @open-change="message=$event" @bubble-change="bubble=$event"><template v-if="$slots.parcel" #parcel><slot name="parcel"/></template></PetMessageNotice>
</template>
