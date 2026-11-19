# 树木与植物的高细节建模 + 远景 _lo 低面数版（完全使用细碎立体叶丛，杜绝大块几何球！）：
# 榉树、橡树、夏日青枫、杉树、竹丛、向日葵，以及 tree_keyaki_lo / tree_oak_lo / tree_cedar_lo
import math, random
from mathutils import Vector, Matrix
from inaka_core import (
    B, srgb, lerp_col, mul_col, vary, ensure_leaf_green, ensure_non_leaf,
    KEYAKI_BARK, OAK_BARK, MAPLE_BARK, CEDAR_BARK,
)


# ---------------- 细碎立体叶丛原语 ----------------

def _sun_shade(pos, crown_ctr, crown_rad, col_hi, col_mid, col_lo, rnd):
    """按太阳方向（左前上方）+ 树冠高度 + 冠内遮蔽计算自然树叶顶点色，严格满足游戏 softFoliage 绿叶判定"""
    rel = pos - crown_ctr
    h_k = max(0.0, min(1.0, (rel.z / max(0.5, crown_rad[2])) * 0.52 + 0.50))
    r_k = min(1.0, math.hypot(rel.x / max(0.5, crown_rad[0]), rel.y / max(0.5, crown_rad[1])))
    sun_dir = Vector((-0.48, -0.52, 0.70)).normalized()
    nd = rel.normalized() if rel.length > 1e-4 else Vector((0, 0, 1))
    sun_k = max(0.0, min(1.0, nd.dot(sun_dir) * 0.5 + 0.5))
    k = h_k * 0.48 + sun_k * 0.34 + r_k * 0.18
    k = max(0.0, min(1.0, k + (rnd.random() - 0.5) * 0.16))
    if k > 0.52:
        c = lerp_col(col_mid, col_hi, (k - 0.52) / 0.48)
    else:
        c = lerp_col(col_lo, col_mid, k / 0.52)
    return ensure_leaf_green(c)


def _vol_tuft(b, center, scale, col_base, col_tip, rnd, style='broad'):
    """
    立体交叉细碎叶丛（3 片互相斜交的尖菱形双面叶簇，每簇仅 12 三角面！）：
    从平视、俯视、侧视任何角度都蓬松饱满且轮廓细碎如手绘叶云，彻底杜绝纸片感与方块球感。
    style: 'broad' (榉树/橡树饱满立体) | 'tier' (青枫略扁平层云但有厚度) | 'lo' (远景稍大饱满)
    """
    c = Vector(center)
    a0 = rnd.random() * math.tau
    cb = ensure_leaf_green(col_base)
    ct = ensure_leaf_green(col_tip)
    cm = ensure_leaf_green(lerp_col(cb, ct, 0.58))

    for k in range(3):
        a = a0 + k * (math.tau / 3.0) + (rnd.random() - 0.5) * 0.38
        if style == 'tier':
            # 青枫层云：两片斜舒展、一片微微立起增加平视厚度
            elev = (0.12 if k < 2 else 0.45) + (rnd.random() - 0.5) * 0.25
            roll = (0.38 if k % 2 == 0 else -0.45) + (rnd.random() - 0.5) * 0.35
            L = scale * (0.95 + rnd.random() * 0.30)
            W = scale * (0.64 + rnd.random() * 0.22)
        else:
            # 榉树/橡树：三片在三维空间充分斜交（俯仰角 15°~65°，滚转角交错），360° 蓬松立体！
            elev = (-0.15 + k * 0.42) + (rnd.random() - 0.5) * 0.32
            roll = (0.55 + k * 0.85) + (rnd.random() - 0.5) * 0.35
            L = scale * (0.90 + rnd.random() * 0.32)
            W = scale * (0.72 + rnd.random() * 0.24)

        d = Vector((math.cos(a) * math.cos(elev), math.sin(a) * math.cos(elev), math.sin(elev))).normalized()
        side = d.cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        u = side.cross(d).normalized()
        sr = side * math.cos(roll) + u * math.sin(roll)
        ur = -side * math.sin(roll) + u * math.cos(roll)

        orig = c - d * (L * 0.40) + Vector((0, 0, (rnd.random() - 0.5) * scale * (0.14 if style == 'tier' else 0.26)))
        p0 = orig
        p1 = orig + d * (L * 0.46) - sr * (W * 0.50) + ur * (W * 0.12)
        p2 = orig + d * L - ur * (L * 0.08)
        p3 = orig + d * (L * 0.46) + sr * (W * 0.50) + ur * (W * 0.12)
        b.double_poly([p0, p1, p2, p3], [(0, 1, 2), (0, 2, 3)], None, vert_colors=[cb, cm, ct, cm], back_darken=0.86)


def _cedar_plume(b, origin, dir_vec, length, width, col_base, col_tip, roll=0.0):
    """一片饱满的杉树人字形立体针叶羽片（带纵折脊与微微上翘梢部，8 三角面双面）"""
    d = dir_vec.normalized()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-4:
        side = d.cross(Vector((1, 0, 0)))
    side.normalize()
    u = side.cross(d).normalized()
    sr = side * math.cos(roll) + u * math.sin(roll)
    ur = -side * math.sin(roll) + u * math.cos(roll)
    cb = ensure_leaf_green(col_base)
    ct = ensure_leaf_green(col_tip)
    cm = ensure_leaf_green(lerp_col(cb, ct, 0.58))
    p0 = origin
    p_mid = origin + d * (length * 0.45) + ur * (width * 0.24)
    p_l = origin + d * (length * 0.42) - sr * (width * 0.50)
    p_r = origin + d * (length * 0.42) + sr * (width * 0.50)
    p_tip = origin + d * length + Vector((0, 0, length * 0.14))
    b.double_poly(
        [p0, p_l, p_mid, p_r, p_tip],
        [(0, 1, 2), (1, 4, 2), (0, 2, 3), (2, 4, 3)],
        None,
        vert_colors=[cb, cm, cm, cm, ct],
        back_darken=0.82,
    )


def _root_flare_trunk(b, h_split, r_bot, r_top, bark_col, rnd, seg=7, curve=(0.0, 0.0), n_roots=5, root_len=0.72, lean_pow=1.5, hug_roots=False):
    """带自然板根与微曲的树干，返回分叉顶坐标"""
    bc = ensure_non_leaf(bark_col)
    bc_d = ensure_non_leaf(mul_col(bc, 0.76))
    n_steps = 6
    pts, rads, cols = [], [], []
    for i in range(n_steps + 1):
        t = i / n_steps
        z = h_split * t
        cx = curve[0] * (t ** lean_pow) + math.sin(t * math.pi) * curve[0] * 0.14
        cy = curve[1] * (t ** lean_pow)
        flare = 1.0 + (0.55 if hug_roots else 0.42) * ((1.0 - min(1.0, t * 4.2)) ** 2)
        r = (r_bot * (1.0 - t) + r_top * t) * flare
        pts.append(Vector((cx, cy, z)))
        rads.append(r)
        cols.append(lerp_col(bc_d, bc, 0.35 + 0.65 * t))
    b.tube(pts, rads, None, seg=seg, smooth=True, colors=cols)
    for k in range(n_roots):
        a = k / n_roots * math.tau + (rnd.random() - 0.5) * 0.40
        rl = root_len * (0.78 + rnd.random() * 0.38)
        if hug_roots:
            # 杉树紧贴树基的沟槽板根（不乱翘成章鱼脚！）
            rp0 = Vector((math.cos(a) * r_bot * 0.72, math.sin(a) * r_bot * 0.72, 1.35))
            rp1 = Vector((math.cos(a) * (r_bot * 1.10), math.sin(a) * (r_bot * 1.10), 0.42))
            rp2 = Vector((math.cos(a) * (r_bot + rl * 0.42), math.sin(a) * (r_bot + rl * 0.42), 0.0))
            b.tube([rp0, rp1, rp2], [r_bot * 0.24, r_bot * 0.30, r_bot * 0.14], bc_d, seg=5, smooth=True)
        else:
            rp0 = Vector((math.cos(a) * r_bot * 0.55, math.sin(a) * r_bot * 0.55, min(0.55, h_split * 0.16)))
            rp1 = Vector((math.cos(a) * (r_bot + rl * 0.48), math.sin(a) * (r_bot + rl * 0.48), 0.12))
            rp2 = Vector((math.cos(a) * (r_bot + rl), math.sin(a) * (r_bot + rl), 0.01))
            b.tube([rp0, rp1, rp2], [r_bot * 0.38, r_bot * 0.22, r_bot * 0.07], bc_d, seg=5, smooth=True)
    return pts[-1]


# ---------------- 1. 日本榉树（tree_keyaki / tree_keyaki_lo，对照 tree_keyaki.png） ----------------

def build_keyaki(name, seed=61, lo=False):
    b = B(seed)
    rnd = random.Random(seed)
    H = 11.2
    bark = ensure_non_leaf(KEYAKI_BARK)
    bark_l = ensure_non_leaf('#9a9284')
    c_hi = '#a6de46'
    c_mid = '#589e32'
    c_lo = '#245622'
    crown_ctr = Vector((0, 0, 7.6))
    crown_rad = (4.6, 4.6, 3.6)

    if lo:
        # 远景 _lo 版（≤ 1500 三角面）：优雅帚形树干 + 96 簇均匀圆拱立体叶云
        split = _root_flare_trunk(b, 3.6, 0.34, 0.22, bark, rnd, seg=5, n_roots=0)
        anchors = [Vector((0, 0, 9.6)), Vector((0, 0, 7.6)), Vector((0, 0, 6.4))]
        for k in range(5):
            a = k / 5.0 * math.tau + 0.3
            p1 = split + Vector((math.cos(a) * 1.25, math.sin(a) * 1.25, 2.2))
            p2 = split + Vector((math.cos(a) * 2.70, math.sin(a) * 2.70, 3.9 + (k % 2) * 0.6))
            b.tube([split, p1, p2], [0.15, 0.09, 0.035], bark, seg=4, smooth=True)
            anchors.append(p1.lerp(p2, 0.55))
            anchors.append(p2)
            anchors.append(p2 + Vector((-math.cos(a) * 0.85, -math.sin(a) * 0.85, 1.75)))
        for k in range(96):
            ap = anchors[k % len(anchors)]
            a = rnd.random() * math.tau
            dist = (rnd.random() ** 0.7) * 1.45
            pos = ap + Vector((math.cos(a) * dist, math.sin(a) * dist, (rnd.random() - 0.42) * 1.30))
            if pos.z > 9.4:
                r_xy = math.hypot(pos.x, pos.y)
                if r_xy > 2.5:
                    pos.x *= 2.5 / r_xy
                    pos.y *= 2.5 / r_xy
            pos.z = max(5.2, min(H - 0.3, pos.z))
            c_tip = _sun_shade(pos, crown_ctr, crown_rad, c_hi, c_mid, c_lo, rnd)
            c_bas = ensure_leaf_green(mul_col(c_tip, 0.56))
            _vol_tuft(b, pos, 1.32 + rnd.random() * 0.52, c_bas, c_tip, rnd, style='lo')
        return b.finish(name)

    # 英雄高细节版：优雅帚状（箒型）高耸圆拱树冠，完全由 ~920 簇立体细叶构成！
    split = _root_flare_trunk(b, 3.55, 0.37, 0.25, bark, rnd, seg=7, curve=(0.12, -0.05), n_roots=5, root_len=0.72)
    # 树冠挂叶锚点 (位置, 半径权重, 簇数)
    canopy_nodes = []

    # 6 根优雅上扬外张的帚形主枝（高低错落形成圆拱大冠！）
    n_main = 6
    for i in range(n_main):
        a = i / n_main * math.tau + (rnd.random() - 0.5) * 0.24
        high_limb = (i % 2 == 0)
        spread = (3.45 if not high_limb else 2.85) + rnd.random() * 0.45
        dz = (3.95 if not high_limb else 5.25) + rnd.random() * 0.65
        p0 = split - Vector((0, 0, 0.16))
        p1 = split + Vector((math.cos(a) * spread * 0.34, math.sin(a) * spread * 0.34, dz * 0.40))
        p2 = split + Vector((math.cos(a) * spread * 0.72, math.sin(a) * spread * 0.72, dz * 0.76))
        p3 = split + Vector((math.cos(a) * spread, math.sin(a) * spread, dz))
        b.tube([p0, p1, p2, p3], [0.16, 0.115, 0.068, 0.026], bark, seg=5, smooth=True)
        canopy_nodes.append((p3, 1.15, 22))
        canopy_nodes.append((p2 + Vector((0, 0, 0.45)), 0.95, 16))

        # 每根主枝分出 3 根二次扇形枝（一根朝内向上填满圆拱，两根向两侧舒展）
        for j in range(3):
            src = p1.lerp(p2, 0.38 + j * 0.26)
            if j == 1:
                da = a + (rnd.random() - 0.5) * 0.25
                sub_l = 1.25 + rnd.random() * 0.45
                sub_dz = 2.65 + rnd.random() * 0.65  # 高高耸起撑出丰满穹顶！
            else:
                da = a + (j - 1) * 0.68 + (rnd.random() - 0.5) * 0.22
                sub_l = 1.85 + rnd.random() * 0.65
                sub_dz = 1.45 + rnd.random() * 0.65
            m_pt = src + Vector((math.cos(da) * sub_l * 0.52, math.sin(da) * sub_l * 0.52, sub_dz * 0.56))
            e_pt = src + Vector((math.cos(da) * sub_l, math.sin(da) * sub_l, sub_dz))
            b.tube([src, m_pt, e_pt], [0.065, 0.038, 0.015], bark_l, seg=4, smooth=True)
            canopy_nodes.append((e_pt, 1.05, 20))
            canopy_nodes.append((m_pt.lerp(e_pt, 0.65), 0.85, 12))
            # 外端细枝小叉
            for side in (-1, 1):
                ta = da + side * 0.52
                tp = m_pt.lerp(e_pt, 0.60) + Vector((math.cos(ta) * 0.78, math.sin(ta) * 0.78, 0.55))
                b.tube([m_pt.lerp(e_pt, 0.60), tp], [0.024, 0.010], bark_l, seg=4, smooth=True)
                canopy_nodes.append((tp, 0.80, 10))

    # 中央两根高耸冠顶主峰枝，撑起 tree_keyaki.png 里丰满圆润的顶部穹顶！
    for k, (ox, oy, top_z) in enumerate([(-0.35, 0.15, 10.65), (0.42, -0.18, 10.25)]):
        p_mid = split + Vector((ox * 0.5, oy * 0.5, 3.2))
        p_top = Vector((ox, oy, top_z))
        b.tube([split, p_mid, p_top], [0.13, 0.075, 0.022], bark, seg=5, smooth=True)
        canopy_nodes.append((p_top, 1.35, 36))
        for m in range(4):
            ma = m * math.pi * 0.5 + k * 0.7
            tp = p_mid.lerp(p_top, 0.58) + Vector((math.cos(ma) * 1.55, math.sin(ma) * 1.55, 1.75))
            b.tube([p_mid.lerp(p_top, 0.58), tp], [0.045, 0.015], bark_l, seg=4, smooth=True)
            canopy_nodes.append((tp, 1.15, 22))

    # 铺设 ~980 簇 3D 立体细叶丛（严格控制在 15,000 三角面预算内，同时保持丰满圆拱感！）
    for ctr, rad_w, n_cl in canopy_nodes:
        n_use = max(6, int(round(n_cl * 0.72)))
        for _ in range(n_use):
            a = rnd.random() * math.tau
            r = (rnd.random() ** 0.72) * 1.05 * rad_w
            dz = (rnd.random() - 0.36) * 0.92 * rad_w
            pos = ctr + Vector((math.cos(a) * r, math.sin(a) * r, dz))
            c_tip = _sun_shade(pos, crown_ctr, crown_rad, c_hi, c_mid, c_lo, rnd)
            c_bas = ensure_leaf_green(mul_col(c_tip, 0.58))
            sc = (0.56 + rnd.random() * 0.32) * (0.85 + 0.15 * rad_w)
            _vol_tuft(b, pos, sc, c_bas, c_tip, rnd, style='broad')

    return b.finish(name)


# ---------------- 2. 日本橡树 / 栎树（tree_oak / tree_oak_lo，对照 tree_oak.png） ----------------

def build_oak(name, seed=62, lo=False):
    b = B(seed)
    rnd = random.Random(seed)
    H = 8.8
    bark = ensure_non_leaf(OAK_BARK)
    bark_d = ensure_non_leaf('#4c443a')
    c_hi = '#86b63a'
    c_mid = '#407828'
    c_lo = '#1b401a'
    crown_ctr = Vector((0, 0, 5.8))
    crown_rad = (4.5, 4.5, 3.1)

    if lo:
        # 远景 _lo 版（≤ 1500 三角面）：粗壮树干 + 96 簇立体宽冠叶云
        split = _root_flare_trunk(b, 2.5, 0.45, 0.30, bark, rnd, seg=5, curve=(0.20, 0.05), n_roots=0)
        anchors = [Vector((0, 0, 7.6)), Vector((0.6, 0.4, 6.8)), Vector((-0.6, -0.4, 6.8))]
        for k in range(5):
            a = k / 5.0 * math.tau + 0.2
            p1 = split + Vector((math.cos(a) * 2.55, math.sin(a) * 2.55, 1.9 + (k % 2) * 0.9))
            b.tube([split, split.lerp(p1, 0.5) + Vector((0, 0, 0.3)), p1], [0.19, 0.12, 0.05], bark, seg=4, smooth=True)
            anchors.append(p1)
            anchors.append(p1 + Vector((-math.cos(a) * 0.7, -math.sin(a) * 0.7, 1.5)))
        for k in range(96):
            ap = anchors[k % len(anchors)]
            a = rnd.random() * math.tau
            dist = rnd.random() * 1.48
            pos = ap + Vector((math.cos(a) * dist, math.sin(a) * dist, (rnd.random() - 0.42) * 1.25))
            pos.z = max(3.6, min(H - 0.3, pos.z))
            c_tip = _sun_shade(pos, crown_ctr, crown_rad, c_hi, c_mid, c_lo, rnd)
            c_bas = ensure_leaf_green(mul_col(c_tip, 0.52))
            _vol_tuft(b, pos, 1.25 + rnd.random() * 0.52, c_bas, c_tip, rnd, style='lo')
        return b.finish(name)

    # 英雄高细节版：苍劲扭曲主干 + 强壮扎地根系 + 水平虬曲大枝 + 浑厚圆拱层叠叶云（零几何球！）
    split = _root_flare_trunk(b, 2.55, 0.48, 0.34, bark, rnd, seg=8, curve=(0.24, -0.06), n_roots=6, root_len=1.08, lean_pow=1.3)
    cloud_pads = []

    # 6 根虬曲大枝（下层横展、中层斜上，构筑橡树厚重宽广的骨架）
    for i in range(6):
        a = i / 6.0 * math.tau + (rnd.random() - 0.5) * 0.28
        low_b = (i % 2 == 0)
        reach = (3.45 if low_b else 2.75) + rnd.random() * 0.45
        dz = (1.65 if low_b else 3.25) + rnd.random() * 0.55
        p0 = split - Vector((0, 0, 0.22 if low_b else 0.0))
        a1 = a + (rnd.random() - 0.5) * 0.30
        p1 = p0 + Vector((math.cos(a1) * reach * 0.40, math.sin(a1) * reach * 0.40, dz * 0.30 - 0.10))
        p2 = p0 + Vector((math.cos(a) * reach * 0.76, math.sin(a) * reach * 0.76, dz * 0.72 + 0.14))
        p3 = p0 + Vector((math.cos(a) * reach, math.sin(a) * reach, dz))
        b.tube([p0, p1, p2, p3], [0.22, 0.15, 0.09, 0.038], bark, seg=6, smooth=True)
        cloud_pads.append((p3, 1.32, 34))
        cloud_pads.append((p2 + Vector((0, 0, 0.60)), 1.15, 24))
        # 每根大枝再生出 2 根虬曲副枝
        for s_side in (-1, 1):
            sa = a + s_side * 0.62 + (rnd.random() - 0.5) * 0.22
            sl = 1.45 + rnd.random() * 0.48
            s_src = p1.lerp(p2, 0.62)
            s_mid = s_src + Vector((math.cos(sa) * sl * 0.55, math.sin(sa) * sl * 0.55, 0.48))
            s_end = s_src + Vector((math.cos(sa) * sl, math.sin(sa) * sl, 1.05 + rnd.random() * 0.50))
            b.tube([s_src, s_mid, s_end], [0.09, 0.052, 0.022], bark_d, seg=5, smooth=True)
            cloud_pads.append((s_end, 1.12, 22))

    # 中央浑厚树冠顶峰枝 + 4 组顶部大叶云（还原 tree_oak.png 的圆拱饱满树冠！）
    top_p = split + Vector((-0.10, 0.06, 5.15))
    b.tube([split, split + Vector((0.16, -0.06, 2.5)), top_p], [0.23, 0.135, 0.042], bark, seg=6, smooth=True)
    cloud_pads.append((top_p + Vector((0, 0, 0.30)), 1.48, 52))
    for k in range(5):
        a = k / 5.0 * math.tau + 0.35
        cloud_pads.append((top_p + Vector((math.cos(a) * 1.55, math.sin(a) * 1.55, -0.45)), 1.30, 34))

    # 铺设 ~980 簇饱满浑厚的 3D 橡树立体叶丛（完全由细叶堆叠出云团体积，彻底告别光滑圆球！）
    for pad, w, n_cl in cloud_pads:
        for _ in range(n_cl):
            a = rnd.random() * math.tau
            r = (rnd.random() ** 0.68) * 1.12 * w
            el = (rnd.random() - 0.42) * 1.15
            pos = pad + Vector((math.cos(a) * r, math.sin(a) * r, el * 0.78 * w))
            c_tip = _sun_shade(pos, crown_ctr, crown_rad, c_hi, c_mid, c_lo, rnd)
            c_bas = ensure_leaf_green(mul_col(c_tip, 0.50))
            sc = (0.56 + rnd.random() * 0.30) * (0.88 + 0.12 * w)
            _vol_tuft(b, pos, sc, c_bas, c_tip, rnd, style='broad')

    return b.finish(name)


# ---------------- 3. 日本夏日青枫 / 伊吕波枫（tree_maple，对照 tree_maple.png） ----------------

def build_maple(name, seed=63):
    b = B(seed)
    rnd = random.Random(seed)
    bark = ensure_non_leaf(MAPLE_BARK)
    bark_l = ensure_non_leaf('#9e988c')
    c_hi = '#aaea42'
    c_mid = '#5ca830'
    c_lo = '#2a6422'
    crown_ctr = Vector((0.1, 0, 4.4))
    crown_rad = (3.5, 3.5, 2.6)

    # 优美 S 形弯曲纤细树干（还原 tree_maple.png 的东方盆景感！）
    trunk_pts = [
        Vector((0.0,   0.0,  0.0)),
        Vector((0.06, -0.02, 0.65)),
        Vector((-0.18, 0.05, 1.48)),
        Vector((-0.34, 0.08, 2.38)),
        Vector((-0.10, 0.04, 3.38)),
        Vector((0.15, -0.04, 4.48)),
        Vector((0.04,  0.02, 5.48)),
        Vector((0.12,  0.04, 6.28)),
    ]
    trunk_r = [0.24, 0.16, 0.135, 0.115, 0.088, 0.062, 0.038, 0.016]
    b.tube(trunk_pts, trunk_r, bark, seg=7, smooth=True)
    for k in range(5):
        a = k / 5.0 * math.tau + 0.3
        b.tube([Vector((math.cos(a) * 0.12, math.sin(a) * 0.12, 0.22)),
                Vector((math.cos(a) * 0.44, math.sin(a) * 0.44, 0.01))],
               [0.062, 0.015], bark, seg=5, smooth=True)

    # 层次分明的水平伸展枝与饱满轻盈的青枫层云叶垫
    tier_specs = [
        (2, 0.22,  2.35, 0.65, 1.25),
        (3, 2.95,  2.45, 0.80, 1.25),
        (3, -1.35, 2.15, 0.90, 1.15),
        (4, 0.05,  2.55, 0.72, 1.30),
        (4, 1.75,  2.15, 0.85, 1.15),
        (4, -2.55, 2.20, 0.78, 1.15),
        (5, 0.35,  2.15, 0.75, 1.20),
        (5, 2.65,  1.95, 0.80, 1.15),
        (5, -1.10, 1.85, 0.82, 1.10),
        (6, 1.20,  1.45, 0.72, 1.02),
        (6, -0.55, 1.50, 0.68, 1.05),
        (6, -2.65, 1.40, 0.75, 1.00),
        (7, 0.40,  0.75, 0.42, 0.98),
        (7, 3.20,  0.75, 0.45, 0.95),
    ]
    pads = []
    for idx, ang, reach, dz, prad in tier_specs:
        src = trunk_pts[idx]
        p1 = src + Vector((math.cos(ang) * reach * 0.48, math.sin(ang) * reach * 0.48, dz * 0.62))
        p2 = src + Vector((math.cos(ang) * reach, math.sin(ang) * reach, dz))
        r0 = trunk_r[idx] * 0.68
        b.tube([src, p1, p2], [r0, r0 * 0.55, 0.015], bark_l, seg=4, smooth=True)
        pads.append((p2, prad))
        for side in (-1, 1):
            sa = ang + side * 0.56
            sp = p1.lerp(p2, 0.45) + Vector((math.cos(sa) * reach * 0.48, math.sin(sa) * reach * 0.48, 0.22 + side * 0.08))
            b.tube([p1.lerp(p2, 0.45), sp], [r0 * 0.42, 0.011], bark_l, seg=4, smooth=True)
            pads.append((sp, prad * 0.78))

    # 铺设 ~1020 簇饱满有厚度的青枫层云叶簇（较第一版加厚 2 倍，平视与俯视都轻盈茂盛！）
    for p_ctr, prad in pads:
        n_cl = int(24 * prad)
        for _ in range(n_cl):
            a = rnd.random() * math.tau
            r = math.sqrt(rnd.random()) * prad
            z_off = (1.0 - (r / prad) ** 2) * 0.34 + (rnd.random() - 0.45) * 0.34
            pos = p_ctr + Vector((math.cos(a) * r, math.sin(a) * r, z_off))
            c_tip = _sun_shade(pos, crown_ctr, crown_rad, c_hi, c_mid, c_lo, rnd)
            c_bas = ensure_leaf_green(mul_col(c_tip, 0.62))
            _vol_tuft(b, pos, 0.42 + rnd.random() * 0.22, c_bas, c_tip, rnd, style='tier')

    return b.finish(name)


# ---------------- 4. 日本杉树（tree_cedar / tree_cedar_lo，对照 tree_cedar.png） ----------------

def build_cedar(name, seed=71, lo=False):
    b = B(seed)
    rnd = random.Random(seed)
    H = 16.0
    bark = ensure_non_leaf(CEDAR_BARK)
    bark_d = ensure_non_leaf('#543422')
    c_hi = '#5c9036'
    c_mid = '#2c5e2c'
    c_lo = '#16361a'
    crown_ctr = Vector((0, 0, 10.2))
    crown_rad = (3.0, 3.0, 6.2)

    if lo:
        # 远景 _lo 版（≤ 1500 三角面）：20 层紧密交错的 9 尖角下垂上翘针叶冠（约 1200 三角面，圆润苍翠！）
        b.cyl((0, 0, 0.0), 0.36, H * 0.94, bark, seg=6, r2=0.04, smooth=True)
        n_tiers = 20
        for k in range(n_tiers):
            t = k / (n_tiers - 1)
            z = 3.85 + t * 11.65
            r_out = ((1.0 - t * 0.89) ** 0.90) * 2.80 + 0.24
            h_tier = (1.0 - t * 0.52) * 1.50
            n_pts = 9
            rot_off = k * 0.68 + rnd.random() * 0.2
            top_v = Vector((0, 0, z + h_tier))
            bot_v = Vector((0, 0, z - h_tier * 0.20))
            ring, cols_r = [], []
            c_t = _sun_shade(top_v, crown_ctr, crown_rad, c_hi, c_mid, c_lo, rnd)
            c_b = ensure_leaf_green(mul_col(c_t, 0.48))
            for i in range(n_pts * 2):
                a = rot_off + i * math.pi / n_pts
                is_tip = (i % 2 == 0)
                rr = r_out * (0.84 + rnd.random() * 0.28) if is_tip else r_out * 0.46
                zz = z - h_tier * (0.14 if is_tip else 0.04) + (0.22 * (0.35 + 0.65 * t) if is_tip else 0.0) + (rnd.random() - 0.5) * 0.14
                ring.append(Vector((math.cos(a) * rr, math.sin(a) * rr, zz)))
                cols_r.append(_sun_shade(ring[-1], crown_ctr, crown_rad, c_hi, c_mid, c_lo, rnd) if is_tip else c_b)
            verts = [top_v, bot_v] + ring
            vcs = [c_t, c_b] + cols_r
            m = n_pts * 2
            faces = []
            for i in range(m):
                ni = (i + 1) % m
                faces.append((0, 2 + i, 2 + ni))
                faces.append((1, 2 + ni, 2 + i))
            b.poly(verts, faces, None, smooth=True, vert_colors=vcs)
        b.cyl((0, 0, 15.1), 0.32, 1.15, ensure_leaf_green(c_mid), seg=6, r2=0.02)
        return b.finish(name)

    # 英雄高细节版：笔直红褐杉木主干 + 紧贴基部的沟槽板根 + 23 层茂密叠压下垂反翘针叶羽枝！
    _root_flare_trunk(b, H * 0.96, 0.36, 0.04, bark, rnd, seg=8, curve=(0.03, -0.02), n_roots=6, root_len=0.55, hug_roots=True)
    # 下部裸干 2 根小枯枝茬（对照 tree_cedar.png）
    for side, zz in ((-1, 3.62), (1, 3.82)):
        b.tube([Vector((side * 0.22, 0, zz)), Vector((side * 0.48, 0.04, zz - 0.12))], [0.028, 0.008], bark_d, seg=4)

    # 23 层茂密针叶轮生冠（宽阔叠压羽片 + 贴干内冠，绝不露空秃枝！）
    n_whorls = 23
    for w_i in range(n_whorls):
        t = w_i / (n_whorls - 1)
        z0 = 3.95 + t * 11.65
        bough_len = ((1.0 - t) ** 0.86) * 2.80 + 0.26
        n_boughs = 6 if t < 0.68 else (5 if t < 0.88 else 4)
        rot_w = w_i * 0.78 + rnd.random() * 0.25
        for k in range(n_boughs):
            a = rot_w + k / n_boughs * math.tau + (rnd.random() - 0.5) * 0.22
            L = bough_len * (0.84 + rnd.random() * 0.30)
            r_tr = 0.28 * (1.0 - z0 / H) + 0.04
            dx, dy = math.cos(a), math.sin(a)
            p0 = Vector((dx * r_tr * 0.55, dy * r_tr * 0.55, z0))
            droop = -0.34 * (1.0 - t * 0.68) * L
            tip_lift = (0.20 + 0.44 * t) * L
            p1 = Vector((dx * (r_tr + L * 0.52), dy * (r_tr + L * 0.52), z0 + droop))
            p2 = Vector((dx * (r_tr + L), dy * (r_tr + L), z0 + droop + tip_lift))

            # 沿每根大枝铺 5–6 组紧密叠压的宽阔 3D 针叶羽片（斜左右 + 微微立体翻卷）
            n_fr = 5 if t < 0.62 else (4 if t < 0.85 else 3)
            for f_i in range(n_fr):
                u = 0.08 + 0.90 * (f_i / max(1, n_fr - 1))
                bp = p0 * ((1 - u) ** 2) + p1 * (2 * (1 - u) * u) + p2 * (u ** 2)
                b_dir = ((p1 - p0) * (1 - u) + (p2 - p1) * u).normalized()
                side = b_dir.cross(Vector((0, 0, 1)))
                side = side.normalized() if side.length > 1e-4 else Vector((1, 0, 0))
                # 大幅加宽加长羽片使其连绵叠压成厚实苍翠杉枝！
                fr_l = (0.78 + (1.0 - u) * 0.62) * (0.48 + 0.52 * (1.0 - t * 0.70))
                fr_w = fr_l * 0.62
                c_tip = _sun_shade(bp + b_dir * (fr_l * 0.8), crown_ctr, crown_rad, c_hi, c_mid, c_lo, rnd)
                c_bas = ensure_leaf_green(lerp_col(c_lo, c_tip, 0.42))
                for sgn in (-1, 1):
                    fd = (b_dir * 0.74 + side * (sgn * 0.58) + Vector((0, 0, 0.08 + 0.18 * u))).normalized()
                    _cedar_plume(b, bp, fd, fr_l, fr_w, c_bas, c_tip, roll=sgn * 0.42)
                if f_i == n_fr - 1:
                    _cedar_plume(b, bp, (b_dir + Vector((0, 0, 0.30))).normalized(), fr_l * 1.18, fr_w * 0.86, c_bas, c_tip, roll=0.0)

    # 顶梢簇立针叶尖峰
    for k in range(6):
        a = k / 6.0 * math.tau
        fd = Vector((math.cos(a) * 0.24, math.sin(a) * 0.24, 0.97)).normalized()
        _cedar_plume(b, Vector((0, 0, H - 1.05)), fd, 1.15, 0.42, c_mid, c_hi, roll=0.25)

    return b.finish(name)


# ---------------- 5. 孟宗竹丛（bamboo，对照 bamboo.png） ----------------

def build_bamboo(name, seed=81):
    b = B(seed)
    rnd = random.Random(seed)
    c_culm_lo = ensure_leaf_green('#568834')
    c_culm_hi = ensure_leaf_green('#78aa42')
    c_node = ensure_non_leaf('#cacfa0')
    c_leaf_hi = '#9ed646'
    c_leaf_mid = '#60a236'
    c_leaf_lo = '#2e6424'
    crown_ctr = Vector((0, 0, 8.8))
    crown_rad = (3.5, 3.5, 4.4)

    # 柔和起伏的自然竹根苔土丘（告别生硬八角饼！）
    for k in range(7):
        a = k * 0.92
        r = 0.0 if k == 0 else (0.55 + rnd.random() * 0.45)
        b.sphere((math.cos(a) * r, math.sin(a) * r, 0.05), 0.55 if k == 0 else 0.40,
                 ensure_non_leaf('#7c7656') if k % 2 == 0 else ensure_leaf_green('#5a7638'),
                 sub=1, scale=(1.55, 1.45, 0.22), smooth=False, jitter=0.08)

    # 22 根纤细修长、向外优雅弧弯的带节竹竿
    n_culms = 22
    twig_sites = []
    for k in range(n_culms):
        ang = k * 2.39996 + (rnd.random() - 0.5) * 0.35
        dist0 = math.sqrt((k + 0.5) / n_culms) * 1.02
        x0, y0 = math.cos(ang) * dist0, math.sin(ang) * dist0
        h = 9.4 + rnd.random() * 4.4
        out_lean = 0.78 + dist0 * 1.18 + rnd.random() * 0.85
        lean = Vector((math.cos(ang) * out_lean, math.sin(ang) * out_lean, 0.0))
        r0 = 0.044 + rnd.random() * 0.016
        r1 = 0.012
        segs = 7
        pts, rads, cols = [], [], []
        for i in range(segs + 1):
            t = i / segs
            p = Vector((x0, y0, 0.0)) + lean * (t ** 1.85) + Vector((0, 0, h * t))
            pts.append(p)
            rads.append(r0 * (1.0 - t) + r1 * t)
            cols.append(ensure_leaf_green(lerp_col(c_culm_lo, c_culm_hi, 0.25 + 0.65 * t)))
        b.tube(pts, rads, None, seg=5, smooth=True, colors=cols)

        for i in range(1, segs):
            t = i / segs
            p_n = pts[i]
            rn = rads[i] * 1.24
            tan = (pts[i + 1] - pts[i - 1]).normalized()
            b.tube([p_n - tan * 0.025, p_n + tan * 0.025], [rn, rn], c_node, seg=5, smooth=False, cap_start=False, cap_end=False)
            if t >= 0.48:
                n_tw = 2 if t > 0.62 else 1
                for j in range(n_tw):
                    ta = ang + (j - 0.5) * 1.35 + (rnd.random() - 0.5) * 0.9
                    tl = 0.85 + rnd.random() * 0.95 * (1.15 - t * 0.35)
                    t_end = p_n + Vector((math.cos(ta) * tl, math.sin(ta) * tl, tl * (0.32 + rnd.random() * 0.22)))
                    b.tube([p_n, p_n.lerp(t_end, 0.55) + Vector((0, 0, 0.08)), t_end], [0.011, 0.007, 0.004], c_culm_lo, seg=3, smooth=False)
                    twig_sites.append((p_n.lerp(t_end, 0.60), Vector((math.cos(ta), math.sin(ta), 0.15)).normalized()))
                    twig_sites.append((t_end, Vector((math.cos(ta), math.sin(ta), 0.05)).normalized()))
        twig_sites.append((pts[-1], (pts[-1] - pts[-2]).normalized()))

    # 轻盈羽毛状披针形竹叶丛
    for site, s_dir in twig_sites:
        for _ in range(2):
            base_p = site + Vector(((rnd.random() - 0.5) * 0.32, (rnd.random() - 0.5) * 0.32, (rnd.random() - 0.5) * 0.24))
            c_tip = _sun_shade(base_p, crown_ctr, crown_rad, c_leaf_hi, c_leaf_mid, c_leaf_lo, rnd)
            c_bas = ensure_leaf_green(mul_col(c_tip, 0.64))
            a0 = math.atan2(s_dir.y, s_dir.x) + (rnd.random() - 0.5) * 1.4
            for b_i in range(3):
                a = a0 + (b_i - 1) * 0.52 + (rnd.random() - 0.5) * 0.22
                L = 0.56 + rnd.random() * 0.32
                W = 0.14 + rnd.random() * 0.05
                elev = 0.05 - rnd.random() * 0.38
                d = Vector((math.cos(a) * math.cos(elev), math.sin(a) * math.cos(elev), math.sin(elev)))
                side = d.cross(Vector((0, 0, 1)))
                side = side.normalized() if side.length > 1e-4 else Vector((1, 0, 0))
                up = side.cross(d).normalized()
                p0 = base_p
                p1 = base_p + d * (L * 0.38) - side * (W * 0.5) + up * (W * 0.18)
                p2 = base_p + d * L - Vector((0, 0, L * 0.22))
                p3 = base_p + d * (L * 0.38) + side * (W * 0.5) + up * (W * 0.18)
                b.double_poly([p0, p1, p2, p3], [(0, 1, 2), (0, 2, 3)], None, vert_colors=[c_bas, c_tip, c_tip, c_tip], back_darken=0.86)

    return b.finish(name)


# ---------------- 6. 盛夏向日葵（sunflower，对照 sunflower.png） ----------------

def build_sunflower(name, seed=91):
    b = B(seed)
    rnd = random.Random(seed)
    c_stem_lo = ensure_leaf_green('#4c802a')
    c_stem_hi = ensure_leaf_green('#6ea63a')
    c_leaf_d  = ensure_leaf_green('#407826')
    c_leaf_m  = ensure_leaf_green('#62a034')
    c_leaf_l  = ensure_leaf_green('#86be44')

    # 1) 自然微弯的粗壮绿茎
    stem_pts = [
        Vector((0.0,   0.0,   0.0)),
        Vector((0.015, 0.005, 0.30)),
        Vector((0.025, 0.010, 0.65)),
        Vector((0.005, 0.005, 1.00)),
        Vector((-0.015, -0.010, 1.32)),
        Vector((-0.010, -0.030, 1.56)),
        Vector((0.0,   -0.065, 1.66)),
    ]
    stem_r = [0.028, 0.025, 0.023, 0.021, 0.019, 0.017, 0.022]
    stem_c = [lerp_col(c_stem_lo, c_stem_hi, i / 6.0) for i in range(7)]
    b.tube(stem_pts, stem_r, None, seg=7, smooth=True, colors=stem_c)

    # 2) 6 片宽大舒展、优雅斜垂的心形向日葵叶（明确低于花盘，正面看叶片大而舒展，还原 sunflower.png！）
    leaf_specs = [
        (0.20, -0.35, 0.36),  # 前右下大叶
        (0.32,  2.70, 0.38),  # 左下大叶
        (0.45, -0.95, 0.34),  # 右前中叶
        (0.56,  1.25, 0.34),  # 后左中叶
        (0.67,  3.25, 0.32),  # 左上中叶
        (0.75,  0.40, 0.30),  # 右上叶（偏侧后绝不挡住花盘！）
    ]
    for t, a, sz in leaf_specs:
        idx_f = t * (len(stem_pts) - 1)
        i0 = min(len(stem_pts) - 2, int(idx_f))
        orig = stem_pts[i0].lerp(stem_pts[i0 + 1], idx_f - i0)
        dx, dy = math.cos(a), math.sin(a)
        dir_xy = Vector((dx, dy, 0.0))
        side = Vector((-dy, dx, 0.0))
        pet_end = orig + dir_xy * (sz * 0.36) + Vector((0, 0, sz * 0.22))
        b.tube([orig, orig.lerp(pet_end, 0.5) + Vector((0, 0, 0.025)), pet_end], [0.010, 0.008, 0.006], c_stem_hi, seg=4)

        # 心形叶片自然向下垂展约 32°，使宽阔心形叶面在平视/3/4 视角下完整呈现！
        p_b  = pet_end
        p_m1 = pet_end + dir_xy * (sz * 0.28) + Vector((0, 0, -sz * 0.05))
        p_m2 = pet_end + dir_xy * (sz * 0.62) + Vector((0, 0, -sz * 0.22))
        p_tp = pet_end + dir_xy * (sz * 0.94) + Vector((0, 0, -sz * 0.44))

        p_l0 = pet_end - dir_xy * (sz * 0.08) - side * (sz * 0.28) + Vector((0, 0, sz * 0.04))
        p_r0 = pet_end - dir_xy * (sz * 0.08) + side * (sz * 0.28) + Vector((0, 0, sz * 0.04))
        p_l1 = p_m1 - side * (sz * 0.48) + Vector((0, 0, -sz * 0.02))
        p_r1 = p_m1 + side * (sz * 0.48) + Vector((0, 0, -sz * 0.02))
        p_l2 = p_m2 - side * (sz * 0.30) + Vector((0, 0, -sz * 0.04))
        p_r2 = p_m2 + side * (sz * 0.30) + Vector((0, 0, -sz * 0.04))

        lverts = [p_b, p_m1, p_m2, p_tp, p_l0, p_l1, p_l2, p_r0, p_r1, p_r2]
        lcols  = [c_leaf_d, c_leaf_m, c_leaf_m, c_leaf_l, c_leaf_m, c_leaf_l, c_leaf_l, c_leaf_m, c_leaf_l, c_leaf_l]
        lfaces = [
            (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 3),
            (0, 1, 8, 7), (1, 2, 9, 8), (2, 3, 9),
        ]
        b.double_poly(lverts, lfaces, None, smooth=True, vert_colors=lcols, back_darken=0.82)

    # 3) 向日葵大花盘
    fc = Vector((0.0, -0.095, 1.69))
    tilt = math.radians(-10.0)
    R_head = Matrix.Rotation(tilt, 3, 'X')

    def to_head(local_p):
        return fc + R_head @ Vector(local_p)

    seg_h = 16
    calyx_verts = [to_head((0, 0.065, 0))]
    calyx_cols = [c_leaf_d]
    for r_ring, y_off, col in [(0.11, 0.042, c_leaf_m), (0.145, 0.008, c_leaf_m)]:
        for i in range(seg_h):
            a = i / seg_h * math.tau
            calyx_verts.append(to_head((math.cos(a) * r_ring, y_off, math.sin(a) * r_ring)))
            calyx_cols.append(col)
    cf = []
    for i in range(seg_h):
        ni = (i + 1) % seg_h
        cf.append((0, 1 + ni, 1 + i))
        cf.append((1 + i, 1 + ni, 1 + seg_h + ni, 1 + seg_h + i))
    b.poly(calyx_verts, cf, None, smooth=True, vert_colors=calyx_cols)

    for k in range(14):
        a = k / 14.0 * math.tau + 0.12
        ca, sa = math.cos(a), math.sin(a)
        p0 = to_head((ca * 0.12, 0.015, sa * 0.12))
        p1 = to_head((ca * 0.18 - sa * 0.032, 0.012, sa * 0.18 + ca * 0.032))
        p2 = to_head((ca * 0.255, 0.032, sa * 0.255))
        p3 = to_head((ca * 0.18 + sa * 0.032, 0.012, sa * 0.18 - ca * 0.032))
        b.double_poly([p0, p1, p2, p3], [(0, 1, 2), (0, 2, 3)], None, vert_colors=[c_leaf_d, c_leaf_m, c_leaf_l, c_leaf_m])

    c_core_d = ensure_non_leaf('#321d0e')
    c_core_m = ensure_non_leaf('#4e2c14')
    c_pollen = ensure_non_leaf('#ba7616')
    disc_verts = [to_head((0, -0.050, 0))]
    disc_cols = [c_core_d]
    rings_d = [
        (0.055, -0.044, c_core_d),
        (0.095, -0.042, c_pollen),
        (0.130, -0.022, c_core_m),
        (0.145,  0.008, c_core_d),
    ]
    for rr, yy, col in rings_d:
        for i in range(seg_h):
            a = i / seg_h * math.tau
            disc_verts.append(to_head((math.cos(a) * rr, yy, math.sin(a) * rr)))
            disc_cols.append(col)
    df = []
    for i in range(seg_h):
        ni = (i + 1) % seg_h
        df.append((0, 1 + i, 1 + ni))
    for ir in range(len(rings_d) - 1):
        r0 = 1 + ir * seg_h
        r1 = 1 + (ir + 1) * seg_h
        for i in range(seg_h):
            ni = (i + 1) % seg_h
            df.append((r0 + i, r1 + i, r1 + ni, r0 + ni))
    b.poly(disc_verts, df, None, smooth=True, vert_colors=disc_cols)

    c_pet_base = ensure_non_leaf('#ea9c12')
    c_pet_mid  = ensure_non_leaf('#ffd020')
    c_pet_tip  = ensure_non_leaf('#ffea58')
    for layer, (n_pet, r_in, r_len, y_off, a_off, bend) in enumerate([
        (18, 0.122, 0.152, -0.012, 0.0,                 -0.016),
        (18, 0.128, 0.170,  0.004, math.pi / 18.0,       0.014),
    ]):
        for k in range(n_pet):
            a = a_off + k / n_pet * math.tau + (rnd.random() - 0.5) * 0.04
            ca, sa = math.cos(a), math.sin(a)
            pw = 0.036 if layer == 0 else 0.040
            L = r_len * (0.94 + rnd.random() * 0.12)
            p0 = to_head((ca * r_in, y_off, sa * r_in))
            p_mid = to_head((ca * (r_in + L * 0.52), y_off + bend * 0.35 - 0.008, sa * (r_in + L * 0.52)))
            p_l = to_head((ca * (r_in + L * 0.48) - sa * pw, y_off + bend * 0.5, sa * (r_in + L * 0.48) + ca * pw))
            p_r = to_head((ca * (r_in + L * 0.48) + sa * pw, y_off + bend * 0.5, sa * (r_in + L * 0.48) - ca * pw))
            p_tip = to_head((ca * (r_in + L), y_off + bend * 1.4, sa * (r_in + L)))
            b.double_poly(
                [p0, p_l, p_mid, p_r, p_tip],
                [(0, 1, 2), (1, 4, 2), (0, 2, 3), (2, 4, 3)],
                None,
                vert_colors=[c_pet_base, c_pet_mid, c_pet_mid, c_pet_mid, c_pet_tip],
                back_darken=0.88,
            )

    return b.finish(name)
