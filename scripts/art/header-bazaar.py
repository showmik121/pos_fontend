#!/usr/bin/env python3
"""হোম হেডারের জলরঙ-কলম স্কেচ (public/art/header-bazaar.svg) তৈরি করে।
চালান: python3 scripts/art/header-bazaar.py   (ফলাফল ঠিক একই আসে: সিড স্থির)"""
import math, random, pathlib

W, H = 480, 200
CANVAS = "#fff6dd"
INK = "#5a3a1e"
out: list[str] = []
add = out.append


def n(x: float) -> str:
    return f"{x:.1f}".rstrip("0").rstrip(".")


def jitter_line(rr, x1, y1, x2, y2, w=0.9, op=0.55):
    """হাতে-টানা কলমের দাগ: সামান্য বাঁকা, পাশে হালকা দ্বিতীয় দাগ"""
    mx, my = (x1 + x2) / 2 + rr.uniform(-0.8, 0.8), (y1 + y2) / 2 + rr.uniform(-0.8, 0.8)
    a = f'<path d="M{n(x1)} {n(y1)}Q{n(mx)} {n(my)} {n(x2)} {n(y2)}" stroke="{INK}" stroke-opacity="{op}" stroke-width="{w}" fill="none" stroke-linecap="round"/>'
    mx2, my2 = mx + rr.uniform(-1, 1), my + rr.uniform(-1, 1)
    b = f'<path d="M{n(x1 + rr.uniform(-.6, .6))} {n(y1 + rr.uniform(-.6, .6))}Q{n(mx2)} {n(my2)} {n(x2 + rr.uniform(-.6, .6))} {n(y2 + rr.uniform(-.6, .6))}" stroke="{INK}" stroke-opacity="{op * .45}" stroke-width="{w * .7}" fill="none" stroke-linecap="round"/>'
    return a + b


def canopy(cx, cy, rx, ry, count, tones, seed, spec=None):
    rr = random.Random(seed)
    pts = []
    for _ in range(count):
        a = rr.random() * math.tau
        d = math.sqrt(rr.random())
        x, y = cx + math.cos(a) * d * rx, cy + math.sin(a) * d * ry
        light = (-(x - cx) / rx * 0.55) + (-(y - cy) / ry * 0.85)  # আলো ওপর-বাঁ থেকে
        pts.append((light, x, y, rr.uniform(0.10, 0.19) * rx * 2))
    pts.sort()
    s = []
    for light, x, y, r in pts:
        i = 0 if light < -0.45 else 1 if light < 0.05 else 2 if light < 0.5 else 3
        s.append(f'<circle cx="{n(x)}" cy="{n(y)}" r="{n(r)}" fill="{tones[i]}"/>')
    # পাতার ঝিলিক
    for _ in range(count // 2):
        a = rr.random() * math.tau
        d = math.sqrt(rr.random()) * 0.85
        x, y = cx + math.cos(a) * d * rx, cy + math.sin(a) * d * ry
        if (-(x - cx) / rx * 0.55) + (-(y - cy) / ry * 0.85) > 0.15:
            s.append(f'<ellipse cx="{n(x)}" cy="{n(y)}" rx="{n(rr.uniform(1.4, 3))}" ry="{n(rr.uniform(.8, 1.6))}" fill="{tones[3]}" opacity=".8" transform="rotate({n(rr.uniform(-40, 40))} {n(x)} {n(y)})"/>')
    if spec:
        for _ in range(spec["count"]):
            a = rr.random() * math.tau
            d = math.sqrt(rr.random()) * 0.8
            x, y = cx + math.cos(a) * d * rx, cy + math.sin(a) * d * ry * 0.95
            s.append(f'<ellipse cx="{n(x)}" cy="{n(y)}" rx="2.4" ry="3.2" fill="{spec["col"]}"/><ellipse cx="{n(x - .7)}" cy="{n(y - 1)}" rx=".8" ry="1.1" fill="{spec["hi"]}"/>')
    return "".join(s)


def quad(p0, p1, p2, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])


def frond(x, y, ang, length, droop, col, dark):
    a = math.radians(ang)
    p0 = (x, y)
    p1 = (x + math.cos(a) * length * .55, y + math.sin(a) * length * .55 - length * .24)
    p2 = (x + math.cos(a) * length, y + math.sin(a) * length + droop)
    s = [f'<path d="M{n(p0[0])} {n(p0[1])}Q{n(p1[0])} {n(p1[1])} {n(p2[0])} {n(p2[1])}" stroke="{dark}" stroke-width="1.5" fill="none" stroke-linecap="round"/>']
    steps = 13
    for i in range(2, steps + 1):
        t = i / steps
        px, py = quad(p0, p1, p2, t)
        tx, ty = quad(p0, p1, p2, min(1, t + .03))
        dx, dy = tx - px, ty - py
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        L = (1 - t * .55) * length * .26
        for sgn in (1, -1):
            ex, ey = px + (nx * sgn * .8 + dx / ln * .55) * L, py + (ny * sgn * .8 + dy / ln * .55) * L + L * .45
            s.append(f'<path d="M{n(px)} {n(py)}L{n(ex)} {n(ey)}" stroke="{col}" stroke-width="1.15" stroke-linecap="round"/>')
    return "".join(s)


def palm(x, base_y, top_y, lean, seed):
    rr = random.Random(seed)
    tx, ty = x + lean, top_y
    cx, cy = x + lean * .2, (base_y + top_y) / 2
    s = [f'<path d="M{n(x)} {n(base_y)}Q{n(cx)} {n(cy)} {n(tx)} {n(ty)}" stroke="#7a4f2a" stroke-width="5" fill="none" stroke-linecap="round"/>',
         f'<path d="M{n(x - 1)} {n(base_y)}Q{n(cx - 1)} {n(cy)} {n(tx - 1)} {n(ty)}" stroke="#a97842" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>']
    for i in range(1, 12):  # কাণ্ডের গিঁট
        px, py = quad((x, base_y), (cx, cy), (tx, ty), i / 12)
        s.append(f'<path d="M{n(px - 2.8)} {n(py)}h5.6" stroke="#4a2f17" stroke-width=".8" opacity=".55"/>')
    for ang in [-175, -150, -125, -100, -75, -50, -25, 0, 20, 160]:
        L = rr.uniform(30, 40)
        dr = rr.uniform(8, 18) if -120 < ang < -50 else rr.uniform(14, 26)
        s.append(frond(tx, ty, ang + rr.uniform(-6, 6), L, dr, rr.choice(["#3f8f48", "#4da053", "#2f7a3b"]), "#2a6a34"))
    for dx, dy in [(-2, 3), (3, 4), (0, 6)]:
        s.append(f'<circle cx="{n(tx + dx)}" cy="{n(ty + dy)}" r="2.6" fill="#8a5a2b"/><circle cx="{n(tx + dx - .6)}" cy="{n(ty + dy - .7)}" r=".8" fill="#c9965a"/>')
    return "".join(s)


def banana(x, y, seed):
    rr = random.Random(seed)
    s = [f'<path d="M{n(x)} {n(y)}q-1 -14 0 -26" stroke="#7fa74f" stroke-width="3.6" fill="none" stroke-linecap="round"/>']
    for ang, L in [(-160, 26), (-130, 30), (-100, 28), (-62, 30), (-30, 26), (-8, 20)]:
        a = math.radians(ang + rr.uniform(-5, 5))
        ox, oy = x, y - 25
        ex, ey = ox + math.cos(a) * L, oy + math.sin(a) * L * .8 + L * .22
        mx, my = ox + math.cos(a) * L * .55, oy + math.sin(a) * L * .55 - 4
        wx, wy = -math.sin(a) * 5.2, math.cos(a) * 5.2
        col = rr.choice(["#6fb44f", "#5aa443", "#7cc05a"])
        s.append(f'<path d="M{n(ox)} {n(oy)}Q{n(mx + wx)} {n(my + wy)} {n(ex)} {n(ey)}Q{n(mx - wx)} {n(my - wy)} {n(ox)} {n(oy)}Z" fill="{col}"/>')
        s.append(f'<path d="M{n(ox)} {n(oy)}Q{n(mx)} {n(my)} {n(ex)} {n(ey)}" stroke="#3d7a35" stroke-width=".8" fill="none"/>')
    return "".join(s)


def build():
    rr = random.Random(11)
    add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">')
    add('''<defs>
<radialGradient id="sun"><stop offset="0" stop-color="#fffbe6"/><stop offset=".25" stop-color="#fff1b8" stop-opacity=".95"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>
<linearGradient id="river" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8e6b8"/><stop offset=".35" stop-color="#bfdcc0"/><stop offset="1" stop-color="#8fc3a6"/></linearGradient>
<linearGradient id="bank" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9c46a"/><stop offset=".5" stop-color="#8db758"/><stop offset="1" stop-color="#7cae55"/></linearGradient>
<linearGradient id="bankL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b3c96e"/><stop offset="1" stop-color="#82b35a"/></linearGradient>
<linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d79a52"/><stop offset="1" stop-color="#9c632f"/></linearGradient>
<linearGradient id="wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#ecd9a8"/></linearGradient>
<linearGradient id="hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6a3a"/><stop offset=".6" stop-color="#6e4624"/><stop offset="1" stop-color="#2f2216"/></linearGradient>
<linearGradient id="thatch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcc07a"/><stop offset="1" stop-color="#b08a45"/></linearGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6dd" stop-opacity="0"/><stop offset=".75" stop-color="#fff6dd" stop-opacity=".92"/><stop offset="1" stop-color="#fff6dd"/></linearGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6dd" stop-opacity="0"/><stop offset="1" stop-color="#fff1c9" stop-opacity=".85"/></linearGradient>
<filter id="rough" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="3"/></filter>
<filter id="wash" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="9" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="6"/><feGaussianBlur stdDeviation=".7"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="2.4"/></filter>
<filter id="wave" x="-5%" y="-20%" width="110%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".012 .22" numOctaves="2" seed="2" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="5"/><feGaussianBlur stdDeviation=".9"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="7" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 .42  0 0 0 0 .3  0 0 0 0 .14  1.1 0 0 0 -.52"/></filter>
</defs>''')

    # ১. সূর্যের আভা ও জলরঙের মেঘ
    add('<circle cx="372" cy="62" r="64" fill="url(#sun)"/>')
    add('<g filter="url(#wash)" fill="#fff" opacity=".7">')
    for cx, cy, sx in [(96, 40, 1.2), (250, 26, .9), (410, 24, 1.0), (170, 62, .7)]:
        add(f'<g transform="translate({cx} {cy}) scale({sx})"><ellipse rx="34" ry="8"/><ellipse cx="-14" cy="-6" rx="16" ry="10"/><ellipse cx="8" cy="-9" rx="20" ry="12"/><ellipse cx="26" cy="-2" rx="14" ry="8"/></g>')
    add('</g>')
    # পাখির ঝাঁক
    for x, y, s in [(200, 52, 1), (226, 42, .85), (250, 56, .75), (60, 64, .7), (84, 56, .6)]:
        add(f'<path d="M{x} {y}q{n(5 * s)} {n(-6 * s)} {n(10 * s)} {n(1 * s)}q{n(5 * s)} {n(-7 * s)} {n(10 * s)} {n(-1 * s)}" fill="none" stroke="{INK}" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round"/>')

    # ২. দূরের গ্রামের গাছের সারি (কুয়াশামাখা)
    add('<g filter="url(#wash)" opacity=".85">')
    add(canopy(60, 112, 70, 12, 34, ["#b8cf86", "#c4d792", "#cfdf9c", "#dbe8ae"], 21))
    add(canopy(230, 110, 90, 10, 40, ["#b8cf86", "#c4d792", "#cfdf9c", "#dbe8ae"], 22))
    add(canopy(420, 106, 70, 14, 34, ["#b3cb82", "#c1d68f", "#cddd9b", "#dbe8ae"], 23))
    add('</g>')
    # দূরের ছোট চালাঘর ও ধোঁয়া
    add('<g opacity=".75"><rect x="150" y="108" width="16" height="8" fill="#e8d9a8"/><path d="M147 109L158 100L169 109Z" fill="#c9a569"/><rect x="190" y="110" width="12" height="6" fill="#ead9a4"/><path d="M188 111L196 104L204 111Z" fill="#c9a569"/></g>')
    add('<path d="M160 98q-4 -8 1 -14q5 -6 0 -13" stroke="#fff" stroke-width="3" stroke-opacity=".35" fill="none" stroke-linecap="round" filter="url(#soft)"/>')
    add('<rect y="100" width="480" height="24" fill="url(#haze)"/>')

    # ৩. নদী
    add('<path d="M0 118C60 114 130 120 220 116S400 112 480 118V200H0Z" fill="url(#river)"/>')
    add('<path d="M340 118Q352 140 346 200" stroke="#fff3c0" stroke-width="18" stroke-opacity=".55" fill="none" filter="url(#soft)"/>')  # সূর্যের ঝিকিমিকি
    for _ in range(46):
        y = rr.uniform(122, 188)
        x = rr.uniform(0, 460)
        ln = rr.uniform(8, 40) * (0.6 + (y - 120) / 90)
        col = "#ffffff" if rr.random() < .6 else "#6fa890"
        add(f'<path d="M{n(x)} {n(y)}q{n(ln / 2)} {n(rr.uniform(-1.2, 1.2))} {n(ln)} 0" stroke="{col}" stroke-opacity="{n(rr.uniform(.35, .75))}" stroke-width="{n(rr.uniform(.7, 1.5))}" fill="none" stroke-linecap="round"/>')

    # ৪. দূরের পালতোলা নৌকা
    add('<g transform="translate(212 118)"><path d="M0 4q10 5 22 0l-2 3q-9 3 -18 0z" fill="#6e4624"/><path d="M11 3V-12" stroke="#6e4624" stroke-width=".9"/><path d="M12 -11L22 2H12Z" fill="#fff" opacity=".95"/><path d="M10 -8L3 2H10Z" fill="#ffe9a8"/></g>')

    # ৫. ডান পাড়ের জমি
    add('<g filter="url(#rough)"><path d="M236 156C250 142 262 134 280 130S330 126 372 124S440 120 480 118V200H214C220 178 226 166 236 156Z" fill="url(#bank)"/>')
    add('<path d="M236 156C250 142 262 134 280 130S330 126 372 124S440 120 480 118V128C440 130 400 132 372 134S300 140 270 146S244 158 236 166Z" fill="#c8d884" opacity=".7"/></g>')
    # বাঁ পাড়
    add('<g filter="url(#rough)"><path d="M0 124C40 120 90 128 130 140S170 158 176 200H0Z" fill="url(#bankL)"/></g>')
    # পাড়ের জলরেখায় ছায়া
    add('<path d="M214 200C220 178 226 166 236 156" stroke="#4f8a5a" stroke-opacity=".35" stroke-width="3" fill="none"/>')

    # ৬. ডান পাড়ের গাছ (পেছনে) — বাঁশঝাড়
    add('<g filter="url(#rough)">')
    for i in range(9):
        bx = 390 + i * 4.5 + rr.uniform(-1, 1)
        add(f'<path d="M{n(bx)} 130Q{n(bx + rr.uniform(-6, 6))} 100 {n(bx + rr.uniform(-12, 12))} {n(rr.uniform(84, 98))}" stroke="#7fa24c" stroke-width="1.4" fill="none"/>')
    add(canopy(410, 100, 24, 18, 30, ["#4f8f46", "#63a552", "#7bba5e", "#a3d27a"], 31))
    add('</g>')

    # ৭. দোকান
    sr = random.Random(5)
    add('<g id="shop">')
    add('<ellipse cx="340" cy="153" rx="58" ry="5" fill="#35602f" opacity=".35" filter="url(#soft)"/>')
    add('<rect x="298" y="112" width="84" height="41" fill="url(#wall)"/>')
    for i in range(1, 9):  # কাঠের পাটাতন
        add(f'<path d="M{298 + i * 9.4} 112V153" stroke="#caa86a" stroke-opacity=".35" stroke-width=".6"/>')
    add('<rect x="298" y="112" width="84" height="41" fill="#8a5a2b" opacity=".08"/>')
    # ভেতরের তাক
    add('<rect x="305" y="128" width="42" height="25" fill="#5a3a1e" opacity=".9"/>')
    add('<path d="M305 136h42M305 145h42" stroke="#caa86a" stroke-width="1"/>')
    cols = ["#2e6b3a", "#f2a900", "#e58ba6", "#fff3cc", "#4f9a4a", "#e58ba6", "#f7c948", "#fff"]
    for row, y in enumerate([130, 138, 147]):
        for k in range(7):
            h = sr.choice([4, 5, 6])
            add(f'<rect x="{n(307 + k * 5.8)}" y="{y + 6 - h - (0 if row < 2 else 0)}" width="4.2" height="{h}" rx=".6" fill="{sr.choice(cols)}"/>')
    # কাউন্টার
    add('<rect x="350" y="136" width="30" height="17" fill="#8a5a2b"/><rect x="350" y="136" width="30" height="3" fill="#b07a42"/>')
    add('<rect x="355" y="128" width="6" height="8" rx="1.2" fill="#fff" opacity=".9"/><rect x="355" y="128" width="6" height="3" rx="1" fill="#2e6b3a"/><ellipse cx="371" cy="134" rx="5" ry="2" fill="#e58ba6"/><rect x="366" y="130" width="10" height="4" rx="2" fill="#f2a900"/>')
    # টিনের চাল
    add('<path d="M284 116L340 88L396 116Z" fill="url(#roof)"/>')
    for i in range(-9, 10):
        x1, y1 = 340 + i * 5.6, 88 + abs(i) * 3.1
        x2, y2 = 340 + i * 6.2, 116
        add(f'<path d="M{n(x1)} {n(y1)}L{n(x2)} {n(y2)}" stroke="#6e4624" stroke-opacity=".28" stroke-width=".8"/><path d="M{n(x1 + 1.4)} {n(y1)}L{n(x2 + 1.5)} {n(y2)}" stroke="#ffe2a8" stroke-opacity=".3" stroke-width=".6"/>')
    add('<path d="M284 116L340 88L346 91L292 118Z" fill="#fff" opacity=".12"/><path d="M284 116H396" stroke="#5a3a1e" stroke-opacity=".5" stroke-width="2"/>')
    # সাইনবোর্ড (বারকোড)
    add('<rect x="318" y="100" width="44" height="12" rx="2.5" fill="#2e6b3a"/><rect x="318" y="100" width="44" height="12" rx="2.5" fill="none" stroke="#1f4d2a" stroke-width=".8"/>')
    x = 322
    for w in [2, 1, 3, 1, 2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 1, 2]:
        add(f'<rect x="{n(x)}" y="103" width="{w * .85}" height="6" fill="#fff" opacity=".92"/>')
        x += w * .85 + 1.05
    # চাঁদোয়া (ডোরা কাপড়)
    for i in range(7):
        c = "#f2a900" if i % 2 == 0 else "#fff3cc"
        x0 = 292 + i * 14.3
        add(f'<path d="M{n(x0)} 116h14.3v10q-7.15 5 -14.3 0z" fill="{c}"/><path d="M{n(x0)} 116h14.3v10q-7.15 5 -14.3 0z" fill="#8a5a2b" opacity=".08"/>')
    add('<path d="M292 126q50 8 100 0" stroke="#8a5a2b" stroke-opacity=".25" stroke-width="1.2" fill="none"/>')
    # ঝোলানো চিহ্ন: ফার্মেসি ও কসমেটিক্স
    add('<path d="M300 126v6M386 126v6" stroke="#5a3a1e" stroke-width=".8"/>')
    add('<circle cx="300" cy="138" r="7" fill="#fff" stroke="#2e6b3a" stroke-width="1.6"/><path d="M300 134v8M296 138h8" stroke="#2e6b3a" stroke-width="2" stroke-linecap="round"/>')
    add('<circle cx="386" cy="138" r="7" fill="#fff" stroke="#c4547c" stroke-width="1.6"/><rect x="383.6" y="138.4" width="4.8" height="5" rx=".8" fill="#e58ba6"/><path d="M384.6 138.4v-4l3 -1.4v5.4" fill="#c4547c"/>')
    # কলার কাঁদি, পাটের বস্তা
    add('<path d="M332 126q-2 6 1 12q4 -5 3 -12z" fill="#f4c542"/><path d="M336 126q-1 7 3 11q3 -5 1 -11z" fill="#e6b52e"/><path d="M334 125v2" stroke="#6b8a3a" stroke-width="1.4"/>')
    add('<path d="M288 153q-2 -14 6 -15q8 1 6 15z" fill="#c9a569"/><path d="M290 140q4 -3 8 0" stroke="#8a6b3a" stroke-width=".9" fill="none"/><path d="M302 153q-1 -11 5 -12q6 1 5 12z" fill="#d6b87a"/>')
    # হারিকেন ও খুঁটি
    add('<path d="M290 153V118" stroke="#6e4624" stroke-width="2.4"/><path d="M382 153V118" stroke="#6e4624" stroke-width="2.4"/>')
    add('<circle cx="373" cy="121" r="7" fill="#ffe9a8" opacity=".55" filter="url(#soft)"/><rect x="371" y="119" width="4" height="6" rx="1" fill="#ffd866" stroke="#5a3a1e" stroke-width=".6"/>')
    # কলমের দাগ
    for (x1, y1, x2, y2) in [(298, 112, 382, 112), (298, 112, 298, 153), (382, 112, 382, 153), (284, 116, 340, 88), (340, 88, 396, 116), (350, 136, 380, 136), (305, 128, 347, 128)]:
        add(jitter_line(sr, x1, y1, x2, y2))
    for i in range(9):  # ছায়ার হ্যাচিং
        add(f'<path d="M{300 + i * 4} 142l6 -8" stroke="{INK}" stroke-opacity=".18" stroke-width=".6"/>')
    add('</g>')

    # ৮. কলাগাছ
    add('<g filter="url(#rough)">' + banana(272, 154, 3) + banana(264, 156, 8) + '</g>')

    # ৯. নারকেলগাছ
    add('<g filter="url(#rough)">' + palm(436, 156, 36, 12, 1) + palm(462, 152, 52, -10, 2) + '</g>')

    # ১০. বাঁয়ের বড় আমগাছ
    add('<ellipse cx="62" cy="160" rx="46" ry="6" fill="#35602f" opacity=".35" filter="url(#soft)"/>')
    add('<path d="M58 166Q56 140 60 118" stroke="#6e4624" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M60 140Q44 128 36 118M62 132Q76 124 86 116" stroke="#6e4624" stroke-width="3.4" stroke-linecap="round" fill="none"/><path d="M56 166Q54 142 57 122" stroke="#a97842" stroke-width="2" opacity=".6" fill="none"/>')
    add('<g filter="url(#rough)">' + canopy(62, 96, 42, 32, 80, ["#2f6b33", "#47934a", "#6bb35a", "#a6d77c"], 41, {"count": 7, "col": "#f2a900", "hi": "#ffd866"}) + '</g>')

    # ১১. ছই-নৌকা ও মাঝি (প্রতিফলনসহ)
    boat = '''<g id="boat">
<path d="M112 142Q116 156 148 160Q196 164 230 142Q228 152 200 162Q150 170 118 156Z" fill="url(#hull)"/>
<path d="M118 150Q150 160 226 146" stroke="#d9b070" stroke-opacity=".55" stroke-width="1.1" fill="none"/>
<path d="M126 155Q160 164 214 152" stroke="#1d150d" stroke-opacity=".5" stroke-width="1.3" fill="none"/>
<path d="M146 146Q150 126 166 124Q186 124 196 146Z" fill="url(#thatch)"/>
<path d="M152 144Q155 130 166 128M160 144Q162 130 170 127M170 144Q172 130 178 127M180 144Q182 132 186 129" stroke="#8a6b3a" stroke-opacity=".5" stroke-width=".8" fill="none"/>
<path d="M146 146Q150 126 166 124Q186 124 196 146" stroke="#5a3a1e" stroke-opacity=".6" stroke-width=".9" fill="none"/>
<path d="M214 118L242 170" stroke="#7a5a2f" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="207" cy="115" r="3.4" fill="#8a5a3a"/><path d="M203.8 113.6q3.2 -4.4 6.4 0" fill="#2a1a10"/>
<path d="M203 119q4 -1 8 0l2 15h-10z" fill="#f4efe0"/><path d="M203 119q4 -1 8 0" stroke="#d9c9a0" stroke-width=".8" fill="none"/>
<path d="M203 134h10l1 9h-12z" fill="#3b6ea5"/><path d="M204 137h9M204 140h9" stroke="#fff" stroke-opacity=".45" stroke-width=".6"/>
<path d="M211 122l5 -4" stroke="#8a5a3a" stroke-width="2" stroke-linecap="round"/>
<path d="M205 143l-1 5M210 143l1 5" stroke="#8a5a3a" stroke-width="1.8" stroke-linecap="round"/>
</g>'''
    add('<g transform="translate(0 322) scale(1 -1)" opacity=".28" filter="url(#wave)"><use href="#boat"/></g>')
    add(boat)
    add('<path d="M108 164q10 2 20 0M222 160q12 3 26 0" stroke="#fff" stroke-opacity=".8" stroke-width="1.2" fill="none" stroke-linecap="round"/>')

    # ১২. নলখাগড়া ও সামনের ঘাস
    add('<g filter="url(#rough)">')
    for _ in range(18):
        x = rr.uniform(176, 232)
        y = rr.uniform(168, 186)
        h = rr.uniform(14, 26)
        add(f'<path d="M{n(x)} {n(y)}Q{n(x + rr.uniform(-3, 3))} {n(y - h * .6)} {n(x + rr.uniform(-5, 5))} {n(y - h)}" stroke="{rr.choice(["#5e9a45", "#7fb85a", "#4a8a3c"])}" stroke-width="1.2" fill="none" stroke-linecap="round"/>')
        add(f'<ellipse cx="{n(x + rr.uniform(-4, 4))}" cy="{n(y - h)}" rx="1.4" ry="3.2" fill="#c9a569" transform="rotate({n(rr.uniform(-20, 20))} {n(x)} {n(y - h)})"/>')
    for _ in range(100):
        x = rr.uniform(0, 480)
        y = rr.uniform(160, 196)
        if 150 < x < 240 and y < 190:
            continue
        h = rr.uniform(5, 13)
        col = rr.choice(["#5e9a45", "#7fb85a", "#4a8a3c", "#9bcf6e"])
        add(f'<path d="M{n(x)} {n(y)}q{n(rr.uniform(-2, 2))} {n(-h * .6)} {n(rr.uniform(-3, 3))} {n(-h)}" stroke="{col}" stroke-width="1.1" fill="none" stroke-linecap="round"/>')
    add('</g>')
    for _ in range(26):  # বুনো ফুল
        x, y = rr.uniform(4, 476), rr.uniform(168, 194)
        c = rr.choice(["#f2a900", "#e58ba6", "#ffffff", "#c4547c"])
        add(f'<circle cx="{n(x)}" cy="{n(y)}" r="{n(rr.uniform(1.2, 2.2))}" fill="{c}"/><circle cx="{n(x)}" cy="{n(y)}" r=".5" fill="#8a5a2b"/>')

    # ১৩. নিচে ক্যানভাসে মিলিয়ে যাওয়া, কাগজের দানা
    add('<rect y="150" width="480" height="50" fill="url(#fade)"/>')
    add(f'<rect width="{W}" height="{H}" filter="url(#grain)" opacity=".5"/>')
    add('</svg>')


build()
pathlib.Path(__file__).resolve().parents[2].joinpath("public/art/header-bazaar.svg").write_text("".join(out), encoding="utf-8")
print("ok", sum(len(s) for s in out), "bytes")
