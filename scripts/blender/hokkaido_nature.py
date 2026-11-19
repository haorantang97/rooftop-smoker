# 北海道冬季树木高细节 + 远景 _lo 低面数建模（二次打磨版）：
# todomatsu (压满蓬松厚雪的冷杉) / birch (繁茂细密冬日枯枝白桦) / larch (垂展细枝冬日落叶松) 及各自 _lo 版
import math, random
from mathutils import Vector, Matrix
from inaka_core import (
    B, srgb, lerp_col, mul_col, vary, ensure_leaf_green, ensure_non_leaf,
)
from vista_common import SNOW_W, SNOW_M, SNOW_S, snow_col


def _snow_puff(b, center, rad_x, rad_y, rad_z, rot_z=0.0):
    """一块柔和微扁的立体雪垫（12 顶点 / 20 三角面，圆润饱满无尖锐花瓣感）"""
    c = Vector(center)
    R = Matrix.Rotation(rot_z, 3, 'Z')
    # 顶顶点 + 上环(6) + 中腰环(6) + 底顶点
    verts = [c + Vector((0, 0, rad_z))]
    vcs = [snow_col(1.0)]
    for ring_k, (rk, zk, sh) in enumerate([(0.72, 0.62, 0.90), (1.00, 0.05, 0.68)]):
        for i in range(6):
            a = i / 6.0 * math.tau + ring_k * 0.2
            p = R @ Vector((math.cos(a) * rad_x * rk, math.sin(a) * rad_y * rk, rad_z * zk))
            verts.append(c + p)
            vcs.append(snow_col(sh))
    verts.append(c + Vector((0, 0, -rad_z * 0.32)))
    vcs.append(snow_col(0.32))
    faces = []
    for i in range(6):
        ni = (i + 1) % 6
        faces.append((0, 1 + i, 1 + ni))
        faces.append((1 + i, 7 + i, 7 + ni, 1 + ni))
        faces.append((13, 7 + ni, 7 + i))
    b.poly(verts, faces, None, smooth=True, vert_colors=vcs)


def _fir_needle_spray(b, origin, dir_vec, length, width, col_base, col_tip, roll=0.0):
    """一片深冷杉绿立体人字针叶羽片（双面，严格满足 softFoliage 绿叶判定 g > 1.1r && g > b）"""
    d = dir_vec.normalized()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-4:
        side = Vector((1, 0, 0))
    side.normalize()
    u = side.cross(d).normalized()
    sr = side * math.cos(roll) + u * math.sin(roll)
    ur = -side * math.sin(roll) + u * math.cos(roll)
    cb = ensure_leaf_green(col_base)
    ct = ensure_leaf_green(col_tip)
    cm = ensure_leaf_green(lerp_col(cb, ct, 0.55))
    p0 = origin
    p_mid = origin + d * (length * 0.48) + ur * (width * 0.22)
    p_l = origin + d * (length * 0.44) - sr * (width * 0.50)
    p_r = origin + d * (length * 0.44) + sr * (width * 0.50)
    p_tip = origin + d * length - Vector((0, 0, length * 0.06))
    b.double_poly(
        [p0, p_l, p_mid, p_r, p_tip],
        [(0, 1, 2), (1, 4, 2), (0, 2, 3), (2, 4, 3)],
        None,
        vert_colors=[cb, cm, cm, cm, ct],
        back_darken=0.80,
    )


# ---------------- 1. 压满雪的冷杉 todomatsu / todomatsu_lo（对照 todomatsu.png） ----------------

def build_todomatsu(name='todomatsu', seed=121, lo=False):
    b = B(seed)
    rnd = random.Random(seed)
    H = 11.2
    bark = ensure_non_leaf('#46382e')
    bark_d = ensure_non_leaf('#32261e')
    needle_lo = '#163a28'
    needle_mid = '#245238'
    needle_hi = '#366e4a'

    if lo:
        # 远景 _lo 版（≤ 1500 三角面）：11 层紧密交错重叠的冷杉雪冠（无缝隙、圆润自然！）
        b.cyl((0, 0, 0.0), 0.24, H * 0.88, bark, seg=6, r2=0.04, smooth=True)
        n_tiers = 11
        for t_i in range(n_tiers):
            frac = t_i / (n_tiers - 1)
            zc = 1.40 + frac * (H - 2.25)
            rad = (2.65 * ((1.0 - frac) ** 0.88) + 0.34) * (0.94 + rnd.random() * 0.12)
            th = 1.60 * (1.0 - frac * 0.45) + 0.35
            n_pts = 7
            rot0 = t_i * 0.88 + rnd.random() * 0.25
            # 深冷杉绿下裙（外探明显，保证绿叶占比）
            g_verts = [Vector((0, 0, zc + th * 0.72))]
            g_cols = [ensure_leaf_green(needle_mid)]
            for k in range(n_pts * 2):
                a = rot0 + k * math.pi / n_pts
                jit = 0.88 + rnd.random() * 0.24
                rr = rad * (1.06 if k % 2 == 0 else 0.72) * jit
                dz = -th * 0.26 if k % 2 == 0 else -th * 0.10
                g_verts.append(Vector((math.cos(a) * rr, math.sin(a) * rr, zc + dz)))
                g_cols.append(ensure_leaf_green(needle_hi if k % 2 == 0 else needle_lo))
            g_verts.append(Vector((0, 0, zc - th * 0.18)))
            g_cols.append(ensure_leaf_green(needle_lo))
            m = n_pts * 2
            bot_idx = m + 1
            g_faces = []
            for k in range(m):
                nk = (k + 1) % m
                g_faces.append((0, 1 + k, 1 + nk))
                g_faces.append((bot_idx, 1 + nk, 1 + k))
            b.poly(g_verts, g_faces, None, smooth=False, vert_colors=g_cols)

            # 圆润雪帽（双层隆起，柔和饱满覆盖绿裙上表面）
            s_verts = [Vector((0, 0, zc + th * 0.86))]
            s_cols = [snow_col(1.0)]
            for k in range(n_pts * 2):
                a = rot0 + k * math.pi / n_pts
                rr = rad * (0.94 if k % 2 == 0 else 0.64)
                dz = -th * 0.04 if k % 2 == 0 else th * 0.08
                s_verts.append(Vector((math.cos(a) * rr, math.sin(a) * rr, zc + dz)))
                s_cols.append(snow_col(0.84 if k % 2 == 0 else 0.65))
            s_faces = [(0, 1 + k, 1 + (k + 1) % m) for k in range(m)]
            b.poly(s_verts, s_faces, None, smooth=True, vert_colors=s_cols)
        # 顶部饱满小雪尖无缝衔接最高层
        b.lathe((0, 0, H - 1.25), [(0.44, 0.0), (0.28, 0.55), (0.12, 0.96), (0.02, 1.28)], SNOW_W, seg=7, smooth=True)
        return b.finish(name)

    # 英雄高细节版（≤ 12,000 三角面）：横向层叠蓬松雪云垫 + 下缘丰茂探出的深绿冷杉羽枝！
    t_pts, t_rads, t_cols = [], [], []
    for i in range(9):
        t = i / 8.0
        flare = 1.0 + 0.55 * ((1.0 - min(1.0, t * 5.0)) ** 2)
        t_pts.append(Vector((math.sin(t * 2.1) * 0.07, math.cos(t * 1.8) * 0.05, t * (H - 0.45))))
        t_rads.append((0.26 * (1.0 - t) + 0.03 * t) * flare)
        t_cols.append(lerp_col(bark_d, bark, 0.3 + 0.7 * t))
    b.tube(t_pts, t_rads, None, seg=7, smooth=True, colors=t_cols)

    n_whorls = 15
    for w_i in range(n_whorls):
        frac = w_i / (n_whorls - 1)
        zc = 1.45 + frac * (H - 2.25)
        base_len = (2.95 * ((1.0 - frac) ** 0.85) + 0.45) * (0.92 + rnd.random() * 0.16)
        n_boughs = 7 if frac < 0.40 else (6 if frac < 0.75 else 5)
        a_off = w_i * 1.27 + rnd.random() * 0.30
        for k in range(n_boughs):
            a = a_off + k / n_boughs * math.tau + (rnd.random() - 0.5) * 0.24
            bl = base_len * (0.85 + rnd.random() * 0.28)
            # 冷杉横展舒缓下垂（不要过陡像垂柳，对照 todomatsu.png 横向舒展层层托雪！）
            droop = 0.18 + 0.14 * (1.0 - frac)
            orig = Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, zc + (rnd.random() - 0.5) * 0.14))
            dir_xy = Vector((math.cos(a), math.sin(a), 0.0))
            side = Vector((-math.sin(a), math.cos(a), 0.0))
            tip = orig + dir_xy * bl - Vector((0, 0, bl * droop))
            if frac < 0.65:
                b.seg(orig, orig.lerp(tip, 0.52), 0.044 * (1.0 - frac * 0.5), 0.044 * (1.0 - frac * 0.5), bark_d)

            c_b = lerp_col(needle_lo, needle_mid, frac * 0.5)
            c_t = lerp_col(needle_mid, needle_hi, 0.35 + frac * 0.55)
            # 枝条下方与左右探出丰茂深绿冷杉羽片（每枝 3~4 片）
            _fir_needle_spray(b, orig.lerp(tip, 0.22) - Vector((0, 0, 0.07)), (tip - orig).normalized(), bl * 0.94, bl * 0.52, c_b, c_t, roll=0.0)
            for sgn in (-1, 1):
                sp_o = orig.lerp(tip, 0.34) - Vector((0, 0, 0.05))
                sp_d = (dir_xy * 0.72 + side * (sgn * 0.68) - Vector((0, 0, droop * 0.7))).normalized()
                _fir_needle_spray(b, sp_o, sp_d, bl * 0.68, bl * 0.40, c_b, c_t, roll=sgn * 0.18)

            # 枝条上表面堆叠 2 个横向圆润蓬松雪团枕（连成一片片厚实横向积雪层，告别尖花瓣！）
            p_in = orig.lerp(tip, 0.42) + Vector((0, 0, 0.12))
            p_out = orig.lerp(tip, 0.76) + Vector((0, 0, 0.07))
            sh_b = 0.22 + 0.14 * (1.0 - frac)
            _snow_puff(b, p_in, bl * 0.36, bl * 0.30, sh_b, rot_z=a)
            _snow_puff(b, p_out, bl * 0.28, bl * 0.34, sh_b * 0.82, rot_z=a + 0.25)

    # 树顶尖梢（细密针叶 + 蓬松白雪顶）
    for k in range(6):
        a = k / 6.0 * math.tau
        _fir_needle_spray(b, Vector((0, 0, H - 1.15)), Vector((math.cos(a) * 0.42, math.sin(a) * 0.42, 0.80)), 0.82, 0.36, needle_mid, needle_hi)
    _snow_puff(b, (0, 0, H - 0.65), 0.38, 0.38, 0.42)
    b.lathe((0, 0, H - 0.65), [(0.24, 0.0), (0.14, 0.38), (0.015, 0.74)], SNOW_W, seg=7, smooth=True)

    return b.finish(name)


# ---------------- 2. 落叶白桦 birch / birch_lo（纯白黑斑树皮 + 繁茂蕾丝冬日细枝，对照 birch.png） ----------------

def _birch_bark_tube(b, pts, radii, rnd, seg=7, white_start_z=0.85):
    pts = [Vector(p) for p in pts]
    cols = []
    for p in pts:
        if p.z < white_start_z:
            k = max(0.0, p.z / max(0.1, white_start_z))
            c = lerp_col('#24201e', '#ecebe6', k ** 1.35)
        else:
            c = '#f7f6f2' if rnd.random() > 0.22 else '#e2e0da'
        cols.append(ensure_non_leaf(c))
    b.tube(pts, radii, None, seg=seg, smooth=True, colors=cols)

    # 紧贴白皮表面的横向深黑树皮皮孔条与黑节斑（白桦核心辨识度）
    n = len(pts)
    for idx in range(n - 1):
        p0, p1 = pts[idx], pts[idx + 1]
        if p1.z < white_start_z * 0.85:
            continue
        r0, r1 = radii[idx], radii[idx + 1]
        if r0 < 0.042:
            continue
        t_dir = (p1 - p0).normalized()
        ref = Vector((1, 0, 0)) if abs(t_dir.x) < 0.9 else Vector((0, 1, 0))
        u = t_dir.cross(ref).normalized()
        v = t_dir.cross(u).normalized()
        n_marks = 4 if r0 > 0.09 else 2
        for _ in range(n_marks):
            f = rnd.random()
            pm = p0.lerp(p1, f)
            rm = (r0 * (1.0 - f) + r1 * f) * 1.035
            a0 = rnd.random() * math.tau
            span = 0.65 + rnd.random() * 0.95
            h_m = 0.036 + rnd.random() * 0.050
            m_verts = []
            for k in range(4):
                aa = a0 + (k / 3.0 - 0.5) * span
                rad_v = (u * math.cos(aa) + v * math.sin(aa)) * rm
                m_verts.append(pm + rad_v - t_dir * (h_m * 0.5))
                m_verts.append(pm + rad_v + t_dir * (h_m * 0.5))
            m_faces = [(k * 2, (k + 1) * 2, (k + 1) * 2 + 1, k * 2 + 1) for k in range(3)]
            b.double_poly(m_verts, m_faces, ensure_non_leaf('#221f1e'))


def build_birch(name='birch', seed=122, lo=False):
    b = B(seed)
    rnd = random.Random(seed)
    H = 10.8
    twig_dark = ensure_non_leaf('#443934')
    twig_mid = ensure_non_leaf('#5c4f48')
    twig_tip = ensure_non_leaf('#746760')

    # 1) 修长纸白白桦主干（底部深褐粗糙树皮 + 中上部纯白黑斑）
    n_t = 9 if lo else 13
    t_pts, t_rads = [], []
    for i in range(n_t):
        t = i / (n_t - 1)
        cx = math.sin(t * 2.7) * 0.22 + (t ** 2) * 0.14
        cy = math.cos(t * 2.1) * 0.12 - 0.12
        flare = 1.0 + 0.62 * ((1.0 - min(1.0, t * 5.8)) ** 2)
        t_pts.append(Vector((cx, cy, t * H * 0.92)))
        t_rads.append((0.21 * (1.0 - t) + 0.022 * t) * flare)
    _birch_bark_tube(b, t_pts, t_rads, rnd, seg=5 if lo else 8, white_start_z=1.05)

    # 2) 从 z=2.8m 向上舒展密集的冬日枯枝与垂梢
    n_main = 14 if lo else 22
    for i in range(n_main):
        frac = i / max(1, n_main - 1)
        idx_f = (0.26 + frac * 0.68) * (n_t - 1)
        i0 = min(n_t - 2, int(idx_f))
        orig = t_pts[i0].lerp(t_pts[i0 + 1], idx_f - i0)
        a = i * 2.39996 + (rnd.random() - 0.5) * 0.42
        bl = (2.75 * (1.0 - frac * 0.54) + 0.72) * (0.85 + rnd.random() * 0.28)
        elev = 0.55 + frac * 0.40 + (rnd.random() - 0.5) * 0.14
        d_xy = Vector((math.cos(a), math.sin(a), 0.0))
        p1 = orig + d_xy * (bl * 0.36) + Vector((0, 0, bl * elev * 0.54))
        p2 = orig + d_xy * (bl * 0.74) + Vector((0, 0, bl * elev * 0.90))
        p3 = orig + d_xy * bl + Vector((0, 0, bl * elev * 0.92 - 0.22 * (1.0 - frac)))
        r0 = 0.068 * (1.0 - frac * 0.62)
        c0 = ensure_non_leaf('#ecebe6' if r0 > 0.040 else twig_dark)
        b.tube([orig, p1, p2, p3], [r0, r0 * 0.60, r0 * 0.34, 0.010], None, seg=3 if lo else 4, smooth=True, colors=[c0, twig_dark, twig_mid, twig_tip])

        if lo:
            # 低面数版（~1,250 面）：每主枝配 3 根错落小枝，保持丰满冬日树冠剪影！
            for j in range(3):
                u = 0.32 + j * 0.26
                src = orig.lerp(p2, u)
                sgn = 1 if j % 2 == 0 else -1
                sa = a + sgn * (0.50 + rnd.random() * 0.28)
                sl = bl * (0.48 - j * 0.06)
                ep = src + Vector((math.cos(sa) * sl, math.sin(sa) * sl, sl * (0.30 + frac * 0.30) - 0.10))
                b.tube([src, ep], [max(0.012, r0 * 0.36), 0.006], twig_mid, seg=3)
            continue

        # 英雄版（~8,500 面）：三层交错蕾丝状细密冬日垂梢，高度还原 birch.png！
        n_sub = 5 if frac < 0.65 else 4
        for j in range(n_sub):
            u = 0.22 + 0.68 * (j / max(1, n_sub - 1))
            src = orig.lerp(p2, u) if u < 0.65 else p2.lerp(p3, (u - 0.65) / 0.35)
            sgn = 1 if j % 2 == 0 else -1
            sa = a + sgn * (0.42 + rnd.random() * 0.45)
            sl = bl * (0.48 + rnd.random() * 0.24) * (1.0 - u * 0.30)
            sm = src + Vector((math.cos(sa) * sl * 0.54, math.sin(sa) * sl * 0.54, sl * (0.38 + frac * 0.24)))
            se = src + Vector((math.cos(sa) * sl, math.sin(sa) * sl, sl * (0.20 + frac * 0.28) - 0.22))
            b.tube([src, sm, se], [max(0.015, r0 * 0.42), max(0.009, r0 * 0.22), 0.005], twig_mid, seg=3)
            # 每根二级枝长出 3 根细柔外弧垂梢！
            for t_k in range(3):
                ts = src.lerp(sm, 0.7) if t_k == 0 else sm.lerp(se, 0.35 + 0.45 * (t_k - 1))
                ta = sa + (1 if t_k % 2 == 0 else -1) * (0.32 + rnd.random() * 0.42)
                tl = 0.58 + rnd.random() * 0.54
                tm = ts + Vector((math.cos(ta) * tl * 0.52, math.sin(ta) * tl * 0.52, 0.06 + rnd.random() * 0.14))
                te = ts + Vector((math.cos(ta) * tl, math.sin(ta) * tl, -0.32 + frac * 0.38))
                b.tube([ts, tm, te], [0.009, 0.006, 0.0035], twig_tip, seg=3)

    # 树顶高耸细枝梢
    top_p = t_pts[-1]
    for k in range(4 if lo else 6):
        a = k * (math.tau / (4 if lo else 6)) + 0.3
        ep = top_p + Vector((math.cos(a) * 0.62, math.sin(a) * 0.62, 1.15 + rnd.random() * 0.38))
        b.tube([top_p, top_p.lerp(ep, 0.5) + Vector((0, 0, 0.14)), ep], [0.022, 0.012, 0.005], twig_mid, seg=3)

    return b.finish(name)


# ---------------- 3. 落叶落叶松 larch / larch_lo（笔直灰褐干 + 分层微垂上翘细密冬枝，对照 larch.png） ----------------

def build_larch(name='larch', seed=123, lo=False):
    b = B(seed)
    rnd = random.Random(seed)
    H = 12.2
    bark_d = ensure_non_leaf('#584d45')
    bark_m = ensure_non_leaf('#766b62')
    bark_l = ensure_non_leaf('#8e8278')
    twig_c = ensure_non_leaf('#82776e')

    # 1) 笔直挺拔灰褐主干（底端微张板根）
    n_t = 8 if lo else 11
    t_pts, t_rads, t_cols = [], [], []
    for i in range(n_t):
        t = i / (n_t - 1)
        flare = 1.0 + 0.68 * ((1.0 - min(1.0, t * 5.8)) ** 2)
        t_pts.append(Vector((math.sin(t * 1.8) * 0.05, math.cos(t * 1.6) * 0.04, t * (H - 0.12))))
        t_rads.append((0.25 * (1.0 - t) + 0.018 * t) * flare)
        t_cols.append(lerp_col(bark_d, bark_m, 0.25 + 0.75 * t))
    b.tube(t_pts, t_rads, None, seg=5 if lo else 7, smooth=True, colors=t_cols)

    # 2) 圆锥形分层平展微垂落叶松枯枝
    n_whorls = 11 if lo else 17
    for w_i in range(n_whorls):
        frac = w_i / max(1, n_whorls - 1)
        zc = 2.25 + frac * (H - 3.05)
        max_len = (2.85 * ((1.0 - frac) ** 0.90) + 0.36)
        n_b = (4 if frac < 0.68 else 3) if lo else (6 if frac < 0.60 else (5 if frac < 0.85 else 4))
        a_off = w_i * 1.41 + rnd.random() * 0.30
        for k in range(n_b):
            a = a_off + k / n_b * math.tau + (rnd.random() - 0.5) * 0.28
            bl = max_len * (0.80 + rnd.random() * 0.32)
            d_xy = Vector((math.cos(a), math.sin(a), 0.0))
            orig = Vector((math.cos(a) * 0.05, math.sin(a) * 0.05, zc + (rnd.random() - 0.5) * 0.16))
            p1 = orig + d_xy * (bl * 0.45) - Vector((0, 0, bl * (0.18 - 0.10 * frac)))
            p2 = orig + d_xy * (bl * 0.82) - Vector((0, 0, bl * (0.14 - 0.14 * frac)))
            p3 = orig + d_xy * bl + Vector((0, 0, bl * (0.04 + 0.18 * frac)))
            r0 = 0.046 * (1.0 - frac * 0.65) + 0.010
            b.tube([orig, p1, p2, p3], [r0, r0 * 0.60, r0 * 0.32, 0.007], bark_l, seg=3)

            if lo:
                if frac < 0.78:
                    for side_i in (0, 1):
                        sgn = 1 if (k + w_i + side_i) % 2 == 0 else -1
                        src = p1 if side_i == 0 else p1.lerp(p2, 0.55)
                        sa = a + sgn * 0.55
                        sl = bl * (0.44 if side_i == 0 else 0.32)
                        ep = src + Vector((math.cos(sa) * sl, math.sin(sa) * sl, -0.06 + frac * 0.12))
                        b.tube([src, ep], [max(0.008, r0 * 0.38), 0.005], twig_c, seg=3)
                continue

            # 英雄版：沿每根主枝交替生出羽状细密冬日小枝 + 末端分叉细梢（~8,800 面）
            n_tw = 5 if frac < 0.55 else (4 if frac < 0.82 else 2)
            for j in range(n_tw):
                u = 0.22 + 0.66 * (j / max(1, n_tw - 1))
                src = orig.lerp(p2, u)
                sgn = 1 if j % 2 == 0 else -1
                sa = a + sgn * (0.48 + rnd.random() * 0.34)
                sl = bl * (0.40 + rnd.random() * 0.18) * (1.0 - u * 0.32)
                sm = src + Vector((math.cos(sa) * sl * 0.55, math.sin(sa) * sl * 0.55, -sl * 0.08))
                se = src + Vector((math.cos(sa) * sl, math.sin(sa) * sl, sl * 0.06))
                b.tube([src, sm, se], [max(0.010, r0 * 0.38), 0.0065, 0.004], twig_c, seg=3)
                # 下中层细枝再出一根微垂小岔
                if frac < 0.60 and j % 2 == 0:
                    sa2 = sa - sgn * 0.42
                    sl2 = sl * 0.48
                    b.tube([sm, sm + Vector((math.cos(sa2) * sl2, math.sin(sa2) * sl2, -0.06))], [0.006, 0.0035], twig_c, seg=3)
            if frac < 0.62 and k % 2 == 0:
                b.seg(orig.lerp(p1, 0.18) + Vector((0, 0, r0 * 0.9)), orig.lerp(p1, 0.78) + Vector((0, 0, r0 * 0.7)), r0 * 0.85, r0 * 0.50, SNOW_M)

    return b.finish(name)
