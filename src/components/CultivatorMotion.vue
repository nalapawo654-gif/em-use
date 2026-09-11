<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { CultivationSkin } from '../shared/types'
import CultivatorSprite from './CultivatorSprite.vue'
import { cultivatorVertex, cultivatorFrameOffset } from '../cultivation/motion'
// Authored hand poses plus restrained joint rotation; no whole-body dilation.
const props=defineProps<{frame:number;skin:CultivationSkin;running:boolean;gentle:boolean}>()
const canvas=ref<HTMLCanvasElement>(), fallback=ref(false)
const source=computed(()=>`./assets/cultivation/skins/${props.skin}.png`)
let gl:WebGLRenderingContext|null=null, program:WebGLProgram|null=null, texture:WebGLTexture|null=null
let vertices:WebGLBuffer|null=null, indices:WebGLBuffer|null=null, observer:ResizeObserver|undefined
const points=new Float32Array(25*25*4)
let raf=0, disposed=false, loaded=false, time=0, last=0, rendered=0, previousFrame=props.frame, frameChange=0, generation=0
const uniforms:Record<string,WebGLUniformLocation|null>={}
const vertexSource=`
precision mediump float;
attribute vec2 position;
attribute vec2 texturePosition;
varying vec2 uv;
void main(){
 uv=texturePosition;
 gl_Position=vec4(position.x*2.0-1.0,1.0-position.y*2.0,0.0,1.0);
}`
const fragmentSource=`
precision mediump float;
uniform sampler2D atlas;uniform float frame;uniform float previous;uniform float blend;
uniform float frameOffset;uniform float previousOffset;
varying vec2 uv;
vec4 sampleFrame(float f,float offset){
 vec2 p=uv-vec2(offset,0.0);
 if(p.x<0.0||p.x>1.0)return vec4(0.0);
 return texture2D(atlas,(clamp(p,vec2(.002),vec2(.998))+vec2(mod(f,3.0),floor(f/3.0)))/vec2(3.0,2.0));
}
void main(){gl_FragColor=mix(sampleFrame(previous,previousOffset),sampleFrame(frame,frameOffset),blend);}`
function shader(type:number,source:string){
 const s=gl!.createShader(type)!;gl!.shaderSource(s,source);gl!.compileShader(s)
 if(!gl!.getShaderParameter(s,gl!.COMPILE_STATUS)){const message=gl!.getShaderInfoLog(s);gl!.deleteShader(s);throw Error('shader: '+message)}
 return s
}
function draw(){
 if(!gl||!program||!loaded||disposed||fallback.value||!canvas.value)return
 gl.viewport(0,0,canvas.value!.width,canvas.value!.height)
 gl.clear(gl.COLOR_BUFFER_BIT)
 const blend=props.running?Math.min(1,(time-frameChange)/200):1
 const strength=props.running?(props.gentle?.22:1):0
 for(let y=0;y<=24;y++)for(let x=0;x<=24;x++){
  const i=(y*25+x)*4, u=x/24, v=y/24
  const next=cultivatorVertex(u,v,props.frame,time/1000,strength)
  const prev=blend<1?cultivatorVertex(u,v,previousFrame,time/1000,strength):next
  points[i]=prev[0]+(next[0]-prev[0])*blend;points[i+1]=prev[1]+(next[1]-prev[1])*blend
  points[i+2]=u;points[i+3]=v
 }
 gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferSubData(gl.ARRAY_BUFFER,0,points)
 gl.uniform1f(uniforms.frame!,props.frame);gl.uniform1f(uniforms.previous!,previousFrame)
 gl.uniform1f(uniforms.frameOffset!,cultivatorFrameOffset(props.skin,props.frame))
 gl.uniform1f(uniforms.previousOffset!,cultivatorFrameOffset(props.skin,previousFrame))
 gl.uniform1f(uniforms.blend!,blend)
 gl.drawElements(gl.TRIANGLES,24*24*6,gl.UNSIGNED_SHORT,0)
}
function tick(now:number){
 if(disposed||!props.running)return
 time+=last?Math.min(now-last,60):0;last=now
 if(now-rendered>=1000/30){draw();rendered=now}
 raf=requestAnimationFrame(tick)
}
function schedule(){cancelAnimationFrame(raf);last=0;draw();if(props.running&&!disposed&&!fallback.value)raf=requestAnimationFrame(tick)}
function load(){
 if(!gl||disposed)return
 const token=++generation;loaded=false
 const img=new Image()
 img.onload=()=>{if(disposed||token!==generation||!gl)return;gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);loaded=true;draw()}
 img.onerror=()=>{if(token===generation&&!disposed){fallback.value=true;cancelAnimationFrame(raf)}}
 img.src=source.value
}
watch(source,load)
watch(()=>props.frame,(_,old)=>{previousFrame=old;frameChange=time;draw()})
watch(()=>[props.running,props.gentle],schedule)
onMounted(()=>{
 try{
  gl=canvas.value!.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true})
  if(!gl)throw Error('webgl unavailable')
  program=gl.createProgram()!;const vs=shader(gl.VERTEX_SHADER,vertexSource),fs=shader(gl.FRAGMENT_SHADER,fragmentSource)
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs)
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link: '+gl.getProgramInfoLog(program))
  gl.useProgram(program)
  for(const name of ['frame','previous','blend','frameOffset','previousOffset'])uniforms[name]=gl.getUniformLocation(program,name)
  const cells:number[]=[]
  for(let y=0;y<24;y++)for(let x=0;x<24;x++){const a=y*25+x;cells.push(a,a+1,a+25,a+1,a+26,a+25)}
  vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferData(gl.ARRAY_BUFFER,points.byteLength,gl.DYNAMIC_DRAW)
  for(const [name,offset] of [['position',0],['texturePosition',8]] as const){
   const attr=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,16,offset)
  }
  indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(cells),gl.STATIC_DRAW)
  texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture)
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0)
  observer=new ResizeObserver(()=>{if(!canvas.value)return;const size=Math.max(1,Math.round(canvas.value.clientWidth*Math.min(devicePixelRatio,2)));canvas.value.width=size;canvas.value.height=size;draw()})
  observer.observe(canvas.value!);load();schedule()
 }catch(error){console.warn('Cultivator motion fallback:', error);fallback.value=true}
})
function contextLost(event:Event){event.preventDefault();fallback.value=true;cancelAnimationFrame(raf)}
onUnmounted(()=>{disposed=true;generation++;cancelAnimationFrame(raf);observer?.disconnect();if(gl){gl.deleteTexture(texture);gl.deleteBuffer(vertices);gl.deleteBuffer(indices);gl.deleteProgram(program)}})
</script>
<template><span class="cultivator-motion" :data-frame="frame" :data-skin="skin"><CultivatorSprite v-if="fallback" :frame="frame" :skin="skin"/><canvas v-else ref="canvas" aria-hidden="true" @webglcontextlost="contextLost"></canvas></span></template>
