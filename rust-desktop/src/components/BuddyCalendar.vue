<script setup lang="ts">
import PetCalendar from './PetCalendar.vue'
defineProps<{blocked?:boolean;deferred?:boolean}>()
const emit=defineEmits<{openChange:[value:boolean]}>()
</script>
<template><PetCalendar appearance="buddy" :blocked="blocked" :deferred="deferred" @open-change="emit('openChange',$event)"/></template>
