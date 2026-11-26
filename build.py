import sys, json, pathlib
S = pathlib.Path(__file__).parent; src = S/'src'
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else S); out.mkdir(parents=True, exist_ok=True)

# Supabase-project: hetzelfde project als het CRM (de tabelnamen botsen niet). De publishable key is bedoeld om openbaar te zijn.
# Zijn ze leeg, dan vraagt de app er bij het openen zelf om (en bewaart ze alleen in die browser).
SUPABASE_URL = 'https://vieqteitlgmspjirgbzq.supabase.co'
SUPABASE_KEY = 'sb_publishable_I8jtbvstxaiovaL0f5jXGw_usVp8rl3'

h = (src/'shell.html').read_text()
js = (src/'app.js').read_text()
assert js.count("'%%SUPABASE_URL%%'") == 1 and js.count("'%%SUPABASE_KEY%%'") == 1
js = js.replace("'%%SUPABASE_URL%%'", json.dumps(SUPABASE_URL)).replace("'%%SUPABASE_KEY%%'", json.dumps(SUPABASE_KEY))
parts = {'/*TEMPLATE_CSS*/': (src/'template.css').read_text(), '/*APP_CSS*/': (src/'app.css').read_text(),
         '/*TEMPLATE_TAIL_CSS*/': (src/'template-tail.css').read_text(), '<!--ICONS-->': (src/'icons.svg').read_text(),
         '/*SUPABASE_JS*/': (src/'supabase.js').read_text(), '/*APP_JS*/': js}
for k, v in parts.items():
    assert h.count(k) == 1, k
    assert '</script' not in v.lower() or k == '<!--ICONS-->', k
    h = h.replace(k, v)
(out/'index.html').write_text(h)
(out/'icon.svg').write_text((src/'logo.svg').read_text())  # logo: bron in src/logo.svg (ook als symbool i-logo in icons.svg)
(out/'manifest.webmanifest').write_text('{"name":"To do","short_name":"To do","start_url":"./#taken","scope":"./","display":"standalone","background_color":"#fafaf9","theme_color":"#ffffff","icons":[{"src":"icon-192.png?v=2","sizes":"192x192","type":"image/png"},{"src":"icon-512.png?v=2","sizes":"512x512","type":"image/png"},{"src":"icon.svg","sizes":"any","type":"image/svg+xml"}]}\n')
print('ok', len(h), '(database gekoppeld)' if SUPABASE_URL and SUPABASE_KEY else '(nog geen database: de app vraagt om URL en key)')
