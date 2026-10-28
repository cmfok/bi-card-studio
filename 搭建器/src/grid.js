/* 画布引擎：格制、吸附、跨度、内容驱动高度、卡内子格、浮层。
 * 只认「版面文档」，不认组件——组件全在 registry.js 里。编辑器与渲染页共用本文件。 */
import { GridStack } from 'gridstack'
import 'gridstack/dist/gridstack.min.css'
import { REG } from './registry.js'

export const MAIN_COLS = 100   // 横向 100 格（CM 口径）
export const SUB_COLS = 50     // 卡内子格 50 列，比旧样片的 24 列细一倍
export const ROWS = 75         // 纵向基准 75 格

/** 内容驱动高度：只有标签/文本这类小件默认塌高，图表必须占满格子 */
function hugOf(node) {
  if (node.autoHeight !== undefined) return !!node.autoHeight
  return !!REG[node.type]?.hug
}

/** 一个已挂载组件的运行时句柄 */
class Mounted {
  constructor() { this.cleanups = []; this.resizes = []; this.el = null }
  onCleanup(fn) { this.cleanups.push(fn) }
  onResize(fn) { this.resizes.push(fn) }
  dispose() { this.cleanups.forEach(f => { try { f() } catch (e) { console.warn('清理失败', e) } }); if (this.el?.parentNode) this.el.remove() }
  fireResize(cellW) { this.resizes.forEach(f => f(cellW)) }
}

export function createCanvas(host, opts = {}) {
  const editable = opts.editable !== false
  const mounted = new Map()   // node.id -> Mounted
  const items = new Map()     // node.id -> {item, grid}（GridStack 不把 id 写进 DOM，只能自己记账）
  const subGrids = new Map()  // node.id -> GridStack（焦点卡内子格）

  host.classList.add('canvas')
  const cellH = Math.max(6, Math.round((host.clientHeight || 720) / ROWS))

  const grid = GridStack.init({
    column: MAIN_COLS,
    cellHeight: cellH,
    margin: 4,
    minRow: ROWS,
    float: true,
    staticGrid: !editable,
    handle: '.w-hd',
    accept: '*',
    draggable: { appendTo: 'body' },
    resizable: { handles: 'se,sw,e,w' },
  }, host)

  // ---- 渲染单个节点 ----
  function renderNode(node, container, isSub) {
    const def = REG[node.type]
    if (!def) {
      const err = document.createElement('div')
      err.className = 'w-note w-note-bad'
      err.textContent = `未注册的类型：${node.type}`
      container.appendChild(err)
      return
    }
    const m = new Mounted()
    const ctx = {
      cellW: container.clientWidth || 320,
      hug: !!def.hug,
      onResize: fn => m.resizes.push(fn),
      onCleanup: fn => m.cleanups.push(fn),
      editable,
    }
    // 字号基准宽：首次挂载把「设计时容器宽」钉进版面，之后拖卡片按该比例缩放字号
    if (node.props && node.props.fontSize && !node.props.baseW) {
      node.props.baseW = Math.round(ctx.cellW)
    }
    Promise.resolve(def.render(node, ctx)).then(el => {
      if (!el) return
      el.dataset.nodeId = node.id
      container.appendChild(el)
      m.el = el
      if (def.nested) {
        const sub = el.querySelector('.w-sub')
        const sg = GridStack.init({
          column: SUB_COLS, cellHeight: Math.max(5, Math.round(cellH / 2)), margin: 3,
          float: true, minRow: 1, staticGrid: !editable, handle: '.w-hd',
        }, sub)
        subGrids.set(node.id, sg)
        sg.on('change', () => {
          sg.engine.nodes.forEach(z => {
            const zm = mounted.get(String(z.id))
            if (zm && z.el) zm.fireResize(z.el.clientWidth)
          })
          emitChange()
        })
        ;(node.children || []).forEach(c => {
          const item = sg.addWidget({ x: c.x, y: c.y, w: c.w, h: c.h, id: c.id, autoHeight: false })
          items.set(String(c.id), { item, grid: sg })
          renderNode(c, item.querySelector('.grid-stack-item-content'), true)
        })
      }
      if (hugOf(node)) el.classList.add('w-hug')
      if (hugOf(node)) reHug(container.closest('.grid-stack-item'))
    })
    m.hug = hugOf(node)
    mounted.set(node.id, m)
  }

  function itemOf(id) {
    return items.get(String(id))?.item
  }

  function clearAll() {
    mounted.forEach(m => m.dispose())
    mounted.clear()
    items.clear()
    subGrids.forEach(sg => { try { sg.destroy(false) } catch (e) { } })
    subGrids.clear()
    grid.removeAll()
    host.querySelectorAll('.float-item').forEach(f => f.remove())
  }

  /** 载入版面文档 */
  function render(doc) {
    clearAll()
    grid.batchUpdate(true)
    ;(doc.cells || []).forEach(c => {
      const item = grid.addWidget({ x: c.x, y: c.y, w: c.w, h: c.h, id: c.id, autoHeight: false })
      items.set(String(c.id), { item, grid })
      renderNode(c, item.querySelector('.grid-stack-item-content'), false)
    })
    grid.batchUpdate(false)
    renderFloats(doc.floats || [])
    if (editable) bindGridEvents()
  }

  /** 浮层：脱离格子、可盖在图或卡之上，位置按格吸附 */
  function renderFloats(floats) {
    host.querySelectorAll('.float-item').forEach(f => f.remove())
    const layer = document.createElement('div')
    layer.className = 'float-layer'
    host.appendChild(layer)
    const cw = host.clientWidth / MAIN_COLS
    const ch = grid.getCellHeight(true)
    floats.forEach(f => {
      const box = document.createElement('div')
      box.className = 'float-item'
      box.style.left = `${f.x * cw}px`
      box.style.top = `${f.y * ch}px`
      box.style.width = `${f.w * cw}px`
      box.style.height = `${f.h * ch}px`
      box.dataset.nodeId = f.id
      items.set(String(f.id), { item: box, grid: null })
      layer.appendChild(box)
      renderNode(f, box, false)
      if (editable) makeFloatDraggable(box, f, cw, ch)
    })
  }

  function makeFloatDraggable(box, f, cw, ch) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false
    box.addEventListener('pointerdown', e => {
      if (e.target.closest('.w-bd table, .w-bd a')) return
      dragging = true
      sx = e.clientX; sy = e.clientY
      ox = parseFloat(box.style.left); oy = parseFloat(box.style.top)
      box.setPointerCapture(e.pointerId)
      box.classList.add('float-drag')
    })
    box.addEventListener('pointermove', e => {
      if (!dragging) return
      box.style.left = `${ox + e.clientX - sx}px`
      box.style.top = `${oy + e.clientY - sy}px`
    })
    box.addEventListener('pointerup', e => {
      if (!dragging) return
      dragging = false
      box.classList.remove('float-drag')
      const px = parseFloat(box.style.left), py = parseFloat(box.style.top)
      f.x = Math.max(0, Math.round(px / cw))          // 松手吸附回整格
      f.y = Math.max(0, Math.round(py / ch))
      box.style.left = `${f.x * cw}px`
      box.style.top = `${f.y * ch}px`
      emitChange()
    })
  }

  function emitChange() { if (opts.onChange) opts.onChange(read()) }

  /** 读回版面文档（不含内容 HTML，只含坐标与节点属性） */
  function read() {
    const cells = grid.save(false).map(n => {
      const src = (lastDoc.cells || []).find(c => String(c.id) === String(n.id)) || {}
      return { ...src, id: String(n.id), x: n.x, y: n.y, w: n.w ?? 1, h: n.h ?? 1 }
    })
    // 卡内子格的位置要单独回收：主 grid 的 save 看不见它们
    subGrids.forEach((sg, parentId) => {
      const parent = cells.find(c => c.id === parentId)
      if (!parent?.children) return
      parent.children = parent.children.map(ch => {
        const z = sg.engine.nodes.find(x => String(x.id) === String(ch.id))
        return z ? { ...ch, x: z.x, y: z.y, w: z.w, h: z.h } : ch
      })
    })
    const floats = (lastDoc.floats || []).map(f => ({ ...f }))
    return { ...lastDoc, cells, floats }
  }

  let lastDoc = { version: 1, name: '', cells: [], floats: [] }

  /** 内容驱动高度：拖完（resizestop）单次按内容重算行数。
   * 不挂 change 也不递归——那会和 GridStack 自己的重排互相放大（实测能冲到 11 行）。 */
  function reHug(el) {
    const n = grid.engine.nodes.find(x => x.el === el)
    const m = n ? mounted.get(String(n.id)) : null
    if (!m || !m.hug || !m.el || !n) return
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!m.el.isConnected) return
      const natural = m.el.getBoundingClientRect().height
      // 行高从元素自身反推：grid.cellHeight() 在有 minRow 的画布上会给出不含边距的口径，量出来偏大
      const itemH = n.el.getBoundingClientRect().height
      const pitch = itemH / n.h
      if (natural <= 0 || !(pitch > 0)) return
      const rows = Math.max(1, Math.ceil(natural / pitch))
      if (rows !== n.h) grid.update(el, { h: rows })
    }))
  }

  let bound = false

  function bindGridEvents() {
    if (bound) return
    bound = true
    grid.on('resizestop', (e, el) => reHug(el))
    grid.on('change', () => {
      // 尺寸变了 → 重算该组件的容器宽（字号按 cqw 自动跟，图表要显式 resize）
      grid.engine.nodes.forEach(n => {
        const m = mounted.get(String(n.id))
        if (!m || !n.el) return
        m.fireResize(n.el.clientWidth)
        // 内容驱动高度：宽度变了字号随之缩，高度按内容重算行数（拖窄就该塌，不留空白）

      })
      emitChange()
    })
  }

  /** 从组件库添加（拖放落点或点击均可）；at 省略时排到最下方 */
  function add(type, at) {
    const def = REG[type]
    const id = `n${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`
    const cell = { id, type, props: JSON.parse(JSON.stringify(def.defaults)),
                   x: at?.x ?? 0, y: at?.y ?? 999, w: def.span.w, h: def.span.h,
                   children: def.nested ? [] : undefined }
    lastDoc.cells.push(cell)
    const item = grid.addWidget({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, id, autoPosition: !at, autoHeight: false })
    items.set(String(id), { item, grid })
    renderNode(cell, item.querySelector('.grid-stack-item-content'), false)
    emitChange()
    return id
  }

  /** 浮层元素：脱离格子，盖在图上（分层需求） */
  function addFloat(type, at) {
    const def = REG[type]
    const id = `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`
    const f = { id, type, props: JSON.parse(JSON.stringify(def.defaults)),
                x: at?.x ?? 2, y: at?.y ?? 2, w: def.span.w, h: def.span.h }
    lastDoc.floats = (lastDoc.floats || []).concat(f)
    renderFloats(lastDoc.floats)
    emitChange()
    return id
  }

  /** 焦点卡连子件一起清账：mounted/items 漏删会让图表实例不释放、删除点了没反应 */
  function forgetTree(id) {
    const cell = (lastDoc.cells || []).find(c => String(c.id) === String(id))
    const m = mounted.get(String(id))
    if (m) { m.dispose(); mounted.delete(String(id)) }
    items.delete(String(id))
    const sg = subGrids.get(String(id))
    if (sg) { sg.destroy(false); subGrids.delete(String(id)) }
    ;(cell?.children || []).forEach(ch => forgetTree(ch.id))
  }

  function remove(id) {
    const entry = items.get(String(id))
    forgetTree(id)
    if (entry) {
      if (entry.grid) entry.grid.removeWidget(entry.item)
      else entry.item.remove()
    }
    lastDoc.cells = lastDoc.cells.filter(c => c.id !== id)
    lastDoc.floats = (lastDoc.floats || []).filter(f => f.id !== id)
    emitChange()
  }

  /** 属性面板改完 → 只重挂这一块 */
  function refresh(node) {
    const target = itemOf(node.id)
    forgetTree(node.id)
    if (!target) return
    const idx = lastDoc.cells.findIndex(c => c.id === node.id)
    if (idx >= 0) lastDoc.cells[idx] = node
    else if (lastDoc.floats) {
      const fi = lastDoc.floats.findIndex(f => f.id === node.id)
      if (fi >= 0) lastDoc.floats[fi] = node
    }
    renderNode(node, target, false)
    emitChange()
  }

  function select(id) {
    host.querySelectorAll('.is-sel').forEach(e => e.classList.remove('is-sel'))
    if (!id) return
    const el = host.querySelector(`[data-node-id="${CSS.escape(id)}"]`)
    if (el) el.classList.add('is-sel')
  }

  window.addEventListener('resize', () => {
    grid.engine.nodes.forEach(n => {
      const m = mounted.get(String(n.id))
      if (m && n.el) m.fireResize(n.el.clientWidth)
    })
    if (lastDoc.floats && lastDoc.floats.length) renderFloats(lastDoc.floats)
  })

  // 点选：编辑器靠它把属性面板对准某个组件
  if (editable) {
    host.addEventListener('click', e => {
      const holder = e.target.closest('[data-node-id]')
      if (holder && opts.onSelect) opts.onSelect(holder.dataset.nodeId)
    })
  }

  return {
    grid,
    render(doc) { lastDoc = JSON.parse(JSON.stringify(doc || lastDoc)); render(lastDoc) },
    read() { return read() },
    add, addFloat, remove, refresh, select, renderFloats,
    find(id) {
      return (lastDoc.cells || []).concat(lastDoc.floats || []).find(c => c.id === id)
    },
    cellHeight() { return grid.getCellHeight(true) },
    destroy() { clearAll(); try { grid.destroy(false) } catch (e) { } },
  }
}
