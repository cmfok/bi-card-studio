/* 六套起手板式：每套预置不同的跨度与层次组合，避免从空白页开始。
 * 数值一律是演示值（props.demo=true，界面带「演示」角标），接真数据后由属性面板换掉。 */
const P = (over = {}) => ({ demo: true, scaleWithCell: true, ...over })

function cell(id, type, x, y, w, h, props, children) {
  return { id, type, x, y, w, h, props: P(props), ...(children ? { children } : {}) }
}

export const PRESETS = {
  overview: {
    label: '总览型（焦点卡＋三指标＋趋势）',
    build: () => ({
      version: 1, name: '总览型', floats: [],
      cells: [
        cell('o1', 'card', 0, 0, 30, 26, { title: '焦点卡 · 指标值', badge: '可再放子组件' }, [
          cell('o1a', 'pill', 0, 0, 6, 2, { text: '2026', fontSize: 13 }),
          cell('o1b', 'metric', 0, 3, 24, 6, { title: '销售额', value: '1,270 万', fontSize: 44 }),
          cell('o1c', 'chart', 0, 10, 24, 12, { title: '近 7 月', chartType: 'area', fontSize: 11 }),
        ]),
        cell('o2', 'metric', 32, 0, 20, 8, { title: '订单数', value: '245,461', fontSize: 34 }),
        cell('o3', 'metric', 32, 9, 20, 8, { title: '在售店铺', value: '20', fontSize: 34 }),
        cell('o4', 'metric', 32, 18, 20, 8, { title: '同比', value: '+18.4%', fontSize: 34 }),
        cell('o5', 'chart', 54, 0, 46, 17, { title: '月度趋势', chartType: 'bar' }),
        cell('o6', 'table', 54, 18, 46, 12, { title: '渠道明细', cols: '渠道,指标值,占比' }),
      ],
    }),
  },

  target: {
    label: '目标进度型（达成率＋仪表）',
    build: () => ({
      version: 1, name: '目标进度型', floats: [],
      cells: [
        cell('t1', 'metric', 0, 0, 22, 9, { title: '年度目标', value: '1.8 亿', fontSize: 34 }),
        cell('t2', 'metric', 23, 0, 22, 9, { title: '已达成', value: '1.27 亿', fontSize: 34 }),
        cell('t3', 'chart', 46, 0, 26, 9, { title: '总达成率', chartType: 'gauge', percent: 71 }),
        cell('t4', 'chart', 73, 0, 27, 9, { title: '季度节奏', chartType: 'progress', percent: 83 }),
        cell('t5', 'chart', 0, 10, 50, 18, { title: '各渠道达成', chartType: 'hbar' }),
        cell('t6', 'table', 51, 10, 49, 18, { title: '目标对照', cols: '渠道,目标,实际,达成率' }),
      ],
    }),
  },

  channel: {
    label: '渠道对比型（三渠道并排）',
    build: () => ({
      version: 1, name: '渠道对比型', floats: [],
      cells: [
        cell('c1', 'card', 0, 0, 33, 26, { title: '分组 A' }, [
          cell('c1a', 'metric', 0, 0, 24, 5, { title: '指标值', value: '534 万', fontSize: 30 }),
          cell('c1b', 'chart', 0, 6, 24, 16, { title: '分项占比', chartType: 'ring' }),
        ]),
        cell('c2', 'card', 34, 0, 33, 26, { title: '分组 B' }, [
          cell('c2a', 'metric', 0, 0, 24, 5, { title: '指标值', value: '419 万', fontSize: 30 }),
          cell('c2b', 'chart', 0, 6, 24, 16, { title: '分项占比', chartType: 'bar' }),
        ]),
        cell('c3', 'card', 67, 0, 33, 26, { title: '分组 C' }, [
          cell('c3a', 'metric', 0, 0, 24, 5, { title: '指标值', value: '190 万', fontSize: 30 }),
          cell('c3b', 'chart', 0, 6, 24, 16, { title: '分项占比', chartType: 'hbar' }),
        ]),
      ],
    }),
  },

  trend: {
    label: '趋势型（大图＋小图阵列）',
    build: () => ({
      version: 1, name: '趋势型', floats: [],
      cells: [
        cell('r1', 'chart', 0, 0, 66, 20, { title: '全年走势', chartType: 'line' }),
        cell('r2', 'pill', 67, 0, 6, 2, { text: '2026', fontSize: 13 }),
        cell('r3', 'pill', 74, 0, 6, 2, { text: 'Q4', tone: 'plain', fontSize: 13 }),
        cell('r4', 'chart', 0, 21, 33, 14, { title: '时段热度', chartType: 'heatmap' }),
        cell('r5', 'chart', 34, 21, 32, 14, { title: '价格区间', chartType: 'kline' }),
        cell('r6', 'chart', 67, 4, 33, 14, { title: '品类结构', chartType: 'tree' }),
        cell('r7', 'text', 67, 19, 33, 3, { text: '指标值（含税）· 每日更新', fontSize: 13 }),
      ],
    }),
  },

  rank: {
    label: '排行型（条形榜＋明细表）',
    build: () => ({
      version: 1, name: '排行型', floats: [],
      cells: [
        cell('k1', 'chart', 0, 0, 46, 24, { title: '店铺 TOP10', chartType: 'hbar' }),
        cell('k2', 'table', 47, 0, 53, 15, { title: 'SKU 明细', cols: 'SKU,销量,金额,退款率' }),
        cell('k3', 'metric', 47, 16, 17, 8, { title: '动销 SKU', value: '1,842', fontSize: 28 }),
        cell('k4', 'metric', 65, 16, 17, 8, { title: '滞销 SKU', value: '216', fontSize: 28 }),
        cell('k5', 'metric', 83, 16, 17, 8, { title: '退款率', value: '2.4%', fontSize: 28 }),
      ],
    }),
  },

  mixed: {
    label: '混合型（左导航＋右内容）',
    build: () => ({
      version: 1, name: '混合型', floats: [{ id: 'mfloat', type: 'pill', props: P({ text: '实时', fontSize: 12 }), x: 92, y: 1, w: 6, h: 2 }],
      cells: [
        cell('m1', 'pill', 0, 0, 5, 2, { text: '2026', fontSize: 13 }),
        cell('m2', 'pill', 6, 0, 5, 2, { text: 'Q4', tone: 'plain', fontSize: 13 }),
        cell('m3', 'metric', 0, 3, 24, 8, { title: '指标值', value: '1,270 万', fontSize: 36 }),
        cell('m4', 'chart', 0, 12, 24, 14, { title: '月度', chartType: 'bar' }),
        cell('m5', 'card', 25, 0, 40, 26, { title: '重点品类' }, [
          cell('m5a', 'metric', 0, 0, 24, 5, { title: '品类额', value: '612 万', fontSize: 28 }),
          cell('m5b', 'chart', 0, 6, 24, 16, { title: '结构', chartType: 'ring' }),
        ]),
        cell('m6', 'table', 66, 0, 34, 26, { title: '店铺榜', cols: '店铺,金额,环比' }),
      ],
    }),
  },
}

export const PRESET_KEYS = Object.keys(PRESETS)
