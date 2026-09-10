export type QuotaState = 'signed-out' | 'connecting' | 'ready' | 'stale' | 'expired' | 'resetting' | 'unavailable' | 'forbidden'
export type Mood = 'abundant' | 'normal' | 'warning' | 'danger'
export interface Quota {
  limit: number; used: number; remaining: number; percent: number; exceeded: boolean;
  estimatedAt: string; serverAt: string; receivedAt: number; day: string;
}
export type Outfit = 'classic' | 'sailor' | 'royal' | 'ribbon'
export type Scene = 'aquarium' | 'buddy' | 'beaver'
export const SCENE_LABELS: Record<Scene, string> = { aquarium: '额度小鱼缸', buddy: '充气牛马', beaver: '林间海狸鼠' }
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
  scene: Scene; buddySkin: BuddySkin; beaverSkin: BeaverSkin; beaverCamp: boolean; beaverMotto: 'gentle' | 'create' | 'rest';
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
  scene: 'aquarium', buddySkin: 'classic', beaverSkin: 'sunny', beaverCamp: false, beaverMotto: 'gentle',
}
