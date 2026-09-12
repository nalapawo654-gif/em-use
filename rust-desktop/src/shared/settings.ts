import type { Settings } from './types.js'

export function validateSettings(input: unknown): Partial<Settings> {
  if (!input || typeof input !== 'object') return {}
  const data = input as Record<string, unknown>, out: Record<string, unknown> = {}
  for (const key of ['alwaysOnTop', 'clickThrough', 'launchAtLogin', 'reducedMotion', 'notifications', 'beaverCamp', 'cultivationRandom']) {
    if (typeof data[key] === 'boolean') out[key] = data[key]
  }
  const enums = {
    size: ['standard', 'compact', 'mini'], theme: ['auto', 'day', 'night'],
    outfit: ['classic', 'sailor', 'royal', 'ribbon'], scene: ['skadi', 'dinosaur', 'luckycat', 'fox', 'feidudu', 'aquarium', 'buddy', 'beaver', 'hamster', 'cultivation', 'battery'],
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
  for (const [key, values] of Object.entries(enums)) if (typeof data[key] === 'string' && values.includes(data[key] as string)) out[key] = data[key]
  if (typeof data.windowWidth === 'number' && Number.isFinite(data.windowWidth)) out.windowWidth = Math.round(Math.min(800, Math.max(180, data.windowWidth)))
  return out as Partial<Settings>
}
