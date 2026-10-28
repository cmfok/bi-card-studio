/* 卡片工作台用的吸附引擎：元素在一张底座上自由摆，松手吸到最近的格。
 * 看板那一层不用它（看板上的卡片互不重叠，用 GridStack 的格子）。
 * 「有感觉」是硬要求：拖起来出网格、跟手走、落点高亮框提前显示、松手回弹落位。 */
export const PITCH = 8   // 吸附步长（px）

export function createSnapStage(host, opts = {}) {
  const onChange = opts.onChange || (() => {})
  let items = []
  let buildEl = opts.buildEl || (() => document.createElement('div'))

  host.classList.add('stage')
  const grid = document.createElement('div')
  grid.className = 'stage-grid'
  const ghost = document.createElement('div')
  ghost.className = 'stage-ghost'
  ghost.hidden = true
  const ghostN = document.createElement('span')
  ghost.appendChild(ghostN)
  host.append(grid, ghost)
  grid.style.backgroundSize = `${PITCH * 2}px ${PITCH * 2}px`

  const snap = v => Math.round(v / PITCH) * PITCH

  const box = () => ({ w: host.clientWidth, h: host.clientHeight })

  function clamp(t, b) {
    t.w = Math.max(PITCH * 3, Math.min(b.w, snap(t.w)))
    t.h = Math.max(PITCH * 2, Math.min(b.h, snap(t.h)))
    t.x = Math.max(0, Math.min(b.w - t.w, snap(t.x)))
    t.y = Math.max(0, Math.min(b.h - t.h, snap(t.y)))
    return t
  }

  function place(el, it) {
    el.style.left = `${it.x}px`
    el.style.top = `${it.y}px`
    el.style.width = `${it.w}px`
    el.style.height = `${it.h}px`
  }

  function bind(el, it) {
    let mode = null, sx = 0, sy = 0, o = null
    const rz = document.createElement('span')
    rz.className = 'stage-rz'
    el.appendChild(rz)

    const begin = (e, m) => {
      mode = m
      sx = e.clientX; sy = e.clientY
      o = { x: it.x, y: it.y, w: it.w, h: it.h }
      el.setPointerCapture(e.pointerId)
      host.classList.add('is-dragging')
      el.classList.add('lifting')
      e.preventDefault()
      e.stopPropagation()
    }
    el.addEventListener('pointerdown', e => {
      if (opts.onSelect) opts.onSelect(it.id)
      begin(e, 'move')
    })
    rz.addEventListener('pointerdown', e => begin(e, 'size'))

    el.addEventListener('pointermove', e => {
      if (!mode) return
      const dx = e.clientX - sx, dy = e.clientY - sy
      const raw = mode === 'move'
        ? { ...it, x: o.x + dx, y: o.y + dy }
        : { ...it, w: o.w + dx, h: o.h + dy }
      const target = clamp({ ...raw }, box())
      // 手上跟自由位置，高亮框显示吸附后的落点
      el.style.left = `${raw.x}px`; el.style.top = `${raw.y}px`
      if (mode === 'size') { el.style.width = `${raw.w}px`; el.style.height = `${raw.h}px` }
      ghost.hidden = false
      ghost.style.cssText = `left:${target.x}px;top:${target.y}px;width:${target.w}px;height:${target.h}px`
      ghostN.textContent = mode === 'size' ? `${target.w} × ${target.h}` : `${target.x}, ${target.y}`
    })

    const end = e => {
      if (!mode) return
      const dx = e.clientX - sx, dy = e.clientY - sy
      const raw = mode === 'move' ? { ...it, x: o.x + dx, y: o.y + dy } : { ...it, w: o.w + dx, h: o.h + dy }
      Object.assign(it, clamp(raw, box()))
      place(el, it)
      el.classList.remove('lifting')
      el.classList.add('settle')          // 回弹落位
      setTimeout(() => el.classList.remove('settle'), 320)
      ghost.hidden = true
      host.classList.remove('is-dragging')
      mode = null
      onChange(items)
    }
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  function render() {
    host.querySelectorAll('.stage-item').forEach(e => {
      try { e.__onRemove?.() } catch (err) { console.warn('元素卸载失败', err) }
      e.remove()
    })
    items.forEach(it => {
      const el = buildEl(it)
      el.className = 'stage-item'
      el.dataset.id = it.id
      place(el, it)
      host.appendChild(el)
      bind(el, it)
    })
  }

  const byId = id => items.find(i => i.id === id)

  return {
    host,
    setBuildEl(fn) { buildEl = fn; render() },
    setItems(list) { items = list; render() },
    items: () => items.map(i => ({ ...i })),
    add(it) { items.push(it); render(); onChange(items) },
    remove(id) { items = items.filter(i => i.id !== id); render(); onChange(items) },
    update(id, patch) {
      const it = byId(id)
      if (!it) return
      Object.assign(it, patch)
      // 数值输入和拖拽走同一套边界：夹进底座内并吸到整格，否则填个 99999 元素就永久跑丢了
      clamp(it, box())
      render()
      onChange(items)
    },
    box,
  }
}
