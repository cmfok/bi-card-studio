/* 卡片工作台的两张清单：
 *  BASES  ＝ 底座样式（卡片本身长什么样，可以换）
 *  ELEMENTS＝ 往底座上放的元素（数字／文字／描述／图表／图标／图示，各是各的，不跟底座绑死）
 * 每个元素可以标一个「数据位」：工作台里显示示例值，拖上看板时才选绑哪个指标。 */
import * as echarts from 'echarts'
import { themeBase, token } from './theme.js'

export const BASES = [
  { v: 'plain', t: '白卡' },
  { v: 'line', t: '描边' },
  { v: 'soft', t: '浅底' },
  { v: 'dark', t: '深色' },
  { v: 'grad', t: '渐变' },
]

export const SLOTS = [
  { v: '', t: '不绑数据（固定样式）' },
  { v: 'main', t: '主数值' },
  { v: 'sub', t: '副说明' },
  { v: 'series', t: '趋势序列' },
  { v: 'cats', t: '分类名' },
]

export const DEMO = {
  cats: ['1月', '2月', '3月', '4月', '5月', '6月', '7月'],
  vals: [38, 56, 98, 64, 86, 110, 77],
  pie: [['分组 A', 42], ['分组 B', 33], ['分组 C', 15], ['分组 D', 10]],
  tree: { name: '全年', children: [{ name: 'Q1', children: [{ name: '1月', value: 38 }, { name: '2月', value: 56 }] }, { name: 'Q2', children: [{ name: '4月', value: 64 }, { name: '5月', value: 86 }] }] },
  heat: Array.from({ length: 7 }, (_, d) => Array.from({ length: 6 }, (_, h) => Math.round((Math.sin(d + h) + 1) * 50))),
}

const ICONS = {
  up: 'M4 17 12 7l4 5 4-4v9z',
  down: 'M4 7h20v10l-4 4-4-5-8 10z',
  warn: 'M12 2 1 21h22L12 2zm0 6 1 7h-2l1-7zm0 9.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z',
  money: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4 12h-2v1.5h-1V14h-2v1.5H10V14H8v-1.5h2V11h-2V9.5h2V8h1v1.5h2V8h2v1.5h-2V11h2v1.5h-2V14h2z',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4V7zm9-1.8L6.3 7.2 12 9.8l5.7-2.6L12 5.2z',
  shop: 'M4 4h16l2 6H2l2-6zm0 8h16v8H4v-8zm3 2v4h10v-4H7z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v5.4l4.2 2.5-.9 1.5L11 13V7h2z',
  users: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6H2zm14-6c2.8 0 5 2.2 5 5v1h-4v-1c0-1.9-.7-3.6-1.9-4.9.3-.1.6-.1.9-.1z',
}

function el(cls, text) {
  const e = document.createElement('div')
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

function chartOption(type, p) {
  const base = themeBase()
  const fs = Number(p.fontSize) || 12
  const cats = DEMO.cats, vals = DEMO.vals
  const cat = { type: 'category', data: cats, axisLabel: { color: token('--sub'), fontSize: fs }, axisLine: { lineStyle: { color: token('--line') } } }
  const val = { type: 'value', axisLabel: { color: token('--sub'), fontSize: fs }, splitLine: { lineStyle: { color: token('--line') } } }
  switch (type) {
    case 'hbar': return { ...base, xAxis: val, yAxis: { ...cat, inverse: true }, series: [{ type: 'bar', data: vals, barMaxWidth: 20, itemStyle: { borderRadius: [0, 4, 4, 0] } }] }
    case 'line': case 'area': return { ...base, xAxis: cat, yAxis: val, series: [{ type: 'line', data: vals, smooth: true, symbolSize: 5, lineStyle: { width: 2.5 }, areaStyle: type === 'area' ? { opacity: .12 } : undefined }] }
    case 'pie': return { ...base, tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: '68%', label: { fontSize: fs, color: token('--ink') }, data: DEMO.pie.map(([n, v]) => ({ name: n, value: v })) }] }
    case 'ring': return { ...base, tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['50%', '74%'], itemStyle: { borderColor: token('--card'), borderWidth: 2 }, label: { fontSize: fs, color: token('--ink') }, data: DEMO.pie.map(([n, v]) => ({ name: n, value: v })) }] }
    case 'gauge': return { ...base, tooltip: { show: false }, series: [{ type: 'gauge', radius: '92%', progress: { show: true, width: 10 }, axisTick: { show: false }, splitLine: { length: 6 }, detail: { fontSize: fs + 4, formatter: '{value}%' }, data: [{ value: Number(p.percent) || 68 }] }] }
    case 'kline': return { ...base, xAxis: cat, yAxis: val, series: [{ type: 'candlestick', data: [[20, 22, 19, 24], [22, 26, 21, 27], [26, 25, 22, 28], [25, 30, 24, 31], [30, 28, 25, 32], [28, 34, 27, 35]] }] }
    case 'heatmap': {
      const data = []
      DEMO.heat.forEach((row, d) => row.forEach((v, h) => data.push([h, d, v])))
      return { ...base, tooltip: { show: false }, grid: { left: 24, right: 8, top: 8, bottom: 26 },
        xAxis: { type: 'category', data: ['09', '11', '13', '15', '17', '19'], axisLabel: { fontSize: fs - 2, color: token('--sub') } },
        yAxis: { type: 'category', data: ['一', '二', '三', '四', '五', '六', '日'], axisLabel: { fontSize: fs - 2, color: token('--sub') } },
        visualMap: { min: 0, max: 100, show: false, inRange: { color: [token('--mint-soft'), token('--mint')] } },
        series: [{ type: 'heatmap', data }] }
    }
    case 'tree': return { ...base, tooltip: { show: false }, series: [{ type: 'tree', data: [DEMO.tree], left: 4, right: 40, top: 6, bottom: 6, symbolSize: 7, label: { fontSize: fs, color: token('--ink') }, leaves: { label: { position: 'right' } }, lineStyle: { color: token('--line') }, expandAndCollapse: false }] }
    default: return { ...base, xAxis: cat, yAxis: val, series: [{ type: 'bar', data: vals, barMaxWidth: 26, itemStyle: { borderRadius: [4, 4, 0, 0] } }] }
  }
}

export const ELEMENTS = {
  number: {
    label: '数字', kind: '文字', def: { w: 160, h: 48 },
    fields: [{ k: 'text', t: '示例值', type: 'text' }, { k: 'fontSize', t: '字号', type: 'number' },
             { k: 'weight', t: '粗细', type: 'select', opts: [{ v: 600, t: '中' }, { v: 700, t: '粗' }, { v: 800, t: '特粗' }] },
             { k: 'align', t: '对齐', type: 'select', opts: [{ v: 'left', t: '左' }, { v: 'center', t: '中' }, { v: 'right', t: '右' }] },
             { k: 'slot', t: '数据位', type: 'select', opts: SLOTS }],
    props: { text: '1,270 万', fontSize: 34, weight: 800, align: 'left', slot: 'main' },
    render(it) {
      const e = el('e-number')
      e.textContent = it.props.text || ''
      e.style.fontSize = `${Number(it.props.fontSize) || 34}px`
      e.style.fontWeight = it.props.weight || 800
      e.style.textAlign = it.props.align || 'left'
      return e
    },
  },

  text: {
    label: '文字', kind: '文字', def: { w: 160, h: 24 },
    fields: [{ k: 'text', t: '内容', type: 'text' }, { k: 'fontSize', t: '字号', type: 'number' },
             { k: 'weight', t: '粗细', type: 'select', opts: [{ v: 400, t: '常规' }, { v: 600, t: '中' }, { v: 700, t: '粗' }] },
             { k: 'align', t: '对齐', type: 'select', opts: [{ v: 'left', t: '左' }, { v: 'center', t: '中' }, { v: 'right', t: '右' }] },
             { k: 'slot', t: '数据位', type: 'select', opts: SLOTS }],
    props: { text: '销售额', fontSize: 14, weight: 600, align: 'left', slot: 'sub' },
    render(it) {
      const e = el('e-text')
      e.textContent = it.props.text || ''
      e.style.fontSize = `${Number(it.props.fontSize) || 14}px`
      e.style.fontWeight = it.props.weight || 600
      e.style.textAlign = it.props.align || 'left'
      return e
    },
  },

  desc: {
    label: '描述', kind: '文字', def: { w: 200, h: 20 },
    fields: [{ k: 'text', t: '说明文字', type: 'text' }, { k: 'fontSize', t: '字号', type: 'number' }],
    props: { text: '出库额（含税）· 每日更新', fontSize: 12 },
    render(it) {
      const e = el('e-desc')
      e.textContent = it.props.text || ''
      e.style.fontSize = `${Number(it.props.fontSize) || 12}px`
      return e
    },
  },

  chart: {
    label: '图表', kind: '图形', def: { w: 220, h: 120 },
    fields: [{ k: 'chartType', t: '图型', type: 'select', opts: [
      { v: 'bar', t: '柱状' }, { v: 'hbar', t: '条形' }, { v: 'line', t: '折线' }, { v: 'area', t: '面积' },
      { v: 'pie', t: '扇形' }, { v: 'ring', t: '圆环' }, { v: 'gauge', t: '仪表' }, { v: 'kline', t: 'K线' },
      { v: 'heatmap', t: '热力' }, { v: 'tree', t: '树状' }] },
      { k: 'percent', t: '百分比（仪表）', type: 'number' },
      { k: 'fontSize', t: '轴字字号', type: 'number' },
      { k: 'slot', t: '数据位', type: 'select', opts: SLOTS }],
    props: { chartType: 'bar', fontSize: 11, slot: 'series' },
    render(it) {
      const box = el('e-chart')
      const inst = echarts.init(box, null, { renderer: 'canvas' })
      inst.setOption(chartOption(it.props.chartType || 'bar', it.props))
      // 容器尺寸由摆它的人决定，靠 ResizeObserver 跟随；清理挂在节点上，谁摘掉它谁调用
      const ro = new ResizeObserver(() => inst.resize())
      ro.observe(box)
      box.__onRemove = () => { ro.disconnect(); inst.dispose() }
      return box
    },
  },

  icon: {
    label: '图标', kind: '图标', def: { w: 32, h: 32 },
    fields: [{ k: 'name', t: '图标', type: 'select', opts: Object.keys(ICONS).map(k => ({ v: k, t: k })) },
             { k: 'size', t: '尺寸', type: 'number' },
             { k: 'tone', t: '色性', type: 'select', opts: [{ v: 'mint', t: '主色' }, { v: 'ink', t: '墨色' }, { v: 'warn', t: '警示' }] }],
    props: { name: 'up', size: 28, tone: 'mint' },
    render(it) {
      const wrap = el(`e-icon tone-${it.props.tone || 'mint'}`)
      const s = Number(it.props.size) || 28
      wrap.innerHTML = `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${Object.hasOwn(ICONS, it.props.name) ? ICONS[it.props.name] : ICONS.up}"/></svg>`
      return wrap
    },
  },

  mark: {
    label: '图示', kind: '图示', def: { w: 160, h: 24 },
    fields: [{ k: 'form', t: '形式', type: 'select', opts: [
      { v: 'bar', t: '进度条' }, { v: 'ring', t: '完成环' }, { v: 'tag', t: '色块标签' }, { v: 'stars', t: '星级' }] },
      { k: 'percent', t: '百分比', type: 'number' },
      { k: 'text', t: '标签文字', type: 'text' },
      { k: 'slot', t: '数据位', type: 'select', opts: SLOTS }],
    props: { form: 'bar', percent: 71, text: '达成', slot: 'main' },
    render(it) {
      const p = Math.max(0, Math.min(100, Number(it.props.percent) || 0))
      if (it.props.form === 'ring') {
        const e = el('e-ring')
        e.style.setProperty('--p', String(p))
        return e
      }
      if (it.props.form === 'tag') {
        const e = el('e-tag')
        e.textContent = it.props.text || ''
        return e
      }
      if (it.props.form === 'stars') {
        const e = el('e-stars')
        e.textContent = '★★★★★'.slice(0, Math.round(p / 20))
        return e
      }
      const e = el('e-bar')
      e.innerHTML = `<i style="width:${p}%"></i>`
      return e
    },
  },
}

export const KINDS = [...new Set(Object.values(ELEMENTS).map(e => e.kind))]
