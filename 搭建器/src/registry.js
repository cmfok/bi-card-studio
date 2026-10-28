/* 组件注册表：唯一扩展点。
 * 每个组件＝所属层＋默认跨度＋属性面板字段＋渲染函数。要加新样式，只在这里加一条。
 * 渲染函数只认 node（版面 JSON 里的一项），不认页面，所以编辑器和渲染页共用它。 */
import * as echarts from 'echarts'
import { themeBase, token, palette } from './theme.js'
import { get, endpointOptions, pick, isMasked, meta } from './data.js'

export const LAYERS = ['卡片层', '文字层', '图形层', '标签层']

/* 演示数据：只用于「演示值」模式，页面上必须带「演示」角标，不得冒充业务数。
 * 标签一律用「分组 A/B/C/D」这类中性占位——平台不写任何消费方的渠道名与指标名（BS-F028 判据）。 */
export const DEMO = {
  cats: ['1月', '2月', '3月', '4月', '5月', '6月', '7月'],
  vals: [38, 56, 98, 64, 86, 110, 77],
  pie: [['分组 A', 42], ['分组 B', 33], ['分组 C', 15], ['分组 D', 10]],
  tree: { name: '全年', children: [{ name: 'Q1', children: [{ name: '1月', value: 38 }, { name: '2月', value: 56 }] }, { name: 'Q2', children: [{ name: '4月', value: 64 }, { name: '5月', value: 86 }] }] },
  heat: Array.from({ length: 7 }, (_, d) => Array.from({ length: 6 }, (_, h) => Math.round((Math.sin(d + h) + 1) * 50))),
}

/* 端点下拉＝消费方配置里的清单（含中文标签），平台不写死任何一家的端点名 */
const ENDPOINT_OPTIONS = endpointOptions()

/** 字号：勾了「跟随卡片缩放」就用容器查询单位（cqw），否则钉死 px。
 * 贴内容的组件（标签/文本）默认不随格缩放——字号随宽缩会让高度来回变，
 * 实测会在「拖窄→字变小→高度该塌」之间震荡；这类件按固定字号＋宽度贴合才对。 */
function fontCss(props, cellW, hug) {
  const base = Number(props.fontSize) || 16
  const ref = Number(props.baseW) || cellW || 320
  if (hug || !props.scaleWithCell || !cellW) return `${base}px`
  return `${(base / ref * 100).toFixed(3)}cqw`
}

function shell(props, layer, inner) {
  const el = document.createElement('div')
  el.className = `w w-${layer}`
  el.innerHTML = `<div class="w-hd"><span class="w-t"></span><span class="w-tag"></span></div>
    <div class="w-bd"></div>`
  el.querySelector('.w-t').textContent = props.title || ''
  el.querySelector('.w-tag').textContent = props.demo ? '演示' : (props.badge || '')
  el.querySelector('.w-bd').appendChild(inner)
  if (!props.title) el.classList.add('w-nohd')
  return el
}

function note(text, kind) {
  const el = document.createElement('div')
  el.className = `w-note w-note-${kind}`
  el.textContent = text
  return el
}

/** 取数：src=api 时按端点＋路径取，取不到不猜数 */
async function resolveValue(props) {
  if (props.src !== 'api') return { kind: 'demo', value: props.value }
  const r = await get(props.endpoint)
  if (!r.ok) return { kind: r.kind, msg: r.msg }
  if (r.kind === 'empty') return { kind: 'empty' }
  const v = pick(r.data, props.path || '')
  if (v === undefined) return { kind: 'nodata', msg: `路径 ${props.path || '（未填）'} 在该接口里取不到值` }
  return { kind: isMasked(v) ? 'masked' : 'ok', value: v }
}

function fmt(v) {
  if (typeof v === 'number') return v.toLocaleString('zh-CN')
  return String(v)
}

/* ---------- 图表 option 生成 ---------- */
function chartOption(type, props) {
  const base = themeBase()
  // 属性面板的「轴字字号」要真落到轴上，否则这条属性是假的
  const axFs = Number(props.fontSize) || 12
  const cats = props.cats && props.cats.length ? props.cats : DEMO.cats
  const vals = props.vals && props.vals.length ? props.vals : DEMO.vals
  const axis = { category: { type: 'category', data: cats, axisLine: { lineStyle: { color: token('--line') } }, axisLabel: { color: token('--sub'), fontSize: axFs } },
                 value: { type: 'value', splitLine: { lineStyle: { color: token('--line') } }, axisLabel: { color: token('--sub'), fontSize: axFs } } }
  switch (type) {
    case 'bar':
      return { ...base, xAxis: axis.category, yAxis: axis.value, series: [{ type: 'bar', data: vals, barMaxWidth: 28, itemStyle: { borderRadius: [4, 4, 0, 0] } }] }
    case 'hbar':
      return { ...base, xAxis: axis.value, yAxis: { ...axis.category, inverse: true }, series: [{ type: 'bar', data: vals, barMaxWidth: 22, itemStyle: { borderRadius: [0, 4, 4, 0] } }] }
    case 'line':
    case 'area':
      return { ...base, xAxis: axis.category, yAxis: axis.value,
        series: [{ type: 'line', data: vals, smooth: true, symbolSize: 6, lineStyle: { width: 2.5 },
          areaStyle: type === 'area' ? { opacity: .12 } : undefined }] }
    case 'pie':
      return { ...base, tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: '70%', data: DEMO.pie.map(([n, v]) => ({ name: n, value: v })), label: { color: token('--ink') } }] }
    case 'ring':
      return { ...base, tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['52%', '76%'], avoidLabelOverlap: true,
        itemStyle: { borderColor: token('--card'), borderWidth: 2 }, data: DEMO.pie.map(([n, v]) => ({ name: n, value: v })), label: { color: token('--ink') } }] }
    case 'progress': {
      const pct = Math.max(0, Math.min(100, Number(props.percent ?? vals[vals.length - 1])))
      return { ...base, grid: undefined, xAxis: { hide: true }, yAxis: { show: false }, series: [{ type: 'bar', data: [pct], showBackground: true,
        backgroundStyle: { color: token('--line'), borderRadius: 99 }, itemStyle: { borderRadius: 99 }, barWidth: 14,
        label: { show: true, position: 'insideRight', formatter: '{c}%', color: token('--card'), fontWeight: 700 } }],
        tooltip: { show: false } }
    }
    case 'gauge':
      return { ...base, grid: undefined, tooltip: { show: false }, series: [{ type: 'gauge', progress: { show: true, width: 12 },
        axisLine: { lineStyle: { width: 12 } }, axisTick: { show: false }, splitLine: { length: 8 },
        detail: { formatter: '{value}%', color: token('--ink') }, data: [{ value: Math.min(100, Number(props.percent ?? 68)) }] }] }
    case 'kline': {
      const d = [[20, 22, 19, 24], [22, 26, 21, 27], [26, 25, 22, 28], [25, 30, 24, 31], [30, 28, 25, 32], [28, 34, 27, 35]]
      return { ...base, xAxis: axis.category, yAxis: axis.value, series: [{ type: 'candlestick', data: d,
        itemStyle: { color: token('--c5'), color0: token('--c1'), borderColor: token('--c5'), borderColor0: token('--c1') } }] }
    }
    case 'heatmap': {
      const data = []
      DEMO.heat.forEach((row, d) => row.forEach((v, h) => data.push([h, d, v])))
      return { ...base, tooltip: { position: 'top' }, grid: { left: 40, right: 12, top: 12, bottom: 40 },
        xAxis: { type: 'category', data: ['09', '11', '13', '15', '17', '19'], axisLabel: { color: token('--sub') } },
        yAxis: { type: 'category', data: ['一', '二', '三', '四', '五', '六', '日'], axisLabel: { color: token('--sub') } },
        visualMap: { min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 8,
          inRange: { color: [token('--mint-soft'), token('--mint')] } },
        series: [{ type: 'heatmap', data, label: { show: false } }] }
    }
    case 'tree':
      return { ...base, tooltip: { show: false }, series: [{ type: 'tree', data: [DEMO.tree], left: 12, right: 60, top: 12, bottom: 12,
        symbolSize: 8, roam: false, label: { position: 'left', color: token('--ink') }, leaves: { label: { position: 'right' } },
        lineStyle: { color: token('--line') }, expandAndCollapse: false }] }
    default:
      return null
  }
}

/* ---------- 注册表 ---------- */
export const REG = {
  metric: {
    label: '指标卡（大数字）', layer: '文字层', span: { w: 14, h: 6 },
    fields: [
      { k: 'title', t: '标题', type: 'text' },
      { k: 'src', t: '取数', type: 'select', opts: [{ v: 'demo', t: '演示值（手填）' }, { v: 'api', t: '数据服务层' }] },
      { k: 'value', t: '数值', type: 'text', when: 'demo' },
      { k: 'endpoint', t: '端点', type: 'select', opts: ENDPOINT_OPTIONS, when: 'api' },
      { k: 'path', t: '取值路径', type: 'text', ph: '如 kpi.0.value', when: 'api' },
      { k: 'unit', t: '单位', type: 'text' },
      { k: 'fontSize', t: '字号(px)', type: 'number' },
      { k: 'scaleWithCell', t: '跟随卡片缩放', type: 'check' },
    ],
    defaults: { title: '销售额', src: 'demo', value: '1,270 万', unit: '', fontSize: 40, scaleWithCell: true, demo: true },
    async render(node, ctx) {
      const box = document.createElement('div')
      box.className = 'v-metric'
      const r = await resolveValue(node.props)
      const num = document.createElement('div')
      num.className = 'v-num'
      num.style.fontSize = fontCss(node.props, ctx.cellW, ctx.hug)
      if (r.kind === 'demo' || r.kind === 'ok' || r.kind === 'masked') {
        num.textContent = fmt(r.value) + (node.props.unit ? ` ${node.props.unit}` : '')
        if (r.kind === 'masked') num.classList.add('v-masked')
        box.appendChild(num)
      } else if (r.kind === 'empty') {
        box.appendChild(note('该口径暂无数据', 'empty'))
      } else {
        box.appendChild(note(r.msg || '取数失败', 'bad'))
      }
      return shell(node.props, '文字层', box)
    },
  },

  text: {
    label: '文本/口径说明', layer: '文字层', span: { w: 20, h: 3 }, hug: true,
    fields: [{ k: 'text', t: '正文', type: 'area' }, { k: 'fontSize', t: '字号(px)', type: 'number' },
             { k: 'scaleWithCell', t: '跟随卡片缩放', type: 'check' }],
    defaults: { title: '', text: '出库额（含税）· 每日更新', fontSize: 14, scaleWithCell: false },
    render(node, ctx) {
      const el = document.createElement('div')
      el.className = 'v-text'
      el.style.fontSize = fontCss(node.props, ctx.cellW, ctx.hug)
      el.textContent = node.props.text || ''
      return shell(node.props, '文字层', el)
    },
  },

  pill: {
    label: '年份/季度标签', layer: '标签层', span: { w: 4, h: 2 }, hug: true,
    fields: [{ k: 'text', t: '文本', type: 'text' }, { k: 'tone', t: '色性', type: 'select',
               opts: [{ v: 'mint', t: '主色' }, { v: 'plain', t: '描边' }] },
             { k: 'fontSize', t: '字号(px)', type: 'number' }, { k: 'scaleWithCell', t: '跟随卡片缩放', type: 'check' }],
    defaults: { title: '', text: '2026', tone: 'mint', fontSize: 13, scaleWithCell: true },
    render(node, ctx) {
      const wrap = document.createElement('div')
      wrap.className = 'v-pillwrap'
      const el = document.createElement('span')
      el.className = `v-pill v-pill-${node.props.tone || 'mint'}`
      el.style.fontSize = fontCss(node.props, ctx.cellW, ctx.hug)
      el.textContent = node.props.text || ''
      wrap.appendChild(el)
      return shell(node.props, '标签层', wrap)
    },
  },

  chart: {
    label: '图表（ECharts）', layer: '图形层', span: { w: 30, h: 16 },
    fields: [
      { k: 'title', t: '标题', type: 'text' },
      { k: 'chartType', t: '图型', type: 'select', opts: [
        { v: 'bar', t: '柱状图' }, { v: 'hbar', t: '条形图' }, { v: 'line', t: '折线图' }, { v: 'area', t: '面积图' },
        { v: 'pie', t: '扇形图' }, { v: 'ring', t: '圆环图' }, { v: 'progress', t: '进度条' }, { v: 'gauge', t: '仪表盘' },
        { v: 'kline', t: 'K线' }, { v: 'heatmap', t: '热力图' }, { v: 'tree', t: '树状图' }] },
      { k: 'percent', t: '百分比（进度/仪表）', type: 'number' },
      { k: 'fontSize', t: '轴字字号(px)', type: 'number' },
    ],
    defaults: { title: '月度趋势', chartType: 'bar', fontSize: 12, demo: true },
    render(node, ctx) {
      const box = document.createElement('div')
      box.className = 'v-chart'
      const opt = chartOption(node.props.chartType || 'bar', node.props)
      if (!opt) { box.appendChild(note('图型未实现', 'bad')); return shell(node.props, '图形层', box) }
      const inst = echarts.init(box, null, { renderer: 'canvas' })
      inst.setOption(opt)
      ctx.onResize(() => inst.resize())
      ctx.onCleanup(() => inst.dispose())
      // 容器查询下 ECharts 需要显式 resize；等布局稳定后再量一次
      requestAnimationFrame(() => inst.resize())
      return shell(node.props, '图形层', box)
    },
  },

  table: {
    label: '明细表', layer: '图形层', span: { w: 34, h: 14 },
    fields: [{ k: 'title', t: '标题', type: 'text' }, { k: 'src', t: '取数', type: 'select',
               opts: [{ v: 'demo', t: '演示值' }, { v: 'api', t: '数据服务层' }] },
             { k: 'endpoint', t: '端点', type: 'select', opts: ENDPOINT_OPTIONS, when: 'api' },
             { k: 'path', t: '行数组路径', type: 'text', ph: '如 rows', when: 'api' },
             { k: 'cols', t: '列（逗号分隔）', type: 'text' }, { k: 'fontSize', t: '字号(px)', type: 'number' },
             { k: 'scaleWithCell', t: '跟随卡片缩放', type: 'check' }],
    defaults: { title: '渠道明细', src: 'demo', cols: '渠道,出库额,占比', fontSize: 13, scaleWithCell: true, demo: true },
    async render(node, ctx) {
      const wrap = document.createElement('div')
      wrap.className = 'v-tablewrap'
      const cols = (node.props.cols || '').split(',').map(s => s.trim()).filter(Boolean)
      if (!cols.length) { wrap.appendChild(note('未填列名', 'empty')); return shell(node.props, '图形层', wrap) }
      let rows
      if (node.props.src === 'api') {
        const r = await get(node.props.endpoint)
        if (!r.ok) { wrap.appendChild(note(r.msg || '取数失败', 'bad')); return shell(node.props, '图形层', wrap) }
        const arr = pick(r.data, node.props.path || '')
        if (!Array.isArray(arr) || !arr.length) { wrap.appendChild(note('该路径取不到行数据', 'empty')); return shell(node.props, '图形层', wrap) }
        rows = arr.slice(0, 50).map(o => cols.map(c => fmt(o?.[c] ?? '')))
      } else {
        rows = [['分组 A', '534 万', '42%'], ['分组 B', '419 万', '33%'], ['分组 C', '190 万', '15%'], ['分组 D', '127 万', '10%']]
      }
      const tb = document.createElement('table')
      tb.className = 'v-table'
      tb.style.fontSize = fontCss(node.props, ctx.cellW, ctx.hug)
      tb.innerHTML = `<thead><tr>${cols.map(c => `<th></th>`).join('')}</tr></thead><tbody></tbody>`
      tb.querySelectorAll('th').forEach((th, i) => { th.textContent = cols[i] })
      const body = tb.querySelector('tbody')
      rows.forEach(r => {
        const tr = document.createElement('tr')
        r.forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td) })
        body.appendChild(tr)
      })
      wrap.appendChild(tb)
      return shell(node.props, '图形层', wrap)
    },
  },

  card: {
    label: '焦点卡（容器）', layer: '卡片层', span: { w: 30, h: 22 }, nested: true,
    fields: [{ k: 'title', t: '卡标题', type: 'text' }, { k: 'badge', t: '角标', type: 'text' }],
    defaults: { title: '焦点卡', badge: '可再放子组件' },
    render(node) {
      const el = document.createElement('div')
      el.className = 'w w-卡片层 w-card'
      el.innerHTML = `<div class="w-hd"><span class="w-t"></span><span class="w-tag"></span></div><div class="w-sub"></div>`
      el.querySelector('.w-t').textContent = node.props.title || ''
      el.querySelector('.w-tag').textContent = node.props.badge || ''
      return el
    },
  },
}

export const TYPES = Object.keys(REG)

/** 顶栏那句「数据截至 X」：取不到数时必须说清是哪种取不到，不许笼统写「未连接」 */
export async function dataAsOf() {
  const r = await meta()
  if (r.ok) return { text: `数据截至 ${r.data?.data_as_of || '（接口未给日期）'}`, real: true }
  const map = {
    unauth: '未登录 · 登录后这里就是真数',
    denied: '没有该模块权限（服务端判定）',
    identity: '登录身份没认出来，请重新登录',
    unreachable: '数据服务层不可达',
    config: '缺消费方接入配置或未绑端点，未取数（平台不猜地址、不回落默认）',
    error: `数据服务层异常：${r.msg || ''}`,
  }
  return { text: map[r.kind] || '未连接数据服务层（演示值）', real: false }
}

export { palette }
