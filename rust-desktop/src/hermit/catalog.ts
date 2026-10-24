import type { HermitSkin, HermitAccessory, HermitProp } from '../shared/types'
export const HERMIT_SKINS: { id: HermitSkin; label: string; awake: string; hint: string }[] = [
  { id: 'box', label: '纸箱小窝', awake: '折纸工程师', hint: '歪胶带，也要贴得很认真。' },
  { id: 'soda', label: '汽水公寓', awake: '汽泡航行员', hint: '敲一敲，听听小家的回声。' },
  { id: 'castle', label: '城堡豪宅', awake: '星堡守护者', hint: '小小城堡，由我守护。' },
]
export const HERMIT_ACCESSORIES: { id: HermitAccessory; label: string; frame: number | null }[] = [
  { id: 'none', label: '轻装', frame: null }, { id: 'leaf', label: '叶片帽', frame: 0 },
  { id: 'badge', label: '歪工牌', frame: 1 }, { id: 'bag', label: '邮差包', frame: 2 },
]
export const HERMIT_PROPS: { id: HermitProp; label: string; frame: number | null }[] = [
  { id: 'none', label: '留点空地', frame: null }, { id: 'stool', label: '瓶盖凳', frame: 3 },
  { id: 'sign', label: '贝壳门牌', frame: 4 }, { id: 'plant', label: '迷你盆栽', frame: 5 },
]
export const HERMIT_ACTIONS = [
  { id: 'knock', label: '敲敲门', hint: '探头看看是谁来了' },
  { id: 'visit', label: '看新房', hint: '先试住，喜欢再搬家' },
  { id: 'tease', label: '逗钳子', hint: '递三次羽毛，抓到就举高高' },
  { id: 'sleep', label: '宅家休息', hint: '收起钳子，歇一会儿' },
] as const
