/* 令牌读取：ECharts 要色值时从这里取，禁止在 JS 里写死 hex（令牌门禁会拦） */
const cache = new Map()

export function token(name) {
  if (cache.has(name)) return cache.get(name)
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  cache.set(name, v)
  return v
}

/** 图表配色序列（--c1…--c6） */
export function palette() {
  return [1, 2, 3, 4, 5, 6].map(i => token(`--c${i}`))
}

export function themeBase() {
  return {
    color: palette(),
    textStyle: { color: token('--ink'), fontFamily: 'inherit' },
    grid: { left: 36, right: 12, top: 24, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
  }
}
