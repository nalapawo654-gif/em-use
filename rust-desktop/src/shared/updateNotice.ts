import type { AppState, Scene } from './types'

export const UPDATE_PERSONAS = {
  aquarium: { title: '小鱼捎来一封新消息', tag: '海底邮局', object: '漂流瓶', body: '打开这封漂流信，看看伙伴又学会了什么。', stamp: '海', motion: 'float' },
  buddy: { title: '新的打工补给到啦', tag: '牛马补给站', object: '打气邮包', body: '补给包已备好，等你歇口气，一起换个新版本。', stamp: '补', motion: 'pump' },
  beaver: { title: '林子里捡到一封新信', tag: '林间信使', object: '树叶信', body: '夹在树叶里的小惊喜，要不要一起拆开看看？', stamp: '林', motion: 'leaf' },
  hamster: { title: '机房有新装备待签收', tag: '鼠鼠维护工单', object: '齿轮工单', body: '小监工已经验收了来信，等你点头再开始升级。', stamp: '验', motion: 'gear' },
  cultivation: { title: '道友，有一卷新功法', tag: '云中传音', object: '传音符', body: '新卷已至，择一闲暇时刻，与你一同翻开。', stamp: '新', motion: 'charm' },
  battery: { title: '新的能量模块已就位', tag: '小电池升级站', object: '能量芯片', body: '模块准备完毕。升级的是伙伴，真实额度保持不变。', stamp: '+', motion: 'circuit' },
  feidudu: { title: '给你捎了点新鲜快乐', tag: '肥嘟嘟茶歇', object: '奶茶来信', body: '今天的奶茶多了一份惊喜，休息时陪我打开吧。', stamp: '甜', motion: 'sip' },
  fox: { title: '尾巴藏了一封新笺', tag: '一尾新笺', object: '墨尾信笺', body: '一笔新墨，几分新意。留一点闲，读一封信。', stamp: '笺', motion: 'ink' },
  luckycat: { title: '叮铃，新版本来招手', tag: '招财猫喜报', object: '金铃福签', body: '铃铛响了一声，新的小欢喜已经送到桌边。', stamp: '吉', motion: 'bell' },
  dinosaur: { title: '摸鱼路上带回了新消息', tag: '小恐龙飞行邮局', object: '小翼信封', body: '翅膀带回一封新信。等你忙完，咱们一起拆！', stamp: '翼', motion: 'wing' },
  skadi: { title: '月光带来了新的来信', tag: '月汐 · 夜影邮递', object: '月光封蜡信', body: '夜影替你守着这封信。准备好时，便一起启程。', stamp: '月', motion: 'moon' },
} satisfies Record<Scene, { title: string; tag: string; object: string; body: string; stamp: string; motion: string }>

export function updateNoticeVisible(update: AppState['update']): boolean {
  return !!update?.version && ['available', 'downloading', 'installing', 'error'].includes(update.status)
}
export function updateProgress(update: AppState['update']): number | null {
  if (!update?.total || !Number.isFinite(update.total) || update.total <= 0 || !Number.isFinite(update.downloaded)) return null
  return Math.min(100, Math.max(0, Math.round(update.downloaded! / update.total * 100)))
}
