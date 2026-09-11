import { installNativeBridge } from './native'
void installNativeBridge().then(() => import('./main')).catch(() => {
  const app = document.querySelector('#app')
  if (app) app.textContent = '桌面服务连接失败，请关闭并重新打开 EM Use。'
})
