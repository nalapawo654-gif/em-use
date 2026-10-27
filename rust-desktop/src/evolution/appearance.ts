import { skadiSelectedSkin, type Settings } from '../shared/types'

/** Only the visible costume participates: changing another pet's wardrobe is silent. */
export function evolutionAppearance(settings: Settings): string {
  const scene = settings.scene
  if (scene === 'modelmuse') return 'modelmuse/base'
  if (scene === 'aquarium') return `${scene}/${settings.outfit}`
  if (scene === 'skadi') return `${scene}/${settings.skadiForm}/${skadiSelectedSkin(settings)}`
  return `${scene}/${settings[`${scene}Skin`]}`
}
