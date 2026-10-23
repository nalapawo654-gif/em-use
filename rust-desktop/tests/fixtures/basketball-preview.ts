// Standalone browser harness: real game + shared quota/gesture/UI, no native claims.
import { createApp, h, computed } from 'vue'
import BasketballExperience from '../../src/components/BasketballExperience.vue'
import { api, appState, quotaDisplay, isDesktop, previewQuota } from '../../src/bridge'
import { useEvolutionController } from '../../src/evolution/controller'
import '../../src/style.css'
import '../../src/window.css'
import '../../src/pet-arc.css'
import '../../src/basketball.css'
import '../../src/calendar.css'
import '../../src/message-notice.css'
import '../../src/update-notice.css'
if (!isDesktop) { await api.settings({ scene: 'basketball', theme: 'day', quotaSource: 'eastmoney' }); previewQuota(75) }
createApp({ setup() {
  useEvolutionController()
  const night = computed(() => appState.settings.theme === 'night')
  return () => h('main', { class: ['app', 'basketball-app', { night: night.value, native: isDesktop, 'reduced-motion': appState.settings.reducedMotion }] }, [h(BasketballExperience, { percent: quotaDisplay.value.percent, night: night.value, usable: quotaDisplay.value.percent !== null, onSettings: () => api.openSettings() })])
} }).mount('#app')
