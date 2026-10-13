import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
createApp(App).mount('#app')

import './play.css'
import './window.css'
import './buddy.css'

import "./beaver.css"

import "./hamster.css"

import './cultivation.css'

import './battery.css'

import './feidudu.css'

import './fox.css'

import './luckycat.css'

import './dinosaur.css'

import './skadi.css'

import "./skadi-v2.css"

import './update-notice.css'

import './message-notice.css'

import './calendar.css'

import './piranha.css'
import './potato.css'

// Vue is mounted, independent of login/quota completion. Hidden WebViews may suspend rAF.
if (new URLSearchParams(location.search).get('view') === 'widget') {
  void import('@tauri-apps/api/core').then(({ isTauri, invoke }) => {
    if (isTauri()) void invoke('startup_event', { kind: 'widget-ready' }).catch(() => {})
  })
}
