/* 左：组件库（按层分组，可拖可点） 右：属性面板（按注册表字段自动生成） */
import { REG, LAYERS } from './registry.js'

export function buildPalette(el, api) {
  el.innerHTML = ''
  LAYERS.forEach(layer => {
    const types = Object.keys(REG).filter(t => REG[t].layer === layer)
    if (!types.length) return
    const h = document.createElement('div')
    h.className = 'pal-h'
    h.textContent = layer
    el.appendChild(h)
    types.forEach(t => {
      const b = document.createElement('button')
      b.className = 'pal-item'
      b.type = 'button'
      b.dataset.type = t
      b.draggable = true
      b.textContent = REG[t].label
      b.title = `拖到画布，或点击加到最下方`
      b.addEventListener('click', () => api.add(t))
      b.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/bi-type', t)
        e.dataTransfer.effectAllowed = 'copy'
      })
      el.appendChild(b)
    })
  })
}

function field(def, node, apply) {
  const row = document.createElement('label')
  row.className = 'f-row'
  const label = document.createElement('span')
  label.textContent = def.t
  row.appendChild(label)
  const v = node.props[def.k]
  let ctrl
  if (def.type === 'select') {
    ctrl = document.createElement('select')
    def.opts.forEach(o => {
      const op = document.createElement('option')
      op.value = o.v
      op.textContent = o.t
      if (String(v) === String(o.v)) op.selected = true
      ctrl.appendChild(op)
    })
    ctrl.onchange = () => apply(def.k, ctrl.value)
  } else if (def.type === 'check') {
    ctrl = document.createElement('input')
    ctrl.type = 'checkbox'
    ctrl.checked = !!v
    ctrl.onchange = () => apply(def.k, ctrl.checked)
  } else if (def.type === 'number') {
    ctrl = document.createElement('input')
    ctrl.type = 'number'
    ctrl.value = v ?? ''
    ctrl.oninput = () => apply(def.k, Number(ctrl.value))
  } else if (def.type === 'area') {
    ctrl = document.createElement('textarea')
    ctrl.rows = 3
    ctrl.value = v ?? ''
    ctrl.oninput = () => apply(def.k, ctrl.value)
  } else {
    ctrl = document.createElement('input')
    ctrl.type = 'text'
    if (def.ph) ctrl.placeholder = def.ph
    ctrl.value = v ?? ''
    ctrl.oninput = () => apply(def.k, ctrl.value)
  }
  row.appendChild(ctrl)
  if (def.when && node.props.src !== def.when) row.hidden = true
  row.dataset.when = def.when || ''
  return row
}

/** 属性面板：组件自身字段＋位置跨度＋浮层/删除 */
export function buildProps(el, node, api) {
  el.innerHTML = ''
  if (!node) {
    el.innerHTML = '<div class="f-empty">点画布上的组件即可编辑它的属性。<br>拖动＝换位置，拖右下角＝改占格数。</div>'
    return
  }
  const def = REG[node.type]
  if (!def) return

  const head = document.createElement('div')
  head.className = 'f-head'
  head.textContent = `${def.label}｜${def.layer}`
  el.appendChild(head)

  let timer = null
  const apply = (k, val) => {
    node.props[k] = val
    if (k === 'fontSize') node.props.baseW = api.cellW(node.id)
    // 切换取数方式要把面板重建一次：端点/路径两栏的显隐只在生成时算，不重建就永远藏着
    if (k === 'src') { buildProps(el, node, api); }
    clearTimeout(timer)
    timer = setTimeout(() => api.apply(node), 220)
  }

  def.fields.forEach(f => el.appendChild(field(f, node, apply)))

  const g = document.createElement('div')
  g.className = 'f-group'
  g.textContent = '位置与跨度（以格为单位）'
  el.appendChild(g)
  const span = document.createElement('div')
  span.className = 'f-span'
  ;[['x', '列'], ['y', '行'], ['w', '占宽'], ['h', '占高']].forEach(([k, t]) => {
    const lab = document.createElement('label')
    lab.innerHTML = `<span>${t}</span>`
    const inp = document.createElement('input')
    inp.type = 'number'
    inp.value = node[k] ?? 0
    inp.oninput = () => { node[k] = Number(inp.value); api.apply(node) }
    lab.appendChild(inp)
    span.appendChild(lab)
  })
  el.appendChild(span)

  const tools = document.createElement('div')
  tools.className = 'f-tools'
  const auto = document.createElement('label')
  auto.className = 'f-row'
  auto.innerHTML = '<span>高度随内容</span>'
  const autoBox = document.createElement('input')
  autoBox.type = 'checkbox'
  autoBox.checked = node.autoHeight !== false
  autoBox.onchange = () => { node.autoHeight = autoBox.checked; api.apply(node) }
  auto.appendChild(autoBox)
  tools.appendChild(auto)
  const del = document.createElement('button')
  del.textContent = '删除该组件'
  del.className = 'f-del'
  del.onclick = () => api.remove(node.id)
  tools.appendChild(del)
  el.appendChild(tools)
}
