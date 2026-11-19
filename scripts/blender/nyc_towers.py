# 纽约 6 座地标摩天楼高细节程序化建模（全部按真实尺度米制建，重复窗格用少量骨架 + glow 条控制面数，每栋 <= 60,000 面）：
# deco_tower (~380m+尖顶) / crown_tower (~320m) / supertall (~540m含天线) /
# slant_tower (~280m) / pencil_tower (~430m) / pyramid_tower (~250m)
import math, random
from mathutils import Vector, Matrix
from inaka_core import (
    B, srgb, lerp_col, mul_col, vary, ensure_non_leaf,
    COPPER_G, COPPER_GL, COPPER_GD, IRON_D, IRON, STEEL,
)


# ---------------- 摩天楼通用立面与窗格原语 ----------------

def _fluted_tier(b, cx, cy, z0, z1, w, d, wall_col, pier_col, spandrel_col, n_bays_x, n_bays_y,
                 glow_strip=True, crown_glow=False, rnd=None, lit_prob=0.82, glow_col='#ffd98e'):
    """
    经典纽约装饰艺术竖肋退台块：
    实体主核 + 四周竖向石柱肋（piers）+ 凹槽内竖向发光窗条（glow，按楼层分段亮灭自然灵动！）+ 顶部石檐线。
    """
    rnd = rnd or b.rnd
    h = z1 - z0
    zc = (z0 + z1) * 0.5
    # 主体核心退进一点，让石肋形成清晰阴影槽！
    b.box((cx, cy, zc), (w, d, h), spandrel_col, grad=(0.82, 1.04))
    # 顶底石檐压线
    b.box((cx, cy, z1 - 0.8), (w + 0.9, d + 0.9, 1.6), pier_col)
    b.box((cx, cy, z0 + 0.6), (w + 0.6, d + 0.6, 1.2), mul_col(pier_col, 0.88))

    # 四角粗壮转角石垛
    cw = max(1.6, min(3.4, min(w, d) * 0.085))
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((cx + sx * (w * 0.5 - cw * 0.35), cy + sy * (d * 0.5 - cw * 0.35), zc),
                  (cw, cw, h), wall_col, grad=(0.86, 1.06))

    # 沿前后(-Y, +Y)与左右(-X, +X)铺设竖向窗肋与竖条发光窗带
    def do_face(span, depth_axis, sign, n_bays, along='X'):
        usable = span - cw * 2.0
        if usable < 2.0 or n_bays < 1:
            return
        bay_w = usable / n_bays
        pier_w = max(0.65, bay_w * 0.36)
        win_w = max(0.60, bay_w - pier_w)
        # 竖向石肋（piers）
        for i in range(n_bays + 1):
            pos_u = -usable * 0.5 + i * bay_w
            if along == 'X':
                b.box((cx + pos_u, cy + sign * (depth_axis * 0.5 + 0.32), zc), (pier_w, 0.72, h), pier_col, grad=(0.86, 1.06))
            else:
                b.box((cx + sign * (depth_axis * 0.5 + 0.32), cy + pos_u, zc), (0.72, pier_w, h), pier_col, grad=(0.86, 1.06))
        # 凹槽内发光窗竖条（切成几段避免死板通天一条亮，冠部泛光则整段金色！）
        if glow_strip:
            n_segs = 1 if crown_glow else max(2, int(h / 18.0))
            sh = (h - 3.0) / n_segs
            for i in range(n_bays):
                pos_u = -usable * 0.5 + (i + 0.5) * bay_w
                for s in range(n_segs):
                    if not crown_glow and rnd.random() > lit_prob:
                        continue
                    za = z0 + 1.5 + s * sh + (0.0 if crown_glow else 0.7)
                    zb = z0 + 1.5 + (s + 1) * sh - (0.0 if crown_glow else 0.7)
                    if zb <= za + 0.4:
                        continue
                    gc = glow_col if crown_glow else (glow_col if rnd.random() < 0.72 else '#fff0cc')
                    if along == 'X':
                        b.box((cx + pos_u, cy + sign * (depth_axis * 0.5 + 0.08), (za + zb) * 0.5),
                              (win_w * 0.84, 0.24, zb - za), gc, glow=True)
                    else:
                        b.box((cx + sign * (depth_axis * 0.5 + 0.08), cy + pos_u, (za + zb) * 0.5),
                              (0.24, win_w * 0.84, zb - za), gc, glow=True)

    for sy in (-1, 1):
        do_face(w, d, sy, n_bays_x, 'X')
    for sx in (-1, 1):
        do_face(d, w, sx, n_bays_y, 'Y')


# ---------------- 1. 阶梯式装饰艺术摩天楼 deco_tower（主体 ~380m + 系泊杆尖顶 ~438m，对照 deco_tower.png） ----------------

def build_deco_tower(name='deco_tower', seed=301):
    b = B(seed)
    rnd = random.Random(seed)
    stone_l = '#ded6c6'
    stone_m = '#c6bcab'
    stone_d = '#7a746a'
    spandrel = '#343840'
    gold_glow = '#ffe68c'
    win_glow = '#ffe4a8'

    # Tier 0: 宏伟石砌基座裙楼 (0..32m, 108 × 72m) + 柱廊大门洞
    b.box((0, 0, 16.0), (108.0, 72.0, 32.0), stone_m, grad=(0.82, 1.04))
    b.box((0, 0, 32.4), (110.5, 74.5, 2.2), stone_l)
    # 基座大厅竖向巨柱与挑高窗槽
    for sy in (-1, 1):
        for i in range(13):
            px = -48.0 + i * 8.0
            b.box((px, sy * 36.4, 16.0), (2.2, 1.4, 30.0), stone_l)
            if i < 12:
                b.box((px + 4.0, sy * 36.1, 13.0), (4.6, 0.4, 20.0), win_glow if i % 3 != 1 else '#383a40', glow=(i % 3 != 1))
    for sx in (-1, 1):
        for i in range(9):
            py = -32.0 + i * 8.0
            b.box((sx * 54.4, py, 16.0), (1.4, 2.2, 30.0), stone_l)
            if i < 8:
                b.box((sx * 54.1, py + 4.0, 13.0), (0.4, 4.6, 20.0), win_glow if i % 2 == 0 else '#383a40', glow=(i % 2 == 0))

    # Tier 1: 对称退台侧翼 + 中央主楼体 (32..108m)
    _fluted_tier(b, 0, 0, 32.0, 108.0, 88.0, 58.0, stone_l, stone_m, spandrel, 12, 8, rnd=rnd, lit_prob=0.80, glow_col=win_glow)
    # 左右独立次级退台侧翼（打造经典阶梯韵律轮廓，非照抄而是原创对称翼！）
    for sx in (-1, 1):
        _fluted_tier(b, sx * 36.0, 0, 32.0, 82.0, 22.0, 46.0, stone_l, stone_m, spandrel, 3, 6, rnd=rnd, lit_prob=0.76, glow_col=win_glow)

    # Tier 2: 巍峨主塔身 (108..264m, 56 × 44m) + 四面中央微凸竖肋翼
    _fluted_tier(b, 0, 0, 108.0, 264.0, 56.0, 44.0, stone_l, stone_m, spandrel, 9, 7, rnd=rnd, lit_prob=0.78, glow_col=win_glow)
    for sy in (-1, 1):
        _fluted_tier(b, 0, sy * 22.5, 108.0, 246.0, 26.0, 6.0, stone_l, stone_l, spandrel, 4, 1, rnd=rnd, lit_prob=0.85, glow_col=win_glow)

    # Tier 3: 高层大退台 (264..314m, 44 × 35m) + 四角装饰艺术竖鳍小塔尖
    _fluted_tier(b, 0, 0, 264.0, 314.0, 44.0, 35.0, stone_l, stone_m, spandrel, 7, 5, rnd=rnd, lit_prob=0.88, glow_col=win_glow)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((sx * 21.0, sy * 16.5, 316.0), (4.5, 4.5, 16.0), stone_l, top=(0.65, 0.65))
            b.box((sx * 21.0, sy * 16.5, 326.0), (2.2, 2.2, 8.0), gold_glow, glow=True, top=(0.3, 0.3))

    # Tier 4 & Tier 5: 顶部几级退台夜里金色泛光（全部由暖金色 glow 面板 + 竖向金属/石肋勾勒！）
    _fluted_tier(b, 0, 0, 314.0, 348.0, 33.0, 27.0, '#dcd2bc', '#c8bea8', '#605444', 6, 5,
                 glow_strip=True, crown_glow=True, rnd=rnd, glow_col=gold_glow)
    # 退台水平金色泛光檐槽
    b.box((0, 0, 348.5), (34.5, 28.5, 2.2), gold_glow, glow=True)
    _fluted_tier(b, 0, 0, 348.0, 376.0, 23.0, 20.0, '#e4dac4', '#d2c6b0', '#706048', 5, 4,
                 glow_strip=True, crown_glow=True, rnd=rnd, glow_col='#ffe498')
    # 八角形金色冠顶灯亭 (376..384m)
    b.cyl((0, 0, 376.0), 10.8, 7.5, '#ffe8a4', seg=8, r2=9.2, glow=True)
    for k in range(8):
        a = k / 8.0 * math.tau + math.pi / 8.0
        b.seg((math.cos(a) * 10.6, math.sin(a) * 10.6, 375.5), (math.cos(a) * 9.2, math.sin(a) * 9.2, 384.0), 1.4, 1.4, '#c4b8a0')

    # 系泊杆塔座与纤细高耸天线尖顶 (384..438m)
    b.cyl((0, 0, 383.5), 7.6, 20.0, '#b8bec4', seg=12, r2=5.4, smooth=True)
    # 系泊杆上竖向发光观景条
    for k in range(8):
        a = k / 8.0 * math.tau
        b.seg((math.cos(a) * 6.9, math.sin(a) * 6.9, 385.5), (math.cos(a) * 5.6, math.sin(a) * 5.6, 401.5), 0.75, 0.75, '#fff0c4', glow=True)
    # 阶梯收尖金属针尖 + 导航环
    b.cyl((0, 0, 403.5), 5.6, 3.0, '#8c949c', seg=12, r2=3.6)
    b.cyl((0, 0, 406.5), 2.8, 16.0, '#c8d0d8', seg=10, r2=1.4, smooth=True)
    b.cyl((0, 0, 422.5), 1.4, 16.0, '#dce2e8', seg=8, r2=0.25, smooth=True)
    b.cyl((0, 0, 412.0), 3.2, 0.8, '#e8edf2', seg=12)
    b.sphere((0, 0, 438.5), 0.7, '#fff4d4', sub=1, glow=True)

    return b.finish(name, glow_color='#ffe29c')


# ---------------- 2. 拱形钢冠尖塔 crown_tower（高约 322m，冠部层叠钢拱+发光三角窗，对照 crown_tower.png） ----------------

def build_crown_tower(name='crown_tower', seed=302):
    b = B(seed)
    rnd = random.Random(seed)
    stone_w = '#e2dcd0'
    stone_m = '#c8c0b2'
    accent_d = '#484c54'
    steel_hi = '#d8dee6'
    steel_m = '#b4bcc6'
    steel_d = '#7c848e'
    win_glow = '#ffe4a8'

    # 1) 阶梯装饰艺术底座与翼楼 (0..38m, 64×64m -> 38..84m, 54×54m)
    _fluted_tier(b, 0, 0, 0.0, 38.0, 64.0, 64.0, stone_w, stone_m, accent_d, 8, 8, rnd=rnd, lit_prob=0.82, glow_col=win_glow)
    _fluted_tier(b, 0, 0, 38.0, 82.0, 52.0, 52.0, stone_w, stone_m, accent_d, 7, 7, rnd=rnd, lit_prob=0.80, glow_col=win_glow)
    # 经典转角凹切对称高塔身 (82..218m, 38×38m)
    _fluted_tier(b, 0, 0, 82.0, 218.0, 38.0, 38.0, stone_w, stone_m, accent_d, 6, 6, rnd=rnd, lit_prob=0.82, glow_col=win_glow)
    # 四面中央深灰竖条装饰带 + 高处装饰性角翼金属雕饰（仿鹰翅/角鳍气质）
    for z_fin, spread in ((82.0, 26.5), (178.0, 19.6), (214.0, 19.2)):
        for sx in (-1, 1):
            for sy in (-1, 1):
                b.box((sx * spread, sy * spread, z_fin + 2.5), (4.2, 4.2, 5.5), steel_hi, top=(0.55, 0.55))
                # 向外伸出的钢质角鳍
                b.seg((sx * (spread - 0.5), sy * (spread - 0.5), z_fin + 3.0),
                      (sx * (spread + 3.8), sy * (spread + 3.8), z_fin + 4.4), 1.6, 1.4, steel_hi)

    # 2) 层层叠叠的拱形不锈钢冠顶 + 醒目放射状发光三角窗（218..286m，共 6 层圆拱钢冠！）
    tiers_crown = [
        # (z_base, z_arch_peak, half_w_bot, half_w_top, n_tris)
        (218.0, 232.5, 19.2, 16.2, 7),
        (230.5, 244.5, 16.0, 13.0, 7),
        (242.5, 256.0, 12.8,  9.8, 5),
        (254.0, 266.0,  9.6,  6.8, 5),
        (264.5, 275.5,  6.6,  4.0, 3),
        (274.0, 285.5,  3.9,  1.6, 3),
    ]
    for t_i, (zb, zp, wb, wt, n_tr) in enumerate(tiers_crown):
        n_arc = 12
        tier_h = zp - zb
        for side_rot in range(4):
            R = Matrix.Rotation(side_rot * math.pi * 0.5, 3, 'Z')
            # 精确曲面函数 surf(u, v): u in [-1,1] 沿拱宽, v in [0,1] 从拱底到拱顶
            def crown_pt(u, v, out_off=0.0):
                hw = wb + (wt - wb) * v
                arch_lift = tier_h * (0.58 * v + 0.25 * v * v) * math.sqrt(max(0.0, 1.0 - u * u))
                lz = zb + tier_h * 0.42 * v + arch_lift
                # 在拱面外推 out_off（垂直于 -Y 斜面）
                return Vector((u * hw, -(hw + out_off), lz))

            verts, vcs = [], []
            n_v = 3
            for iv in range(n_v + 1):
                v = iv / n_v
                c_s = steel_hi if iv in (1, 2) else (steel_m if iv == 3 else steel_d)
                sh = 1.08 if iv == 2 else (0.96 if iv == 1 else 0.84)
                for k in range(n_arc + 1):
                    u = k / n_arc * 2.0 - 1.0
                    verts.append(R @ crown_pt(u, v, 0.0))
                    vcs.append(mul_col(c_s, sh))
            gw = n_arc + 1
            faces = []
            for iv in range(n_v):
                b0, b1 = iv * gw, (iv + 1) * gw
                for k in range(n_arc):
                    faces.append((b0 + k, b0 + k + 1, b1 + k + 1, b1 + k))
            b.poly(verts, faces, None, smooth=True, vert_colors=vcs)

            # 拱缘外凸亮银金属压条（勾勒出层层叠叠的弯月钢拱轮廓！）
            arch_rim = [R @ crown_pt(k / n_arc * 2.0 - 1.0, 1.0, 0.28) for k in range(n_arc + 1)]
            b.tube(arch_rim, 0.48, '#e8eef5', seg=5, smooth=True)

            # 冠部标志性放射状「发光三角窗」(glow)！精准浮贴在钢拱外表面 +0.42m 处，绝不埋进壳里！
            for k in range(n_tr):
                u_c = ((k + 0.5) / n_tr * 2.0 - 1.0) * 0.74
                du = 0.56 / n_tr
                # 暗色金属三角外框 + 亮白暖金三角发光窗芯（glow！）
                p_bl_f = R @ crown_pt(u_c - du * 0.92, 0.14, 0.30)
                p_br_f = R @ crown_pt(u_c + du * 0.92, 0.14, 0.30)
                p_tp_f = R @ crown_pt(u_c,             0.84, 0.34)
                b.poly([p_bl_f, p_br_f, p_tp_f], [(0, 1, 2)], '#38404a')

                p_bl = R @ crown_pt(u_c - du * 0.68, 0.22, 0.48)
                p_br = R @ crown_pt(u_c + du * 0.68, 0.22, 0.48)
                p_tp = R @ crown_pt(u_c,             0.76, 0.52)
                b.poly([p_bl, p_br, p_tp], [(0, 1, 2)], '#fff2c8', glow=True)

        # 内核暗钢封顶防穿帮
        b.box((0, 0, zb + tier_h * 0.48), (wt * 1.92, wt * 1.92, tier_h * 0.72), steel_d)

    # 3) 闪亮细长不锈钢针尖 (283..322m)
    b.cyl((0, 0, 282.0), 2.1, 14.0, steel_hi, seg=8, r2=1.0, smooth=True)
    b.cyl((0, 0, 296.0), 1.0, 26.0, '#eef2f8', seg=8, r2=0.14, smooth=True)
    b.sphere((0, 0, 322.2), 0.5, '#ffffff', sub=1, glow=True)

    return b.finish(name, glow_color='#eef4ff')


# ---------------- 3. 现代扭转八角玻璃超高层 supertall（含天线 ~540m，对照 supertall.png） ----------------

def build_supertall(name='supertall', seed=303):
    b = B(seed)
    rnd = random.Random(seed)
    # 1) 方形深色玻璃+钢框裙楼基座 (0..56m, 58×58m)
    W0 = 58.0
    b.box((0, 0, 28.0), (W0, W0, 56.0), '#28323e', grad=(0.75, 1.05))
    # 基座四角深钢立柱与竖向玻璃幕墙分格肋 + 暖/冷大堂发光条
    for side_rot in range(4):
        R = Matrix.Rotation(side_rot * math.pi * 0.5, 3, 'Z')
        for i in range(9):
            lx = -W0 * 0.44 + W0 * 0.88 * i / 8.0
            b.box_rot(R @ Vector((lx, -W0 * 0.5 - 0.25, 28.0)), (0.95, 0.9, 55.0), (0, 0, side_rot * math.pi * 0.5), '#4e5c6c')
        # 挑高玻璃大堂微亮光带
        b.box_rot(R @ Vector((0, -W0 * 0.5 - 0.10, 12.0)), (W0 * 0.72, 0.3, 18.0), (0, 0, side_rot * math.pi * 0.5), '#d4e4f4', glow=True)
    b.box((0, 0, 56.5), (W0 + 1.2, W0 + 1.2, 2.5), '#687684')

    # 2) 标志性「方底向上切角扭转成八角/旋转方顶」玻璃幕墙主塔 (56..418m)！
    # 高度 t=0 (56m) 为 0° 正方形 (半宽 28.5m)；往上四条棱渐进切出四个巨型等腰三角形玻璃斜切面，
    # 到 t=1 (418m) 完美收成 45° 旋转正方形（中腰 t=0.5 处为正八边形！）—— 8 块大三角折面反射蓝灰天光！
    z_s0, z_s1 = 56.0, 418.0
    n_floors = 24
    # 定义每层高度 t 上的 8 个八角轮廓顶点 (x, y)
    def oct_ring(t):
        # 方形半宽随高度微微收窄 (28.5 -> 20.5)
        r_sq = 28.6 * (1.0 - 0.27 * t)
        # 切角比例 c: t=0 时 c=0.04 (近方底), t=1 时 c=0.96 (旋转 45° 菱形顶), 中段为清晰八边形！
        c = 0.04 + 0.92 * t
        s = r_sq
        d = r_sq * (1.0 - c)
        # 顺时针/逆时针 8 点：(南左, 南右, 东下, 东上, 北右, 北左, 西上, 西下)
        return [
            (-d, -s), ( d, -s),
            ( s, -d), ( s,  d),
            ( d,  s), (-d,  s),
            (-s,  d), (-s, -d),
        ]

    # 玻璃幕墙各朝向反光色调（使 8 个三角形折面在白天光影下棱角闪烁如钻石晶体！）
    face_tints = ['#62849e', '#84a6be', '#4a6880', '#789ab2', '#52728c', '#8eb0c8', '#425e74', '#6e90aa']
    for fi in range(n_floors):
        t0 = fi / n_floors
        t1 = (fi + 1) / n_floors
        za = z_s0 + (z_s1 - z_s0) * t0
        zb = z_s0 + (z_s1 - z_s0) * t1
        r0 = oct_ring(t0)
        r1 = oct_ring(t1)
        is_mech = fi in (7, 15, 22)  # 3 层暗色设备百叶腰带
        for k in range(8):
            nk = (k + 1) % 8
            p00 = Vector((r0[k][0],  r0[k][1],  za))
            p10 = Vector((r0[nk][0], r0[nk][1], za))
            p11 = Vector((r1[nk][0], r1[nk][1], zb))
            p01 = Vector((r1[k][0],  r1[k][1],  zb))
            # 玻璃面色随高度渐亮（天空反射渐变）
            c_face = '#26303c' if is_mech else lerp_col(mul_col(face_tints[k], 0.85), mul_col(face_tints[k], 1.18), t0)
            b.poly([p00, p10, p11, p01], [(0, 1, 2, 3)], c_face)
            # 金属斜棱柱筋（沿 8 条折线边缘勾勒清晰银白钢棱！）
            b.seg(p00, p01, 0.55, 0.55, '#9cb0c0')
            # 水平银色幕墙层间筋
            b.seg(p01, p11, 0.38, 0.45, '#7e92a4')
            # 发光办公楼水平窗灯带（glow，贴在非设备层的玻璃面上微微外浮 0.14m，夜里通透璀璨！）
            if not is_mech and (p10 - p00).length > 5.0:
                edge_n = (p10 - p00).cross(p01 - p00)
                if edge_n.length > 1e-4:
                    edge_n.normalize()
                    # 在这一段楼层里画 2 条细长水平亮灯办公窗带
                    for sub_k in (0.30, 0.72):
                        if rnd.random() < 0.74:
                            qa = p00.lerp(p01, sub_k - 0.11) + edge_n * 0.15
                            qb = p10.lerp(p11, sub_k - 0.11) + edge_n * 0.15
                            qc = p10.lerp(p11, sub_k + 0.11) + edge_n * 0.15
                            qd = p00.lerp(p01, sub_k + 0.11) + edge_n * 0.15
                            # 左右略内收留出金属棱边
                            pa = qa.lerp(qb, 0.06)
                            pb = qa.lerp(qb, 0.94)
                            pc = qd.lerp(qc, 0.94)
                            pd = qd.lerp(qc, 0.06)
                            gc = '#e2f0ff' if rnd.random() < 0.62 else '#ffe8bc'
                            b.poly([pa, pb, pc, pd], [(0, 1, 2, 3)], gc, glow=True)

    # 3) 顶层观景/通讯环冠 (418..434m) + 细长银色主天线直抵 ~540m！
    top_r = oct_ring(1.0)
    b.poly([Vector((x, y, z_s1)) for x, y in top_r], [tuple(range(8))], '#3a4654')
    # 屋顶金属通讯环（经典圆形银灰环冠 + 发光内环带）
    b.cyl((0, 0, 418.0), 14.5, 9.5, '#98a6b4', seg=20, r2=13.5, smooth=True)
    b.cyl((0, 0, 419.5), 14.7, 3.2, '#e4f0ff', seg=20, smooth=True, glow=True)
    b.cyl((0, 0, 427.5), 15.8, 2.2, '#c8d4de', seg=20, smooth=True)
    # 通讯环顶部细钢架支撑 + 110 米细长尖塔天线 (430..540m)
    b.cyl((0, 0, 429.5), 4.6, 18.0, '#aebac6', seg=12, r2=2.8, smooth=True)
    b.cyl((0, 0, 447.5), 2.8, 36.0, '#c8d4de', seg=10, r2=1.5, smooth=True)
    b.cyl((0, 0, 483.5), 1.5, 56.5, '#e2eaf2', seg=8, r2=0.22, smooth=True)
    for rz, rr in ((448.0, 5.2), (472.0, 3.4), (498.0, 2.2)):
        b.cyl((0, 0, rz), rr, 1.0, '#dce4ec', seg=12)
    b.sphere((0, 0, 540.0), 0.7, '#ffffff', sub=1, glow=True)

    return b.finish(name, glow_color='#e6f2ff')


# ---------------- 4. 顶部 45° 斜切办公楼 slant_tower（高约 280m，斜面整面发白光 glow，对照 slant_tower.png） ----------------

def build_slant_tower(name='slant_tower', seed=304):
    b = B(seed)
    rnd = random.Random(seed)
    W = 48.0
    alum_l = '#dde3e8'
    alum_m = '#bcc4cc'
    glass_d = '#283440'
    win_glow = '#eef4ff'

    # 1) 标志性挑空巨柱裙楼大堂 (0..36m)：4 根居中的雕塑感巨型方柱托起整个大楼 + 内收发光玻璃大堂核！
    b.box((0, 0, 18.0), (26.0, 26.0, 36.0), '#fff2d8', glow=True)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((sx * 13.0, sy * 13.0, 18.0), (2.4, 2.4, 36.0), '#56606a')
    # 四面居中的 4 根超级大柱（经典悬挑托举造型！）
    for cx, cy in ((0, -20.5), (0, 20.5), (-20.5, 0), (20.5, 0)):
        b.box((cx, cy, 18.0), (8.2, 8.2, 36.0), alum_l, grad=(0.86, 1.05))
    b.box((0, 0, 36.0), (W + 0.6, W + 0.6, 3.6), alum_m)  # 底部转换巨梁

    # 2) 主体办公楼身 (37.8..232m)：银白铝板水平横带与深色水平通窗带交替 + 发光横条窗 (glow)
    z0, z1 = 37.8, 232.0
    b.box((0, 0, (z0 + z1) * 0.5), (W - 0.6, W - 0.6, z1 - z0), glass_d)
    # 30 条利落水平银白铝板幕墙带（每隔 6.4m 一组双层横带）
    n_bands = 30
    bh = (z1 - z0) / n_bands
    for i in range(n_bands):
        za = z0 + i * bh
        # 铝板实墙横带
        b.box((0, 0, za + bh * 0.25), (W + 0.2, W + 0.2, bh * 0.48), alum_l if i % 2 == 0 else '#d0d7de')
        # 水平发光办公长条窗（每面随机分成 2–3 段，自然灵动！）
        z_win = za + bh * 0.74
        h_win = bh * 0.40
        for side_rot in range(4):
            R = Matrix.Rotation(side_rot * math.pi * 0.5, 3, 'Z')
            for seg_i in range(3):
                if rnd.random() < 0.72:
                    lx = (-1.0 + seg_i) * (W * 0.30)
                    gc = '#eef5ff' if rnd.random() < 0.60 else '#ffe8be'
                    b.box_rot(R @ Vector((lx, -W * 0.5 + 0.05, z_win)), (W * 0.28, 0.35, h_win), (0, 0, side_rot * math.pi * 0.5), gc, glow=True)
    # 四角竖向银白铝板包角条
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((sx * (W * 0.5 - 0.8), sy * (W * 0.5 - 0.8), (z0 + z1) * 0.5), (2.2, 2.2, z1 - z0), alum_l)

    # 3) 顶部 45° 斜切冠顶 (232..280m，高 48m 宽 48m 严格 45°！斜面朝正面 -Y，整面发亮白光 glow！)
    # 侧面三角形铝板外墙 + 背面竖直铝板墙
    hw = W * 0.5
    z_top = z1 + W  # 232 + 48 = 280.0m！严格 45° 斜面！
    # 楔形主壳（除斜前面外全部铝板包覆）
    w_verts = [
        Vector((-hw, -hw, z1)),    # 0 前左下
        Vector(( hw, -hw, z1)),    # 1 前右下
        Vector(( hw,  hw, z1)),    # 2 后右下
        Vector((-hw,  hw, z1)),    # 3 后左下
        Vector(( hw,  hw, z_top)), # 4 后右上
        Vector((-hw,  hw, z_top)), # 5 后左上
    ]
    # 左三角面、右三角面、后矩形面、底面
    b.poly(w_verts, [(0, 5, 3), (1, 2, 4), (2, 3, 5, 4), (0, 3, 2, 1)], alum_l)
    # 两侧三角形铝板上的水平金属条纹（延续楼身节奏）
    for k in range(1, 8):
        zz = z1 + k * (W / 8.0)
        y_front = -hw + k * (W / 8.0)
        for sx in (-1, 1):
            b.seg((sx * (hw + 0.15), y_front, zz), (sx * (hw + 0.15), hw, zz), 0.45, 1.35, alum_m)
    # 斜面四周粗壮银白铝框边框
    b.seg((-hw, -hw, z1), ( hw, -hw, z1), 1.8, 1.8, alum_l)
    b.seg((-hw,  hw, z_top), ( hw,  hw, z_top), 1.8, 1.8, alum_l)
    b.seg((-hw, -hw, z1), (-hw,  hw, z_top), 1.8, 1.8, alum_l)
    b.seg(( hw, -hw, z1), ( hw,  hw, z_top), 1.8, 1.8, alum_l)
    # 整面 45° 发光白光斜面（glow！微微外移 0.25m 沿斜面法向，夜里成为中城最醒目的白光斜顶！）
    n_sl = Vector((0, -1, 1)).normalized()
    sl_pts = [
        Vector((-hw + 1.1, -hw + 0.6, z1 + 0.6)) + n_sl * 0.25,
        Vector(( hw - 1.1, -hw + 0.6, z1 + 0.6)) + n_sl * 0.25,
        Vector(( hw - 1.1,  hw - 0.6, z_top - 0.6)) + n_sl * 0.25,
        Vector((-hw + 1.1,  hw - 0.6, z_top - 0.6)) + n_sl * 0.25,
    ]
    b.poly(sl_pts, [(0, 1, 2, 3)], '#f6faff', glow=True)
    # 斜面上几条极细的银色采光天窗分格筋（保留建筑精细度又不遮挡白光！）
    for f in (0.25, 0.50, 0.75):
        a = sl_pts[0].lerp(sl_pts[1], f) + n_sl * 0.22
        c = sl_pts[3].lerp(sl_pts[2], f) + n_sl * 0.22
        b.seg(a, c, 0.42, 0.42, alum_m)
    for f in (0.33, 0.67):
        a = sl_pts[0].lerp(sl_pts[3], f) + n_sl * 0.22
        c = sl_pts[1].lerp(sl_pts[2], f) + n_sl * 0.22
        b.seg(a, c, 0.42, 0.42, alum_m)
    # 顶部细短避雷针
    b.cyl((0, hw - 1.2, z_top), 0.38, 12.0, alum_l, seg=6, r2=0.10)

    return b.finish(name, glow_color='#f6faff')


# ---------------- 5. 细高住宅「铅笔楼」pencil_tower（高约 430m，28×28m 方格大窗，对照 pencil_tower.png） ----------------

def build_pencil_tower(name='pencil_tower', seed=305):
    b = B(seed)
    rnd = random.Random(seed)
    W = 28.0
    H = 428.0
    conc_l = '#e6e0d4'
    conc_m = '#cbc4b8'
    dark_core = '#242930'

    # 6 段住宅模组 + 5 层暗色镂空双倍层高「穿风设备层」（纽约铅笔楼最标志性的结构特征！）
    # 每面 6 列巨型方格落地窗，直接由外露浅色清水混凝土网格柱梁 + 大方格 glow 窗构成！
    n_cols = 6
    cell = W / n_cols  # 4.67m 巨大方格
    z_cur = 0.0
    n_mods = 6
    floors_per_mod = 13
    fl_h = 4.65  # 住宅高挑层高，方格窗接近正正方形！

    for mod_i in range(n_mods):
        # 1) 住宅模组段
        mod_h = floors_per_mod * fl_h
        z_next = z_cur + mod_h
        # 内部暗色玻璃核（略微内收 0.85m 营造强烈深凹方格立面影！）
        b.box((0, 0, (z_cur + z_next) * 0.5), (W - 1.5, W - 1.5, mod_h), '#2c3642')

        # 四面外露浅白混凝土竖柱（每面 7 根）+ 水平混凝土横梁（每层 1 道）
        for side_rot in range(4):
            R = Matrix.Rotation(side_rot * math.pi * 0.5, 3, 'Z')
            for ci in range(n_cols + 1):
                lx = -W * 0.5 + ci * cell
                pw = 1.05 if ci in (0, n_cols) else 0.72
                b.box_rot(R @ Vector((lx, -W * 0.5 + 0.45, (z_cur + z_next) * 0.5)), (pw, 0.92, mod_h), (0, 0, side_rot * math.pi * 0.5), conc_l)
            for fi in range(floors_per_mod + 1):
                zz = z_cur + fi * fl_h
                b.box_rot(R @ Vector((0, -W * 0.5 + 0.45, zz)), (W, 0.92, 0.76), (0, 0, side_rot * math.pi * 0.5), conc_m if fi % 2 else conc_l)

            # 巨型方格发光大窗（glow，部分亮暖白、部分亮冷白、部分熄灯显深蓝玻璃，立体通透！）
            for fi in range(floors_per_mod):
                zz = z_cur + (fi + 0.5) * fl_h
                # 每层按整套公寓成片亮灯（连续 2–3 扇窗同亮，超级真实！）
                apt_l = rnd.random() < 0.64
                apt_r = rnd.random() < 0.64
                col_l = '#ffe5b0' if rnd.random() < 0.68 else '#dceaff'
                col_r = '#ffe5b0' if rnd.random() < 0.68 else '#dceaff'
                for ci in range(n_cols):
                    lit = apt_l if ci < 3 else apt_r
                    if not lit:
                        continue
                    lx = -W * 0.5 + (ci + 0.5) * cell
                    gc = col_l if ci < 3 else col_r
                    b.box_rot(R @ Vector((lx, -W * 0.5 + 0.80, zz)), (cell - 0.85, 0.16, fl_h - 0.85), (0, 0, side_rot * math.pi * 0.5), gc, glow=True)

        z_cur = z_next

        # 2) 双倍层高暗色镂空「穿风设备层」（除最顶模组外）
        if mod_i < n_mods - 1:
            wind_h = fl_h * 2.0
            # 内收暗色结构核心筒 + 四周通透外框支柱
            b.box((0, 0, z_cur + wind_h * 0.5), (W * 0.56, W * 0.56, wind_h), dark_core)
            for side_rot in range(4):
                R = Matrix.Rotation(side_rot * math.pi * 0.5, 3, 'Z')
                for ci in (0, 2, 4, 6):
                    lx = -W * 0.5 + ci * cell
                    b.box_rot(R @ Vector((lx, -W * 0.5 + 0.45, z_cur + wind_h * 0.5)), (0.95, 0.92, wind_h), (0, 0, side_rot * math.pi * 0.5), conc_m)
            z_cur += wind_h

    # 3) 顶部发光冠框（顶层透光灯箱栏板 + 细短避雷针，总高 ~430m）
    cr_h = 11.5
    b.box((0, 0, z_cur + cr_h * 0.5), (W - 2.2, W - 2.2, cr_h - 1.2), '#fff2d2', glow=True)
    for side_rot in range(4):
        R = Matrix.Rotation(side_rot * math.pi * 0.5, 3, 'Z')
        for ci in range(n_cols + 1):
            lx = -W * 0.5 + ci * cell
            b.box_rot(R @ Vector((lx, -W * 0.5 + 0.45, z_cur + cr_h * 0.5)), (0.88, 0.92, cr_h), (0, 0, side_rot * math.pi * 0.5), conc_l)
        b.box_rot(R @ Vector((0, -W * 0.5 + 0.45, z_cur + cr_h)), (W + 0.2, 1.05, 1.2), (0, 0, side_rot * math.pi * 0.5), conc_l)
    b.box((0, 0, z_cur + cr_h - 0.3), (W - 1.0, W - 1.0, 0.6), '#484e56')

    return b.finish(name, glow_color='#ffebc0')


# ---------------- 6. 金字塔铜绿尖顶老楼 pyramid_tower（高约 252m，铜绿尖顶+夜里金色 glow，对照 pyramid_tower.png） ----------------

def build_pyramid_tower(name='pyramid_tower', seed=306):
    b = B(seed)
    rnd = random.Random(seed)
    stone_l = '#d8ccb6'
    stone_m = '#bfb29c'
    stone_d = '#908472'
    spandrel = '#4a4642'
    win_glow = '#ffdfa0'
    gold_glow = '#ffd878'

    # 1) 古典石砌基座裙楼 (0..38m, 48 × 42m)
    _fluted_tier(b, 0, 0, 0.0, 38.0, 48.0, 42.0, stone_l, stone_m, spandrel, 7, 6, rnd=rnd, lit_prob=0.80, glow_col=win_glow)
    b.box((0, 0, 38.6), (50.4, 44.4, 2.4), stone_l)

    # 2) 典雅瘦高石砌主塔身 (38..178m, 34 × 34m -> 轻退台)
    _fluted_tier(b, 0, 0, 38.0, 152.0, 34.0, 34.0, stone_l, stone_m, spandrel, 6, 6, rnd=rnd, lit_prob=0.78, glow_col=win_glow)
    # 152m 古典雕花重檐线
    b.box((0, 0, 152.5), (36.8, 36.8, 2.6), stone_l)
    _fluted_tier(b, 0, 0, 153.5, 178.0, 31.5, 31.5, stone_l, stone_m, spandrel, 6, 6, rnd=rnd, lit_prob=0.88, glow_col=win_glow)

    # 3) 古典列柱观景回廊层 (178..204m, 29 × 29m)：外圈石柱 + 内部金色暖光核 (glow!) + 厚重古典挑檐
    b.box((0, 0, 191.0), (24.0, 24.0, 25.0), '#ffe29c', glow=True)
    for side_rot in range(4):
        R = Matrix.Rotation(side_rot * math.pi * 0.5, 3, 'Z')
        for i in range(7):
            lx = -13.2 + i * 4.4
            b.box_rot(R @ Vector((lx, -14.0, 191.0)), (1.55, 1.55, 25.5), (0, 0, side_rot * math.pi * 0.5), stone_l)
    # 华丽多层挑出石檐冠 (203..208m)
    b.box((0, 0, 204.2), (31.5, 31.5, 2.4), stone_m)
    b.box((0, 0, 206.5), (33.6, 33.6, 2.4), stone_l)
    # 檐口四角小石墩
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((sx * 15.2, sy * 15.2, 209.5), (2.8, 2.8, 4.2), stone_l, top=(0.7, 0.7))

    # 4) 阶梯式氧化铜绿金字塔尖顶 (207.5..246m) + 夜里金色泛光棱脊与阶梯光带 (glow!) + 镀金尖刹
    z_p0 = 207.5
    p_h = 38.5
    hw_p = 14.8
    # 7 级阶梯微收铜绿金字塔主体（铜绿基底 + 每层压脊棱 + 夜间金色泛光带！）
    n_steps = 7
    sh = p_h / n_steps
    for s_i in range(n_steps):
        t0 = s_i / n_steps
        t1 = (s_i + 1) / n_steps
        w0 = hw_p * 2.0 * (1.0 - t0 * 0.90)
        w1 = hw_p * 2.0 * (1.0 - t1 * 0.90)
        za = z_p0 + s_i * sh
        col = '#82c8b0' if s_i % 2 == 0 else '#62a892'
        b.box((0, 0, za + sh * 0.5), (w0, w0, sh + 0.08), col, top=(w1 / w0, w1 / w0))
        # 每级台阶面朝上的一圈窄金色泛光灯带（夜里整个铜绿金字塔闪耀金光！）
        if s_i in (0, 2, 4, 5, 6):
            b.box((0, 0, za + 0.55), (w0 + 0.38, w0 + 0.38, 1.15), '#ffe48a', glow=True)
    # 四条闪亮斜角铜脊筋 + 金色泛光顶亭 (244..252m)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.seg((sx * hw_p, sy * hw_p, z_p0), (sx * 1.4, sy * 1.4, z_p0 + p_h), 0.95, 0.95, COPPER_GD)
    # 塔尖金色小灯笼与避雷针尖（总高 ~252m）
    b.cyl((0, 0, z_p0 + p_h - 0.5), 1.9, 3.6, gold_glow, seg=8, r2=1.2, glow=True)
    b.cyl((0, 0, z_p0 + p_h + 3.0), 0.75, 4.5, '#d8b464', seg=8, r2=0.12)

    return b.finish(name, glow_color='#ffda82')
