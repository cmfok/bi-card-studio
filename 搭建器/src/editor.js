import './tokens.css'
import './editor.css'
import { createCanvas } from './grid.js'
import { buildPalette, buildProps } from './panels.js'
import { PRESETS, PRESET_KEYS } from './presets.js'
import { REG, dataAsOf } from './registry.js'
import * as store from './store.js'

const host = document.getElementById('canvas')
const palEl = document.getElementById('palette')
const propsEl = document.getElementById('props')
const nameEl = document.getElementById('name')
const modeEl = document.getElementById('mode')

let doc = boot()
let selected = null
let mode = 'grid'   // grid＝进格子；float＝进浮层（盖在图上）

function boot() {
  const id = new URLSearchParams(location.search).get('layout')
  return (id && store.load(id)) || PRESETS.overview.build()
}

const api = {
  add(type) {
    const id = mode === 'float' ? canvas.addFloat(type, { x: 2, y: 2 }) : canvas.add(type)
    select(id)
    return id
  },
  apply(node) { canvas.refresh(node) },
  remove(id) { canvas.remove(id); if (selected === id) select(null) },
  cellW(id) {
    const el = host.querySelector(`[data-node-id="${CSS.escape(id)}"]`)
    return el ? el.clientWidth : 320
  },
}

const canvas = createCanvas(host, {
  editable: true,
  onSelect: id => select(id),
  onChange: d => { doc = d },
})

function select(id) {
  selected = id
  canvas.select(id)
  const node = id ? (doc.cells || []).concat(doc.floats || []).find(c => c.id === id) : null
  buildProps(propsEl, node, api)
  const on = !!node
  document.getElementById('tofloat').disabled = !on
  document.getElementById('delsel').disabled = !on
}

/* ---- 顶栏 ---- */
const presetBar = document.getElementById('presets')
PRESET_KEYS.forEach(k => {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = PRESETS[k].label
  b.onclick = () => { if (confirm('换板式会覆盖当前版面，确定？')) { doc = PRESETS[k].build(); canvas.render(doc); select(null) } }
  presetBar.appendChild(b)
})

modeEl.onclick = () => {
  mode = mode === 'grid' ? 'float' : 'grid'
  modeEl.setAttribute('aria-pressed', String(mode === 'float'))
  modeEl.textContent = mode === 'float' ? '新组件 → 浮层（可盖住图）' : '新组件 → 格子（自动吸附）'
}

document.getElementById('tofloat').onclick = () => {
  if (!selected) return
  const i = (doc.cells || []).findIndex(c => c.id === selected)
  if (i < 0) return
  const [c] = doc.cells.splice(i, 1)
  doc.floats = (doc.floats || []).concat([{ ...c, x: c.x, y: c.y }])
  canvas.render(doc)
  select(c.id)
}

document.getElementById('delsel').onclick = () => selected && api.remove(selected)

document.getElementById('save').onclick = () => {
  doc.name = nameEl.value || doc.name
  const r = store.save(doc.name, doc)
  const tip = document.getElementById('tip')
  if (r.error) { tip.textContent = r.error; return }
  tip.textContent = `已存本机（${new Date(r.savedAt).toLocaleTimeString('zh-CN')}）· ${store.storageState().note}`
    + (r.overwrote ? ' · 本次覆盖了同名版面' : '')
}
document.getElementById('export').onclick = () => store.download(doc, `${doc.name}.json`)
document.getElementById('viewlink').onclick = () => {
  doc.name = nameEl.value || doc.name
  store.save(doc.name, doc)
  window.open(`view.html?layout=${encodeURIComponent(doc.name)}`, '_blank')
}

/* ---- 拖放落点：按格换算 ---- */
host.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' })
host.addEventListener('drop', e => {
  const type = e.dataTransfer.getData('text/bi-type')
  if (!type || !REG[type]) return
  e.preventDefault()
  const r = host.getBoundingClientRect()
  const cw = r.width / 100
  const ch = canvas.cellHeight()
  const at = { x: Math.max(0, Math.round((e.clientX - r.left) / cw)), y: Math.max(0, Math.round((e.clientY - r.top) / ch)) }
  const id = mode === 'float' ? canvas.addFloat(type, at) : canvas.add(type, at)
  select(id)
})

/* ---- 键盘 ---- */
document.addEventListener('keydown', e => {
  if (e.key === 'Delete' && selected && !/input|textarea|select/i.test(e.target.tagName)) api.remove(selected)
  if (e.key === 'Escape') select(null)
})

/* ---- 起盘 ---- */
buildPalette(palEl, api)
nameEl.value = doc.name || ''
canvas.render(doc)
// 验证钩子：tests/verify_builder.py 用它做「拖窄后高度是否塌」「字号是否随容器缩放」的实测
window.__biBuilder = { canvas, get doc() { return doc }, api }
dataAsOf().then(v => { document.getElementById('asof').textContent = v.text })
document.getElementById('tip').textContent = store.storageState().note
