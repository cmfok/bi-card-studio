/* 卡片工作台：只做一件事——设计一张卡片长什么样，保存即注册进卡片库。
 * 数据在这里全是示例值；真正绑哪个指标是看板那一步的事。 */
import './tokens.css'
import './studio.css'
import { createSnapStage, PITCH } from './snap.js'
import { ELEMENTS, BASES } from './elements.js'
import { blankCard, getCard, saveCard, allCards } from './cards.js'

const host = document.getElementById('stage')
const propsEl = document.getElementById('props')
const listEl = document.getElementById('lib')
const tipEl = document.getElementById('tip')
const dimsEl = document.getElementById('dims')

const q = new URLSearchParams(location.search)
let card = (q.get('card') && getCard(q.get('card'))) || blankCard()
let selected = null

/* ---- 左：元素清单（按类分组） ---- */
function buildLib() {
  listEl.innerHTML = ''
  Object.entries(ELEMENTS).forEach(([type, def]) => {
    let h = listEl.querySelector(`[data-grp="${def.kind}"]`)
    if (!h) {
      h = document.createElement('div')
      h.className = 'grp'
      h.dataset.grp = def.kind
      h.textContent = def.kind
      listEl.appendChild(h)
    }
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'item-btn'
    b.textContent = def.label
    b.title = '点击放到底座正中，之后拖动吸附'
    b.onclick = () => addItem(type)
    listEl.appendChild(b)
  })
}

/* ---- 中：底座 + 吸附画布 ---- */
const stage = createSnapStage(host, {
  onSelect: id => { selected = id; paintProps() },
  onChange: items => { card.items = items; markSel(); syncDims() },
  buildEl,
})

function buildEl(it) {
  const box = document.createElement('div')
  const def = ELEMENTS[it.type]
  if (!def) {
    box.textContent = `未注册元素：${it.type}`
    return box
  }
  const node = def.render(it)
  box.appendChild(node)
  box.__onRemove = () => node.__onRemove?.()
  return box
}

function applyCardFrame() {
  host.style.width = `${card.w}px`
  host.style.height = `${card.h}px`
  host.style.borderRadius = `${card.radius}px`
  host.className = `stage base-${card.base || 'plain'}`
}

/* 画布重绘：不动右栏（动右栏会让正在输入的框丢焦点，打一半字就断了）；
 * 传同一个数组引用，不复制——复制会让右栏闭包指向被淘汰的旧对象，拖完再改属性就失效。 */
function redraw() {
  applyCardFrame()
  stage.setItems(card.items)
  markSel()
  syncDims()
}

function markSel() {
  host.querySelectorAll('.stage-item').forEach(el => el.classList.toggle('is-sel', el.dataset.id === selected))
}

const grids = v => Math.round(Number(v) / PITCH * 10) / 10

function syncDims() {
  const it = card.items.find(i => i.id === selected)
  dimsEl.textContent =
    `卡片 ${card.w} × ${card.h} px（${grids(card.w)} × ${grids(card.h)} 格，每格 ${PITCH}px）`
    + (it ? ` ｜ 选中「${ELEMENTS[it.type]?.label || it.type}」${it.w} × ${it.h} px，位于 ${it.x}, ${it.y}` : '')
  const ins = propsEl.querySelectorAll('.f-geo input')
  if (it && ins.length === 4) ['x', 'y', 'w', 'h'].forEach((k, i) => {
    if (document.activeElement !== ins[i]) ins[i].value = it[k]
  })
}

function addItem(type) {
  const def = ELEMENTS[type]
  const b = stage.box()
  const step = (card.items.length % 4) * PITCH * 3
  const it = {
    id: `i${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`,
    type,
    x: Math.max(0, Math.round((b.w - def.def.w) / 2 / PITCH) * PITCH + step),
    y: Math.max(0, Math.round((b.h - def.def.h) / 2 / PITCH) * PITCH + step),
    w: def.def.w, h: def.def.h,
    props: JSON.parse(JSON.stringify(def.props)),
  }
  card.items.push(it)
  selected = it.id
  redraw()
  paintProps()
  tipEl.textContent = `放了个「${def.label}」，拖动它会自动吸附到底座的格上；拖右下角圆点或直接填宽高能改大小。`
}

/* ---- 右：卡片本身 ＋ 选中元素的属性 ---- */
function control(label, node) {
  const row = document.createElement('label')
  row.className = 'f-row'
  const span = document.createElement('span')
  span.textContent = label
  row.append(span, node)
  return row
}

function selectEl(opts, value, on) {
  const s = document.createElement('select')
  opts.forEach(o => {
    const op = document.createElement('option')
    op.value = o.v
    op.textContent = o.t
    if (String(value) === String(o.v)) op.selected = true
    s.appendChild(op)
  })
  s.onchange = () => on(s.value)
  return s
}

function inputEl(type, value, on, ev) {
  const i = document.createElement('input')
  i.type = type
  i.value = value ?? ''
  const fire = () => on(type === 'number' ? Number(i.value) : i.value)
  if (ev === 'change') i.onchange = fire
  else i.oninput = fire
  return i
}

const px = (v, min) => Math.max(min, Math.round(Number(v) || 0))

/* 数字格：夹到边界后把实际生效值写回框里，别让框里留着用户填的 0 或 99999 */
function numField(label, value, min, on) {
  const i = inputEl('number', value, v => {
    const fixed = px(v, min)
    on(fixed)
    i.value = fixed
  }, 'change')
  return control(label, i)
}

function paintProps() {
  propsEl.innerHTML = ''
  const head = document.createElement('div')
  head.className = 'f-head'
  head.textContent = '这张卡片'
  propsEl.appendChild(head)

  propsEl.appendChild(control('卡片名称', inputEl('text', card.name, v => { card.name = v })))
  propsEl.appendChild(control('底座样式', selectEl(BASES, card.base, v => { card.base = v; applyCardFrame() })))
  propsEl.appendChild(numField('宽（px）', card.w, PITCH * 5, v => { card.w = v; redraw() }))
  propsEl.appendChild(numField('高（px）', card.h, PITCH * 5, v => { card.h = v; redraw() }))
  propsEl.appendChild(numField('圆角（px）', card.radius, 0, v => { card.radius = v; applyCardFrame() }))

  const it = card.items.find(i => i.id === selected)
  const h2 = document.createElement('div')
  h2.className = 'f-head'
  h2.textContent = it ? `选中：${ELEMENTS[it.type]?.label || it.type}` : '没选中元素'
  propsEl.appendChild(h2)
  if (!it) {
    const e = document.createElement('div')
    e.className = 'f-empty'
    e.textContent = '点底座上的元素就能改它；拖动＝换位置（自动吸附），拖右下角圆点＝改大小，也可以直接在下表填数字。'
    propsEl.appendChild(e)
    return
  }

  const geo = document.createElement('div')
  geo.className = 'f-geo'
  ;[['x', 'X'], ['y', 'Y'], ['w', '宽'], ['h', '高']].forEach(([k, t]) => {
    const lab = document.createElement('label')
    const span = document.createElement('span')
    span.textContent = t
    const i = inputEl('number', it[k], v => {
      const patch = {}
      patch[k] = Math.max(0, Math.round(Number(v) || 0))
      stage.update(it.id, patch)
      i.value = it[k]          // update 里会夹进底座并吸到整格，回填实际生效值
    }, 'change')
    lab.append(span, i)
    geo.appendChild(lab)
  })
  propsEl.appendChild(geo)

  const def = ELEMENTS[it.type]
  def.fields.forEach(f => {
    const on = v => { it.props[f.k] = v; redraw() }
    if (f.type === 'select') propsEl.appendChild(control(f.t, selectEl(f.opts, it.props[f.k], on)))
    else propsEl.appendChild(control(f.t, inputEl(f.type === 'number' ? 'number' : f.type === 'area' ? 'text' : 'text', it.props[f.k], on)))
  })
  const hint = document.createElement('div')
  hint.className = 'slot-hint'
  hint.textContent = '「数据位」＝这张卡放到看板上时，需要你去选一个指标的位置。工作台里填的是示例值。'
  propsEl.appendChild(hint)

  const tools = document.createElement('div')
  tools.className = 'f-tools'
  const del = document.createElement('button')
  del.className = 'f-del'
  del.textContent = '删除该元素'
  del.onclick = () => { selected = null; stage.remove(it.id); redraw(); paintProps() }
  tools.appendChild(del)
  propsEl.appendChild(tools)
}

/* ---- 顶栏 ---- */
document.getElementById('save').onclick = () => {
  // 存盘用快照副本，card.items 本身继续与吸附层共用同一份，避免两边数组分叉
  const r = saveCard({ ...card, items: stage.items() })
  tipEl.textContent = r.error || `已注册「${card.name}」，看板编辑台的卡片列表里就有了（卡片库共 ${allCards().length} 张）`
  if (!r.error) document.getElementById('liblink').hidden = false
}
document.getElementById('new').onclick = () => { card = blankCard(); selected = null; redraw(); paintProps() }
document.getElementById('liblink').onclick = () => { location.href = 'index.html' }
document.getElementById('cards').onclick = () => { location.href = 'cards.html' }

buildLib()
redraw()
paintProps()
