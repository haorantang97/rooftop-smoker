# 旷野植物与红砂岩大石高细节 + 远景 _lo 低面数建模（二次打磨版）：
# juniper / juniper_b / sage / yucca / cholla（各含 _lo <= 600 tris，无方块球感）+ 极坐标分层红砂岩 boulder_a / b / c
import math, random
from mathutils import Vector, Matrix
from inaka_core import (
    B, srgb, lerp_col, mul_col, vary, ensure_leaf_green, ensure_non_leaf,
)


# ---------------- 荒漠植物共用叶丛原语 ----------------

def _desert_tuft(b, center, scale, col_lo, col_hi, rnd, n_planes=3):
    """荒漠刺柏/鼠尾草细碎立体交叉叶簇（严格满足 softFoliage 绿叶判定 g > 1.1r && g > b）"""
    c = Vector(center)
    a0 = rnd.random() * math.tau
    cb = ensure_leaf_green(col_lo)
    ct = ensure_leaf_green(col_hi)
    cm = ensure_leaf_green(lerp_col(cb, ct, 0.56))
    for k in range(n_planes):
        a = a0 + k * (math.tau / n_planes) + (rnd.random() - 0.5) * 0.42
        elev = (-0.12 + k * 0.36) + (rnd.random() - 0.5) * 0.30
        roll = (0.45 + k * 0.85) + (rnd.random() - 0.5) * 0.35
        L = scale * (0.88 + rnd.random() * 0.30)
        W = scale * (0.68 + rnd.random() * 0.24)
        d = Vector((math.cos(a) * math.cos(elev), math.sin(a) * math.cos(elev), math.sin(elev))).normalized()
        side = d.cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        u = side.cross(d).normalized()
        sr = side * math.cos(roll) + u * math.sin(roll)
        ur = -side * math.sin(roll) + u * math.cos(roll)
        orig = c - d * (L * 0.38)
        p0 = orig
        p1 = orig + d * (L * 0.46) - sr * (W * 0.50) + ur * (W * 0.12)
        p2 = orig + d * L - ur * (L * 0.06)
        p3 = orig + d * (L * 0.46) + sr * (W * 0.50) + ur * (W * 0.12)
        b.double_poly([p0, p1, p2, p3], [(0, 1, 2), (0, 2, 3)], None, vert_colors=[cb, cm, ct, cm], back_darken=0.86)


# ---------------- 1. 荒漠虬曲刺柏 juniper / juniper_lo（对照 juniper.png） ----------------

def build_juniper(name='juniper', seed=211, lo=False):
    b = B(seed)
    rnd = random.Random(seed)
    bark_d = ensure_non_leaf('#6e5c4c')
    bark_l = ensure_non_leaf('#b2a494')
    dead_c = ensure_non_leaf('#c6beb0')
    # 温暖日光晒过的荒漠橄榄灰绿（经 ensure_leaf_green 保证 100% 通过 softFoliage！）
    fol_lo = '#4a6434'
    fol_mid = '#6f8c4a'
    fol_hi = '#9ab466'

    if lo:
        # 严格 <= 600 面（~520 面）：虬曲分叉主干 + 34 簇立体交叉叶丛（告别棱角多面体球！）
        b.tube([(0, 0, 0), (0.08, -0.04, 0.9), (-0.04, 0.06, 1.7)], [0.22, 0.15, 0.08], bark_d, seg=4, smooth=True)
        pads = [
            (Vector((-1.05, -0.45, 2.05)), 0.72, 6),
            (Vector(( 1.05,  0.22, 1.85)), 0.70, 6),
            (Vector(( 0.05, -0.10, 3.05)), 0.85, 9),
            (Vector((-0.35,  0.85, 2.35)), 0.68, 6),
            (Vector(( 0.55, -0.78, 2.25)), 0.68, 6),
        ]
        for ctr, rad, nt in pads:
            b.tube([Vector((0, 0, 1.05)), ctr - Vector((0, 0, 0.30))], [0.09, 0.035], bark_l, seg=3)
            for _ in range(nt):
                a = rnd.random() * math.tau
                rr = rnd.random() * rad * 0.72
                pos = ctr + Vector((math.cos(a) * rr, math.sin(a) * rr, (rnd.random() - 0.4) * 0.55))
                hk = max(0.0, min(1.0, (pos.z - 1.4) / 2.2))
                _desert_tuft(b, pos, 0.92 + rnd.random() * 0.34, lerp_col(fol_lo, fol_mid, hk * 0.6), lerp_col(fol_mid, fol_hi, hk), rnd, n_planes=3)
        return b.finish(name)

    # 英雄高细节版（<= 4,000 面）：多股拧绞沧桑粗干 + 枯白死枝 + 层层细碎暖橄榄绿叶云垫！
    for s_i, (ox, oy, rad0, top_p) in enumerate([
        (-0.08, 0.02, 0.24, Vector((-0.18, 0.08, 1.65))),
        ( 0.12, -0.06, 0.18, Vector((0.35, -0.15, 1.48))),
    ]):
        pts = [
            Vector((ox, oy, 0.0)),
            Vector((ox + 0.08 * (1 if s_i == 0 else -1), oy - 0.06, 0.55)),
            Vector((ox * 0.5, oy + 0.08, 1.12)),
            top_p,
        ]
        rads = [rad0 * 1.25, rad0 * 0.92, rad0 * 0.72, rad0 * 0.48]
        b.tube(pts, rads, None, seg=6, smooth=True, colors=[bark_d, bark_d, bark_l, bark_l])
    for k in range(5):
        a = k / 5.0 * math.tau + 0.3
        b.tube(
            [Vector((math.cos(a) * 0.16, math.sin(a) * 0.16, 0.32)),
             Vector((math.cos(a) * 0.52, math.sin(a) * 0.52, 0.09)),
             Vector((math.cos(a) * 0.88, math.sin(a) * 0.88, 0.0))],
            [0.095, 0.055, 0.020], bark_d, seg=4, smooth=True,
        )
    b.tube([Vector((-0.12, -0.05, 1.15)), Vector((-0.68, -0.35, 1.68)), Vector((-1.15, -0.52, 1.98))], [0.065, 0.036, 0.012], dead_c, seg=5)

    limbs = [
        (Vector((-0.15, 0.05, 1.55)), Vector((-1.32, -0.45, 2.22)), 0.92, 42),
        (Vector(( 0.30, -0.12, 1.42)), Vector(( 1.38, -0.30, 1.92)), 0.92, 42),
        (Vector(( 0.18,  0.10, 1.48)), Vector(( 0.95,  0.88, 2.48)), 0.86, 36),
        (Vector((-0.16,  0.12, 1.58)), Vector((-0.82,  0.96, 2.65)), 0.86, 36),
        (Vector((-0.06,  0.04, 1.62)), Vector(( 0.12, -0.18, 3.35)), 1.12, 54),
        (Vector(( 0.06, -0.04, 1.52)), Vector((-0.55, -0.92, 2.75)), 0.82, 34),
    ]
    for p0, p2, rad_w, n_t in limbs:
        mid = p0.lerp(p2, 0.52) + Vector(((rnd.random() - 0.5) * 0.35, (rnd.random() - 0.5) * 0.35, -0.12))
        b.tube([p0, mid, p2], [0.10, 0.062, 0.025], bark_l, seg=5, smooth=True)
        for _ in range(n_t):
            a = rnd.random() * math.tau
            rr = (rnd.random() ** 0.65) * rad_w
            dz = (rnd.random() - 0.42) * rad_w * 0.62
            pos = p2 + Vector((math.cos(a) * rr, math.sin(a) * rr, dz))
            h_k = max(0.0, min(1.0, (pos.z - 1.4) / 2.4))
            _desert_tuft(b, pos, 0.46 + rnd.random() * 0.24, lerp_col(fol_lo, fol_mid, h_k * 0.65), lerp_col(fol_mid, fol_hi, h_k), rnd, n_planes=3)

    return b.finish(name)


# ---------------- 2. 卧风斜伸刺柏变体 juniper_b / juniper_b_lo（对照 juniper_b.png） ----------------

def build_juniper_b(name='juniper_b', seed=212, lo=False):
    b = B(seed)
    rnd = random.Random(seed)
    bark_d = ensure_non_leaf('#746252')
    bark_l = ensure_non_leaf('#beb4a6')
    fol_lo = '#445e36'
    fol_mid = '#66844c'
    fol_hi = '#90ac64'

    if lo:
        # 严格 <= 600 面（~520 面）：斜倾苍干 + 34 簇蓬松立体叶丛
        b.tube([(-0.9, 0, 0), (-0.2, 0.1, 1.0), (0.6, 0.05, 1.9)], [0.22, 0.14, 0.07], bark_d, seg=4, smooth=True)
        pads = [
            (Vector((-0.35, -0.15, 2.35)), 0.78, 8),
            (Vector(( 0.45,  0.25, 2.85)), 0.86, 10),
            (Vector(( 1.75, -0.25, 1.85)), 0.74, 8),
            (Vector(( 1.15,  0.65, 2.20)), 0.68, 7),
        ]
        for ctr, rad, nt in pads:
            b.tube([Vector((-0.2, 0.1, 1.0)), ctr - Vector((0, 0, 0.25))], [0.085, 0.032], bark_l, seg=3)
            for _ in range(nt):
                a = rnd.random() * math.tau
                rr = rnd.random() * rad * 0.72
                pos = ctr + Vector((math.cos(a) * rr, math.sin(a) * rr, (rnd.random() - 0.42) * 0.52))
                hk = max(0.0, min(1.0, (pos.z - 1.2) / 2.2))
                _desert_tuft(b, pos, 0.92 + rnd.random() * 0.34, lerp_col(fol_lo, fol_mid, hk * 0.6), lerp_col(fol_mid, fol_hi, hk), rnd, n_planes=3)
        return b.finish(name)

    main_pts = [
        Vector((-1.15, 0.05, 0.0)),
        Vector((-0.62, 0.08, 0.68)),
        Vector((-0.08, 0.04, 1.48)),
        Vector(( 0.35, -0.08, 2.25)),
        Vector(( 0.58, -0.10, 2.85)),
    ]
    b.tube(main_pts, [0.28, 0.21, 0.15, 0.095, 0.042], None, seg=6, smooth=True, colors=[bark_d, bark_d, bark_l, bark_l, bark_l])
    low_pts = [
        Vector((-0.95, -0.05, 0.0)),
        Vector((-0.35, -0.10, 0.52)),
        Vector(( 0.55, -0.16, 1.05)),
        Vector(( 1.45, -0.20, 1.42)),
        Vector(( 2.15, -0.18, 1.56)),
    ]
    b.tube(low_pts, [0.20, 0.15, 0.10, 0.062, 0.028], None, seg=6, smooth=True, colors=[bark_d, bark_l, bark_l, bark_l, bark_d])

    pads = [
        (main_pts[2], Vector((-0.55, -0.52, 2.45)), 0.92, 42),
        (main_pts[3], Vector(( 0.25,  0.48, 3.05)), 1.05, 50),
        (main_pts[4], Vector(( 0.72, -0.35, 3.22)), 0.95, 44),
        (low_pts[3],  Vector(( 1.72,  0.22, 1.98)), 0.84, 36),
        (low_pts[4],  Vector(( 2.38, -0.22, 1.72)), 0.88, 40),
        (main_pts[2], Vector((-0.78,  0.55, 2.20)), 0.78, 32),
    ]
    for p0, p2, rad_w, n_t in pads:
        mid = p0.lerp(p2, 0.52) + Vector((0, 0, -0.10))
        b.tube([p0, mid, p2], [0.085, 0.052, 0.022], bark_l, seg=4, smooth=True)
        for _ in range(n_t):
            a = rnd.random() * math.tau
            rr = (rnd.random() ** 0.65) * rad_w
            dz = (rnd.random() - 0.45) * rad_w * 0.55
            pos = p2 + Vector((math.cos(a) * rr, math.sin(a) * rr, dz))
            h_k = max(0.0, min(1.0, (pos.z - 1.2) / 2.2))
            _desert_tuft(b, pos, 0.46 + rnd.random() * 0.24, lerp_col(fol_lo, fol_mid, h_k * 0.6), lerp_col(fol_mid, fol_hi, h_k), rnd, n_planes=3)

    return b.finish(name)


# ---------------- 3. 灰绿色鼠尾草丛 sage / sage_lo（0.6–1m 高，圆润蓬松银灰绿，对照 sage.png） ----------------

def build_sage(name='sage', seed=213, lo=False):
    b = B(seed)
    rnd = random.Random(seed)
    stem_c = ensure_non_leaf('#54473c')
    # 明亮柔和的荒漠银灰绿鼠尾草色（全部严格满足 g > 1.15r && g > b！）
    sage_lo = '#6c8664'
    sage_mid = '#92ac84'
    sage_hi = '#bad0a6'

    if lo:
        # 严格 <= 600 面（~450 面）：扭曲暗木基枝 + 36 簇蓬松银灰绿鼠尾草叶丛（告别大块棱角多面体！）
        for k in range(3):
            a = k * math.tau / 3.0 + 0.4
            b.tube([(0, 0, 0), (math.cos(a) * 0.22, math.sin(a) * 0.22, 0.34)], [0.045, 0.018], stem_c, seg=3)
        for k in range(36):
            a = k * 2.39996
            u = k / 36.0
            rr = (u ** 0.65) * 0.44
            # 自然圆拱灌丛轮廓（中心高 0.78m，外缘低 0.32m，绝不平顶！）
            z_dome = 0.24 + (1.0 - (rr / 0.52) ** 2) * 0.54
            pos = Vector((math.cos(a) * rr, math.sin(a) * rr, max(0.22, z_dome + (rnd.random() - 0.5) * 0.16)))
            hk = max(0.0, min(1.0, (pos.z - 0.20) / 0.62))
            _desert_tuft(b, pos, 0.38 + rnd.random() * 0.16, lerp_col(sage_lo, sage_mid, hk * 0.6), lerp_col(sage_mid, sage_hi, hk), rnd, n_planes=3)
        return b.finish(name)

    # 英雄版（<= 4,000 面，高约 0.92m，宽约 1.25m）：扭曲深木质根枝 + 圆拱状 ~220 簇银灰绿鼠尾草细丛！
    n_stems = 12
    anchors = []
    for k in range(n_stems):
        a = k / n_stems * math.tau + (rnd.random() - 0.5) * 0.35
        is_inner = (k % 3 == 0)
        spread = (0.16 + rnd.random() * 0.16) if is_inner else (0.32 + rnd.random() * 0.22)
        sh = (0.64 + rnd.random() * 0.18) if is_inner else (0.40 + rnd.random() * 0.20)
        p0 = Vector((math.cos(a) * 0.04, math.sin(a) * 0.04, 0.0))
        p1 = Vector((math.cos(a) * spread * 0.55, math.sin(a) * spread * 0.55, sh * 0.45))
        p2 = Vector((math.cos(a) * spread, math.sin(a) * spread, sh))
        b.tube([p0, p1, p2], [0.032, 0.018, 0.008], stem_c, seg=4, smooth=True)
        anchors.append((p1.lerp(p2, 0.65), 0.18))
        anchors.append((p2, 0.22))
    anchors.append((Vector((0, 0, 0.72)), 0.24))

    for ap, rad_a in anchors:
        for _ in range(9):
            a = rnd.random() * math.tau
            rr = rnd.random() * rad_a
            dz = (rnd.random() - 0.35) * rad_a * 0.85
            pos = ap + Vector((math.cos(a) * rr, math.sin(a) * rr, dz))
            r_xy = math.hypot(pos.x, pos.y)
            max_z = max(0.35, 0.92 - (r_xy ** 2) * 0.85)
            pos.z = max(0.18, min(max_z, pos.z))
            hk = max(0.0, min(1.0, (pos.z - 0.18) / 0.72))
            _desert_tuft(b, pos, 0.21 + rnd.random() * 0.12, lerp_col(sage_lo, sage_mid, hk * 0.6), lerp_col(sage_mid, sage_hi, hk), rnd, n_planes=3)

    return b.finish(name)


# ---------------- 4. 丝兰 yucca / yucca_lo（一丛尖剑叶 + 高花茎白铃花，对照 yucca.png） ----------------

def build_yucca(name='yucca', seed=214, lo=False):
    b = B(seed)
    rnd = random.Random(seed)
    leaf_lo = '#385c28'
    leaf_mid = '#5e883c'
    leaf_hi = '#8ab052'
    dry_c = ensure_non_leaf('#bda47a')
    stalk_c = ensure_non_leaf('#baa47c')
    bloom_c = ensure_non_leaf('#faf4e2')
    bloom_s = ensure_non_leaf('#dfd4b6')

    def sword_blade(orig, d_vec, length, width, col_b, col_t, is_green=True):
        d = d_vec.normalized()
        side = d.cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        u = side.cross(d).normalized()
        cb = ensure_leaf_green(col_b) if is_green else ensure_non_leaf(col_b)
        ct = ensure_leaf_green(col_t) if is_green else ensure_non_leaf(col_t)
        cm = lerp_col(cb, ct, 0.55)
        if is_green:
            cm = ensure_leaf_green(cm)
        p0 = orig
        p_l = orig + d * (length * 0.35) - side * (width * 0.5) + u * (width * 0.15)
        p_r = orig + d * (length * 0.35) + side * (width * 0.5) + u * (width * 0.15)
        p_tip = orig + d * length
        b.double_poly([p0, p_l, p_tip, p_r], [(0, 1, 2), (0, 2, 3)], None, vert_colors=[cb, cm, ct, cm], back_darken=0.85)

    ctr = Vector((0, 0, 0.42))
    n_dry = 12 if lo else 24
    for k in range(n_dry):
        a = k / n_dry * math.tau + rnd.random() * 0.2
        elev = -0.78 - rnd.random() * 0.38
        d = Vector((math.cos(a) * math.cos(elev), math.sin(a) * math.cos(elev), math.sin(elev)))
        sword_blade(ctr - Vector((0, 0, 0.06)), d, 0.46 + rnd.random() * 0.12, 0.065, '#8c7450', dry_c, is_green=False)

    n_blades = 34 if lo else 92
    for k in range(n_blades):
        u = k / max(1, n_blades - 1)
        elev = -0.40 + u * 1.65 + (rnd.random() - 0.5) * 0.12
        a = k * 2.39996 + (rnd.random() - 0.5) * 0.15
        d = Vector((math.cos(a) * math.cos(elev), math.sin(a) * math.cos(elev), math.sin(elev)))
        bl = (0.58 + 0.18 * math.sin(u * math.pi)) * (0.88 + rnd.random() * 0.24)
        bw = 0.072 if lo else 0.058
        c_t = lerp_col(leaf_mid, leaf_hi, 0.3 + 0.7 * u)
        sword_blade(ctr, d, bl, bw, leaf_lo, c_t, is_green=True)

    H_s = 2.12
    b.cyl((0, 0, 0.38), 0.042, H_s - 0.38, stalk_c, seg=5 if lo else 7, r2=0.012, smooth=True)
    if lo:
        # 6 个蓬松分层小花簇构成低面数花穗（比光溜溜橄榄球自然得多，且总面数 <= 520！）
        for k in range(7):
            u = k / 6.0
            zz = 1.24 + u * 0.86
            env = math.sin((0.12 + u * 0.82) * math.pi)
            rr = 0.05 + env * 0.11
            b.sphere((math.cos(k * 2.4) * 0.04, math.sin(k * 2.4) * 0.04, zz), rr, bloom_c if k % 2 == 0 else bloom_s, sub=1, scale=(1.0, 1.0, 0.85), smooth=True)
        return b.finish(name)

    n_bells = 44
    for k in range(n_bells):
        u = k / (n_bells - 1)
        z = 1.22 + u * 0.92
        a = k * 2.39996
        env = math.sin(u * math.pi) ** 0.65 * (1.0 - 0.30 * u)
        rad = 0.05 + env * 0.14
        bx = math.cos(a) * rad
        by = math.sin(a) * rad
        b.seg((0, 0, z), (bx, by, z + 0.02), 0.012, 0.012, stalk_c)
        sc = 0.052 + 0.028 * env
        b.lathe(
            (bx, by, z - sc * 0.6),
            [(sc * 0.72, 0.0), (sc * 0.68, sc * 0.55), (sc * 0.25, sc * 1.15)],
            None, seg=6, smooth=True, cap_bot=True,
            colors=[bloom_s, bloom_c, bloom_c],
        )

    return b.finish(name)


# ---------------- 5. 仙人掌丛 cholla / cholla_lo（分节树状仙人掌 + 顶毛刺晕，对照 cholla.png） ----------------

def build_cholla(name='cholla', seed=215, lo=False):
    b = B(seed)
    rnd = random.Random(seed)
    wood_c = ensure_non_leaf('#544234')
    cac_lo = '#466830'
    cac_mid = '#668c42'
    cac_hi = '#88aa54'
    spine_c = ensure_non_leaf('#e8dfb8')

    def add_joint(p0, p1, r0, r1, is_tip=False, seg=6):
        p0, p1 = Vector(p0), Vector(p1)
        mid = p0.lerp(p1, 0.5)
        r_m = (r0 + r1) * 0.5 * 1.14
        c0 = ensure_leaf_green(cac_lo)
        cm = ensure_leaf_green(cac_mid)
        c1 = ensure_leaf_green(cac_hi)
        b.tube([p0, p0.lerp(mid, 0.5), mid, mid.lerp(p1, 0.5), p1],
               [r0 * 0.78, r0 * 1.05, r_m, r1 * 1.05, r1 * 0.72],
               None, seg=seg, smooth=True, colors=[c0, cm, cm, c1, c1])
        if is_tip and not lo:
            b.sphere(p1 + (p1 - p0).normalized() * (r1 * 0.25), r1 * 1.18, spine_c, sub=1, smooth=True, jitter=0.06)

    if lo:
        b.tube([(0, 0, 0), (0, 0, 0.42)], [0.10, 0.075], wood_c, seg=5)
        arms = [
            (0.0, 0.42, 0.55, 0.95), (1.1, 0.40, 0.62, 1.05), (2.2, 0.38, 0.58, 0.90),
            (3.4, 0.42, 0.65, 1.10), (4.6, 0.36, 0.52, 0.85), (5.5, 0.40, 0.48, 1.25),
        ]
        for a, z0, rad, top_z in arms:
            p0 = Vector((0, 0, z0))
            p1 = Vector((math.cos(a) * rad * 0.65, math.sin(a) * rad * 0.65, z0 + 0.22))
            p2 = Vector((math.cos(a) * rad, math.sin(a) * rad, top_z))
            b.tube([p0, p1], [0.062, 0.048], wood_c, seg=4)
            add_joint(p1, p2, 0.078, 0.068, is_tip=True, seg=5)
            a2 = a + 0.75
            p3 = p1.lerp(p2, 0.55) + Vector((math.cos(a2) * 0.28, math.sin(a2) * 0.28, 0.32))
            add_joint(p1.lerp(p2, 0.55), p3, 0.062, 0.056, is_tip=True, seg=4)
        return b.finish(name)

    b.tube([(0, 0, 0.0), (0.04, -0.02, 0.22), (0.0, 0.02, 0.42)], [0.125, 0.095, 0.080], wood_c, seg=6, smooth=True)
    n_main = 7
    for i in range(n_main):
        a = i / n_main * math.tau + (rnd.random() - 0.5) * 0.32
        r_m = 0.28 + rnd.random() * 0.22
        p0 = Vector((0, 0, 0.32 + (i % 2) * 0.08))
        p1 = Vector((math.cos(a) * r_m, math.sin(a) * r_m, 0.56 + rnd.random() * 0.16))
        b.tube([p0, p0.lerp(p1, 0.5) - Vector((0, 0, 0.04)), p1], [0.072, 0.056, 0.048], wood_c, seg=5, smooth=True)
        p2 = p1 + Vector((math.cos(a) * 0.24, math.sin(a) * 0.24, 0.40 + rnd.random() * 0.16))
        add_joint(p1, p2, 0.072, 0.068, is_tip=False, seg=6)
        n_sub = 3 if i < 4 else 2
        for j in range(n_sub):
            sa = a + (j - (n_sub - 1) * 0.5) * 0.92 + (rnd.random() - 0.5) * 0.28
            sl = 0.28 + rnd.random() * 0.16
            p3 = p2 + Vector((math.cos(sa) * sl * 0.72, math.sin(sa) * sl * 0.72, sl * 0.92))
            has_child = (j == 1 and rnd.random() < 0.75)
            add_joint(p2, p3, 0.065, 0.060, is_tip=not has_child, seg=6)
            if has_child:
                for k in range(2):
                    ta = sa + (1 if k == 0 else -1) * (0.65 + rnd.random() * 0.35)
                    p4 = p3 + Vector((math.cos(ta) * 0.16, math.sin(ta) * 0.16, 0.26 + rnd.random() * 0.14))
                    add_joint(p3, p4, 0.056, 0.050, is_tip=True, seg=5)

    return b.finish(name)


# ---------------- 6. 极坐标分层沉积红砂岩大石 boulder_a / boulder_b / boulder_c（锐利水平层理！） ----------------

# 丰富鲜明的科罗拉多高原沉积岩层色带（每层明暗与冷暖红/橙/赭/米黄交替）
STRATA_BANDS = [
    '#9a4024', '#c8683a', '#e0a268', '#a84828', '#edd09c',
    '#8e3a24', '#d47c48', '#b85632', '#e8be84', '#9e4428',
    '#ce7846', '#e6c28c', '#b45432', '#d88e56', '#e4bc84',
]


def _stratified_rock(b, center, rx, ry, h, seed, mode='block', na=28, nh=20):
    """
    水平环带极坐标网格雕刻红砂岩：
    每圈顶点严格沿水平沉积层理排列，所以红/橙/赭/浅沙黄岩层边界极其锐利清晰！
    自带水平风蚀台阶、竖向裂隙凹槽、暗褐沙漠漆竖条纹、顶面起伏盖岩与底部扎实落零。
    """
    c = Vector(center)
    # 预先生成每个方位角的基础岩石平面轮廓（方圆相济的棱角巨岩）
    outline = []
    for i in range(na):
        a = i / na * math.tau
        ca, sa = math.cos(a), math.sin(a)
        # 四角方石化 + 自然岩石凹凸
        sq = (abs(ca) ** 3.0 + abs(sa) ** 3.0) ** (-1.0 / 3.0)
        base_r = 0.65 + 0.35 * sq
        n_az = (
            0.14 * math.sin(a * 2.0 + seed * 1.1)
            + 0.10 * math.cos(a * 3.0 - seed * 0.7)
            + 0.07 * math.sin(a * 5.0 + seed * 2.3)
        )
        # 竖向断崖裂隙
        cr = -0.09 * (max(0.0, math.cos(a * 4.0 + seed * 1.7)) ** 6)
        outline.append(base_r * (1.0 + n_az + cr))

    # 预先生成每层高度的不规则地质台阶缩放（2~3 道真实断层台阶，杜绝均匀手风琴波纹！）
    ledges = [0.28 + (seed % 3) * 0.04, 0.58 + (seed % 2) * 0.05, 0.80]
    layer_r = []
    for j in range(nh + 1):
        t = j / nh  # 0=底, 1=顶
        if mode == 'block':
            prof = 0.94 + 0.08 * math.sin(t * math.pi)
            if t > 0.78:
                prof *= 1.0 - ((t - 0.78) / 0.22) ** 1.6 * 0.28
        elif mode == 'crag':
            prof = 1.00 - 0.16 * (t ** 1.2)
            if t > 0.88:
                prof *= 1.0 - ((t - 0.88) / 0.12) * 0.18
        else:
            # caprock：宽扁平顶盖岩，底部略收，上部硬岩微微外挑
            prof = 0.88 + 0.15 * (t ** 0.65)
            if t > 0.88:
                prof *= 1.0 - ((t - 0.88) / 0.12) * 0.10
        # 2~3 道微妙的沉积岩硬软台阶（平滑阶梯而非正弦褶皱）
        step_k = 0.0
        for L_t in ledges:
            if t > L_t:
                step_k -= 0.032
            elif abs(t - L_t) < 0.045:
                step_k -= 0.025  # 薄凹蚀岩缝
        layer_r.append(prof + step_k)

    verts = []
    vcs = []
    for j in range(nh + 1):
        t = j / nh
        band_idx = int((t * len(STRATA_BANDS) * 1.15 + seed * 0.3) % len(STRATA_BANDS))
        base_col = srgb(STRATA_BANDS[band_idx])
        if t > 0.88:
            base_col = lerp_col(base_col, '#e2b87e', (t - 0.88) / 0.12 * 0.65)
        for i in range(na):
            a = i / na * math.tau
            ca, sa = math.cos(a), math.sin(a)
            # 沿方位角加入柔和微起伏的岩石块面
            face_jit = 1.0 + 0.035 * math.sin(a * 6.0 + t * 4.5 + seed)
            rad = outline[i] * layer_r[j] * face_jit
            # caprock 前下侧(-Y)风蚀内凹掏空洞（对照 boulder_c.png！）
            if mode == 'caprock' and sa < -0.15 and 0.10 < t < 0.56:
                cav = math.sin(((t - 0.10) / 0.46) * math.pi) * ((-sa - 0.15) / 0.85)
                rad *= max(0.48, 1.0 - cav * 0.40)
            # 轻微倾斜沉积层理（crag 顶部保持斜切平整断崖，绝不起尖刺角！）
            tilt_z = 0.03 * ca * h
            if mode == 'crag' and t > 0.72:
                tilt_z += ca * 0.08 * h * ((t - 0.72) / 0.28)
            px = ca * rx * rad
            py = sa * ry * rad
            pz = max(0.0, t * h + tilt_z * (1.0 if j > 0 else 0.0))
            verts.append(c + Vector((px, py, pz)))
            varnish = (max(0.0, math.sin(a * 7.0 + seed * 1.9)) ** 6) * 0.36 * (1.0 - max(0.0, t - 0.85) * 5.0)
            col = lerp_col(base_col, '#4a2618', varnish)
            col = mul_col(col, 0.82 + 0.24 * min(1.0, t * 2.4))
            vcs.append(ensure_non_leaf(col))

    faces = []
    for j in range(nh):
        b0, b1 = j * na, (j + 1) * na
        for i in range(na):
            ni = (i + 1) % na
            faces.append((b0 + i, b0 + ni, b1 + ni, b1 + i))

    # 顶面：2 圈向中心收束的平整微起伏顶盖岩（不出现尖刺！）
    top_ring_start = nh * na
    cap_col = ensure_non_leaf('#dfb47c')
    inner_start = len(verts)
    for i in range(na):
        p_outer = verts[top_ring_start + i]
        p_in = Vector((c.x + (p_outer.x - c.x) * 0.48, c.y + (p_outer.y - c.y) * 0.48, p_outer.z + h * (0.04 if mode != 'caprock' else 0.015)))
        verts.append(p_in)
        vcs.append(cap_col)
    avg_top_z = sum(verts[inner_start + i].z for i in range(na)) / na
    ctr_top_idx = len(verts)
    verts.append(Vector((c.x, c.y, avg_top_z + h * (0.03 if mode != 'caprock' else 0.01))))
    vcs.append(ensure_non_leaf('#e8c48e'))
    for i in range(na):
        ni = (i + 1) % na
        faces.append((top_ring_start + i, top_ring_start + ni, inner_start + ni, inner_start + i))
        faces.append((inner_start + i, inner_start + ni, ctr_top_idx))

    # 底面封口（z=0）
    ctr_bot_idx = len(verts)
    verts.append(Vector((c.x, c.y, 0.0)))
    vcs.append(ensure_non_leaf('#6a3420'))
    for i in range(na):
        ni = (i + 1) % na
        faces.append((ctr_bot_idx, ni, i))

    b.poly(verts, faces, None, smooth=False, vert_colors=vcs)


def build_boulder(name, seed, variant='a'):
    b = B(seed)
    if variant == 'a':
        # 厚重风化红砂岩圆角巨石（~3.3 × 2.5 × 2.2m，~1,280 三角面，对照 boulder_a.png）
        _stratified_rock(b, (0, 0, 0), 1.65, 1.25, 2.22, seed, mode='block', na=28, nh=20)
    elif variant == 'b':
        # 竖直断崖状裂隙红砂岩块 + 脚下两块分层崩落碎石（~2.4 × 2.1 × 2.7m，~1,850 三角面，对照 boulder_b.png）
        _stratified_rock(b, (0.0, 0.14, 0), 1.08, 0.88, 2.68, seed, mode='crag', na=28, nh=20)
        _stratified_rock(b, (-0.70, -0.82, 0), 0.42, 0.34, 0.52, seed + 17, mode='block', na=14, nh=8)
        _stratified_rock(b, ( 0.48, -0.90, 0), 0.52, 0.40, 0.64, seed + 31, mode='block', na=14, nh=8)
    else:
        # 宽扁平顶风蚀内凹盖岩巨石（~3.9 × 2.6 × 1.50m，~1,280 三角面，对照 boulder_c.png）
        _stratified_rock(b, (0, 0, 0), 1.95, 1.32, 1.48, seed, mode='caprock', na=30, nh=18)
    return b.finish(name)
