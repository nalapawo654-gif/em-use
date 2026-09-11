// Percentages of the square native window; the action dock is outside all art.
export const HAMSTER_LAYOUT = {
  visual: { x: 30, y: 10, width: 68, height: 68 },
  quota: { x: 3, y: 15, width: 33, height: 23 },
  cat: { x: 1, y: 44, width: 32, height: 32 },
  cup: { x: 30, y: 63, width: 18, height: 17 },
  generator: { x: 82, y: 55, width: 17, height: 25 },
  actionDock: { x: 3, y: 82, width: 94, height: 17 },
} as const
export function overlaps(a: {x:number;y:number;width:number;height:number}, b: {x:number;y:number;width:number;height:number}) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}
export function hamsterRunFrame(time: number, tired: boolean, reduced: boolean) {
  return (tired ? 6 : 0) + (reduced ? 0 : Math.floor(Math.max(0,time) / (tired ? 120 : 90)) % 6)
}
