import { foregroundPaw, type MailPainter } from '../shared/characterMail'
export function renderDinosaurMail(ctx:CanvasRenderingContext2D,source:HTMLCanvasElement,frame:number,paint:MailPainter){
 if(frame===1){
  paint(ctx,{x:105,y:320,width:61,height:113},'held')
  foregroundPaw(ctx,source,145,348,18,21)
 }else if(frame===5){
  paint(ctx,{x:272,y:359,width:57,height:105},'lap')
  foregroundPaw(ctx,source,285,359,20,14)
 }else if(frame===6){
  paint(ctx,{x:344,y:365,width:53,height:98},'propped')
 }else if(frame===8){
  paint(ctx,{x:262,y:369,width:51,height:94},'lap')
 }else{
  paint(ctx,{x:423,y:374,width:49,height:91},'ground')
 }
}
