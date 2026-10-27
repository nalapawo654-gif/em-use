import type { Settings, Scene, HermitSkin, PotatoSkin, PiranhaSkin, SkadiSkin, DinosaurSkin, LuckyCatSkin, FoxSkin, FeiduduSkin, Outfit, BuddySkin, BeaverSkin, HamsterSkin, CultivationSkin, BatterySkin } from '../shared/types'
import { skadiSelectedSkin } from '../shared/types'

export type Motif = 'core' | 'shield' | 'wing' | 'moon' | 'petal' | 'leaf' | 'snow' | 'star' | 'ripple' | 'ember'
export interface AwakeningStyle { name: string; edge: string; light: string; motif: Motif }
type Wardrobes = { basketball: 'home' | 'away' | 'mint'; hermit: HermitSkin; potato: PotatoSkin; piranha: PiranhaSkin; skadi: SkadiSkin; dinosaur: DinosaurSkin; luckycat: LuckyCatSkin; fox: FoxSkin; feidudu: FeiduduSkin; aquarium: Outfit; buddy: BuddySkin; beaver: BeaverSkin; hamster: HamsterSkin; cultivation: CultivationSkin; battery: BatterySkin }
const style = (name: string, edge: string, light: string, motif: Motif): AwakeningStyle => ({ name, edge, light, motif })

// Palette metadata for optional rim effects. Whole costume art is mapped separately
// in atlas-manifest.json; no generic equipment is placed over the original actor.
export const AWAKENING_WARDROBES = {
  basketball: { home: style('小鸡 · 经典背带', '#ffbc72', '#fff2be', 'star'), away: style('小鸡 · 经典背带', '#8edbff', '#e8faff', 'star'), mint: style('小鸡 · 经典背带', '#91ddbd', '#f3f9cf', 'star') },
  hermit: { box: style('折纸工程师', '#a5d9bd', '#e6f4cd', 'leaf'), soda: style('汽泡航行员', '#85cec9', '#e2f7f1', 'ripple'), castle: style('星堡守护者', '#dfbb76', '#fff2c8', 'star') },
  potato: {
    gundam: style('白蓝 · 星核', '#73dfff', '#ffe3a1', 'core'),
    iron: style('红金 · 熔心', '#ffb358', '#ffead0', 'ember'),
    captain: style('蓝盾 · 辉卫', '#81c5ff', '#ffc575', 'shield'),
    batman: style('暗夜 · 翼影', '#c5a66d', '#e3d4af', 'wing'),
    eva: style('紫电 · 共鸣', '#b68aff', '#b5ff7c', 'core'),
    zaku: style('翠甲 · 独眼', '#8ecb9c', '#ff9da7', 'shield'),
    star: style('星际 · 跃迁', '#8ed7ff', '#d8b5ff', 'star'),
    thor: style('雷霆 · 赤辉', '#a6ddff', '#ffd4ad', 'ember'),
    space: style('太空 · 远航', '#d4ebff', '#8ce6e0', 'ripple'),
    redhorn: style('赤角 · 烈焰', '#ff916e', '#ffe1aa', 'ember'),
    freedom: style('自由 · 展翼', '#9acfff', '#f1e7be', 'wing'),
    mark85: style('精工 · 日曜', '#ffd18a', '#ffb797', 'core'),
    captainclassic: style('经典 · 守望', '#9cbaf1', '#ffc68f', 'shield'),
    darkknight: style('黑曜 · 月蚀', '#a9a4d5', '#d9c7a3', 'moon'),
    unicorn: style('元祖 · 破晓', '#a3e7f0', '#ffe8b0', 'wing'),
    pink: style('粉甲 · 星樱', '#ffbedc', '#f7d8a3', 'petal'),
    gold: style('黄金 · 日冕', '#ffe17e', '#fff1bc', 'star'),
    purple: style('赛博 · 极光', '#c394ff', '#80f4e9', 'core'),
    greenholiday: style('圣诞 · 冬青', '#8dddaf', '#ffe1a1', 'leaf'),
    santa: style('驯鹿 · 雪夜', '#ffbb9e', '#e5f7ff', 'snow'),
  },
  piranha: {
    classic: style('赤花 · 日冕', '#ffb68c', '#ffe3a0', 'petal'),
    sakura: style('樱花 · 花信', '#ffb5da', '#ffeddf', 'petal'),
    cactus: style('仙人掌 · 绿洲', '#b2db8b', '#f2dc8e', 'leaf'),
    halloween: style('南瓜 · 夜灯', '#ffad62', '#c7a1ee', 'ember'),
    christmas: style('圣诞 · 冬芽', '#9cd4ac', '#f7dfba', 'snow'),
  },
  skadi: {
    classic: style('夜海 · 绯月', '#e9a5b4', '#ecd2a3', 'moon'),
    moonlight: style('圣歌 · 银辉', '#dce6ff', '#f8eac8', 'wing'),
    gothic: style('魅影 · 月蚀', '#b9a0d7', '#e9b4c6', 'moon'),
    sakura: style('和服 · 樱华', '#f5b5d0', '#f4dfb3', 'petal'),
    azure: style('战姬 · 星霜', '#a2dcfa', '#e1eaff', 'snow'),
    pajamas: style('居家 · 晚安', '#d5bfed', '#efe2bf', 'star'),
  },
  dinosaur: {
    classic: style('翠龙 · 晶脊', '#a5e5bb', '#e2edc2', 'leaf'),
    peach: style('桃龙 · 花晶', '#f7b7cf', '#ffe3b3', 'petal'),
    cream: style('奶龙 · 蜜晶', '#ffe1a0', '#fff0d0', 'star'),
    charcoal: style('炭龙 · 黑曜', '#b6a9d9', '#a7d3ec', 'ember'),
  },
  luckycat: {
    classic: style('金链 · 福星', '#f1cf83', '#fff0bb', 'star'),
    festival: style('唐装 · 瑞锦', '#f4b481', '#ffe0a0', 'ember'),
    jade: style('围裙 · 蓝调', '#a1c8df', '#e5d3ae', 'ripple'),
    pajamas: style('睡衣 · 星眠', '#b8c5e9', '#f0dfb2', 'moon'),
  },
  fox: {
    classic: style('水墨 · 玄金', '#c5aa73', '#eee1bb', 'wing'),
    jade: style('青墨 · 翠灵', '#9dcfbd', '#e0dec0', 'leaf'),
    sepia: style('暖墨 · 秋笺', '#d7b28a', '#efdfbb', 'petal'),
  },
  feidudu: {
    classic: style('原味 · 曙光', '#f1d28c', '#fff0c4', 'star'),
    peach: style('蜜桃 · 花航', '#f1bad2', '#f4e2bd', 'petal'),
    cream: style('奶油 · 暖航', '#ead6a2', '#fff1d2', 'moon'),
    'black-purple': style('黑紫 · 夜航', '#bea0ed', '#a1d5e7', 'core'),
    'eleme-blue': style('蓝 · 风航', '#91d6f1', '#dbecf2', 'wing'),
    'jd-red': style('红 · 炽航', '#f2ad9a', '#f7d6a6', 'ember'),
  },
  aquarium: {
    classic: style('原生 · 珍珠', '#e7cba2', '#d6f5ef', 'ripple'),
    sailor: style('领航 · 潮汐', '#97cde6', '#e4ebdf', 'ripple'),
    royal: style('王冠 · 金珊瑚', '#f4d18b', '#f9e9bc', 'star'),
    ribbon: style('缎带 · 海樱', '#f3b4c8', '#f4dfd1', 'petal'),
  },
  buddy: {
    classic: style('原味 · 曙光', '#e6d4aa', '#f6eacb', 'shield'),
    worker: style('工装 · 精工', '#b4cbd4', '#f4cf95', 'core'),
    holiday: style('度假 · 海风', '#a8d5dc', '#efe0b6', 'ripple'),
    midnight: style('酷黑 · 夜巡', '#b7acdd', '#d9d1e5', 'moon'),
    blossom: style('粉萌 · 花语', '#edbbd5', '#e7dbbd', 'petal'),
  },
  beaver: {
    sunny: style('草帽 · 麦光', '#dec28e', '#f5e8bf', 'leaf'),
    rain: style('雨衣 · 雨露', '#abcfd0', '#e7ecc8', 'ripple'),
    snow: style('围巾 · 雪绒', '#c2def1', '#f4e8d2', 'snow'),
    wind: style('风镜 · 流风', '#b3d0bb', '#e1d0a4', 'wing'),
    night: style('头灯 · 夜工', '#e4c68b', '#b9c9e6', 'star'),
  },
  hamster: {
    classic: style('发带 · 星籽', '#e9bf99', '#f3dfae', 'star'),
    worker: style('工装 · 齿轮', '#e3c87e', '#c3d9e7', 'core'),
    nightshift: style('夜班 · 灯火', '#d6bb7d', '#b7b9e0', 'moon'),
    rain: style('雨衣 · 水珠', '#e1d398', '#b8e3e4', 'ripple'),
    summer: style('夏装 · 晴浪', '#b4ded9', '#f0d5a5', 'wing'),
    winter: style('毛衣 · 霜花', '#b8d4e9', '#eee2c7', 'snow'),
    holiday: style('圣诞 · 铃愿', '#e5b098', '#cde1b3', 'leaf'),
  },
  cultivation: {
    classic: style('云岚 · 太初', '#c4e2df', '#efe3bc', 'ripple'),
    azure: style('青霄 · 剑意', '#a4d1bf', '#dfe2c9', 'wing'),
    astral: style('紫微 · 星河', '#c4b0eb', '#ebd9aa', 'star'),
    crimson: style('朱雀 · 丹翎', '#eab18f', '#f5d7a2', 'ember'),
  },
  battery: {
    classic: style('绿芯 · 生息', '#b3df96', '#e6f1bb', 'leaf'),
    nanfu: style('金黑 · 聚能', '#e9c782', '#f2dfaa', 'core'),
    xiaomi: style('珊瑚 · 朝阳', '#f3b99c', '#ffdfaf', 'ember'),
    duracell: style('铜黑 · 恒温', '#d9ad88', '#eed4ac', 'shield'),
    byd: style('银红 · 赤脉', '#eca6a5', '#f0d4ce', 'ember'),
    catl: style('银蓝 · 澄流', '#9fcce8', '#d5e5ef', 'ripple'),
  },
} satisfies { [S in Exclude<Scene, 'modelmuse'>]: Record<Wardrobes[S], AwakeningStyle> }

export function awakeningStyle(scene: Scene, skin: string): AwakeningStyle | undefined {
  // Model Muse uses quota-specific artwork rather than a selectable skin atlas.
  if (scene === 'modelmuse') return undefined
  // Unknown skins deliberately have no borrowed costume or default palette.
  return (AWAKENING_WARDROBES[scene] as Record<string, AwakeningStyle>)[skin]
}
export function selectedAwakeningSkin(settings: Settings): string {
  const scene = settings.scene
  return scene === 'modelmuse' ? 'base' : scene === 'skadi' ? skadiSelectedSkin(settings) : scene === 'aquarium' ? settings.outfit : settings[`${scene}Skin`]
}
export function appearanceKey(settings: Settings): string {
  return `${settings.scene}/${selectedAwakeningSkin(settings)}/${settings.scene === 'skadi' ? settings.skadiForm : ''}`
}
export function awakeningEnergy(percent: number | null, resting = false, fresh = true): number {
  if (!fresh || percent === null || !Number.isFinite(percent) || percent <= 0 || resting) return 0
  return Math.min(1, Math.max(0, percent / 100))
}
export function isRestingPose(pose?: string): boolean {
  return !!pose && ['sleep', 'rest', 'doze', 'cat-nap', 'empty', 'flat', 'exhausted'].includes(pose)
}
