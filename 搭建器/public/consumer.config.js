/* 消费方接入配置 · 示例件（public example）。
 * 平台不认任何具名消费方：数据前缀、凭证头名、凭证存储键、端点清单与中文标签全部由本文件提供。
 * 换消费方＝换本文件，平台代码零改动（判据见 功能清单 BS-F026/F027/F028）。
 * 本示例件的端点是虚构占位，取数会如实报「不可达／未登录」，不补数、不造样。 */
window.BI_CONSUMER = {
  name: 'example-consumer',
  apiBase: '/example-bi-api',
  credHeader: 'X-Example-Cred',
  credKey: 'example-login:cred:v1',
  endpoints: [
    { key: 'meta', label: '元信息', path: '/meta' },
    { key: 'config', label: '配置', path: '/config' },
    { key: 'overview', label: '总览', path: '/overview' },
    { key: 'channels', label: '分组对比', path: '/channels' },
    { key: 'trend', label: '趋势', path: '/trend' },
    { key: 'rank', label: '排行', path: '/rank' },
  ],
}
