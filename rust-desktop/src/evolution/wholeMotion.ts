/** Gentle continuous deformation of a complete clothed figure; no old body pieces. */
export function drawAwakenedMotion(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, motion: string, progress: number, variation=1) {
  ctx.clearRect(0,0,512,512)
  const envelope=Math.sin(Math.PI*Math.max(0,Math.min(1,progress)))**2, phase=progress*Math.PI*2
  const sway=['eyes','look','ears','wiggle'].includes(motion)?Math.sin(phase*2)*5*envelope*variation:0
  const lift=motion==='stretch'?-12*envelope:motion==='nod'||motion==='yawn'?Math.sin(phase)*6*envelope:0
  // Horizontal bands share edges and keep the ground line fixed.
  for(let y=0;y<512;y+=4){
    const weight=Math.max(0,1-y/480),dx=sway*weight,dy=lift*weight
    ctx.drawImage(image,0,y,512,4,dx,y+dy,512,4*(1-lift/480)+.15)
  }
}
