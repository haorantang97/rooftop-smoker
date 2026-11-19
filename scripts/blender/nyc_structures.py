# 纽约悬索桥桥塔（石砌哥特双拱 / 铆接钢结构）与屋顶小物（木水箱 / 屋顶设备一组）：
# bridge_tower_stone (~90m×40m) / bridge_tower_steel (~90m×40m) / water_tower / rooftop_set
import math, random
from mathutils import Vector, Matrix
from inaka_core import (
    B, srgb, lerp_col, mul_col, vary, ensure_non_leaf,
    WOOD_VD, WOOD_D, WOOD, WOOD_M, WOOD_L,
    STONE_L, STONE, STONE_D, CONCRETE, CONCRETE_D, IRON_D, IRON, STEEL,
)


# ---------------- 1. 石砌哥特尖拱双门洞悬索桥塔 bridge_tower_stone（高 ~90m，宽 ~40m，对照 bridge_tower_stone.png） ----------------

def build_bridge_tower_stone(name='bridge_tower_stone', seed=311):
    b = B(seed)
    # 宽 40m 沿 X，厚 ~16.5m 沿 Y，双哥特尖拱门洞前后贯通 Y 轴（正面朝 -Y）！
    gran_l = '#bfb4a2'
    gran_m = '#a49888'
    gran_d = '#7c7264'
    gran_vd = '#5e564c'

    # 1) 三个宏伟垂直石墩（左 x=-15.6，中 x=0.0，右 x=+15.6），留出左右两个宽达 8.8m 的巍峨通透哥特门洞！
    pier_xs = (-15.6, 0.0, 15.6)
    pier_ws = (7.2, 6.4, 7.2)
    D_base = 13.8
    D_top = 11.4

    for px, pw in zip(pier_xs, pier_ws):
        # 水线阶梯基座 (0..10m)
        b.box((px, 0, 2.5), (pw + 2.2, D_base + 2.2, 5.0), gran_d, top=(0.94, 0.94))
        b.box((px, 0, 7.5), (pw + 1.2, D_base + 1.2, 5.0), gran_m, top=(0.95, 0.95))
        # 主石墩身 (10..81m，略微收分) + 前后外凸阶梯扶壁（buttresses）
        b.box((px, 0, 45.5), (pw, D_base, 71.0), gran_m, top=(0.88, D_top / D_base), grad=(0.86, 1.05))
        for sy in (-1, 1):
            b.box((px, sy * (D_base * 0.5 + 0.4), 24.0), (pw * 0.54, 2.2, 28.0), gran_l, top=(0.92, 0.85))
            b.box((px, sy * (D_base * 0.48 + 0.35), 52.0), (pw * 0.46, 1.8, 30.0), gran_l, top=(0.92, 0.85))
            b.box((px, sy * (D_base * 0.44 + 0.3), 73.5), (pw * 0.42, 1.3, 15.0), gran_l)
            for hz in (26.0, 38.0, 54.0, 67.0):
                b.box((px, sy * (D_base * 0.46 + 0.55), hz), (pw * 0.64, 2.4, 1.2), gran_d)
        if abs(px) > 1.0:
            sx_out = -1 if px < 0 else 1
            for hz in (20.0, 36.0, 52.0, 68.0):
                b.box((px + sx_out * (pw * 0.47), 0, hz), (1.0, D_base * 0.94, 1.3), gran_d)

    # 2) 桥面下层石墩基础托梁 (0..25m 实心连接三个石墩，25m 以上双哥特门洞宽敞完全贯通！)
    b.box((0, 0, 12.2), (37.0, D_base - 1.4, 24.4), gran_d, grad=(0.82, 1.02))
    b.box((0, 0, 25.0), (40.2, D_base + 1.0, 2.2), gran_l)

    # 3) 双哥特式尖拱门洞（宽 8.8m × 高达 49m，从 3/4 视角一眼看穿双尖拱通透蓝天！）
    z_spring = 53.5
    z_apex = 73.5
    z_entab = 80.8
    for cx_arch in (-7.8, 7.8):
        half_span = 4.95
        d_arch = 11.8
        n_seg = 12
        def gothic_pt(u):
            a = abs(u)
            x = cx_arch + (half_span if u >= 0 else -half_span) * (a ** 0.85)
            z = z_spring + (z_apex - z_spring) * math.sqrt(max(0.0, 1.0 - (a ** 1.65)))
            return x, z

        for i in range(n_seg):
            u0 = -1.0 + 2.0 * i / n_seg
            u1 = -1.0 + 2.0 * (i + 1) / n_seg
            x0, z0 = gothic_pt(u0)
            x1, z1 = gothic_pt(u1)
            v_sp = [
                (x0, -d_arch * 0.5, z0), (x1, -d_arch * 0.5, z1), (x1, -d_arch * 0.5, z_entab), (x0, -d_arch * 0.5, z_entab),
                (x0,  d_arch * 0.5, z0), (x1,  d_arch * 0.5, z1), (x1,  d_arch * 0.5, z_entab), (x0,  d_arch * 0.5, z_entab),
            ]
            f_sp = [
                (0, 1, 2, 3), (7, 6, 5, 4),
                (0, 4, 5, 1),
                (3, 2, 6, 7),
            ]
            b.poly(v_sp, f_sp, gran_m if i % 2 == 0 else '#aba090')
            for sy in (-1, 1):
                b.seg((x0, sy * (d_arch * 0.5 + 0.35), z0 + 0.35), (x1, sy * (d_arch * 0.5 + 0.35), z1 + 0.35), 1.15, 0.95, gran_l)

    # 4) 宏伟多层挑出石檐冠（Entablature Cornice, z = 80.5..89.5m）+ 顶部主缆铸铁鞍座！
    b.box((0, 0, 81.8), (40.4, 13.0, 2.8), gran_d)
    b.box((0, 0, 84.6), (41.8, 14.2, 3.0), gran_m)
    b.box((0, 0, 87.5), (43.4, 15.6, 3.0), gran_l)
    for sy in (-1, 1):
        for i in range(17):
            dx = -19.2 + i * 2.4
            b.box((dx, sy * 7.1, 83.2), (0.85, 1.1, 1.8), gran_vd)
    for px in pier_xs:
        b.box((px, 0, 89.6), (7.2, 14.0, 1.8), gran_l)
        b.box((px, 0, 90.8), (2.4, 6.2, 1.6), '#464a50', top=(0.7, 0.85))

    return b.finish(name)


# ---------------- 2. 钢结构悬索桥桥塔 bridge_tower_steel（高 ~90m，宽 ~40m，对照 bridge_tower_steel.png） ----------------

def build_bridge_tower_steel(name='bridge_tower_steel', seed=312):
    b = B(seed)
    # 宽 40m 沿 X，厚 ~14m 沿 Y，双格构钢塔腿 + 桥面净空门洞 + 顶部拱形桁架与 X 斜撑！
    st_l = '#889aa8'
    st_m = '#687a8a'
    st_d = '#485866'
    conc_l = '#b8b6ae'
    conc_d = '#8a8882'

    # 1) 底部阶梯混凝土沉箱基座 (0..9m)
    b.box((0, 0, 2.5), (42.0, 16.0, 5.0), conc_d, top=(0.96, 0.94))
    b.box((0, 0, 6.8), (39.6, 14.2, 3.8), conc_l, top=(0.96, 0.94))

    # 2) 左右两座大型蜂窝铆接钢塔腿（位于 x = ±14.2m，从 z=8.5m 优雅微收至 z=88.5m！）
    # 每座塔腿由前后两对粗壮钢箱柱 + 纵横隔板 + 密集格构 X 斜撑构成，极具曼哈顿钢桥工业美感！
    for sx in (-1, 1):
        cx = sx * 14.2
        # 每座塔腿由内外双联钢柱组成，中间嵌 X 格构斜撑
        for sub_x in (-2.4, 2.4):
            x_bot = cx + sub_x * 1.18
            x_top = cx + sub_x * 0.86
            # 主钢柱（带收分与外凸法兰肋）
            b.seg((x_bot, -3.2, 8.5), (x_top, -2.4, 88.0), 2.5, 2.5, st_m)
            b.seg((x_bot,  3.2, 8.5), (x_top,  2.4, 88.0), 2.5, 2.5, st_m)
            # 前后柱之间的 12 层横撑与侧向 X 斜撑
            n_lev = 12
            for k in range(n_lev):
                t0 = k / n_lev
                t1 = (k + 1) / n_lev
                za, zb = 8.5 + 79.5 * t0, 8.5 + 79.5 * t1
                xa, xb = x_bot + (x_top - x_bot) * t0, x_bot + (x_top - x_bot) * t1
                ya, yb = 3.2 - 0.8 * t0, 3.2 - 0.8 * t1
                b.seg((xa, -ya, za), (xa, ya, za), 0.9, 0.9, st_d)
                b.seg((xa, -ya, za), (xb, yb, zb), 0.65, 0.65, st_l)
                b.seg((xa,  ya, za), (xb, -yb, zb), 0.65, 0.65, st_l)
        # 塔腿正面(-Y/+Y) 两个子柱之间的 12 层水平连系梁与 X 斜撑
        for k in range(12):
            t0 = k / 12.0
            t1 = (k + 1) / 12.0
            za, zb = 8.5 + 79.5 * t0, 8.5 + 79.5 * t1
            dx0 = 2.4 * (1.18 - 0.32 * t0)
            dx1 = 2.4 * (1.18 - 0.32 * t1)
            yy = 3.2 - 0.8 * t0
            for sy in (-1, 1):
                b.seg((cx - dx0, sy * yy, za), (cx + dx0, sy * yy, za), 0.85, 0.95, st_l)
                b.seg((cx - dx0, sy * yy, za), (cx + dx1, sy * (3.2 - 0.8 * t1), zb), 0.55, 0.55, st_l)
                b.seg((cx + dx0, sy * yy, za), (cx - dx1, sy * (3.2 - 0.8 * t1), zb), 0.55, 0.55, st_l)
        # 塔脚优雅外张钢靴底座
        b.box((cx, 0, 10.5), (9.6, 10.2, 4.2), st_d, top=(0.82, 0.82))

    # 3) 双塔腿之间的横跨桁架（下层桥面托梁 25..31m + 下部 X 撑 10..25m + 顶部双层弧拱门楣 X 桁架 68..88m！）
    # 注意：z = 31..68m 中间保持完全通透的巨型桥面通车门洞！
    # 桥面托梁 (z = 26..31m)
    b.box((0, 0, 28.5), (38.0, 6.2, 4.8), st_d)
    for sy in (-1, 1):
        b.box((0, sy * 3.2, 28.5), (38.4, 0.6, 5.2), st_l)
    # 桥面下方 2 层钢 X 斜撑 (9..26m)
    for k in range(2):
        za, zb = 9.5 + k * 8.2, 9.5 + (k + 1) * 8.2
        for sy in (-1, 1):
            b.seg((-11.2, sy * 2.8, za), (11.2, sy * 2.8, za), 1.1, 1.1, st_m)
            b.seg((-11.2, sy * 2.8, za), ( 0.0, sy * 2.8, zb), 0.85, 0.85, st_l)
            b.seg(( 0.0,  sy * 2.8, za), (-11.2, sy * 2.8, zb), 0.85, 0.85, st_l)
            b.seg(( 0.0,  sy * 2.8, za), (11.2, sy * 2.8, zb), 0.85, 0.85, st_l)
            b.seg(( 11.2, sy * 2.8, za), ( 0.0, sy * 2.8, zb), 0.85, 0.85, st_l)

    # 顶部优雅钢拱门洞 + 双层上部 X 格构横梁 (64..88m)
    z_a0 = 63.0
    z_a1 = 74.5
    n_arc = 10
    for i in range(n_arc):
        u0 = -1.0 + 2.0 * i / n_arc
        u1 = -1.0 + 2.0 * (i + 1) / n_arc
        x0, x1 = u0 * 11.4, u1 * 11.4
        z0 = z_a0 + (z_a1 - z_a0) * math.sqrt(max(0.0, 1.0 - u0 * u0))
        z1 = z_a0 + (z_a1 - z_a0) * math.sqrt(max(0.0, 1.0 - u1 * u1))
        for sy in (-1, 1):
            b.seg((x0, sy * 2.4, z0), (x1, sy * 2.4, z1), 1.35, 1.35, st_l)
            # 拱顶到横梁的竖腹杆
            b.seg((x0, sy * 2.4, z0), (x0, sy * 2.4, 77.0), 0.72, 0.72, st_m)
    # 顶部双层 X 格构门楣 (77..88m)
    for zz in (77.0, 82.5, 87.8):
        for sy in (-1, 1):
            b.seg((-16.8, sy * 2.4, zz), (16.8, sy * 2.4, zz), 1.35, 1.45, st_l)
        b.box((0, 0, zz), (28.0, 5.2, 1.2), st_d)
    for z_lo, z_hi in ((77.0, 82.5), (82.5, 87.8)):
        for sy in (-1, 1):
            for kx in (-10.5, -3.5, 3.5):
                b.seg((kx, sy * 2.4, z_lo), (kx + 7.0, sy * 2.4, z_hi), 0.72, 0.72, st_l)
                b.seg((kx + 7.0, sy * 2.4, z_lo), (kx, sy * 2.4, z_hi), 0.72, 0.72, st_l)

    # 4) 塔顶装饰性挑檐冠盖 + 4 座铆接钢尖饰与主缆鞍座 (88..92m)
    b.box((0, 0, 88.6), (36.8, 7.6, 1.8), st_l)
    for sx in (-1, 1):
        cx = sx * 14.2
        b.box((cx, 0, 89.2), (8.2, 8.8, 2.2), st_l)
        b.box((cx, 0, 90.8), (3.4, 6.2, 2.0), '#3d4650', top=(0.75, 0.85))  # 主缆大鞍座
        for ox in (-2.6, 2.6):
            b.box((cx + ox, 0, 91.0), (1.3, 1.3, 2.4), st_l, top=(0.45, 0.45))

    return b.finish(name)


# ---------------- 3. 老纽约屋顶木水箱 water_tower（高 ~9.1m，<= 3,000 面，对照 water_tower.png） ----------------

def build_water_tower(name='water_tower', seed=313):
    b = B(seed)
    st_d = '#343a42'
    st_m = '#4c545e'
    cedar_cols = ['#8a5236', '#7a462e', '#9a5e40', '#6d3e28', '#8e583a']
    roof_col = '#383a3e'

    # 1) 四条微收分铆接钢架支腿 (z=0..3.6m) + 混凝土垫块 + 双层 X 交叉钢斜撑！
    r_b, r_t = 1.65, 1.35
    zh = 3.55
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for sx, sy in corners:
        p0 = Vector((sx * r_b, sy * r_b, 0.0))
        p1 = Vector((sx * r_t, sy * r_t, zh))
        b.box((p0.x, p0.y, 0.14), (0.42, 0.42, 0.28), CONCRETE_D, top=(0.86, 0.86))
        b.seg(p0 + Vector((0, 0, 0.12)), p1, 0.14, 0.14, st_d)
    # 水平钢围梁 + 四面 X 斜撑
    for t_h in (0.12, 0.96):
        zz = zh * t_h
        rr = r_b + (r_t - r_b) * t_h
        for i in range(4):
            c0, c1 = corners[i], corners[(i + 1) % 4]
            b.seg((c0[0] * rr, c0[1] * rr, zz), (c1[0] * rr, c1[1] * rr, zz), 0.10, 0.10, st_m)
    for i in range(4):
        c0, c1 = corners[i], corners[(i + 1) % 4]
        p00 = Vector((c0[0] * r_b * 0.97, c0[1] * r_b * 0.97, 0.42))
        p10 = Vector((c1[0] * r_b * 0.97, c1[1] * r_b * 0.97, 0.42))
        p01 = Vector((c0[0] * r_t * 1.01, c0[1] * r_t * 1.01, zh - 0.14))
        p11 = Vector((c1[0] * r_t * 1.01, c1[1] * r_t * 1.01, zh - 0.14))
        b.seg(p00, p11, 0.075, 0.075, st_m)
        b.seg(p10, p01, 0.075, 0.075, st_m)

    # 2) 顶部双层纵横工字钢与承重枕木排（dunnage beams）+ 中央保温粗立管！
    b.box((0, 0, zh + 0.12), (3.65, 3.65, 0.18), st_d)
    for k in range(7):
        off = -1.50 + k * 0.50
        b.box((off, 0, zh + 0.30), (0.14, 3.70, 0.18), '#5c4430')
    # 中央垂直粗保温供水管 + 底部弯头
    b.cyl((0, 0, 0.0), 0.24, zh + 0.35, '#68564c', seg=10, smooth=True)
    b.seg((0, 0, 0.42), (-1.45, -1.25, 0.42), 0.16, 0.16, '#5c4c44')

    # 3) 红雪松木板条圆桶水箱（z = 3.92..7.42m，r = 1.72m，24 条交替木板色 + 10 道下密上疏铁箍！）
    z_t0, t_h, r_tk = zh + 0.38, 3.52, 1.72
    n_staves = 24
    # 每条竖直雪松木桶板自带轻微色差，近看就像真实拼接木桶！
    for i in range(n_staves):
        a0 = i / n_staves * math.tau
        a1 = (i + 1) / n_staves * math.tau
        p0 = Vector((math.cos(a0) * r_tk, math.sin(a0) * r_tk, z_t0))
        p1 = Vector((math.cos(a1) * r_tk, math.sin(a1) * r_tk, z_t0))
        p2 = Vector((math.cos(a1) * r_tk, math.sin(a1) * r_tk, z_t0 + t_h))
        p3 = Vector((math.cos(a0) * r_tk, math.sin(a0) * r_tk, z_t0 + t_h))
        col = vary(cedar_cols[i % len(cedar_cols)], 0.08, b.rnd)
        b.poly([p0, p1, p2, p3], [(0, 1, 2, 3)], None,
               vert_colors=[mul_col(col, 0.78), mul_col(col, 0.78), mul_col(col, 1.06), mul_col(col, 1.06)])
    # 桶底密封圆盘
    b.cyl((0, 0, z_t0 - 0.04), r_tk + 0.04, 0.08, '#5a3a26', seg=20)
    # 10 道下密上疏的深锈铁紧固钢箍（越靠近底部水压越大、铁箍越密，超级真实！）
    hoop_fracs = [0.05, 0.11, 0.18, 0.26, 0.35, 0.46, 0.58, 0.71, 0.84, 0.95]
    for f in hoop_fracs:
        b.cyl((0, 0, z_t0 + t_h * f), r_tk + 0.032, 0.048, '#2d2826', seg=24, cap=False)

    # 4) 深灰圆锥油毡铁皮顶盖 + 金属尖顶 (z = 7.42..9.05m)
    z_rf = z_t0 + t_h
    b.lathe(
        (0, 0, z_rf - 0.05),
        [(r_tk + 0.24, 0.0), (r_tk + 0.22, 0.08), (r_tk * 0.52, 0.78), (0.14, 1.42), (0.04, 1.50)],
        roof_col, seg=20, smooth=False,
        colors=['#26282c', '#3c4046', '#4a4e54', '#565a60', '#383c42'],
    )
    b.cyl((0, 0, z_rf + 1.42), 0.05, 0.58, '#626870', seg=6, r2=0.015)

    # 5) 侧面直通顶盖的竖向钢制检修爬梯（从 z=0 一直通到锥顶！）
    lx = 1.98
    ly = -0.35
    for dy in (-0.22, 0.22):
        b.seg((lx, ly + dy, 0.05), (lx, ly + dy, z_rf + 0.28), 0.032, 0.032, st_d)
        b.seg((lx, ly + dy, z_rf + 0.28), (lx - 0.35, ly + dy, z_rf + 0.22), 0.032, 0.032, st_d)
    for k in range(21):
        zz = 0.35 + k * 0.36
        b.seg((lx, ly - 0.22, zz), (lx, ly + 0.22, zz), 0.022, 0.022, st_m)
        if k in (4, 11, 18):
            b.seg((lx, ly, zz), (lx - 0.32, ly, zz), 0.03, 0.03, st_d)

    return b.finish(name)


# ---------------- 4. 纽约屋顶设备一组 rooftop_set（约 15×10m，<= 5,000 面，对照 rooftop_set.png） ----------------

def build_rooftop_set(name='rooftop_set', seed=314):
    b = B(seed)
    brick_m = '#864838'
    brick_d = '#6a362a'
    conc_l = '#b6b4ac'
    conc_d = '#7a7c80'
    galv_l = '#bec6ce'
    galv_m = '#949ca4'
    galv_d = '#5c646c'

    # 1) 轻薄深灰屋面防渗铺装底垫（14.6 × 9.6 × 0.14m，将整组屋顶设备自然凝聚成一组）
    b.box((0, 0, 0.07), (14.6, 9.6, 0.14), '#3e4248')

    # 2) 左侧红褐旧砖砌电梯机房小屋（Bulkhead: 5.4 × 4.6 × 3.85m，混凝土框柱 + 压顶 + 重铁门 + 百叶 + 屋顶旋风帽！）
    bx, by = -4.2, 0.8
    bw, bd, bh = 5.4, 4.6, 3.85
    z0 = 0.14
    b.box((bx, by, z0 + bh * 0.5), (bw, bd, bh), brick_m, grad=(0.82, 1.04))
    # 四角混凝土构造柱 + 顶女儿墙水泥压顶
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((bx + sx * bw * 0.5, by + sy * bd * 0.5, z0 + bh * 0.5), (0.34, 0.34, bh + 0.06), conc_l)
    b.box((bx, by, z0 + bh + 0.12), (bw + 0.42, bd + 0.42, 0.26), conc_l)
    b.box((bx, by, z0 + bh + 0.02), (bw - 0.30, bd - 0.30, 0.12), '#52565c')
    # 砖墙微妙横纹装饰带
    for kz in (0.9, 1.8, 2.7):
        b.box((bx, by, z0 + kz), (bw + 0.03, bd + 0.03, 0.06), brick_d)
    # 正面(-Y) 重型灰色防火铁门 + 门框 + 门口小金属雨灯
    b.box((bx - 0.8, by - bd * 0.5 - 0.04, z0 + 1.15), (1.36, 0.12, 2.30), conc_d)
    b.box((bx - 0.8, by - bd * 0.5 - 0.08, z0 + 1.15), (1.14, 0.08, 2.12), '#8c949c')
    b.box((bx - 0.8, by - bd * 0.5 - 0.11, z0 + 1.60), (0.58, 0.04, 0.52), '#3c4248')  # 小门窗
    # 右侧面金属排风百叶窗（面向空调机组）
    b.box((bx + bw * 0.5 + 0.04, by + 0.4, z0 + 2.55), (0.10, 1.45, 1.15), galv_d)
    for k in range(6):
        b.box((bx + bw * 0.5 + 0.08, by + 0.4, z0 + 2.12 + k * 0.17), (0.06, 1.32, 0.06), galv_l)
    # 机房屋顶两个经典银色涡轮通风帽（whirlybird / mushroom vents）+ 细避雷针
    for vx in (bx - 0.7, bx + 0.9):
        b.cyl((vx, by + 0.4, z0 + bh + 0.14), 0.34, 0.36, galv_m, seg=10)
        b.sphere((vx, by + 0.4, z0 + bh + 0.68), 0.46, galv_l, sub=2, scale=(1.0, 1.0, 0.78), smooth=True)
        b.cyl((vx, by + 0.4, z0 + bh + 0.98), 0.32, 0.08, galv_d, seg=10)
    b.cyl((bx - 1.6, by - 1.1, z0 + bh + 0.14), 0.04, 2.25, '#8a929a', seg=6, r2=0.015)

    # 3) 中间偏前 3 台大型工业空调外机 / 冷水机组（带散热百叶格栅 + 顶部圆形风扇罩与暗色风叶！）
    ac_positions = [(0.6, -1.6), (2.8, -1.6), (1.7, 0.7)]
    for ax, ay in ac_positions:
        aw, ad, ah = 1.85, 1.75, 1.48
        # 防震钢座 + 镀锌主机箱
        b.box((ax, ay, z0 + 0.10), (aw + 0.12, ad + 0.12, 0.20), '#4a4e54')
        b.box((ax, ay, z0 + 0.20 + ah * 0.5), (aw, ad, ah), galv_l, grad=(0.86, 1.05))
        # 四侧暗色散热进风百叶区
        for sy in (-1, 1):
            b.box((ax, ay + sy * (ad * 0.5 + 0.02), z0 + 0.20 + ah * 0.48), (aw * 0.78, 0.04, ah * 0.66), '#3a4048')
        for sx in (-1, 1):
            b.box((ax + sx * (aw * 0.5 + 0.02), ay, z0 + 0.20 + ah * 0.48), (0.04, ad * 0.78, ah * 0.66), '#3a4048')
        # 顶面圆形凹陷风扇井 + 防护圈 + 十字护网
        fz = z0 + 0.20 + ah
        b.cyl((ax, ay, fz), 0.66, 0.14, galv_m, seg=14)
        b.cyl((ax, ay, fz + 0.04), 0.58, 0.11, '#262a30', seg=14)
        b.box((ax, ay, fz + 0.15), (1.22, 0.05, 0.04), galv_d)
        b.box((ax, ay, fz + 0.15), (0.05, 1.22, 0.04), galv_d)

    # 4) 架空镀锌铁皮矩形大风管（从电梯机房穿出向右延伸至右侧支架，带节段法兰箍与支腿！）
    dz = z0 + 2.35
    # 主水平矩形风管（两根并排）
    for dy, dw, dh in ((1.85, 1.05, 0.88), (3.10, 0.85, 0.76)):
        b.box((2.2, dy, dz), (7.6, dw, dh), galv_l, grad=(0.88, 1.06))
        # 每 1.5m 一道外凸风管法兰连接箍
        for fx in (-1.2, 0.3, 1.8, 3.3, 4.8, 5.95):
            b.box((fx, dy, dz), (0.10, dw + 0.14, dh + 0.14), galv_m)
        # 末端通风百叶口
        b.box((6.02, dy, dz), (0.06, dw - 0.14, dh - 0.14), '#2d3238')
    # 支撑风管的钢门架立腿
    for sx in (0.3, 3.3, 5.6):
        b.seg((sx, 1.20, z0), (sx, 1.20, dz - 0.40), 0.10, 0.10, galv_d)
        b.seg((sx, 3.65, z0), (sx, 3.65, dz - 0.40), 0.10, 0.10, galv_d)
        b.seg((sx, 1.20, dz - 0.42), (sx, 3.65, dz - 0.42), 0.10, 0.12, galv_d)

    # 5) 右后两根弯头鹅颈排气管（gooseneck vents）+ 右前玻璃采光天窗（skylight）
    for gx, gy, gh in ((4.4, 3.5, 3.65), (5.3, 3.5, 3.30)):
        pts = [
            Vector((gx, gy, z0)),
            Vector((gx, gy, z0 + gh)),
            Vector((gx - 0.25, gy, z0 + gh + 0.35)),
            Vector((gx - 0.55, gy, z0 + gh + 0.22)),
            Vector((gx - 0.58, gy, z0 + gh - 0.08)),
        ]
        b.tube(pts, 0.15, galv_m, seg=10, smooth=True)
    # 右前金属框玻璃坡面采光天窗
    sx_k, sy_k = 4.6, -2.1
    skw, skd = 3.2, 2.2
    b.box((sx_k, sy_k, z0 + 0.22), (skw, skd, 0.44), conc_d)
    # 人字坡面玻璃窗体 + 金属窗格筋
    p_l0, p_l1 = (sx_k - skw * 0.48, sy_k - skd * 0.48, z0 + 0.44), (sx_k + skw * 0.48, sy_k - skd * 0.48, z0 + 0.44)
    p_r0, p_r1 = (sx_k - skw * 0.48, sy_k + skd * 0.48, z0 + 0.44), (sx_k + skw * 0.48, sy_k + skd * 0.48, z0 + 0.44)
    p_t0, p_t1 = (sx_k - skw * 0.48, sy_k, z0 + 1.22), (sx_k + skw * 0.48, sy_k, z0 + 1.22)
    b.poly([p_l0, p_l1, p_t1, p_t0], [(0, 1, 2, 3)], '#52687c')
    b.poly([p_r1, p_r0, p_t0, p_t1], [(0, 1, 2, 3)], '#425668')
    b.poly([p_l0, p_t0, p_r0], [(0, 1, 2)], '#606870')
    b.poly([p_l1, p_r1, p_t1], [(0, 1, 2)], '#606870')
    for k in range(5):
        f = k / 4.0
        a = Vector(p_l0).lerp(Vector(p_l1), f)
        c = Vector(p_t0).lerp(Vector(p_t1), f)
        d = Vector(p_r0).lerp(Vector(p_r1), f)
        b.seg(a, c, 0.08, 0.08, galv_l)
        b.seg(d, c, 0.08, 0.08, galv_l)
    b.seg(p_t0, p_t1, 0.10, 0.10, galv_l)

    return b.finish(name)
