import { POTATO_SKINS } from '../potato/catalog'
import type { Settings } from './types.js'

export const SETTINGS_STRINGS = { codexExecutable: 4096, codexHome: 4096, codexBucket: 128 }
export const SETTINGS_ENUMS = {
  quotaSource: ['eastmoney', 'codex'],
  evolutionMotion: ['full', 'light', 'off'],
  size: ['standard', 'compact', 'mini'], theme: ['auto', 'day', 'night'],
  outfit: ['classic', 'sailor', 'royal', 'ribbon'], scene: ['modelmuse', 'basketball', 'hermit', 'potato', 'piranha', 'skadi', 'dinosaur', 'luckycat', 'fox', 'feidudu', 'aquarium', 'buddy', 'beaver', 'hamster', 'cultivation', 'battery'],
  hermitSkin: ['box', 'soda', 'castle'],
  hermitAccessory: ['none', 'leaf', 'badge', 'bag'],
  hermitProp: ['none', 'stool', 'sign', 'plant'],
  basketballSkin: ['home', 'away', 'mint'],
  potatoSkin: POTATO_SKINS.map(skin => skin.id) as string[],
  piranhaSkin: ['classic', 'sakura', 'cactus', 'halloween', 'christmas'],
  skadiSkin: ['classic', 'moonlight', 'gothic', 'sakura', 'azure', 'pajamas'],
  skadiAdultSkin: ['classic', 'moonlight', 'gothic', 'sakura', 'azure', 'pajamas'],
  skadiForm: ['chibi', 'adult'],
  skadiWeapon: ['sword', 'scythe', 'staff', 'twins', 'bow', 'butterfly'],
  dinosaurSkin: ['classic', 'peach', 'cream', 'charcoal'],
  luckycatSkin: ['classic', 'festival', 'jade', 'pajamas'],
  foxSkin: ['classic', 'jade', 'sepia'],
  feiduduSkin: ['classic', 'peach', 'cream', 'black-purple', 'eleme-blue', 'jd-red'],
  batterySkin: ['classic', 'nanfu', 'xiaomi', 'duracell', 'byd', 'catl'],
  batteryRealm: ['office', 'balcony', 'overtime', 'weekend'],
  cultivationSkin: ['classic', 'azure', 'astral', 'crimson'],
  cultivationAccessory: ['none', 'lotus', 'moon', 'blossom'],
  cultivationTreasure: ['none', 'gourd', 'jade', 'pouch'],
  cultivationRealm: ['sunny', 'rain', 'night', 'thunder', 'tribulation', 'enlightened'],
  hamsterSkin: ['classic', 'worker', 'nightshift', 'rain', 'summer', 'winter', 'holiday'],
  buddySkin: ['classic', 'worker', 'holiday', 'midnight', 'blossom'],
  beaverSkin: ['sunny', 'rain', 'snow', 'wind', 'night'], beaverMotto: ['gentle', 'create', 'rest'],
}

export function validateSettings(input: unknown): Partial<Settings> {
  if (!input || typeof input !== 'object') return {}
  const data = input as Record<string, unknown>, out: Record<string, unknown> = {}
  for (const key of ['codexEnabled', 'startupAnimation', 'worldEnabled', 'worldPaused', 'calendarEnabled', 'calendarPreview', 'calendarAtStart', 'calendarSystemNotifications', 'alwaysOnTop', 'clickThrough', 'launchAtLogin', 'reducedMotion', 'notifications', 'messageEnabled', 'messagePreview', 'messageRespectMute', 'beaverCamp', 'cultivationRandom']) {
    if (typeof data[key] === 'boolean') out[key] = data[key]
  }

  for (const [key, values] of Object.entries(SETTINGS_ENUMS)) if (typeof data[key] === 'string' && values.includes(data[key] as string)) out[key] = data[key]
  if (typeof data.windowWidth === 'number' && Number.isFinite(data.windowWidth)) out.windowWidth = Math.round(Math.min(800, Math.max(180, data.windowWidth)))
  if (typeof data.messagePausedUntil === 'number' && Number.isFinite(data.messagePausedUntil)) out.messagePausedUntil = Math.round(Math.min(Date.now() + 86400_000, Math.max(0, data.messagePausedUntil)))
  if (typeof data.calendarLeadMinutes === 'number' && [1, 5, 10, 15].includes(data.calendarLeadMinutes)) out.calendarLeadMinutes = data.calendarLeadMinutes
  for (const [key, max] of Object.entries(SETTINGS_STRINGS)) {
    const value = data[key]
    if (typeof value === 'string' && value.length <= max && !/[\x00-\x1f\x7f]/.test(value) && (key !== 'codexBucket' || value.trim())) out[key] = value.trim()
  }
  return out as Partial<Settings>
}
