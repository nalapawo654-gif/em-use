import { writeFileSync } from 'node:fs'
import { normalizeQuota, quotaFreshness, QuotaError } from '../src/shared/quota'
import { fitBowl, gestureBounds } from '../src/shared/windowGeometry'
const now=Date.parse('2026-09-11T23:59:00+08:00')
const base={dailyCostLimit:'300',currentDayCost:'96',currentTime:'2026-09-11T23:59:00',lastCostEstimateTime:'2026-09-11T23:59:00'}
const bodies=[{code:'000200',data:base},...['000401','401','000403','403','other'].map(code=>({code})),...['0','-1','NaN','.3','1.','',null,'0.3',450].map(v=>({code:'000200',data:{...base,dailyCostLimit:v}})),...['0','-1','NaN','.3','1.','',null,'0.1',450].map(v=>({code:'000200',data:{...base,currentDayCost:v}})),...['2026-09-12T00:02:00','2026-09-10T23:59:00','2026-09-11T23:00:00','bad'].map(v=>({code:'000200',data:{...base,lastCostEstimateTime:v}}))]
const quota=bodies.map(body=>{try{const result=normalizeQuota(body,now);return{body,now,result,freshness:[0,60_000,86400_000].map(offset=>({now:now+offset,status:quotaFreshness(result,now+offset)}))}}catch(e){return{body,now,error:(e as QuotaError).kind}}})
const geometry=[]
for(const area of [{x:0,y:25,width:1920,height:1055},{x:-1920,y:-20,width:1920,height:1080},{x:0,y:0,width:140,height:100}])for(const width of [190,440,800])for(const mode of ['move','nw','ne','sw','se'] as const)for(const [dx,dy]of [[0,0],[-0.5,-0.5],[90,-65],[-1000,1000]]){
const start=fitBowl({x:area.x+50,y:area.y+35,width,height:width},area);geometry.push({start,dx,dy,mode,area,result:gestureBounds(start,dx,dy,mode,area)})}
writeFileSync(new URL('../src-tauri/src/behavior-contract.json',import.meta.url),JSON.stringify({quota,geometry})+'\n')
