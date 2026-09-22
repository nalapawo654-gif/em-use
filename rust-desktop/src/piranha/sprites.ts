import { ref } from 'vue'
import { loadImage } from '../aquarium/sprites'

export const piranhaRetryVersion = ref(0)
const atlases = new Map<string, Promise<HTMLImageElement>>()
export function loadPiranhaAtlas(atlas: 'character' | 'costume') {
  let pending = atlases.get(atlas)
  if (!pending) {
    pending = loadImage(`./assets/piranha/${atlas}-atlas.png`).catch(error => {
      atlases.delete(atlas)
      throw error
    })
    atlases.set(atlas, pending)
  }
  return pending
}
