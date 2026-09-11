export type QuotaState = 'signed-out' | 'connecting' | 'ready' | 'stale' | 'expired' | 'resetting' | 'unavailable' | 'forbidden'
export type Mood = 'abundant' | 'normal' | 'warning' | 'danger'
export interface Quota {
  limit: number; used: number; remaining: number; percent: number; exceeded: boolean;
  estimatedAt: string; serverAt: string; receivedAt: number; day: string;
}
export type Outfit = 'classic' | 'sailor' | 'royal' | 'ribbon'
export type Scene = 'aquarium' | 'buddy' | 'beaver' | 'hamster' | 'cultivation'
export const SCENE_LABELS: Record<Scene, string> = { aquarium: '额度小鱼缸', buddy: '充气牛马', beaver: '林间海狸鼠', hamster: '仓鼠动力机房', cultivation: '修仙渡劫事务所' }
export type CultivationSkin = 'classic' | 'azure' | 'astral' | 'crimson'
export type CultivationAccessory = 'none' | 'lotus' | 'moon' | 'blossom'
export type CultivationTreasure = 'none' | 'gourd' | 'jade' | 'pouch'
export const CULTIVATION_SKINS: { id: CultivationSkin; label: string; hint: string }[] = [
  { id: 'classic', label: '云岚道袍', hint: '月白流云，清心自在' },
  { id: 'azure', label: '青霄剑修', hint: '青衣银纹，一剑凌云' },
  { id: 'astral', label: '紫微星官', hint: '星河入袖，观天问道' },
  { id: 'crimson', label: '朱雀锦衣', hint: '赤金翎羽，瑞气盈身' },
]
export const CULTIVATION_ACCESSORIES: { id: CultivationAccessory; label: string; prop: number | null }[] = [
  { id: 'none', label: '素簪', prop: null }, { id: 'lotus', label: '白玉莲冠', prop: 4 },
  { id: 'moon', label: '星月宝冠', prop: 5 }, { id: 'blossom', label: '桃花发簪', prop: 6 },
]
export const CULTIVATION_TREASURES: { id: CultivationTreasure; label: string; prop: number | null }[] = [
  { id: 'none', label: '轻装', prop: null }, { id: 'gourd', label: '灵葫', prop: 7 },
  { id: 'jade', label: '双鱼玉佩', prop: 8 }, { id: 'pouch', label: '纳福锦囊', prop: 9 },
]
export type CultivationRealm = 'sunny' | 'rain' | 'night' | 'thunder' | 'tribulation' | 'enlightened'
export const CULTIVATION_REALMS: { id: CultivationRealm; label: string; hint: string }[] = [
  { id: 'sunny', label: '晴天', hint: '云海仙山' }, { id: 'rain', label: '雨天', hint: '荷叶听雨' },
  { id: 'night', label: '夜晚', hint: '观星悟道' }, { id: 'thunder', label: '雷天', hint: '雷霆护体' },
  { id: 'tribulation', label: '雷劫', hint: '特效渡劫' }, { id: 'enlightened', label: '顿悟', hint: '重回巅峰' },
]
export type HamsterSkin = 'classic' | 'worker' | 'nightshift' | 'rain' | 'summer' | 'winter' | 'holiday'
export const HAMSTER_SKINS: { id: HamsterSkin; label: string; hint: string }[] = [
  { id: 'classic', label: '经典', hint: '红发带，元气开工' }, { id: 'worker', label: '日班', hint: '安全帽与背带裤' },
  { id: 'nightshift', label: '夜班', hint: '头灯与工作马甲' }, { id: 'rain', label: '雨天', hint: '雨帽与小雨衣' },
  { id: 'summer', label: '夏日', hint: '墨镜与清凉衬衣' }, { id: 'winter', label: '冬日', hint: '围巾与暖暖毛衣' },
  { id: 'holiday', label: '节日', hint: '圣诞帽与红马甲' },
]
export type BeaverSkin = 'sunny' | 'rain' | 'snow' | 'wind' | 'night'
export const BEAVER_SKINS: { id: BeaverSkin; label: string; hint: string }[] = [
  { id: 'sunny', label: '晴天', hint: '戴上草帽' }, { id: 'rain', label: '雨天', hint: '穿上雨衣' },
  { id: 'snow', label: '下雪', hint: '围上围巾' }, { id: 'wind', label: '刮风', hint: '戴好护目镜' },
  { id: 'night', label: '夜晚', hint: '点亮头灯' },
]
export type BuddySkin = 'classic' | 'worker' | 'holiday' | 'midnight' | 'blossom'
export const BUDDY_SKINS: { id: BuddySkin; label: string }[] = [
  { id: 'classic', label: '经典款' }, { id: 'worker', label: '打工人' }, { id: 'holiday', label: '摸鱼款' },
  { id: 'midnight', label: '酷黑款' }, { id: 'blossom', label: '粉萌款' },
]
export const OUTFITS: { id: Outfit; label: string }[] = [{ id: 'classic', label: '原生小鱼' }, { id: 'sailor', label: '海洋领航员' }, { id: 'royal', label: '小小王冠' }, { id: 'ribbon', label: '今日小可爱' }]
export interface Settings {
  alwaysOnTop: boolean; clickThrough: boolean; launchAtLogin: boolean;
  size: 'standard' | 'compact' | 'mini'; theme: 'auto' | 'day' | 'night';
  windowWidth: number;
  reducedMotion: boolean; notifications: boolean; outfit: Outfit;
  scene: Scene; cultivationSkin: CultivationSkin; cultivationAccessory: CultivationAccessory; cultivationTreasure: CultivationTreasure; cultivationRandom: boolean; cultivationRealm: CultivationRealm; hamsterSkin: HamsterSkin; buddySkin: BuddySkin; beaverSkin: BeaverSkin; beaverCamp: boolean; beaverMotto: 'gentle' | 'create' | 'rest';
}
export interface AppState {
  status: QuotaState; quota: Quota | null; message: string; syncing: boolean;
  settings: Settings; version: string; persistentLogin: boolean; loginOpen: boolean;
}
export interface DesktopAPI {
  getState(): Promise<AppState>; login(): Promise<void>; logout(): Promise<void>;
  refresh(): Promise<void>; settings(patch: Partial<Settings>): Promise<void>;
  beginGesture(mode: import('./windowGeometry.js').WindowGesture): Promise<number>;
  moveGesture(id: number): Promise<void>; endGesture(id: number): Promise<void>;
  openSettings(): Promise<void>; hide(): Promise<void>; quit(): Promise<void>;
  openPortal(): Promise<void>; openReleases(): Promise<void>; screenshot(): Promise<string | null>;
  onState(callback: (state: AppState) => void): () => void;
}
export const DEFAULT_SETTINGS: Settings = {
  alwaysOnTop: true, clickThrough: false, launchAtLogin: false, size: 'standard',
  windowWidth: 440, theme: 'auto', reducedMotion: false, notifications: true, outfit: 'classic',
  scene: 'aquarium', cultivationSkin: 'classic', cultivationAccessory: 'none', cultivationTreasure: 'none', cultivationRandom: true, cultivationRealm: 'sunny', hamsterSkin: 'classic', buddySkin: 'classic', beaverSkin: 'sunny', beaverCamp: false, beaverMotto: 'gentle',
}
