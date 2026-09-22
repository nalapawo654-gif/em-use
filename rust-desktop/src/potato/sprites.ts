import { ref } from 'vue'
import { loadImage } from '../aquarium/sprites'
import type { PotatoAtlas } from './catalog'
export const potatoRetryVersion = ref(0)
type PotatoArtwork = PotatoAtlas | 'china-flag'
const atlases = new Map<PotatoArtwork,Promise<HTMLImageElement>>()
export function loadPotatoAtlas(atlas:PotatoArtwork) {
 let pending=atlases.get(atlas)
 if(!pending){pending=loadImage(`./assets/potato/${atlas === 'china-flag' ? 'china-flag' : `${atlas}-atlas`}.png`).catch(error=>{atlases.delete(atlas);throw error});atlases.set(atlas,pending)}
 return pending
}
