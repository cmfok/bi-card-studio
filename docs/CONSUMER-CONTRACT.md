# 消费方接入契约 / Consumer Contract

平台的唯一外部依赖形状就是这份配置。换一家消费方＝换这一个文件，平台代码零改动。
仓内 `搭建器/public/consumer.config.js` 附的是**示例占位内容**（端点不存在，取数会如实报不可达）。

## 加载方式

四个页面在应用脚本**之前**用普通 `<script>` 注入配置文件，模块脚本按规范是 defer 的，
因此配置文件先执行、`window.BI_CONSUMER` 一定就绪：

- `index.html:36`（看板编辑台）、`studio.html:27`（卡片工作台）、`cards.html:20`（卡片库）、`view.html:18`（渲染页）

Vite 把 `public/` 原样拷进 `dist/`，页面用相对路径 `./consumer.config.js` 取它，
因此站点部署在子路径下也能命中（不需要改配置路径）。

## 字段

```js
window.BI_CONSUMER = {
  name: "example-consumer",        // 仅用于界面显示与排查，不参与判定
  apiBase: "/example-bi-api",      // 数据服务前缀，与 endpoints 里的 path 拼接
  credHeader: "X-Example-Cred",    // 身份凭证的请求头名（平台只透传，不解释其含义）
  credKey: "example-login:cred:v1",// 凭证在使用方站点内的 localStorage 键，值形如 {"cred":"..."}
  endpoints: [
    { key: "overview", label: "总览", path: "/overview" },
    { key: "channels", label: "分组对比", path: "/channels" },
    { key: "trend",    label: "趋势",     path: "/trend" }
  ]
}
```

| 字段 | 必填 | 用在哪 | 代码位置 |
|---|:--:|---|---|
| `apiBase` | 🔴 | 每次取数的 URL 前缀 | `src/data.js:7`–`9`（准入判定）、`src/data.js:44`（URL 拼接） |
| `credHeader` | 🔴 | 请求头里带凭证的那一个头名 | `src/data.js:53` |
| `credKey` | 🔴 | 从浏览器存储读凭证的键名 | `src/data.js:27`–`29` |
| `endpoints[].key` | 🔴 | 平台内部按 key 取元信息／配置端点 | `src/data.js:12`–`16`（`ep(key)`） |
| `endpoints[].label` | 建议 | 属性面板「端点」下拉里显示的中文名，缺省回落 `key` | `src/data.js:18`–`22` |
| `endpoints[].path` | 🔴 | 拼在 `apiBase` 后的路径 | 同上 |

**准入判定是三条**：`apiBase`、`credHeader`、非空 `endpoints`（`src/data.js:7`–`9`）。
`credKey` 缺失时凭证取不到，会以「未登录」形态如实报出，而不是静默当已登录。

保留键：`meta`（元信息，`dataAsOf` 等用）与 `config`（指标下拉源）会被平台主动调用；
`meta`／`config`／`schema` 三个键不会出现在端点下拉里（`src/data.js:21`）。

## fail-closed 语义（这是硬要求）

- 配置缺失或不全 → 每一次取数返回 `kind: "config"`，界面显示
  「缺消费方接入配置：请提供 consumer.config.js（apiBase／credHeader／endpoints 三项齐全），平台不回落默认地址」
  （`src/data.js:38`–`40`）。**平台里没有一份默认地址可回落。**
- 组件绑的端点在这份清单里不存在 → `kind: "config"`，「该组件绑的端点键在消费方配置里不存在，未取数（不猜路径）」
  （`src/data.js:41`–`43`）。属性面板也不允许「留空默认取第一个端点」这种隐式行为。
- 服务端返回 401/403 时按语义分三类报：未登录（`no_open_id`）／身份未识别（`map_unavailable`、`unknown_person`）／
  确实无该模块权限；不可达与 502 单独一类（`src/data.js:58` 起的分流）。
- 打码值 `***` 由服务端给出，前端原样显示（`src/data.js` 的 `isMasked`），不改写成 0 或空。

## 端点返回值的形状约定

组件属性里除「端点」还有一栏「路径」，用的是点号路径取值（`src/data.js` 的 `pick`，支持 `a.b.0.c`）：

- 取到一个标量 → 数字类组件显示该值。
- 取到数组 → 表格／图表类组件按行渲染。
- 取不到（`undefined`）→ 显示「路径 xxx 在该接口里取不到值」，不猜数。
- 顶层 `{"empty": true}` → 显示空态，不画假图。

元信息端点（`meta`）建议返回 `data_as_of` 一类字段，渲染页顶栏会显示「数据截至 …」；
拿不到时按上面的失败语义如实降级。

## 主题（尚未外置）

色值目前集中在 `src/tokens.css` 的 `:root` 里，是平台自带的默认主题。
「由消费方注入主题包」是下一步（同一条 fail-closed 原则：缺主题包时回落默认主题并提示，不改配色判定）。
在那之前，改动配色请只改 `:root` 令牌表——仓内的令牌纪律门禁会拦住其他文件里的裸色值。
