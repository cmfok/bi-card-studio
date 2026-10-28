# -*- coding: utf-8 -*-
"""卡片工作台判据：测「放元素→吸附有反馈→松手吸到整格→调大小→注册成卡片」这条闭环。
跑法：python tests/verify_studio.py [x http://…/_builder]   （失败 exit 1）"""
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")
PITCH = 8

# 每类元素的「真画出内容」判据：选择器 + 该元素必须出现在底座上
SIG = {
    "数字": ("querySelector('.e-number') && textContent 非空", "() => { const n=document.querySelector('#stage .stage-item:last-child .e-number'); return {ok: !!n && n.textContent.length > 0, h: n ? Math.round(n.getBoundingClientRect().height) : 0}; }"),
    "文字": (".e-text", "() => { const n=document.querySelector('#stage .stage-item:last-child .e-text'); return {ok: !!n && n.textContent.length > 0, h: n ? Math.round(n.getBoundingClientRect().height) : 0}; }"),
    "描述": (".e-desc", "() => { const n=document.querySelector('#stage .stage-item:last-child .e-desc'); return {ok: !!n && n.textContent.length > 0, h: n ? Math.round(n.getBoundingClientRect().height) : 0}; }"),
    "图表": ("canvas", "() => { const c=document.querySelector('#stage .stage-item:last-child canvas'); return {ok: !!c, h: c ? Math.round(c.getBoundingClientRect().height) : 0, w: c ? Math.round(c.getBoundingClientRect().width) : 0}; }"),
    "图标": ("svg", "() => { const s=document.querySelector('#stage .stage-item:last-child .e-icon svg'); return {ok: !!s, h: s ? Math.round(s.getBoundingClientRect().height) : 0}; }"),
    "图示": (".e-bar", "() => { const b=document.querySelector('#stage .stage-item:last-child .e-bar'); return {ok: !!b, h: b ? Math.round(b.getBoundingClientRect().height) : 0}; }"),
}


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def first_asset(url):
    html = urllib.request.urlopen(url, timeout=25).read().decode("utf8", "ignore")
    return [a.lstrip("./") for a in html.split('"') if "assets/" in a and a.endswith(".js")][0]


if not os.path.isdir(DIST):
    print("[FAIL] 没有 dist/，先跑 npm run build")
    sys.exit(1)

ONLINE = sys.argv[2] if len(sys.argv) > 2 else None
if ONLINE:
    BASE = ONLINE.rstrip("/")
    srv = None
else:
    PORT = free_port()
    BASE = f"http://127.0.0.1:{PORT}"
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                           cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# 自证：线上回的是本次构建
marker = first_asset(BASE + "/studio.html")
print(f"[自证] {BASE} 的 studio 页引用本次构建资产 {marker}")

fails = []


def chk(name, ok, detail=""):
    print(f"[{'过' if ok else '不过'}] {name} {detail}")
    if not ok:
        fails.append(name)


with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 1500, "height": 950})
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)[:180]))
    pg.on("console", lambda m: errs.append("c.err: " + m.text[:150])
          if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.goto(BASE + "/studio.html", wait_until="load")
    pg.wait_for_timeout(2500)

    # S1 元素清单按类给全（数字/文字/描述/图表/图标/图示）
    labels = pg.eval_on_selector_all("#lib .item-btn", "els=>els.map(e=>e.textContent)")
    chk("S1 元素清单六类齐", len(labels) >= 6, "、".join(labels))

    # S2 六类元素逐个点开，每一类都要真画出内容（不能是空框）
    bad = []
    for i, lab in enumerate(labels):
        n = pg.eval_on_selector("#stage", "e=>e.querySelectorAll('.stage-item').length")
        pg.locator("#lib .item-btn").nth(i).click()
        pg.wait_for_timeout(650)
        after = pg.eval_on_selector("#stage", "e=>e.querySelectorAll('.stage-item').length")
        probe = pg.evaluate(SIG[lab][1]) if lab in SIG else {"ok": False}
        if after != n + 1 or not probe.get("ok") or probe.get("h", 0) < 4:
            bad.append(f"{lab}: 计数 {n}->{after} 内容 {probe}")
    chk("S2 六类元素逐个真画出内容", not bad, "；".join(bad) if bad else f"{len(labels)} 类全出")

    # S2b 换新卡片清空底座，之后只在单个元素上做交互（多个元素默认都落在正中会互相盖住，命中有歧义）
    pg.locator("#new").click()
    pg.wait_for_timeout(300)
    pg.locator("#lib .item-btn").nth(0).click()
    pg.wait_for_timeout(450)
    chk("S2b 新卡片后底座只剩一个元素",
        pg.eval_on_selector("#stage", "e=>e.querySelectorAll('.stage-item').length") == 1)

    # S3 拖动过程要有反馈：网格出现＋落点框显示＋落点框上有数字
    box = pg.eval_on_selector("#stage .stage-item", "e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}}")
    pg.mouse.move(box["x"], box["y"])
    pg.mouse.down()
    pg.mouse.move(box["x"] + 53, box["y"] + 37, steps=8)
    pg.wait_for_timeout(120)
    fb = pg.evaluate("""() => ({
      dragging: document.getElementById('stage').classList.contains('is-dragging'),
      ghost: !document.querySelector('.stage-ghost').hidden,
      gridOpacity: getComputedStyle(document.querySelector('.stage-grid')).opacity,
      num: (document.querySelector('.stage-ghost span')||{}).textContent || '',
    })""")
    chk("S3 拖动有吸附反馈（网格＋落点框＋数字）",
        fb["dragging"] and fb["ghost"] and float(fb["gridOpacity"]) > 0.5 and "," in fb["num"],
        json.dumps(fb, ensure_ascii=False))

    # S4 松手吸到整格（坐标是步长的整数倍）
    pg.mouse.up()
    pg.wait_for_timeout(450)
    pos = pg.eval_on_selector("#stage .stage-item", "e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top)})")
    chk("S4 松手吸附到整格", pos["x"] % PITCH == 0 and pos["y"] % PITCH == 0, f"落点 {pos}")

    # S5 底座样式可换（卡片是底座，不是文字）
    pg.evaluate("""() => {
      const s=[...document.querySelectorAll('#props select')].find(x=>[...x.options].some(o=>o.textContent==='深色'));
      s.value=[...s.options].find(o=>o.textContent==='深色').value;
      s.dispatchEvent(new Event('change'));
    }""")
    pg.wait_for_timeout(400)
    chk("S5 底座样式能换", "base-dark" in (pg.get_attribute("#stage", "class") or ""),
        pg.get_attribute("#stage", "class"))

    # S6 拖右下角圆点＝改大小（手柄在各类元素上都能用）
    g = pg.eval_on_selector("#stage .stage-item", "e=>{const r=e.getBoundingClientRect();return {x:r.right-4,y:r.bottom-4,w:Math.round(r.width),h:Math.round(r.height)}}")
    pg.mouse.move(g["x"], g["y"])
    pg.mouse.down()
    pg.mouse.move(g["x"] + 41, g["y"] + 33, steps=6)
    pg.wait_for_timeout(120)
    sz = pg.evaluate("""() => ({
      ghost: !document.querySelector('.stage-ghost').hidden,
      num: (document.querySelector('.stage-ghost span')||{}).textContent || '',
    })""")
    pg.mouse.up()
    pg.wait_for_timeout(450)
    after = pg.eval_on_selector("#stage .stage-item", "e=>({w:Math.round(parseFloat(e.style.width)),h:Math.round(parseFloat(e.style.height))})")
    chk("S6 拖手柄改元素大小（吸附到整格且变大）",
        sz["ghost"] and "×" in sz["num"] and after["w"] > g["w"] and after["h"] > g["h"]
        and after["w"] % PITCH == 0 and after["h"] % PITCH == 0,
        f"{g['w']}×{g['h']} → {after}，拖中读数 {sz['num']}")

    # S7 右侧填数字改大小，底部读数同步给出 px 与格数
    pg.evaluate("""() => {
      const w=[...document.querySelectorAll('#props .f-geo input')][2];
      w.value='144'; w.dispatchEvent(new Event('change'));
    }""")
    pg.wait_for_timeout(450)
    dom_w = pg.eval_on_selector("#stage .stage-item", "e=>Math.round(parseFloat(e.style.width))")
    dims = pg.eval_on_selector("#dims", "e=>e.textContent")
    head7 = pg.eval_on_selector_all("#props .f-head", "els=>els.map(e=>e.textContent).join('|')")
    chk("S7 数字输入改大小＋底部尺寸读数（作用在选中元素上）",
        "选中：数字" in head7 and dom_w == 144 and "144" in dims and "格" in dims,
        f"{head7} ｜ DOM 宽 {dom_w}，读数「{dims}」")

    # S8 文字框连续输入不被重绘打断（属性面板改动只重绘画布）
    pg.evaluate("""() => {
      const t=[...document.querySelectorAll('#props .f-row')].find(r=>r.querySelector('span').textContent==='示例值').querySelector('input');
      t.focus(); t.value='';
    }""")
    pg.keyboard.type("2,050 万", delay=40)
    pg.wait_for_timeout(400)
    typed = pg.evaluate("""() => {
      const n=document.querySelector('#stage .stage-item .e-number');
      const i=[...document.querySelectorAll('#props .f-row')].find(r=>r.querySelector('span').textContent==='示例值').querySelector('input');
      return {shown:n?n.textContent:null, focused:document.activeElement===i, val:i?i.value:null};
    }""")
    chk("S8 示例值逐字输入完整落到底座且不丢焦点",
        typed["shown"] == "2,050 万" and typed["focused"] and typed["val"] == "2,050 万",
        json.dumps(typed, ensure_ascii=False))

    # S9 底座尺寸数字输入生效（卡片本身也能调大小）
    pg.evaluate("""() => {
      const ins=[...document.querySelectorAll('#props .f-row input[type=number]')];
      ins[0].value='384'; ins[0].dispatchEvent(new Event('change'));
      ins[1].value='240'; ins[1].dispatchEvent(new Event('change'));
    }""")
    pg.wait_for_timeout(450)
    frame = pg.eval_on_selector("#stage", "e=>({w:Math.round(e.clientWidth),h:Math.round(e.clientHeight)})")
    dims9 = pg.eval_on_selector("#dims", "e=>e.textContent")
    chk("S9 卡片宽高数字输入生效", frame["w"] == 384 and frame["h"] == 240 and "48 × 30 格" in dims9,
        f"{frame}，读数「{dims9}」")

    # S10 放图表元素：自动选中 → 切图型仍出图 → 点画布也能选中它
    pg.locator("#lib .item-btn").nth(labels.index("图表")).click()
    pg.wait_for_timeout(700)
    head10 = pg.eval_on_selector_all("#props .f-head", "els=>els.map(e=>e.textContent).join('|')")
    pg.evaluate("""() => {
      const s=[...document.querySelectorAll('#props select')].find(x=>[...x.options].some(o=>o.textContent==='圆环'));
      s.value=[...s.options].find(o=>o.textContent==='圆环').value;
      s.dispatchEvent(new Event('change'));
    }""")
    pg.wait_for_timeout(700)
    cr = pg.eval_on_selector_all(
        "#stage .stage-item",
        "els=>{const e=els.find(x=>x.querySelector('canvas')); const r=e.getBoundingClientRect(); return {x:r.x+6, y:r.y+r.height/2}; }")
    pg.mouse.click(cr["x"], cr["y"])
    pg.wait_for_timeout(350)
    head10b = pg.eval_on_selector_all("#props .f-head", "els=>els.map(e=>e.textContent).join('|')")
    chk("S10 图表出图＋切图型仍出图＋点击可选中",
        "选中：图表" in head10 and pg.eval_on_selector_all(
            "#stage .stage-item", "els=>{const e=els.find(x=>x.querySelector('canvas')); return !!e && e.querySelector('canvas').getBoundingClientRect().width > 40;}")
        and "选中：图表" in head10b, f"{head10} → 点击后 {head10b}")

    # S11 保存即注册
    before = pg.eval_on_selector_all("#stage .stage-item", "els=>els.length")
    pg.evaluate("""() => {
      const i=document.querySelector('#props .f-row input[type=text]');
      i.value='销售焦点卡'; i.dispatchEvent(new Event('input'));
    }""")
    pg.locator("#save").click()
    pg.wait_for_timeout(600)
    saved = pg.evaluate("JSON.parse(localStorage.getItem('bi-cards-v1')||'[]')")
    chk("S11 保存即注册进卡片库", len(saved) >= 1 and saved[-1]["name"] == "销售焦点卡"
        and len(saved[-1]["items"]) == before,
        f"卡片库 {len(saved)} 张，最后一张 {len(saved[-1].get('items', []))} 个元素（画布 {before} 个）")
    chk("S12 工作台零报错", not errs, "；".join(errs[:3]))
    pg.screenshot(path=os.path.join(HERE, "..", "output", "studio.png"))

    # S14 从卡片库点「改这张卡」回来：按 id 载入，元素与尺寸原样在底座上
    cid = saved[-1]["id"]
    pg3 = ctx.new_page()
    e3 = []
    pg3.on("pageerror", lambda e: e3.append(str(e)[:160]))
    pg3.goto(BASE + f"/studio.html?card={cid}", wait_until="load")
    pg3.wait_for_timeout(2500)
    back = pg3.evaluate("""() => ({
      name: [...document.querySelectorAll('#props .f-row')].find(r=>r.querySelector('span').textContent==='卡片名称').querySelector('input').value,
      items: document.querySelectorAll('#stage .stage-item').length,
      w: Math.round(document.getElementById('stage').clientWidth),
      geo: [...document.querySelectorAll('#props .f-geo input')].map(i=>i.value),
      dims: document.getElementById('dims').textContent,
    })""")
    chk("S14 已注册卡片可按 id 回载入工作台",
        back["name"] == "销售焦点卡" and back["items"] == 2 and back["w"] == 384 and not e3,
        f"{json.dumps(back, ensure_ascii=False)} 报错 {len(e3)}")
    pg3.close()

    # S15 几何数字填超界值：夹回底座内并吸到整格，且选中状态不丢（审查中危 1＋2）
    pg.evaluate("""() => {
      const ins=[...document.querySelectorAll('#props .f-geo input')];
      ins[2].value='99999'; ins[2].dispatchEvent(new Event('change'));
    }""")
    pg.wait_for_timeout(400)
    pg.evaluate("""() => {
      const ins=[...document.querySelectorAll('#props .f-geo input')];
      ins[0].value='99999'; ins[0].dispatchEvent(new Event('change'));
    }""")
    pg.wait_for_timeout(450)
    clamped = pg.evaluate("""() => {
      const its=[...document.querySelectorAll('#stage .stage-item')];
      const c=its.find(x=>x.querySelector('canvas'));
      const r=c.getBoundingClientRect(), s=document.getElementById('stage').getBoundingClientRect();
      const ins=[...document.querySelectorAll('#props .f-geo input')];
      return {w:Math.round(r.width), right:Math.round(r.right), stageRight:Math.round(s.right),
              bottom:Math.round(r.bottom), stageBottom:Math.round(s.bottom),
              sel:c.classList.contains('is-sel'), rz:getComputedStyle(c.querySelector('.stage-rz')).opacity,
              geo:ins.map(i=>i.value)};
    }""")
    chk("S15 超界数字被夹回底座内且仍选中",
        clamped["right"] <= clamped["stageRight"] + 1 and clamped["bottom"] <= clamped["stageBottom"] + 1
        and clamped["sel"] and float(clamped["rz"]) > 0.5
        and all(int(v) % PITCH == 0 for v in clamped["geo"]),
        json.dumps(clamped, ensure_ascii=False))

    # S16 卡片宽填 0：夹到最小值，不会缩成看不见
    pg.evaluate("""() => {
      const ins=[...document.querySelectorAll('#props .f-row input[type=number]')];
      ins[0].value='0'; ins[0].dispatchEvent(new Event('change'));
    }""")
    pg.wait_for_timeout(400)
    frame0 = pg.eval_on_selector("#stage", "e=>Math.round(e.clientWidth)")
    chk("S16 卡片宽 0 夹到最小值", frame0 == 40 and frame0 > 0, f"底座宽 {frame0}px")
    pg.evaluate("""() => {
      const ins=[...document.querySelectorAll('#props .f-row input[type=number]')];
      ins[0].value='384'; ins[0].dispatchEvent(new Event('change'));
    }""")
    pg.wait_for_timeout(400)

    # S17 反复重绘不泄漏图表实例（活动实例数 == 图表元素数）
    for t in ("柱状", "折线", "圆环"):
        pg.evaluate("""(t) => {
          const s=[...document.querySelectorAll('#props select')].find(x=>[...x.options].some(o=>o.textContent===t));
          if(!s) return;
          s.value=[...s.options].find(o=>o.textContent===t).value;
          s.dispatchEvent(new Event('change'));
        }""", t)
        pg.wait_for_timeout(350)
    leak = pg.evaluate("""() => ({
      live: document.querySelectorAll('#stage [_echarts_instance_]').length,
      charts: [...document.querySelectorAll('#stage .stage-item')].filter(e=>e.querySelector('canvas')).length,
    })""")
    chk("S17 图表实例不随重绘累积", leak["live"] == leak["charts"] and leak["live"] >= 1,
        json.dumps(leak, ensure_ascii=False))
    chk("S18 修完这一轮仍零报错", not errs, "；".join(errs[:3]))

    # S13 卡片库页能看到这张卡
    pg2 = ctx.new_page()
    e2 = []
    pg2.on("pageerror", lambda e: e2.append(str(e)[:160]))
    pg2.goto(BASE + "/cards.html", wait_until="load")
    pg2.wait_for_timeout(2500)
    chk("S13 卡片库列出已注册卡", pg2.locator(".card-cell").count() >= 1 and not e2,
        f"{pg2.locator('.card-cell').count()} 张，报错 {len(e2)}")
    pg2.screenshot(path=os.path.join(HERE, "..", "output", "cards-lib.png"))

    ctx.close()
    b.close()

if srv:
    srv.terminate()
print("\n[结论]", "全部通过" if not fails else f"{len(fails)} 项不过：" + "、".join(fails))
sys.exit(1 if fails else 0)
