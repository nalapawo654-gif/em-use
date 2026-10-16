<script setup lang="ts">
defineProps<{src:string}>()
</script>
<template><span class="awakened-sprite" data-awakened="true"><img :src="src" alt="" draggable="false"/></span></template>
<style scoped>.awakened-sprite{display:block;position:relative;width:100%;height:100%;pointer-events:none}.awakened-sprite img{display:block;width:100%;height:100%;object-fit:contain}</style>
