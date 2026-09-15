import type { Scene } from './types'
export const CALENDAR_PROPS = {
 beaver: {name:'林间木牌',asset:'./assets/beaver/calendar-prop.png',x:0,y:73,width:16,height:19,ink:'#654725'},
 hamster: {name:'机房值班牌',asset:'./assets/hamster/calendar-prop.png',x:84,y:14,width:15,height:22,ink:'#694820'},
 cultivation: {name:'云纹玉简',asset:'./assets/cultivation/calendar-prop.png',x:43,y:64,width:21,height:17,ink:'#41676a'},
 battery: {name:'健身计时器',asset:'./assets/battery/calendar-prop.png',x:0,y:47,width:15,height:16,ink:'#ffe8ab'},
 feidudu: {name:'奶油便签',asset:'./assets/feidudu/calendar-prop.png',x:0,y:53,width:14,height:21,ink:'#91612d'},
 dinosaur: {name:'化石日历',asset:'./assets/dinosaur/calendar-prop.png',x:0,y:53,width:14,height:21,ink:'#746048'},
 fox: {name:'水墨书签',asset:'./assets/fox/calendar-prop.png',x:79,y:15,width:20,height:12,ink:'#4f4c44'},
 luckycat: {name:'招福绘马',asset:'./assets/luckycat/calendar-prop.png',x:0,y:52,width:15,height:17,ink:'#95582e'},
 skadi: {name:'月汐手札',asset:'./assets/skadi/calendar-prop.png',x:0,y:58,width:21,height:21,ink:'#45576d'},
} as const satisfies Record<Exclude<Scene,'buddy'|'aquarium'>,{name:string;asset:string;x:number;y:number;width:number;height:number;ink:string}>
export type CalendarPropScene=keyof typeof CALENDAR_PROPS
