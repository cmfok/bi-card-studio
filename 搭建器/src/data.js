/* 数据服务层客户端：只做传输与三态判定，判权与打码全在服务端。
 * 🔴 消费方无关：数据前缀、凭证头名、凭证存储键、端点清单一律来自 consumer.config.js
 *    （由消费方提供，见接入契约 BS-F028）。平台不写死任何一家消费方的地址与端点名。 */
const CFG = (typeof window !== 'undefined' && window.BI_CONSUMER) || null

/** 平台侧只认这三个键；缺任何一条都拒绝取数并如实报错，绝不静默回落默认值。 */
export function consumerReady() {
  return !!(CFG && CFG.apiBase && CFG.credHeader && Array.isArray(CFG.endpoints) && CFG.endpoints.length)
}
export function consumerName() { return CFG && CFG.name ? CFG.name : '（未配置）' }
/** 端点键 → 路径；配置里没有这个键就返回空，调用方按「未配置」处理，不猜路径 */
export function ep(key) {
  if (!CFG || !Array.isArray(CFG.endpoints)) return ''
  const hit = CFG.endpoints.find(e => e.key === key)
  return hit ? hit.path : ''
}
/** 属性面板「端点」下拉的选项：配置里除结构类端点外全部列出，标签用消费方给的中文名 */
export function endpointOptions() {
  if (!CFG || !Array.isArray(CFG.endpoints)) return []
  return CFG.endpoints
    .filter(e => !['meta', 'config', 'schema'].includes(e.key))
    .map(e => ({ v: e.path, t: `${e.label || e.key}（${e.path}）` }))
}

/* 身份：凭证键名与存储键都由消费方配置决定，平台只透传，不判权、不打码、不补数。 */
export function loginCred() {
  if (!CFG || !CFG.credKey) return ''
  try {
    const o = JSON.parse(localStorage.getItem(CFG.credKey) || 'null')
    return o && o.cred ? o.cred : ''
  } catch (e) {
    return ''
  }
}

/** 统一取数。返回 {ok, kind, data, msg}，kind：ok|empty|denied|unauth|identity|unreachable|config|error */
export async function get(path, params = {}) {
  if (!consumerReady()) {
    return { ok: false, kind: 'config', msg: '缺消费方接入配置：请提供 consumer.config.js（apiBase／credHeader／endpoints 三项齐全），平台不回落默认地址' }
  }
  if (!path) {
    return { ok: false, kind: 'config', msg: '该组件绑的端点键在消费方配置里不存在，未取数（不猜路径）' }
  }
  const url = new URL(CFG.apiBase + path, location.href)

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  const cred = loginCred()
  let res
  try {
    res = await fetch(url.pathname + url.search, {
      headers: { Accept: 'application/json', ...(cred ? { [CFG.credHeader]: cred } : {}) },
    })
  } catch (e) {
    return { ok: false, kind: 'unreachable', msg: '数据服务层不可达（网络或服务未起）' }
  }
  if (res.status === 401 || res.status === 403) {
    // 403 有三种语义，混报会误导：no_open_id＝没登录；map_unavailable/unknown_person＝身份认不出；
    // 其余才是真的没该模块权限。按服务端 error 字段分流，文案各说各的。
    let body = null
    try { body = await res.clone().json() } catch (e) { body = null }
    const msg = (body && body.message) || (await res.text().catch(() => '')) || ''
    const err = body && body.error
    if (res.status === 401 || err === 'no_open_id') {
      return { ok: false, kind: 'unauth', msg: msg || '未登录，登录后即可看到真数' }
    }
    if (err === 'map_unavailable' || err === 'unknown_person') {
      return { ok: false, kind: 'identity', msg: msg || '登录身份没认出来（凭证过期或对不上人）' }
    }
    return { ok: false, kind: 'denied', msg: msg || '没有该模块的查看权限' }
  }
  if (res.status === 502) {
    return { ok: false, kind: 'unreachable', msg: '数据服务层暂时不可用（502）' }
  }
  if (!res.ok) return { ok: false, kind: 'error', msg: `接口返回 ${res.status}` }
  let data
  try {
    data = await res.json()
  } catch (e) {
    return { ok: false, kind: 'error', msg: '接口返回不是合法 JSON' }
  }
  if (data && data.empty === true) return { ok: true, kind: 'empty', data, msg: '该口径暂无数据' }
  return { ok: true, kind: 'ok', data }
}

/** 按 'a.b.0.c' 取值；取不到返回 undefined，不猜数 */
export function pick(obj, dotted) {
  return String(dotted).split('.').reduce((o, k) => {
    if (o === null || o === undefined) return undefined
    return o[k]
  }, obj)
}

/** 服务端打码是字符串 ***，前端原样显示，不得替换成 0 或空 */
export function isMasked(v) {
  return typeof v === 'string' && v.includes('***')
}

const mem = {}
/** 元信息（data_as_of、权限面）与配置（指标下拉源），同一次会话只拉一次 */
export async function meta() {
  if (!mem.meta) mem.meta = await get(ep('meta'))
  return mem.meta
}
export async function config() {
  if (!mem.config) mem.config = await get(ep('config'))
  return mem.config
}
