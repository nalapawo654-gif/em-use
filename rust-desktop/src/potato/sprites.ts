import { ref } from 'vue'
import { loadImage } from '../aquarium/sprites'
import type { PotatoAtlas } from './catalog'
export const potatoRetryVersion = ref(0)
const atlases = new Map<PotatoAtlas,Promise<HTMLImageElement>>()
export function loadPotatoAtlas(atlas:PotatoAtlas) {
 let pending=atlases.get(atlas)
 if(!pending){pending=loadImage(`./assets/potato/${atlas}-atlas.png`).catch(error=>{atlases.delete(atlas);throw error});atlases.set(atlas,pending)}
 return pending
}
