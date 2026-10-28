/* 卡片库：看板的「已注册卡片」列表，从这里进工作台改，或回看板摆它。 */
import './tokens.css'
import './studio.css'
import { allCards, removeCard } from './cards.js'
import { cardEl, cardSlots } from './cardview.js'

const SLOT_CN = { main: '主数值', sub: '副说明', series: '趋势序列', cats: '分类名' }
const list = document.getElementById('list')

function paint() {
  list.querySelectorAll('.card-frame > .stage').forEach(s => s.__onRemove?.())
  list.innerHTML = ''
  const cards = allCards()
  if (!cards.length) {
    const e = document.createElement('div')
    e.className = 'f-empty'
    e.textContent = '还没有注册任何卡片。去「卡片工作台」做一张，保存后就会出现在这里。'
    list.appendChild(e)
    return
  }
  cards.forEach(c => {
    const cell = document.createElement('div')
    cell.className = 'card-cell'

    const frame = document.createElement('div')
    frame.className = 'card-frame'
    const el = cardEl(c, { w: 300, h: 190 })
    frame.appendChild(el)
    cell.appendChild(frame)

    const meta = document.createElement('div')
    meta.className = 'card-meta'
    const name = document.createElement('b')
    name.textContent = c.name
    const slots = cardSlots(c)
    const sub = document.createElement('span')
    sub.textContent = `${c.w}×${c.h}｜${(c.items || []).length} 个元素｜要绑：${slots.length ? slots.map(s => SLOT_CN[s.slot] || s.slot).join('、') : '无（纯样式）'}`
    meta.append(name, document.createElement('br'), sub)
    cell.appendChild(meta)

    const ops = document.createElement('div')
    ops.className = 'card-ops'
    const edit = document.createElement('button')
    edit.textContent = '改这张卡'
    edit.onclick = () => { location.href = `studio.html?card=${encodeURIComponent(c.id)}` }
    const del = document.createElement('button')
    del.className = 'f-del'
    del.textContent = '删除'
    del.onclick = () => { if (confirm(`删除卡片「${c.name}」？`)) { removeCard(c.id); paint() } }
    ops.append(edit, del)
    cell.appendChild(ops)

    list.appendChild(cell)
  })
}

document.getElementById('new').onclick = () => { location.href = 'studio.html' }
document.getElementById('board').onclick = () => { location.href = 'index.html' }
paint()
