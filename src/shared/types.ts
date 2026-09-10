export type QuotaState = 'signed-out' | 'connecting' | 'ready' | 'stale' | 'expired' | 'resetting' | 'unavailable' | 'forbidden'
export type Mood = 'abundant' | 'normal' | 'warning' | 'danger'
export interface Quota {
  limit: number; used: number; remaining: number; percent: number; exceeded: boolean;
  estimatedAt: string; serverAt: string; receivedAt: number; day: string;
}
export type Outfit = 'classic' | 'sailor' | 'royal' | 'ribbon'
export type Scene = 'aquarium' | 'buddy'
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
  scene: Scene; buddySkin: BuddySkin;
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
  scene: 'aquarium', buddySkin: 'classic',
}
