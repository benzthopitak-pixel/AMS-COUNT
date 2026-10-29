"""Build a single-file review copy of AMS Count (no Supabase): demo/AMS-Count-ตัวอย่าง.html

usage: python3 demo/build_demo.py <seed.json> <out.html>
"""
import base64, json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / 'web'
seed_path, out_path = sys.argv[1], sys.argv[2]

html = (WEB / 'index.html').read_text()
js = lambda p: (WEB / p).read_text().replace('</script', '<\\/script').replace('\ufffd', '\\ufffd')
b64 = lambda p, mime: f'data:{mime};base64,' + base64.b64encode((WEB / p).read_bytes()).decode()

demo_cfg = "window.AMS_CONFIG = { SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_demo_review_copy', LOGIN_DOMAIN: 'ams-count.example.com' };"
backend = (ROOT / 'demo' / 'demo-backend.js').read_text().replace('</script', '<\\/script')
seed = pathlib.Path(seed_path).read_text().replace('</', '<\\/')

subs = {
    '<script src="config.js"></script>': f'<script>{demo_cfg}</script>',
    '<script src="lib/supabase.js"></script>': f'<script type="application/json" id="demo-seed">{seed}</script>\n<script>{backend}</script>',
    '<script src="lib/xlsx.full.min.js"></script>': f'<script>{js("lib/xlsx.full.min.js")}</script>',
    '<script src="lib/xlsx-style.min.js"></script>': f'<script>{js("lib/xlsx-style.min.js")}</script>',
    '<script src="lib/jspdf.umd.min.js"></script>': f'<script>{js("lib/jspdf.umd.min.js")}</script>',
    '<script src="lib/qrcode.js"></script>': f'<script>{js("lib/qrcode.js")}</script>',
    '<script src="lib/jsbarcode.min.js"></script>': f'<script>{js("lib/jsbarcode.min.js")}</script>',
    '<script src="store.js"></script>': f'<script>{js("store.js")}</script>',
    '<script src="build.js"></script>': "<script>window.AMS_BUILD = 'ตัวอย่าง'; window.AMS_BUILT = '" + __import__('datetime').datetime.now().strftime('%d/%m/%Y %H:%M') + "';</script>",
    '<link rel="icon" href="icon.svg" type="image/svg+xml">': f'<link rel="icon" href="{b64("icon.svg", "image/svg+xml")}" type="image/svg+xml">',
}
for a, b in subs.items():
    assert html.count(a) == 1, a
    html = html.replace(a, b)
# Pivot libraries load on demand; the review copy carries them inline as inert blocks the loader picks up
lazy = ''.join(f'<script type="text/x-lazy" id="lazy-{n}">' + (WEB / 'lib' / n).read_text().replace('</script', '<\\/script').replace('\ufffd', '\\ufffd') + '</script>' for n in ['jquery.min.js', 'jquery-ui.min.js', 'pivot.min.js'])
lazy += '<script type="text/x-lazy" id="lazy-pivot.min.css">' + (WEB / 'lib' / 'pivot.min.css').read_text() + '</script>'
html = html.replace('\n</body>', lazy + '\n</body>', 1)
html = re.sub(r'url\(fonts/([\w.-]+\.woff2)\)', lambda m: f'url({b64("fonts/" + m.group(1), "font/woff2")})', html)
html = html.replace('src="logo-mark.svg"', f'src="{b64("logo-mark.svg", "image/svg+xml")}"').replace('src="logo.svg"', f'src="{b64("logo.svg", "image/svg+xml")}"')

# computer / scanner view switch (#app = scanner screens)
mode_line = "  mode: window.AndroidBridge || new URLSearchParams(location.search).get('mode') === 'app' ? 'app' : 'web',"
assert html.count(mode_line) == 1
html = html.replace(mode_line, "  mode: location.hash === '#app' ? 'app' : 'web',")
html = html.replace('<title>AssetSync</title>', '<title>AssetSync ตัวอย่าง</title>')

bar = """
<style>
.demo-bar { position: fixed; z-index: 60; right: max(12px, env(safe-area-inset-right, 0px)); top: calc(10px + env(safe-area-inset-top, 0px)); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; background: #121826; color: #fff; border-radius: 999px; padding: 5px 6px 5px 12px; font: 600 12px 'Prompt', system-ui, sans-serif; box-shadow: 0 4px 14px rgb(0 0 0 / .2); }
.demo-bar button { font: inherit; border: none; border-radius: 999px; padding: 6px 11px; cursor: pointer; background: #2a3242; color: #fff; }
.demo-bar button[aria-pressed="true"] { background: #d4f25a; color: #121826; }
@media (max-width: 860px) { .demo-bar { top: auto; bottom: calc(86px + env(safe-area-inset-bottom, 0px)); } }
</style>
<div class="demo-bar" role="group" aria-label="ตัวอย่างสำหรับรีวิว"><span>ตัวอย่าง · ไม่ใช่ข้อมูลจริง</span>
  <button type="button" id="dvWeb">คอม</button><button type="button" id="dvApp">เครื่องยิง</button><button type="button" id="dvReset">รีเซ็ตข้อมูล</button></div>
<script>
(() => {
  const paint = () => { const app = location.hash === '#app'; document.getElementById('dvWeb').setAttribute('aria-pressed', String(!app)); document.getElementById('dvApp').setAttribute('aria-pressed', String(app)); };
  document.getElementById('dvWeb').onclick = () => { location.hash = ''; location.reload(); };
  document.getElementById('dvApp').onclick = () => { location.hash = 'app'; location.reload(); };
  document.getElementById('dvReset').onclick = () => window.AMSDemoReset && window.AMSDemoReset();
  paint();
  // inside claude.ai the page may only hand files over through the viewer's download permission
  if (window.claude && window.claude.use && window.AMSStore) {
    const orig = window.AMSStore.downloads.save;
    window.AMSStore.downloads.save = async (o) => { let d = null; try { d = await window.claude.use('downloads'); } catch {} if (!d) return orig(o); const blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: o.type || 'application/octet-stream' }); await d.save({ filename: o.filename, data: blob }); return { status: 'saved', where: 'โฟลเดอร์ดาวน์โหลด' }; };
  }
})();
</script>
"""
html = html.replace('\n</body>', bar + '\n</body>')
pathlib.Path(out_path).write_text(html)
print(out_path, len(html.encode()))
