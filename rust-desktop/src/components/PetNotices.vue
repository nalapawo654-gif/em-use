<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import PetUpdateNotice from './PetUpdateNotice.vue'
import PetMessageNotice from './PetMessageNotice.vue'
const props=defineProps<{blocked?:boolean}>()
const emit=defineEmits<{openChange:[value:boolean]}>()
const update=ref(false),message=ref(false),bubble=ref(false)
const anyOpen=computed(()=>update.value||message.value)
watch(anyOpen,v=>emit('openChange',v))
</script>
<template>
  <PetUpdateNotice :blocked="props.blocked||message||bubble" @open-change="update=$event"/>
  <PetMessageNotice :blocked="props.blocked||update" @open-change="message=$event" @bubble-change="bubble=$event"/>
</template>
