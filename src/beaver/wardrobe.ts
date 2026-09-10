import type { BeaverSkin } from '../shared/types'
/** Full dressed-head frames, aligned to the shared mouth and neck anchors. */
export const BEAVER_WARDROBE: Record<BeaverSkin,{width:number;x:number;y:number}> = {
  sunny:{width:280,x:-120,y:-125},
  rain:{width:280,x:-120,y:-130},
  snow:{width:280,x:-120,y:-130},
  wind:{width:280,x:-120,y:-130},
  night:{width:280,x:-120,y:-130},
}
