export type QuotaState = 'signed-out' | 'connecting' | 'ready' | 'stale' | 'expired' | 'resetting' | 'unavailable' | 'forbidden'
export type Mood = 'abundant' | 'normal' | 'warning' | 'danger'
export interface Quota {
  limit: number; used: number; remaining: number; percent: number; exceeded: boolean;
  estimatedAt: string; serverAt: string; receivedAt: number; day: string;
}
export interface Settings {
  alwaysOnTop: boolean; clickThrough: boolean; launchAtLogin: boolean;
  size: 'standard' | 'compact' | 'mini'; theme: 'auto' | 'day' | 'night';
  reducedMotion: boolean; notifications: boolean;
}
export interface AppState {
  status: QuotaState; quota: Quota | null; message: string; syncing: boolean;
  settings: Settings; version: string; persistentLogin: boolean; loginOpen: boolean;
}
export interface DesktopAPI {
  getState(): Promise<AppState>; login(): Promise<void>; logout(): Promise<void>;
  refresh(): Promise<void>; settings(patch: Partial<Settings>): Promise<void>;
  openSettings(): Promise<void>; hide(): Promise<void>; quit(): Promise<void>;
  openPortal(): Promise<void>; openReleases(): Promise<void>; screenshot(): Promise<string | null>;
  onState(callback: (state: AppState) => void): () => void;
}
export const DEFAULT_SETTINGS: Settings = {
  alwaysOnTop: true, clickThrough: false, launchAtLogin: false, size: 'standard',
  theme: 'auto', reducedMotion: false, notifications: true,
}
