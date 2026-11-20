"""public/art/city-3shops.svg তৈরি করে (হোম/পাতার শেষের শহর-দৃশ্য)। চালান: python3 scripts/art/city-3shops.py
নকশা: আম-ক্রিম ক্যানভাসের ওপর ৪ স্তরের বালি-রঙ (দূর → কাছে), একটাই সবুজ/সোনালি জোর, ঘরে ঘরে ছোট বিস্তারিত।"""
import random, re, pathlib

random.seed(7)
ROOT = pathlib.Path(__file__).resolve().parents[2]
T1, T2, T3, T4 = "#f6ecd0", "#efe2ba", "#e6d5a6", "#d9c48c"
GREEN, DKGREEN, GOLD, PINK = "#2e6b3a", "#1f4d2a", "#f2a900", "#c0607f"
out: list[str] = []
add = out.append


def building(x, w, top, fill, windows=True, lit=0.12, ground=190):
    h = ground - top
    add(f'<rect x="{x}" y="{top}" width="{w}" height="{h}" rx="1.5" fill="{fill}"/>')
    add(f'<rect x="{x - 1.5}" y="{top - 3}" width="{w + 3}" height="3.5" rx="1" fill="{T3 if fill != T1 else T2}"/>')
    if not windows:
        return
    cols = max(1, int((w - 6) // 10))
    gap = (w - 6 - cols * 6) / max(1, cols - 1) if cols > 1 else 0
    y = top + 9
    while y + 9 < ground - 40:
        for c in range(cols):
            wx = x + 3 + c * (6 + gap)
            on = random.random() < lit
            add(f'<rect x="{wx:.1f}" y="{y}" width="6" height="8" rx="1" fill="{"#f7c948" if on else "#fff"}" opacity="{".9" if on else ".6"}"/>')
        y += 15


def cloud(cx, cy, s):
    add(f'<g fill="{T1}" transform="translate({cx} {cy}) scale({s})"><ellipse rx="26" ry="8"/><ellipse cx="-11" cy="-6" rx="12" ry="9"/><ellipse cx="7" cy="-9" rx="14" ry="11"/></g>')


def bird(x, y, s=1):
    add(f'<path d="M{x} {y}q{6*s} {-7*s} {12*s} 0q{6*s} {-7*s} {12*s} 0" fill="none" stroke="{T3}" stroke-width="2" stroke-linecap="round"/>')


def tree(x, s=1.0):
    add(f'<g transform="translate({x} 190) scale({s})"><rect x="-3" y="-34" width="6" height="34" rx="2" fill="{T3}"/>'
        f'<circle cy="-48" r="22" fill="{T3}"/><circle cx="-16" cy="-38" r="14" fill="{T2}"/><circle cx="16" cy="-40" r="15" fill="{T2}"/><circle cx="2" cy="-58" r="12" fill="#e9dcae"/></g>')


def bush(x, s=1.0, c="#d6dfae"):
    add(f'<g transform="translate({x} 190) scale({s})" fill="{c}"><circle cx="-7" cy="-6" r="7"/><circle cx="3" cy="-9" r="9"/><circle cx="12" cy="-5" r="6"/></g>')


def lamp(x, flip=1):
    add(f'<g stroke="{T4}" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M{x} 190V104q0 -8 {10*flip} -8h{8*flip}"/></g>'
        f'<rect x="{x + (14 if flip > 0 else -26)}" y="94" width="12" height="5" rx="2.5" fill="{T4}"/>'
        f'<path d="M{x + (15 if flip > 0 else -25)} 99l-3 9h16l-3 -9z" fill="#f7c948" opacity=".28"/>')


def person(x, body, head="#d9c48c", s=1.0, bag=None):
    add(f'<g transform="translate({x} 191) scale({s})"><circle cy="-34" r="5" fill="{head}"/><rect x="-5.5" y="-28" width="11" height="28" rx="5" fill="{body}"/>')
    if bag:
        add(f'<rect x="4" y="-16" width="8" height="9" rx="1.5" fill="{bag}"/><path d="M6 -16q2 -5 4 0" stroke="{bag}" fill="none" stroke-width="1.4"/>')
    add('</g>')


# ---------- আকাশ ----------
cloud(58, 40, 1.0); cloud(236, 30, .62); cloud(432, 36, .85)
bird(132, 34); bird(186, 52, .8); bird(318, 26, .9); bird(446, 70, .7)

# ---------- দূরের স্তর ----------
for x, w, top in [(0, 38, 108), (34, 30, 84), (126, 34, 112), (196, 30, 96), (296, 40, 118), (372, 32, 90), (440, 40, 104)]:
    building(x, w, top, T1, windows=False)

# ---------- মাঝের স্তর ----------
for x, w, top in [(8, 38, 98), (60, 44, 66), (114, 32, 94), (212, 42, 46), (264, 34, 86), (330, 44, 58), (386, 36, 82), (434, 42, 100)]:
    building(x, w, top, T2)
# ছাদের খুঁটিনাটি: পানির ট্যাংক, অ্যান্টেনা, এসি
add(f'<g fill="{T3}"><rect x="70" y="56" width="14" height="8" rx="2"/><rect x="72" y="63" width="2" height="3"/><rect x="80" y="63" width="2" height="3"/><rect x="224" y="38" width="10" height="5" rx="1"/><rect x="274" y="80" width="9" height="6" rx="1"/><rect x="440" y="94" width="10" height="6" rx="1"/></g>')
add(f'<path d="M233 43V26M229 31h8" stroke="{T3}" stroke-width="1.6" stroke-linecap="round"/><circle cx="233" cy="25" r="1.8" fill="{GOLD}"/>')

# ---------- বিলবোর্ড (লোগো + Bipone) ----------
logo = (ROOT / "public/icons/logo.svg").read_text(encoding="utf8").strip()
inner = re.sub(r"^<svg[^>]*>", "", logo).rsplit("</svg>", 1)[0]
for i in ["bg", "glow", "wh", "gold"]:
    inner = inner.replace(f'id="{i}"', f'id="bb-{i}"').replace(f"url(#{i})", f"url(#bb-{i})")
add(f'<g id="billboard"><g fill="{DKGREEN}"><rect x="332" y="48" width="4" height="12"/><rect x="368" y="48" width="4" height="12"/></g>'
    f'<g stroke="{DKGREEN}" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M318 12v-4h-4"/><path d="M352 12v-5"/><path d="M386 12v-4h4"/></g>'
    f'<g fill="#ffd45a"><circle cx="314" cy="8" r="2"/><circle cx="352" cy="7" r="2"/><circle cx="390" cy="8" r="2"/></g>'
    f'<rect x="304" y="12" width="96" height="38" rx="4" fill="{DKGREEN}"/><rect x="307" y="15" width="90" height="32" rx="2.5" fill="{GREEN}"/>'
    f'<svg x="311" y="19" width="24" height="24" viewBox="0 0 512 512">{inner}</svg>'
    f'<text x="339.5" y="37" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="14" font-weight="800" fill="#fff3c9" letter-spacing=".2">Bipone</text></g>')

# ---------- গাছ, ঝোপ, বাতি ----------
tree(8, 1.0); tree(474, .95); bush(60, .9); bush(432, 1.0, "#d6dfae"); bush(456, .7, "#cfd9a0")
lamp(88, -1); lamp(392, 1)

# ---------- ফুটপাত ও রাস্তা ----------
add(f'<rect x="0" y="190" width="480" height="7" fill="{T3}"/><rect x="0" y="197" width="480" height="33" fill="{T2}"/><rect x="0" y="197" width="480" height="2" fill="{T4}" opacity=".5"/>')
for i in range(11):
    add(f'<rect x="{10 + i * 44}" y="214" width="22" height="3" rx="1.5" fill="#fff" opacity=".85"/>')


# ---------- তিনটি দোকান ----------
def shop(x, c1, c2, icon):
    w = 92
    add(f'<ellipse cx="{x + w / 2}" cy="191" rx="{w / 2 + 3}" ry="3" fill="{T4}" opacity=".5"/>')
    add(f'<rect x="{x}" y="124" width="{w}" height="66" rx="2.5" fill="#fff"/>')
    # সাইনবোর্ড-বৃত্ত
    cx = x + w / 2
    add(f'<rect x="{cx - 1.5}" y="116" width="3" height="9" fill="{c1}" opacity=".7"/><circle cx="{cx}" cy="104" r="14" fill="#fff" stroke="{c1}" stroke-width="2.6"/>')
    add(f'<g transform="translate({cx} 104)" stroke="{c1}" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{icon}</g>')
    # ছাউনি
    n = 6
    sw = w / n
    for i in range(n):
        add(f'<rect x="{x + i * sw:.2f}" y="124" width="{sw + .3:.2f}" height="14" fill="{c1 if i % 2 == 0 else c2}"/>')
        add(f'<path d="M{x + i * sw:.2f} 138a{sw / 2:.2f} 6 0 0 0 {sw:.2f} 0z" fill="{c1 if i % 2 == 0 else c2}"/>')
    add(f'<rect x="{x - 2}" y="121" width="{w + 4}" height="4" rx="2" fill="{c1}"/>')
    # জানালা ও দরজা
    add(f'<rect x="{x + 8}" y="148" width="38" height="26" rx="2" fill="{T1}" stroke="{T3}" stroke-width="1.2"/>')
    add(f'<rect x="{x + 8}" y="168" width="38" height="2" fill="{T3}"/>')
    add(f'<rect x="{x + 54}" y="148" width="26" height="42" rx="2" fill="{T2}"/><rect x="{x + 58}" y="152" width="18" height="20" rx="1.5" fill="#fff" opacity=".7"/><circle cx="{x + 76}" cy="172" r="1.5" fill="{T4}"/>')
    return x


def display(x, kind):
    base = 168
    if kind == "med":
        for i, h in enumerate([12, 16, 10, 14]):
            add(f'<rect x="{x + 11 + i * 8}" y="{base - h}" width="5" height="{h}" rx="1.5" fill="{GREEN}" opacity="{.55 + i * .08:.2f}"/>')
    elif kind == "gen":
        add(f'<rect x="{x + 11}" y="{base - 9}" width="13" height="9" rx="1.5" fill="{GOLD}" opacity=".8"/><rect x="{x + 16}" y="{base - 17}" width="12" height="8" rx="1.5" fill="#f7c948"/><rect x="{x + 29}" y="{base - 6}" width="9" height="6" rx="1.5" fill="{T4}"/>')
    else:
        add(f'<circle cx="{x + 15}" cy="{base - 5}" r="5" fill="#e3a9bb"/><rect x="{x + 24}" y="{base - 15}" width="5" height="15" rx="2" fill="{PINK}" opacity=".75"/><rect x="{x + 32}" y="{base - 10}" width="5" height="10" rx="2" fill="#e3a9bb"/>')


ICON_MED = '<path d="M0 -6.5V6.5M-6.5 0H6.5"/>'
ICON_GEN = '<path d="M-6 -2h12l-1.2 9h-9.6z"/><path d="M-3 -2v-2a3 3 0 0 1 6 0v2"/>'
ICON_COS = '<rect x="-3" y="-1" width="6" height="8" rx="1" fill="currentColor" fill-opacity=".25" stroke-width="2"/><path d="M-2.2 -1l1 -6l3 1.5v4.5"/>'
ICON_COS = ICON_COS.replace("currentColor", PINK)
for x, c1, c2, icon, kind in [(96, GREEN, "#cfe0d2", ICON_MED, "med"), (193, GOLD, "#fde9b0", ICON_GEN, "gen"), (290, PINK, "#f3d3dd", ICON_COS, "cos")]:
    shop(x, c1, c2, icon)
    display(x, kind)

# ---------- মানুষ ----------
person(190.5, GREEN, s=.9)
person(287.5, "#d9c48c", s=.92, bag=GOLD)
person(386, GREEN, s=.85, bag="#d9c48c")

# ---------- রিকশা ----------
add(f'<g transform="translate(10 -2)" stroke="{GREEN}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none">'
    f'<circle cx="26" cy="214" r="9"/><circle cx="78" cy="214" r="10"/>'
    f'<path d="M26 214L33 196L50 214L55 194L33 196M50 214H78"/><path d="M30 190l5 6"/>'
    f'<path d="M60 198Q63 178 90 180V198Z" fill="#cfe0d2"/><rect x="62" y="198" width="28" height="8" rx="2" fill="{GREEN}"/>'
    f'<path d="M90 198L82 214" /></g>'
    f'<g transform="translate(10 -2)"><circle cx="52" cy="181" r="4.6" fill="{T4}"/><path d="M48 186q4 -2 8 0l2 9l-12 1z" fill="{GREEN}"/><circle cx="74" cy="190" r="3.6" fill="{T3}"/><rect x="70" y="194" width="8" height="8" rx="3" fill="{T4}"/></g>')

svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 230">{"".join(out)}</svg>\n'
(ROOT / "public/art/city-3shops.svg").write_text(svg, encoding="utf8")
print(len(svg), "bytes")
