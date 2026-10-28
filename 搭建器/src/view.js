import './tokens.css'
import './editor.css'
import { createCanvas } from './grid.js'
import { dataAsOf } from './registry.js'
import * as store from './store.js'

const host = document.getElementById('canvas')
const id = new URLSearchParams(location.search).get('layout')
const doc = id ? store.load(id) : null

document.getElementById('title').textContent = doc?.name || '未找到版面'
document.getElementById('asof').textContent = ''

if (!doc) {
  const msg = document.createElement('div')
  msg.className = 'w-note w-note-empty'
  msg.textContent = `没有找到版面「${id || '（未指定）'}」。先在搭建器里保存，或用 ?layout=版面名 打开。`
  host.appendChild(msg)
} else {
  const canvas = createCanvas(host, { editable: false })
  canvas.render(doc)
  dataAsOf().then(v => { document.getElementById('asof').textContent = v.text })

  // 手机端不照搬电脑版：换一套列数重排（100 列 → 10 列，按原顺序纵向堆）
  const mq = window.matchMedia('(max-width: 650px)')
  const apply = () => {
    try {
      // 窄屏：换 10 列并按原顺序纵向堆（'list'/'breakpoint' 才是 GridStack 的口径，大小写不对会走回填）
      if (mq.matches) canvas.grid.column(10, 'list')
      else canvas.grid.column(100, 'breakpoint')
    } catch (e) { console.warn('断点重排失败', e) }
  }
  mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply)
  apply()
}
