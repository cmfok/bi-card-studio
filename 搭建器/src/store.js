/* 版面 JSON 存取。
 * 现状如实声明：数据服务层没有「版面」这张表，所以 V1 只落本机 localStorage；
 * 服务端接口一通就换 store 的实现，上层不改。 */
const KEY = 'bi-builder-layouts-v1'

export function all() {
  try {
    const raw = localStorage.getItem(KEY) || '{}'
    const m = JSON.parse(raw)
    return m && typeof m === 'object' ? m : {}
  } catch (e) {
    // 存储被写坏（手工改过/别的页占用）不能整页白屏，报一句然后当空的用
    console.warn('版面存储读不出，按空处理：', e)
    return {}
  }
}

export function load(id) {
  const doc = all()[id]
  return doc ? JSON.parse(doc) : null
}

export function save(id, doc) {
  const m = all()
  const prev = m[id]
  m[id] = JSON.stringify(doc)
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch (e) {
    m[id] = prev
    console.warn('版面写入失败：', e)
    return { id, error: '浏览器存储写不进去（可能已满），版面没保存成功' }
  }
  return { id, savedAt: new Date().toISOString(), overwrote: !!prev }
}

export function ids() {
  return Object.keys(all()).sort()
}

/** 版面文档骨架：cells＝格制元素，floats＝浮层元素，bp＝手机端另排 */
export function blankDoc(name = '未命名版面') {
  return { version: 1, name, cells: [], floats: [], mobile: null }
}

export function download(doc, filename) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || `${doc.name || 'layout'}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function storageState() {
  return { mode: 'local', note: '版面暂存本机浏览器；服务端版面表未建，未假装已入库' }
}
