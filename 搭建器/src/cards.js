/* 卡片注册表：工作台保存 = 注册一张卡片；看板只从这张表里取，不再自己定义元素。 */
const KEY = 'bi-cards-v1'

export function allCards() {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(m) ? m : []
  } catch (e) {
    console.warn('卡片库读不出，按空处理：', e)
    return []
  }
}

export function getCard(id) {
  return allCards().find(c => c.id === id) || null
}

export function saveCard(card) {
  const list = allCards()
  const i = list.findIndex(c => c.id === card.id)
  card.updated = new Date().toISOString()
  if (i >= 0) list[i] = card
  else list.push(card)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch (e) {
    console.warn('卡片写入失败：', e)
    return { error: '浏览器存储写不进去，卡片没注册成功' }
  }
  return { id: card.id, created: i < 0 }
}

export function removeCard(id) {
  localStorage.setItem(KEY, JSON.stringify(allCards().filter(c => c.id !== id)))
}

export function blankCard() {
  return {
    id: `c${Date.now().toString(36)}`,
    name: '未命名卡片',
    base: 'plain',
    w: 320, h: 200, radius: 12,
    items: [],
  }
}

/** 这张卡对外声明了哪些数据位（看板绑数据时就问它） */
export function slotsOf(card) {
  const seen = new Set()
  ;(card.items || []).forEach(it => {
    const s = it.props?.slot
    if (s) seen.add(s)
  })
  return [...seen]
}
