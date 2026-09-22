export const POTATO_SKINS = [
  { id: 'gundam', label: '白蓝原型', reference: '高达机甲', adapted: true, atlas: 'armor-1', row: 0, group: '机甲英雄' },
  { id: 'iron', label: '红金钢甲', reference: '钢铁侠机甲', adapted: true, atlas: 'armor-1', row: 1, group: '机甲英雄' },
  { id: 'captain', label: '蓝盾守卫', reference: '美国队长机甲', adapted: true, atlas: 'armor-1', row: 2, group: '机甲英雄' },
  { id: 'batman', label: '暗夜披风', reference: '蝙蝠侠机甲', adapted: true, atlas: 'armor-1', row: 3, group: '机甲英雄' },
  { id: 'eva', label: '初号机机甲', reference: '初号机机甲', adapted: false, atlas: 'armor-2', row: 0, group: '机甲英雄' },
  { id: 'zaku', label: 'ZAKU扎古', reference: 'ZAKU扎古', adapted: false, atlas: 'armor-2', row: 1, group: '机甲英雄' },
  { id: 'star', label: '星际战甲', reference: '星际战甲', adapted: false, atlas: 'armor-2', row: 2, group: '机甲英雄' },
  { id: 'thor', label: '雷神机甲', reference: '雷神机甲', adapted: false, atlas: 'armor-2', row: 3, group: '机甲英雄' },
  { id: 'space', label: '太空探索', reference: '太空探索', adapted: true, atlas: 'armor-3', row: 0, group: '机甲英雄' },
  { id: 'redhorn', label: '赤焰独角', reference: '机动红扎', adapted: true, atlas: 'armor-3', row: 1, group: '特别机体' },
  { id: 'freedom', label: '自由翼机甲', reference: '自由高达', adapted: true, atlas: 'armor-3', row: 2, group: '特别机体' },
  { id: 'mark85', label: '红金精工', reference: '钢铁侠 Mark 85', adapted: true, atlas: 'armor-3', row: 3, group: '特别机体' },
  { id: 'captainclassic', label: '经典蓝盾', reference: '美国队长经典', adapted: true, atlas: 'armor-4', row: 0, group: '特别机体' },
  { id: 'darkknight', label: '黑曜披风', reference: '黑武士风', adapted: true, atlas: 'armor-4', row: 1, group: '特别机体' },
  { id: 'unicorn', label: '元祖机甲', reference: '元祖高达', adapted: true, atlas: 'armor-4', row: 2, group: '特别机体' },
  { id: 'pink', label: '少女粉机甲', reference: '少女粉高达', adapted: true, atlas: 'armor-4', row: 3, group: '特别机体' },
  { id: 'gold', label: '黄金土豆', reference: '黄金土豆', adapted: false, atlas: 'armor-5', row: 0, group: '异色节日' },
  { id: 'purple', label: '赛博肥魔', reference: '赛博肥魔', adapted: false, atlas: 'armor-5', row: 1, group: '异色节日' },
  { id: 'greenholiday', label: '节日限定 · 圣诞版', reference: '节日限定 · 圣诞版', adapted: false, atlas: 'armor-5', row: 2, group: '异色节日' },
  { id: 'santa', label: '驯鹿圣诞', reference: '驯鹿圣诞', adapted: false, atlas: 'armor-5', row: 3, group: '异色节日' },
] as const
export type PotatoSkin = typeof POTATO_SKINS[number]['id']
export type PotatoAtlas = typeof POTATO_SKINS[number]['atlas'] | 'props'
