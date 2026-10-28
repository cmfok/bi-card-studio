/* 把一张已注册的卡片渲染成静态 DOM（不可编辑）。
 * 工作台预览、看板、渲染页三处共用，保证「注册的那张卡」到哪都是同一张。
 * 缩放只做整体适配：内部元素位置尺寸一律不变。 */
import { ELEMENTS } from './elements.js'

export function cardEl(card, box = null) {
  const wrap = document.createElement('div')
  wrap.className = `stage base-${card.base || 'plain'}`
  wrap.style.width = `${card.w}px`
  wrap.style.height = `${card.h}px`
  wrap.style.borderRadius = `${card.radius ?? 12}px`
  wrap.style.position = 'relative'
  wrap.dataset.cardId = card.id

  const cleanups = []
  ;(card.items || []).forEach(it => {
    const def = ELEMENTS[it.type]
    if (!def) return
    const box2 = document.createElement('div')
    box2.className = 'stage-item'
    box2.style.cssText = `left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px;cursor:default`
    box2.dataset.id = it.id
    try {
      const node = def.render(it)
      box2.appendChild(node)
      if (node.__onRemove) cleanups.push(() => node.__onRemove())
    } catch (e) { console.warn('元素渲染失败', it.type, e) }
    wrap.appendChild(box2)
  })
  // 图表等自带实例的元素：摘掉整张卡之前要 dispose，否则每重绘一次泄漏一份
  wrap.__onRemove = () => cleanups.splice(0).forEach(fn => fn())

  if (box) {
    const s = Math.min(box.w / card.w, box.h / card.h)
    wrap.style.transformOrigin = 'top left'
    wrap.style.transform = `scale(${s})`
    wrap.style.position = 'absolute'
  }
  return wrap
}

/** 卡片对外声明的数据位（看板绑数据用） */
export function cardSlots(card) {
  const out = []
  ;(card.items || []).forEach(it => {
    const s = it.props?.slot
    if (s) out.push({ slot: s, itemId: it.id, type: it.type })
  })
  return out
}
