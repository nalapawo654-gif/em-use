<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { api, appState as state } from '../bridge'
import { MESSAGE_PERSONAS } from '../shared/messageNotice'
import MessageInbox from './MessageInbox.vue'
const persona=computed(()=>MESSAGE_PERSONAS[state.settings.scene])
function escape(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();void api.hide()}}
onMounted(()=>document.addEventListener('keydown',escape))
onUnmounted(()=>document.removeEventListener('keydown',escape))
</script>
<template><div class="message-panel" :style="{'--msg-color':persona.color}"><MessageInbox closeable @close="api.hide()"/></div></template>
