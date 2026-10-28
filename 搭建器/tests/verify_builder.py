# -*- coding: utf-8 -*-
"""搭建器 V1 交付判据：不测「页面 200」，测「真渲染＋格制行为」。
跑法：python tests/verify_builder.py    （失败 exit 1）
判据清单见 README.md 第三节 F-01～F-11。"""
import io
import json
import os
import socket
import subprocess
import sys
import time
import urllib.parse
import urllib.request

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def read(p):
    return io.open(os.path.join(DIST, p), encoding="utf-8").read()


if not os.path.isdir(DIST):
    print("[FAIL] 没有 dist/，先跑 npm run build")
    sys.exit(1)

# 传第二个参数即改测线上（同一套判据，手动铺环境不算验证）：
#   python tests/verify_builder.py x <预览站基址>   # 例：http://<staging-host>/_builder
ONLINE = sys.argv[2] if len(sys.argv) > 2 else None
if ONLINE:
    BASE = ONLINE.rstrip("/")
    PORT = None
    srv = None
else:
    PORT = free_port()
    BASE = f"http://127.0.0.1:{PORT}"
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                           cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# A. 自证：服务回的是本次构建（比对 dist/index.html 引用的资产名）
marker = None
ready = False
for _ in range(15):
    time.sleep(1)
    try:
        h = urllib.request.urlopen(f"{BASE}/index.html", timeout=4).read().decode("utf-8", "ignore")
        marker = [a.lstrip("./") for a in read("index.html").split('"')
                  if "assets/" in a and a.endswith(".js")][0]
        if marker in h:
            ready = True
            break
    except Exception:
        continue
print(f"[A 自证] {BASE} 响应含本次构建资产 {marker}: {ready}")
if not ready:
    if srv:
        srv.terminate()
    sys.exit(1)

fails = []


def chk(name, ok, detail=""):
    print(f"[{'过' if ok else '不过'}] {name} {detail}")
    if not ok:
        fails.append(name)


with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 1600, "height": 950})
    pg = ctx.new_page()
    errs = []
    missing = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)[:200]))
    pg.on("console", lambda m: errs.append("console.err: " + m.text[:160])
          if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.on("response", lambda r: missing.append(f"{r.status} {r.url}")
          if r.status >= 400 and "favicon" not in r.url else None)
    pg.goto(f"{BASE}/index.html", wait_until="load")
    pg.wait_for_timeout(4000)

    # B. 编辑器真渲染（404 单独列，favicon 缺失不算缺陷但要如实记录）
    pal = pg.locator(".pal-item").count()
    items = pg.locator("#canvas > .grid-stack-item").count()
    charts = pg.locator(".v-chart canvas").count()
    chk("B1 组件库四层齐备", pal >= 6, f"实得 {pal} 个可拖组件")
    chk("B2 板式落位≥6", items >= 6, f"实得 {items}")
    chk("B3 ECharts 真出图≥1", charts >= 1, f"实得 {charts}")
    chk("B4 页面零报错", len(errs) == 0, "；".join(errs[:3]))
    # 消费方配置从页面取，判据不写死任何一家的前缀/凭证键（BS-F027 口径）
    CFG = pg.evaluate("() => window.BI_CONSUMER || {}")
    API = CFG.get("apiBase", "")
    CRED_KEY = CFG.get("credKey", "")
    CRED_HDR = (CFG.get("credHeader", "") or "").lower()
    api404 = [m for m in missing if API and API in m]
    other404 = [m for m in missing if not (API and API in m)]
    chk("B5 除数据服务层外无异常响应", len(other404) == 0, "；".join(other404[:3]))
    # 本地没有数据服务层，接口 404 属预期；判据是「界面如实降级」而不是假装取到数
    asof = pg.locator("#asof").inner_text()
    SPECIFIC = ("数据截至", "未登录", "没有该模块权限", "登录身份没认出来", "不可达", "数据服务层异常")
    chk("B6 取不到数时说明具体原因（不许笼统写未连接）", asof.startswith(SPECIFIC),
        f"顶栏文案「{asof}」，数据服务层非 2xx {len(api404)} 条")

    # C. 字号随容器等比缩放（cqw 口径：实测字号 / 容器宽 ≈ props.fontSize / baseW）
    c = pg.evaluate("""() => {
      const node=(window.__biBuilder.canvas.read().cells||[]).find(x=>x.type==='metric' && x.props?.baseW);
      if(!node) return null;
      const w=document.querySelector(`.w[data-node-id='${node.id}']`);
      if(!w) return null;
      const num=w.querySelector(':scope > .w-bd .v-num');
      const ref=w.closest('.grid-stack-item-content');   // cqw 的参照就是这个容器
      return {fs:parseFloat(getComputedStyle(num).fontSize), w:ref.clientWidth,
              want:node.props.fontSize/node.props.baseW, id:node.id,
              declared:node.props.fontSize, baseW:node.props.baseW};
    }""")
    if c and c["want"]:
        got = c["fs"] / c["w"]
        chk("C 字号随容器等比", abs(got - c["want"]) / c["want"] < 0.02,
            f"容器 {c['w']}px → 字号 {c['fs']}px（比值 {got:.4f}，声明 {c['want']:.4f}）")
    else:
        chk("C 字号随容器等比", False, "取不到 metric 元素或基准宽")

    # D. 内容驱动高度：新加一颗胶囊，拖窄后高度不得留大片空白
    d = pg.evaluate("""async () => {
      const {canvas, api} = window.__biBuilder;
      const id = api.add('pill');
      await new Promise(r=>setTimeout(r, 700));
      const g = canvas.grid;
      const root = document.querySelector(`#canvas > .grid-stack-item .w[data-node-id='${id}']`);
      const el = root ? root.closest('.grid-stack-item') : null;
      const pill = el.querySelector('.v-pill');
      const h0 = el.getBoundingClientRect().height, w0 = el.getBoundingClientRect().width;
      const p0 = pill.getBoundingClientRect();
      g.update(el, {w: 2});
      await new Promise(r=>setTimeout(r, 700));
      const h1 = el.getBoundingClientRect().height, w1 = el.getBoundingClientRect().width;
      const p1 = pill.getBoundingClientRect();
      return {h0, w0, h1, w1, pad0: h0 - p0.height, pad1: h1 - p1.height, pw0: p0.width, pw1: p1.width};
    }""")
    chk("D1 胶囊初始不占空高", d and d["h0"] <= 46, f"初始高 {d['h0']:.0f}px（内容 {d['pw0']:.0f}×{d['h0'] - d['pad0']:.0f}）")
    chk("D2 拖窄后不塌字", d and d["w1"] < d["w0"] and d["pad1"] <= d["pad0"] + 2,
        f"宽 {d['w0']:.0f}→{d['w1']:.0f}，空白 {d['pad0']:.0f}→{d['pad1']:.0f}px")

    # E. 属性面板随选中出现；图表组件要能选到 11 种图型
    pg.locator("#canvas > .grid-stack-item .w-hd").first.click()
    pg.wait_for_timeout(500)
    chk("E1 属性面板出字段", pg.locator("#props .f-row").count() >= 3, f"实得 {pg.locator('#props .f-row').count()}")
    chart_id = pg.evaluate("window.__biBuilder.canvas.read().cells.find(c=>c.type==='chart').id")
    pg.locator(f"#canvas > .grid-stack-item .w[data-node-id='{chart_id}'] .w-hd").first.click()
    pg.wait_for_timeout(500)
    types = pg.evaluate("""() => {
      const s=[...document.querySelectorAll('#props select')].find(x=>[...x.options].some(o=>o.textContent.includes('扇形')));
      return s ? s.options.length : 0;
    }""")
    chk("E2 图型可选≥11", types >= 11, f"实得 {types} 种")
    pg.screenshot(path=os.path.join(HERE, "..", "output", "builder-editor.png"))

    # H. 身份凭证要随请求带上（凭证头名与存储键都由消费方配置给，平台只透传）
    pg.evaluate("(k) => localStorage.setItem(k, JSON.stringify({cred:'SELFTEST-NOT-A-REAL-CRED'}))", CRED_KEY)
    hdr = {}

    def on_req(req):
        if API and API in req.url:
            hdr.update(req.headers)
    pg2h = ctx.new_page()
    pg2h.on("request", on_req)
    pg2h.goto(BASE + "/index.html", wait_until="load")
    pg2h.wait_for_timeout(2500)
    chk("H 请求带身份凭证", "SELFTEST-NOT-A-REAL-CRED" in json.dumps(hdr),
        f"{CRED_HDR}={hdr.get(CRED_HDR, '（缺）')}")
    pg2h.close()

    # I. 浮层落点必须是有限像素（cellHeight() 返回实例、当数值用会算出 NaN）
    fl = pg.evaluate("""async () => {
      const {canvas} = window.__biBuilder;
      const id = canvas.addFloat('pill', {x: 5, y: 3});
      await new Promise(r=>setTimeout(r,700));
      const el = document.querySelector(`.float-item[data-node-id='${id}']`);
      return el ? {top: el.style.top, h: el.style.height, w: el.style.width} : null;
    }""")
    finite = bool(fl) and all("NaN" not in str(v) and str(v).endswith("px") for v in fl.values())
    chk("I 浮层落点为有限像素", finite, str(fl))

    # J. 删除组件要真少一个（id→元素 账本没漏才点得动）
    dj = pg.evaluate("""async () => {
      const {canvas, api} = window.__biBuilder;
      const before = document.querySelectorAll('#canvas > .grid-stack-item').length;
      const id = api.add('metric');
      await new Promise(r=>setTimeout(r,600));
      const mid = document.querySelectorAll('#canvas > .grid-stack-item').length;
      api.remove(id);
      await new Promise(r=>setTimeout(r,600));
      return {before, mid, after: document.querySelectorAll('#canvas > .grid-stack-item').length};
    }""")
    chk("J 加/删组件生效", dj["mid"] == dj["before"] + 1 and dj["after"] == dj["before"], str(dj))

    # F. 渲染页读同一份版面
    saved = pg.evaluate("""() => {
      const doc = window.__biBuilder.canvas.read();
      doc.name = '自测版面';
      localStorage.setItem('bi-builder-layouts-v1', JSON.stringify({ '自测版面': JSON.stringify(doc) }));
      return doc.cells.length;
    }""")
    pg2 = ctx.new_page()
    e2 = []
    pg2.on("pageerror", lambda e: e2.append(str(e)[:180]))
    pg2.goto(f"{BASE}/view.html?layout=" + urllib.parse.quote("自测版面"), wait_until="load")
    pg2.wait_for_timeout(3500)
    vitems = pg2.locator("#canvas > .grid-stack-item").count()
    chk("F 渲染页还原版面", vitems >= 6 and not e2, f"元素 {vitems}（保存时 {saved}），报错 {len(e2)}")

    # G. 手机端不横向溢出
    pg3 = b.new_page(viewport={"width": 390, "height": 780, "is_mobile": True})
    e3 = []
    pg3.on("pageerror", lambda e: e3.append(str(e)[:180]))
    pg3.goto(f"{BASE}/view.html?layout=" + urllib.parse.quote("自测版面"), wait_until="load")
    pg3.wait_for_timeout(3500)
    ovf = pg3.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth")
    chk("G 手机 390px 无横向溢出", ovf <= 2, f"溢出 {ovf}px")
    pg3.screenshot(path=os.path.join(HERE, "..", "output", "builder-mobile.png"), full_page=True)

    ctx.close()
    b.close()

if srv:
    srv.terminate()
print("\n[结论]", "全部通过" if not fails else f"{len(fails)} 项不过：" + "、".join(fails))
sys.exit(1 if fails else 0)
