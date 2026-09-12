export type QuotaState = 'signed-out' | 'connecting' | 'ready' | 'stale' | 'expired' | 'resetting' | 'unavailable' | 'forbidden'
export type Mood = 'abundant' | 'normal' | 'warning' | 'danger'
export interface Quota {
  limit: number; used: number; remaining: number; percent: number; exceeded: boolean;
  estimatedAt: string; serverAt: string; receivedAt: number; day: string;
}
export type Outfit = 'classic' | 'sailor' | 'royal' | 'ribbon'
export type Scene = 'skadi' | 'dinosaur' | 'luckycat' | 'fox' | 'feidudu' | 'aquarium' | 'buddy' | 'beaver' | 'hamster' | 'cultivation' | 'battery'
export const SCENE_LABELS: Record<Scene, string> = { skadi: '斯卡蒂 · 月汐', dinosaur: '摸鱼小恐龙', luckycat: '破产招财猫', fox: '水墨小狐', feidudu: '肥嘟嘟', aquarium: '额度小鱼缸', buddy: '充气牛马', beaver: '林间海狸鼠', hamster: '仓鼠动力机房', cultivation: '修仙渡劫事务所', battery: '健身电池人' }
export type SkadiForm = 'chibi' | 'adult'
export type SkadiSkin = 'classic' | 'moonlight' | 'gothic' | 'sakura' | 'azure' | 'pajamas'
export type SkadiWeapon = 'sword' | 'scythe' | 'staff' | 'twins' | 'bow' | 'butterfly'
export const SKADI_FORMS: { id: SkadiForm; label: string; hint: string }[] = [
  { id: 'adult', label: '御姐', hint: '修长身姿，沉静而优雅' },
  { id: 'chibi', label: '萝莉', hint: '小小身影，软软的陪伴' },
]
export const SKADI_SKINS: { id: SkadiSkin; label: string; hint: string }[] = [
  { id: 'classic', label: '夜海之誓', hint: '黑红缎带，月下最初的约定' },
  { id: 'moonlight', label: '纯白圣歌', hint: '银色蕾丝，披一身温柔月光' },
  { id: 'gothic', label: '暗夜魅影', hint: '黑纱与玫瑰，夜色里的秘密' },
  { id: 'sakura', label: '樱落和服', hint: '绯樱白绢，藏起一缕晚风' },
  { id: 'azure', label: '星穹战姬', hint: '冰蓝铠甲，守护月下的你' },
  { id: 'pajamas', label: '休闲居家', hint: '软软的针织，慢慢说声晚安' },
]
export const SKADI_WEAPONS: { id: SkadiWeapon; label: string; hint: string; color: string }[] = [
  { id: 'sword', label: '赤渊长剑', hint: '月光斩弧 · 剑锋流光', color: '#ed91ab' },
  { id: 'scythe', label: '月蚀镰刀', hint: '绯月轮舞 · 月牙环绕', color: '#c999ec' },
  { id: 'staff', label: '星眠法杖', hint: '星阵咏唱 · 星辉汇聚', color: '#aab4ff' },
  { id: 'twins', label: '冰霜双刃', hint: '双刃交错 · 冰晶绽放', color: '#8fdbff' },
  { id: 'bow', label: '血月弓', hint: '绯红箭雨 · 弓弦蓄光', color: '#ef829a' },
  { id: 'butterfly', label: '灵蝶浮刃', hint: '蝶刃回旋 · 蝶群流舞', color: '#9ea9ff' },
]
export function skadiSelectedSkin(settings: Pick<Settings, 'skadiForm' | 'skadiSkin' | 'skadiAdultSkin'>): SkadiSkin {
  return settings.skadiForm === 'adult' ? settings.skadiAdultSkin : settings.skadiSkin
}
export type DinosaurSkin = 'classic' | 'peach' | 'cream' | 'charcoal'
export const DINOSAUR_SKINS: { id: DinosaurSkin; label: string; hint: string }[] = [
  { id: 'classic', label: '经典绿', hint: '一只原味的小恐龙' },
  { id: 'peach', label: '樱花粉', hint: '把春天穿在身上' },
  { id: 'cream', label: '奶龙黄', hint: '奶油味的好心情' },
  { id: 'charcoal', label: '酷炭黑', hint: '看起来酷，摸起来软' },
]
export type LuckyCatSkin = 'classic' | 'festival' | 'jade' | 'pajamas'
export const LUCKYCAT_SKINS: { id: LuckyCatSkin; label: string; hint: string }[] = [
  { id: 'classic', label: '原味金链', hint: '墨镜推上头，金链晃悠悠' },
  { id: 'festival', label: '财神唐装', hint: '红缎金绣，戴上小财神帽' },
  { id: 'jade', label: '咖啡师', hint: '蓝围裙，奶油衬衫和贝雷帽' },
  { id: 'pajamas', label: '星星睡衣', hint: '绸缎睡衣，晚安小绒球' },
]
export type FoxSkin = 'classic' | 'jade' | 'sepia'
export const FOX_SKINS: { id: FoxSkin; label: string; hint: string }[] = [
  { id: 'classic', label: '水墨', hint: '墨分五色，朱砂一点' },
  { id: 'jade', label: '青墨', hint: '山色入墨，清风作伴' },
  { id: 'sepia', label: '暖墨', hint: '旧笺暖色，落笔温柔' },
]
export type FeiduduSkin = 'classic' | 'peach' | 'cream' | 'black-purple' | 'eleme-blue' | 'jd-red'
export const FEIDUDU_SKINS: { id: FeiduduSkin; label: string; hint: string }[] = [
  { id: 'classic', label: '原味黄', hint: '圆圆的，好心情' },
  { id: 'peach', label: '蜜桃粉', hint: '甜甜的，小欢喜' },
  { id: 'cream', label: '奶油黄', hint: '软软的，慢生活' },
  { id: 'black-purple', label: '小黑紫', hint: '酷酷的，也很圆' },
  { id: 'eleme-blue', label: '饿了么蓝', hint: '蓝蓝的，快乐送达' },
  { id: 'jd-red', label: '狗东红', hint: '红红的，元气开工' },
]
export type BatterySkin = 'classic' | 'nanfu' | 'xiaomi' | 'duracell' | 'byd' | 'catl'
export type BatteryRealm = 'office' | 'balcony' | 'overtime' | 'weekend'
export const BATTERY_SKINS: { id: BatterySkin; label: string; hint: string; color: string; mark: string; body: number }[] = [
  { id: 'classic', label: '元气绿', hint: '原味满格快乐', color: '#77b848', mark: 'ENERGY', body: 0 },
  { id: 'nanfu', label: '北孚', hint: '金黑运动款', color: '#c99b3c', mark: '北孚', body: 1 },
  { id: 'xiaomi', label: '大米', hint: '珊瑚橙的好心情', color: '#ee885f', mark: '大米', body: 2 },
  { id: 'duracell', label: '铜霸王', hint: '经典铜黑配色', color: '#b47d55', mark: '铜霸王', body: 3 },
  { id: 'byd', label: 'A亚迪', hint: '银白红边，蓄势待发', color: '#c4403e', mark: 'AYD', body: 16 },
  { id: 'catl', label: '您德时代', hint: '银蓝运动，稳稳续航', color: '#17689c', mark: '您德时代', body: 17 },
]
export const BATTERY_REALMS: { id: BatteryRealm; label: string; hint: string; prop: number }[] = [
  { id: 'office', label: '工位健身', hint: '摸鱼五分钟，运动两分钟', prop: 19 },
  { id: 'balcony', label: '阳台晨练', hint: '晒晒太阳，伸个懒腰', prop: 12 },
  { id: 'overtime', label: '深夜加班', hint: '放点音乐，陪你慢慢来', prop: 19 },
  { id: 'weekend', label: '周末躺营', hint: '今天的计划：好好休息', prop: 10 },
]
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
  scene: Scene; skadiSkin: SkadiSkin; skadiAdultSkin: SkadiSkin; skadiForm: SkadiForm; skadiWeapon: SkadiWeapon; dinosaurSkin: DinosaurSkin; luckycatSkin: LuckyCatSkin; foxSkin: FoxSkin; feiduduSkin: FeiduduSkin; batterySkin: BatterySkin; batteryRealm: BatteryRealm; cultivationSkin: CultivationSkin; cultivationAccessory: CultivationAccessory; cultivationTreasure: CultivationTreasure; cultivationRandom: boolean; cultivationRealm: CultivationRealm; hamsterSkin: HamsterSkin; buddySkin: BuddySkin; beaverSkin: BeaverSkin; beaverCamp: boolean; beaverMotto: 'gentle' | 'create' | 'rest';
}
export interface AppState {
  loginMode?: 'dongdong' | 'manual' | 'signed-out';
  account?: { id: string; name?: string } | null;
  status: QuotaState; quota: Quota | null; message: string; syncing: boolean;
  update?: { status: 'idle' | 'checking' | 'available' | 'current' | 'downloading' | 'installing' | 'error'; message: string; version?: string; notes?: string; downloaded?: number; total?: number };
  settings: Settings; version: string; persistentLogin: boolean; loginOpen: boolean;
}
export interface DesktopAPI {
  checkUpdate?(): Promise<void>; installUpdate?(): Promise<void>;
  getState(): Promise<AppState>; login(mode?: 'dongdong' | 'manual'): Promise<void>; logout(): Promise<void>;
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
  scene: 'aquarium', skadiSkin: 'classic', skadiAdultSkin: 'classic', skadiForm: 'chibi', skadiWeapon: 'sword', dinosaurSkin: 'classic', luckycatSkin: 'classic', foxSkin: 'classic', feiduduSkin: 'classic', batterySkin: 'classic', batteryRealm: 'office', cultivationSkin: 'classic', cultivationAccessory: 'none', cultivationTreasure: 'none', cultivationRandom: true, cultivationRealm: 'sunny', hamsterSkin: 'classic', buddySkin: 'classic', beaverSkin: 'sunny', beaverCamp: false, beaverMotto: 'gentle',
}
