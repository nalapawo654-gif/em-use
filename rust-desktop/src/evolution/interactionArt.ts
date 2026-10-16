import { onMounted, onScopeDispose, shallowRef } from 'vue'
import rects from './props-manifest.json'
let pending: Promise<HTMLCanvasElement[]> | undefined
export function useAwakeningProps(){
  const art=shallowRef<HTMLCanvasElement[]>();let disposed=false
  onMounted(async()=>{
    try{const result=await (pending??=new Promise<HTMLCanvasElement[]>((resolve,reject)=>{
      const image=new Image();image.onerror=()=>{pending=undefined;reject(new Error('Interaction props failed'))}
      image.onload=()=>resolve(rects.map(([x,y,w,h])=>{const c=document.createElement('canvas');c.width=w!;c.height=h!;c.getContext('2d')!.drawImage(image,x!,y!,w!,h!,0,0,w!,h!);return c}))
      image.src='./assets/evolution/v2/interaction-props.png'
    }));if(!disposed)art.value=result}catch{ /* The original interaction feedback remains visible. */ }
  });onScopeDispose(()=>{disposed=true});return art
}
export function paintInteraction(ctx:CanvasRenderingContext2D,art:HTMLCanvasElement[]|undefined,action:string){
  const index=({tea:0,cookie:1,pillow:2,rest:3,work:4,feed:5} as Record<string,number>)[action]
  if(index===undefined||!art?.[index])return
  const image=art[index]!, boxes=[[205,270,115,175],[260,310,90,90],[150,355,230,125],[100,355,300,135],[145,338,225,150],[210,345,95,60]]
  const [x,y,w,h]=boxes[index]!,scale=Math.min(w!/image.width,h!/image.height)
  ctx.drawImage(image,x!,y!,image.width*scale,image.height*scale)
}
