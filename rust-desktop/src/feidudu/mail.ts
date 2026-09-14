import { foregroundPaw, type MailPainter } from '../shared/characterMail'
export function renderFeiduduMail(ctx:CanvasRenderingContext2D,source:HTMLCanvasElement,frame:number,paint:MailPainter){
 if(frame===1){
  // The drink is already in this atlas frame: hang the letter on that cup.
  paint(ctx,{x:207,y:332,width:59,height:55},'cup','tag')
  foregroundPaw(ctx,source,286,336,39,24)
 }else if(frame===0){
  paint(ctx,{x:151,y:283,width:119,height:166},'held')
  foregroundPaw(ctx,source,142,334,22,26);foregroundPaw(ctx,source,284,333,35,27)
 }else if(frame===2){
  paint(ctx,{x:155,y:350,width:80,height:112},'lap')
  foregroundPaw(ctx,source,140,342,26,25)
 }else if(frame===8){
  paint(ctx,{x:311,y:349,width:76,height:106},'held')
  foregroundPaw(ctx,source,345,367,20,24)
 }else if(frame===5){
  // Both paws hold the snack: the little letter clips onto its paper wrapper.
  paint(ctx,{x:183,y:358,width:61,height:57},'propped','tag')
 }else if(frame===6){
  paint(ctx,{x:76,y:350,width:63,height:59},'propped','tag')
 }else{
  // Rest, exhaustion and belly-up poses share the floor baseline, clear of the face.
  paint(ctx,{x:387,y:357,width:75,height:105},'ground')
 }
}
