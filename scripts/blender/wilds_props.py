# 旷野建筑与牧场机械小物高细节程序化建模：
# windmill (叶轮独立子物体 wheel) / trough / pickup (缺轮略塌老皮卡) / shed / fence (12m 可首尾拼接) / mailbox
import bpy, math, random
from mathutils import Vector, Matrix, Euler
from inaka_core import (
    B, srgb, lerp_col, mul_col, vary, ensure_non_leaf,
    WOOD_VD, WOOD_D, WOOD, WOOD_M, WOOD_L,
    IRON_D, IRON, STEEL,
)


# ---------------- 1. 多叶片风车水泵 windmill（叶轮独立子物体命名为 wheel，塔高 ~10m，对照 windmill.png） ----------------

def build_windmill(name='windmill', seed=201):
    b = B(seed)
    H = 9.85  # 塔顶平台/机头座高度约 10m
    galv = '#9fa6aa'
    galv_d = '#7d8488'
    galv_rust = '#8c725e'
    wood_w = '#8f7d68'

    # 1) 四条外张镀锌角钢塔腿（从底 ±1.55m 收至顶 ±0.32m）+ 水泥锚座
    r_bot, r_top = 1.58, 0.30
    def leg_pt(sx, sy, t):
        rr = r_bot + (r_top - r_bot) * t
        return Vector((sx * rr, sy * rr, H * t))

    for sx in (-1, 1):
        for sy in (-1, 1):
            p0 = leg_pt(sx, sy, 0.0)
            p1 = leg_pt(sx, sy, 1.0)
            b.box((p0.x, p0.y, 0.14), (0.36, 0.36, 0.28), '#92887a', top=(0.82, 0.82))
            b.seg(p0 + Vector((0, 0, 0.10)), p1, 0.095, 0.095, galv)

    # 2) 5 层水平围梁（girts）+ 四面交叉 X 斜撑杆（lattice bracing）
    tiers = [0.06, 0.24, 0.44, 0.64, 0.82, 0.96]
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for t_i in range(len(tiers)):
        t = tiers[t_i]
        col_g = galv_rust if t_i % 3 == 0 else galv_d
        for c_i in range(4):
            a0 = leg_pt(*corners[c_i], t)
            a1 = leg_pt(*corners[(c_i + 1) % 4], t)
            b.seg(a0, a1, 0.055, 0.055, col_g)
        if t_i < len(tiers) - 1:
            t_next = tiers[t_i + 1]
            for c_i in range(4):
                c0 = corners[c_i]
                c1 = corners[(c_i + 1) % 4]
                p00 = leg_pt(*c0, t)
                p10 = leg_pt(*c1, t)
                p01 = leg_pt(*c0, t_next)
                p11 = leg_pt(*c1, t_next)
                b.seg(p00, p11, 0.032, 0.032, galv_d)
                b.seg(p10, p01, 0.032, 0.032, galv_d)

    # 3) 中央垂直抽水杆、套管与地面铸铁井口泵座
    b.cyl((0, 0, 0.0), 0.22, 0.42, '#5a5048', seg=10)
    b.cyl((0, 0, 0.42), 0.12, 0.65, '#4c4642', seg=10)
    b.cyl((0, 0, 1.05), 0.038, H - 0.85, '#685e54', seg=8)
    for t_g in (0.24, 0.54, 0.82):
        zz = H * t_g
        rr = r_bot + (r_top - r_bot) * t_g
        b.seg((-rr, 0, zz), (rr, 0, zz), 0.04, 0.04, galv_d)
        b.seg((0, -rr, zz), (0, rr, zz), 0.04, 0.04, galv_d)

    # 4) 顶部检修木板平台（z=8.95m）与侧爬梯（沿 +X 侧面直通顶部）
    pz = H * 0.90
    pw = 1.25
    for k in range(5):
        py = -pw * 0.42 + pw * 0.84 * k / 4.0
        b.box((0, py, pz), (pw, 0.18, 0.05), vary(wood_w, 0.08, b.rnd))
    # 沿 +X 侧斜塔面爬梯
    for dy in (-0.20, 0.20):
        b.seg((r_bot + 0.06, dy, 0.10), (r_top + 0.08, dy, pz + 0.10), 0.032, 0.032, galv_d)
    for k in range(22):
        u = (k + 0.5) / 22.0
        lx = (r_bot + 0.06) * (1.0 - u) + (r_top + 0.08) * u
        lz = 0.10 + (pz) * u
        b.seg((lx, -0.20, lz), (lx, 0.20, lz), 0.022, 0.022, galv)

    # 5) 塔顶回转轴承颈 + 铸铁齿轮机头箱 + 长尾杆与宽大扇形金属尾舵（朝 +Y）
    b.cyl((0, 0, H - 0.12), 0.24, 0.42, '#5a6066', seg=12)
    b.box((0, 0.02, H + 0.46), (0.44, 0.78, 0.48), '#686e74', top=(0.86, 0.88))
    b.cyl((0, -0.42, H + 0.48), 0.11, 0.45, '#4c5258', seg=10, axis='Y')  # 主轴套筒朝 -Y
    # 尾杆与斜拉稳定撑
    tail_z = H + 0.48
    b.seg((0, 0.36, tail_z), (0, 3.25, tail_z + 0.16), 0.06, 0.06, galv_d)
    b.seg((0, 0.25, tail_z + 0.35), (0, 2.35, tail_z + 0.38), 0.032, 0.032, galv_d)
    b.seg((0, 0.25, tail_z - 0.18), (0, 2.25, tail_z - 0.10), 0.032, 0.032, galv_d)
    # 经典梯形微弧镀锌金属尾舵叶片（无任何文字！）
    vane_pts = [
        (0.0, 2.10, tail_z - 0.28),
        (0.0, 3.52, tail_z - 0.44),
        (0.0, 3.55, tail_z + 0.78),
        (0.0, 2.10, tail_z + 0.56),
    ]
    # 赋予一点厚度与加强筋
    v_l = [Vector((-0.022, y, z)) for _, y, z in vane_pts]
    v_r = [Vector((0.022, y, z)) for _, y, z in vane_pts]
    v_all = v_l + v_r
    v_faces = [
        (0, 1, 2, 3), (7, 6, 5, 4),
        (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0),
    ]
    v_cols = [srgb('#8c949c'), srgb('#767e86'), srgb('#b2b8be'), srgb('#9aa2a8')] * 2
    b.poly(v_all, v_faces, None, vert_colors=v_cols)
    # 尾舵横向镀锌压条
    b.seg((0, 2.08, tail_z + 0.14), (0, 3.54, tail_z + 0.18), 0.065, 0.055, galv_rust)

    tower_ob = b.finish(name)

    # 6) 独立子物体 wheel（原点精确落在叶轮轴心 (0, -0.64, H + 0.48)，18 片倾斜镀锌叶片 + 双钢圈 + 6 辐条！）
    hub_pos = Vector((0.0, -0.64, H + 0.48))
    bw = B(seed + 50)
    R_out = 2.02
    R_mid = 1.48
    R_in = 0.74
    # 中心铸铁轮毂 + 轮轴鼻帽
    bw.cyl((0, 0, 0), 0.20, 0.28, '#545a60', seg=12, axis='Y', smooth=True)
    bw.cyl((0, -0.16, 0), 0.12, 0.12, '#787e84', seg=10, axis='Y')
    # 6 根辐射钢辐条（略微前后伞形张开以增强刚度）
    for k in range(6):
        a = k / 6.0 * math.tau
        ca, sa = math.cos(a), math.sin(a)
        bw.seg((0, 0.06, 0), (ca * R_out, -0.02, sa * R_out), 0.042, 0.042, galv_d)
        bw.seg((0, -0.08, 0), (ca * R_in, -0.02, sa * R_in), 0.032, 0.032, galv_d)
    # 3 道同心钢环箍（内圈、中筋圈、外大圈）
    for rad, thick, col in ((R_in, 0.024, galv_d), (R_mid, 0.022, galv_rust), (R_out, 0.034, galv)):
        ring = [Vector((math.cos(i / 36.0 * math.tau) * rad, -0.02, math.sin(i / 36.0 * math.tau) * rad)) for i in range(37)]
        bw.tube(ring, thick, col, seg=6, smooth=True, cap_start=False, cap_end=False)
    # 18 片经典梯形倾斜弧面镀锌金属风叶（每片绕自身径向轴偏转 28° 迎风！）
    n_blades = 18
    for i in range(n_blades):
        a = i / n_blades * math.tau
        rad_dir = Vector((math.cos(a), 0.0, math.sin(a)))
        tan_dir = Vector((-math.sin(a), 0.0, math.cos(a)))
        ax_dir = Vector((0.0, 1.0, 0.0))
        pitch = math.radians(28.0)
        # 倾斜后的弦向向量
        chord = tan_dir * math.cos(pitch) + ax_dir * math.sin(pitch)
        r0, r1 = R_in - 0.06, R_out - 0.04
        w0, w1 = 0.21, 0.56  # 内窄外宽扇形叶
        # 微微弧弯的 6 顶点双面叶片
        mid_r = (r0 + r1) * 0.5
        mid_w = (w0 + w1) * 0.5
        cup = ax_dir * 0.035  # 叶片微凹迎风弧
        p_i0 = rad_dir * r0 - chord * (w0 * 0.5)
        p_i1 = rad_dir * r0 + chord * (w0 * 0.5)
        p_m0 = rad_dir * mid_r - chord * (mid_w * 0.5) + cup
        p_m1 = rad_dir * mid_r + chord * (mid_w * 0.5) + cup
        p_o0 = rad_dir * r1 - chord * (w1 * 0.5)
        p_o1 = rad_dir * r1 + chord * (w1 * 0.5)
        # 每片叶子轻微不同的镀锌银灰/淡锈色，光影层次极佳！
        c_base = vary('#b2b8be' if i % 4 != 0 else '#a89a8c', 0.07, bw.rnd)
        c_tip = mul_col(c_base, 1.08)
        c_root = mul_col(c_base, 0.82)
        bw.double_poly(
            [p_i0, p_i1, p_m1, p_m0, p_o0, p_o1],
            [(0, 1, 2, 3), (3, 2, 5, 4)],
            None,
            vert_colors=[c_root, c_root, c_base, c_base, c_tip, c_tip],
            back_darken=0.84,
        )

    wheel_ob = bw.finish('wheel')
    wheel_ob.parent = tower_ob
    wheel_ob.location = hub_pos
    return [tower_ob, wheel_ob]


# ---------------- 2. 圆形镀锌饮水槽 + 小储水罐 trough（对照 trough.png） ----------------

def _corrugated_cyl(b, c, r, h, col_base, col_rust, seg=24, n_rings=10, amp=0.022, rust_bot=0.28, cap_bot=True, cap_top=True):
    """水平波纹镀锌铁皮圆筒（饮水槽/储水罐专用，带底部锈渍渐变）"""
    prof = []
    cols = []
    cb = srgb(col_base)
    cr = srgb(col_rust)
    steps = n_rings * 2
    for i in range(steps + 1):
        k = i / steps
        zz = h * k
        dr = amp if i % 2 == 1 else -amp * 0.4
        prof.append((r + dr, zz))
        rk = max(0.0, 1.0 - k / max(0.05, rust_bot))
        c_here = lerp_col(cb, cr, rk * 0.72)
        shade = 1.06 if i % 2 == 1 else 0.84
        cols.append(mul_col(c_here, shade))
    b.lathe(c, prof, None, seg=seg, smooth=True, cap_bot=cap_bot, cap_top=cap_top, colors=cols)


def build_trough(name='trough', seed=202):
    b = B(seed)
    galv = '#adb4ba'
    rust = '#8c5838'

    # 1) 左侧：圆形水平波纹镀锌饮水槽（r=1.32m, h=0.72m，卷边顶沿 + 内部清澈反光水面）
    tx, ty = -0.92, -0.15
    tr, th = 1.32, 0.72
    _corrugated_cyl(b, (tx, ty, 0.0), tr, th, galv, rust, seg=28, n_rings=7, amp=0.020, cap_top=False)
    # 槽内壁（略微内缩，防止从斜上方看到空底）
    b.cyl((tx, ty, 0.02), tr - 0.05, th - 0.04, '#7a848c', seg=24, cap=False)
    # 槽口加粗圆管卷边
    rim_pts = [Vector((tx + math.cos(i / 28.0 * math.tau) * (tr + 0.01), ty + math.sin(i / 28.0 * math.tau) * (tr + 0.01), th)) for i in range(29)]
    b.tube(rim_pts, 0.038, '#bcc4ca', seg=7, smooth=True, cap_start=False, cap_end=False)
    # 槽内平静蓝色沙漠倒影水面（带中心到边缘微渐变）
    wz = th - 0.14
    w_verts = [Vector((tx, ty, wz))]
    w_cols = [srgb('#7ea4be')]
    for i in range(24):
        a = i / 24.0 * math.tau
        w_verts.append(Vector((tx + math.cos(a) * (tr - 0.04), ty + math.sin(a) * (tr - 0.04), wz)))
        w_cols.append(srgb('#4b6c82'))
    w_faces = [(0, 1 + i, 1 + (i + 1) % 24) for i in range(24)]
    b.poly(w_verts, w_faces, None, smooth=True, vert_colors=w_cols)

    # 2) 右侧：竖立圆形波纹镀锌小储水罐（r=0.76m, h=2.12m，微拱顶盖 + 检修口 + 弯折锈铁输水管！）
    sx, sy = 1.25, 0.22
    sr, sh = 0.76, 2.12
    _corrugated_cyl(b, (sx, sy, 0.0), sr, sh, galv, rust, seg=24, n_rings=16, amp=0.022, rust_bot=0.22, cap_top=False)
    # 罐顶微拱锥盖与压边箍
    b.lathe(
        (sx, sy, sh - 0.02),
        [(sr + 0.05, 0.0), (sr + 0.05, 0.05), (sr * 0.72, 0.14), (sr * 0.28, 0.21), (0.02, 0.24)],
        '#9ea6ae', seg=24, smooth=True,
        colors=['#7c8288', '#b8c0c6', '#aeb6bc', '#c4ccd2', '#cbd2d8'],
    )
    # 罐顶弯出再垂直探入饮水槽的生锈铁皮上水管与浮球阀盒
    pipe_pts = [
        Vector((sx - 0.18, sy - 0.10, sh + 0.15)),
        Vector((sx - 0.18, sy - 0.10, sh + 0.44)),
        Vector((tx + tr - 0.10, ty + 0.12, sh + 0.44)),
        Vector((tx + tr - 0.10, ty + 0.12, th + 0.06)),
        Vector((tx + tr - 0.14, ty + 0.12, wz + 0.02)),
    ]
    b.tube(pipe_pts, 0.042, '#7d563c', seg=8, smooth=False)
    b.box((tx + tr - 0.16, ty + 0.12, th - 0.06), (0.28, 0.24, 0.20), '#8c9298')  # 槽边浮球阀罩

    return b.finish(name)


# ---------------- 3. 废弃老皮卡 pickup（圆润车头、锈红褪色漆、缺一轮略塌、无标志，对照 pickup.png） ----------------

def build_pickup(name='pickup', seed=203):
    b = B(seed)
    # 车头朝 -Y，总长约 5.05m (y ∈ [-2.55, +2.50])，宽约 1.98m
    # 左前轮 (-X, -Y) 缺失，整车向左前明显倾塌！我们先在水平局部坐标系建模，最后整体施加倾斜矩阵再精确落零。
    paint_main = '#bc5a3c'   # 温暖锈红褪色主漆（日光下更明快，对照 pickup.png）
    paint_fade = '#da8662'   # 太阳晒白的引擎盖/车顶褪色漆
    paint_dark = '#843824'   # 阴面深红锈漆
    rust_pat = '#6e3a22'     # 暗锈斑
    chrome_old = '#989a94'   # 发乌旧镀铬
    glass_dust = '#6c7474'   # 落满尘土的旧车窗玻璃
    wood_bed = '#7c5d42'     # 货箱旧木板
    tire_col = '#2e2c2a'
    rim_col = '#8c5634'

    # 1) 底盘大梁、前后车轴、排气管
    z_ax = 0.39
    for sx in (-1, 1):
        b.box((sx * 0.42, 0.02, z_ax + 0.10), (0.12, 4.35, 0.14), '#322b26')
    for ay in (-1.52, 1.48):
        b.cyl((0, ay, z_ax), 0.055, 1.62, '#3a322c', seg=8, axis='X')
    b.sphere((0, 1.48, z_ax), 0.13, '#38302a', sub=1)  # 后差速器包
    b.tube([Vector((0.28, -0.8, z_ax)), Vector((0.36, 1.2, z_ax - 0.04)), Vector((0.52, 2.38, z_ax + 0.02))], 0.036, '#5a4436', seg=6)

    # 2) 三只带旧轮胎的轮子 + 缺失轮胎的左前锈刹车鼓！（左前 -X, -Y 缺轮！）
    def add_wheel(wx, wy, wz):
        # 外胎（用 lathe 沿 X 轴旋转，手工用两层圆环+圆润胎肩构建）
        r_out, r_in, tw = 0.39, 0.21, 0.24
        seg = 18
        prof_r = [
            (r_in, -tw * 0.46), (r_out - 0.05, -tw * 0.50), (r_out, -tw * 0.34),
            (r_out, tw * 0.34), (r_out - 0.05, tw * 0.50), (r_in, tw * 0.46),
        ]
        # 绕 X 轴放样
        verts, vcs = [], []
        for idx, (rr, dx) in enumerate(prof_r):
            c_here = srgb('#3c3733' if idx in (2, 3) else tire_col)
            for i in range(seg):
                a = i / seg * math.tau
                verts.append(Vector((wx + dx, wy + math.cos(a) * rr, wz + math.sin(a) * rr)))
                vcs.append(c_here)
        faces = []
        m = len(prof_r)
        for j in range(m - 1):
            b0, b1 = j * seg, (j + 1) * seg
            for i in range(seg):
                ni = (i + 1) % seg
                faces.append((b0 + i, b0 + ni, b1 + ni, b1 + i))
        b.poly(verts, faces, None, smooth=True, vert_colors=vcs)
        # 锈蚀钢轮毂与中央小轮罩
        b.cyl((wx, wy, wz), r_in + 0.01, tw * 0.72, rim_col, seg=14, axis='X', smooth=True)
        sgn = -1 if wx < 0 else 1
        b.sphere((wx + sgn * tw * 0.34, wy, wz), 0.11, '#7a6c5e', sub=2, scale=(0.45, 1.0, 1.0), smooth=True)

    # 装右前、左后、右后三只完整轮子；左前 (-0.84, -1.52) 无胎，仅露锈刹车鼓与悬挂摇臂！
    add_wheel( 0.84, -1.52, z_ax)
    add_wheel(-0.84,  1.48, z_ax)
    add_wheel( 0.84,  1.48, z_ax)
    # 左前裸露锈蚀刹车鼓与轮轴头（着地支撑塌陷侧）
    b.cyl((-0.78, -1.52, z_ax), 0.17, 0.14, '#5a3424', seg=12, axis='X', smooth=True)
    b.cyl((-0.87, -1.52, z_ax), 0.065, 0.12, '#3d281e', seg=8, axis='X')

    # 3) 1950 年代圆润鼓包车头引擎盖 + 曲面弧形前翼子板 + 横条格栅（无标志！）+ 保险杠
    # 引擎盖（沿 Y 放样光滑流线型断面）
    hood_y = [-2.42, -2.30, -1.95, -1.40, -0.78]
    hood_w = [0.48, 0.60, 0.68, 0.72, 0.74]
    hood_z0 = [0.64, 0.64, 0.68, 0.70, 0.72]
    hood_z1 = [0.92, 1.12, 1.24, 1.28, 1.30]
    h_verts, h_cols = [], []
    # 每站 7 点拱形断面
    for st_i in range(len(hood_y)):
        yy, hw, zb, zt = hood_y[st_i], hood_w[st_i], hood_z0[st_i], hood_z1[st_i]
        arch = [
            (-hw, zb, paint_dark), (-hw, zb + (zt - zb) * 0.65, paint_main),
            (-hw * 0.62, zt - 0.04, paint_fade), (0.0, zt + 0.04, paint_fade),
            (hw * 0.62, zt - 0.04, paint_fade), (hw, zb + (zt - zb) * 0.65, paint_main),
            (hw, zb, paint_dark),
        ]
        for rx, rz, col in arch:
            h_verts.append(Vector((rx, yy, rz)))
            h_cols.append(srgb(col))
    h_faces = []
    for j in range(len(hood_y) - 1):
        b0, b1 = j * 7, (j + 1) * 7
        for k in range(6):
            h_faces.append((b0 + k, b1 + k, b1 + k + 1, b0 + k + 1))
    # 引擎盖前鼻封口与后封口
    h_faces.append((0, 1, 2, 3, 4, 5, 6))
    last_h = (len(hood_y) - 1) * 7
    h_faces.append((last_h + 6, last_h + 5, last_h + 4, last_h + 3, last_h + 2, last_h + 1, last_h + 0))
    b.poly(h_verts, h_faces, None, smooth=True, vert_colors=h_cols)

    # 左右圆润饱满的前翼子板（包裹轮拱、带圆大灯桶！）
    for sx in (-1, 1):
        f_stations = [
            (-2.36, 0.56, 0.94, 0.56, 0.94),
            (-2.12, 0.62, 0.98, 0.58, 1.06),
            (-1.52, 0.62, 0.99, 0.84, 1.08),  # 轮拱顶高起留出轮窝！
            (-0.98, 0.62, 0.98, 0.54, 1.04),
            (-0.62, 0.62, 0.94, 0.44, 0.92),
        ]
        fv, fc = [], []
        for yy, xin, xout, zb, zt in f_stations:
            pts_f = [
                (sx * xin, yy, zt), (sx * (xin + (xout - xin) * 0.6), yy, zt + 0.03),
                (sx * xout, yy, zt - 0.14), (sx * xout, yy, zb),
                (sx * (xin + 0.05), yy, zb),
            ]
            cols_f = [paint_fade, paint_fade, paint_main, rust_pat, paint_dark]
            for p, c_f in zip(pts_f, cols_f):
                fv.append(Vector(p))
                fc.append(srgb(c_f))
        ff = []
        for j in range(len(f_stations) - 1):
            b0, b1 = j * 5, (j + 1) * 5
            for k in range(4):
                if sx > 0:
                    ff.append((b0 + k, b1 + k, b1 + k + 1, b0 + k + 1))
                else:
                    ff.append((b0 + k, b0 + k + 1, b1 + k + 1, b1 + k))
        # 前后封闭
        ff.append((0, 1, 2, 3, 4) if sx > 0 else (4, 3, 2, 1, 0))
        lf = (len(f_stations) - 1) * 5
        ff.append((lf + 4, lf + 3, lf + 2, lf + 1, lf + 0) if sx > 0 else (lf + 0, lf + 1, lf + 2, lf + 3, lf + 4))
        b.poly(fv, ff, None, smooth=True, vert_colors=fc)
        # 圆润经典凸起大灯炮筒 + 灰尘玻璃灯镜
        b.cyl((sx * 0.78, -2.32, 0.86), 0.115, 0.24, paint_main, seg=12, axis='Y', smooth=True)
        b.cyl((sx * 0.78, -2.44, 0.86), 0.112, 0.04, chrome_old, seg=12, axis='Y')
        b.cyl((sx * 0.78, -2.455, 0.86), 0.090, 0.03, '#b8bcb4' if sx > 0 else '#464844', seg=10, axis='Y')
        # 驾驶室下方老式踏脚板（running board）
        b.box((sx * 0.88, -0.02, 0.45), (0.26, 1.38, 0.06), rust_pat)

    # 复古横条进气格栅（5 道圆头金属条，无任何车标！）+ 弯曲旧镀铬前保险杠
    b.box((0, -2.42, 0.74), (1.02, 0.08, 0.40), '#282220')
    for k in range(5):
        gz = 0.58 + k * 0.085
        gw = 1.04 - abs(k - 2) * 0.04
        b.box((0, -2.46, gz), (gw, 0.07, 0.042), chrome_old if k % 2 == 0 else '#847e74')
    b.box((0, -2.54, 0.48), (1.84, 0.13, 0.14), '#8a7e72', top=(0.96, 0.90))
    for sx in (-1, 1):
        b.box((sx * 0.44, -2.58, 0.52), (0.08, 0.09, 0.24), '#7a6c60')

    # 4) 圆顶双人驾驶室（带斜分体前挡风玻璃、侧门、后窗、门把手与后视镜）
    # 下半驾驶室门箱（y = -0.78..+0.42）
    b.box((0, -0.18, 0.92), (1.68, 1.24, 0.84), paint_main, grad=(0.76, 1.05))
    # 驾驶室上半（略收窄倾斜窗柱 + 圆润拱顶，y = -0.68..+0.40, z = 1.32..1.90）
    b.box((0, -0.12, 1.60), (1.52, 1.08, 0.56), paint_main, top=(0.88, 0.82))
    # 圆润鼓包驾驶室顶盖
    b.sphere((0, -0.12, 1.84), 0.72, paint_fade, sub=2, scale=(1.02, 0.78, 0.24), smooth=True)
    # 分体前挡风玻璃（中柱分两块）+ 落尘侧窗 + 后小窗
    b.box((0, -0.64, 1.58), (1.28, 0.08, 0.42), glass_dust)
    b.box((0, -0.68, 1.58), (0.055, 0.06, 0.46), paint_dark)  # 经典分体中柱
    b.box((0, 0.40, 1.58), (0.98, 0.08, 0.34), glass_dust)     # 后窗
    for sx in (-1, 1):
        b.box((sx * 0.74, -0.14, 1.58), (0.08, 0.74, 0.40), glass_dust)
        b.box((sx * 0.86, 0.08, 1.12), (0.04, 0.14, 0.035), chrome_old)  # 门把手
        # 旧圆后视镜
        b.seg((sx * 0.84, -0.62, 1.32), (sx * 1.02, -0.66, 1.48), 0.02, 0.02, IRON_D)
        b.cyl((sx * 1.02, -0.66, 1.52), 0.068, 0.028, chrome_old, seg=10, axis='Y')

    # 5) 复古木栅栏平底货箱（对照 pickup.png：旧木地板 + 四周竖立木栏柱与 3 道横木板 + 锈铁边角 + 后保险杠）
    bed_y0, bed_y1 = 0.48, 2.46
    bed_yc = (bed_y0 + bed_y1) * 0.5
    bed_w = 1.86
    bed_z = 0.82
    # 金属底框与旧木板货箱底面
    b.box((0, bed_yc, bed_z - 0.05), (bed_w + 0.06, bed_y1 - bed_y0 + 0.06, 0.10), rust_pat)
    for k in range(9):
        px = -bed_w * 0.44 + bed_w * 0.88 * k / 8.0
        b.box((px, bed_yc, bed_z + 0.015), (0.18, bed_y1 - bed_y0 - 0.04, 0.035), vary(wood_bed, 0.10, b.rnd))
    # 两侧与前后木栏板（竖柱 + 3 层水平旧木板）
    rail_h = 0.62
    for sx in (-1, 1):
        for py in (0.56, 1.16, 1.78, 2.38):
            b.box((sx * (bed_w * 0.5 - 0.04), py, bed_z + rail_h * 0.5), (0.065, 0.075, rail_h), '#5c4430')
        for rz in (0.14, 0.34, 0.54):
            b.box((sx * (bed_w * 0.5 - 0.01), bed_yc, bed_z + rz), (0.045, bed_y1 - bed_y0, 0.13), vary(wood_bed, 0.08, b.rnd))
    # 前后挡板（带旧红锈金属包边）
    for py in (bed_y0 + 0.03, bed_y1 - 0.03):
        for rz in (0.14, 0.34, 0.54):
            b.box((0, py, bed_z + rz), (bed_w - 0.04, 0.05, 0.13), vary(wood_bed, 0.08, b.rnd))
    # 尾灯与旧铁后杠
    b.box((0, bed_y1 + 0.04, 0.52), (1.72, 0.10, 0.12), '#5c463a')
    for sx in (-1, 1):
        b.cyl((sx * 0.72, bed_y1 + 0.02, 0.72), 0.052, 0.05, '#9e2620', seg=8, axis='Y')

    # 6) 对整个皮卡网格施加「左前缺轮塌陷」的真实倾角（向左 roll + 向前轻微 pitch！）
    tilt_M = Euler((math.radians(-3.2), math.radians(-7.2), 0.0), 'XYZ').to_matrix().to_4x4()
    for v in b.bm.verts:
        v.co = tilt_M @ v.co

    return b.finish(name)


# ---------------- 4. 牧场旧木板工具棚 shed（对照 shed.png） ----------------

def build_shed(name='shed', seed=204):
    b = B(seed)
    W, D = 3.85, 3.10
    z_base = 0.22
    H_wall = 2.22
    z_eave = z_base + H_wall
    rh = 0.92
    plank_cols = ['#a89276', '#968066', '#b6a084', '#86725a', '#9e8c74']

    # 1) 底部三根粗糙风化枕木墩子（对照 shed.png！）
    for sx in (-1.45, 0.0, 1.45):
        b.box((sx, 0, z_base * 0.5), (0.24, D + 0.18, z_base), '#6e5c48', jitter=0.06)
    b.box((0, 0, z_base + 0.05), (W + 0.06, D + 0.06, 0.10), '#7a6854')

    # 2) 四面粗锯竖向旧木板墙（带深色木板缝与自然褪色斑驳！）
    z0 = z_base + 0.10
    wh = z_eave - z0
    b.box((0, 0, z0 + wh * 0.5), (W - 0.08, D - 0.08, wh), '#3a2e24')  # 内衬暗缝底
    # 前后竖木板
    n_px = 18
    pw = W / n_px
    for sy in (-1, 1):
        for i in range(n_px):
            px = -W * 0.5 + (i + 0.5) * pw
            col = plank_cols[(i * 3 + (0 if sy < 0 else 2)) % len(plank_cols)]
            b.box((px, sy * (D * 0.5 - 0.01), z0 + wh * 0.5), (pw - 0.018, 0.045, wh), vary(col, 0.07, b.rnd), grad=(0.76, 1.06))
    # 左右竖木板
    n_py = 14
    pd = D / n_py
    for sx in (-1, 1):
        for i in range(n_py):
            py = -D * 0.5 + (i + 0.5) * pd
            col = plank_cols[(i * 5 + (1 if sx > 0 else 3)) % len(plank_cols)]
            b.box((sx * (W * 0.5 - 0.01), py, z0 + wh * 0.5), (0.045, pd - 0.018, wh), vary(col, 0.07, b.rnd), grad=(0.76, 1.06))

    # 前后三角形山墙竖木板
    for sy in (-1, 1):
        yw = sy * (D * 0.5 - 0.01)
        for i in range(n_px):
            px = -W * 0.5 + (i + 0.5) * pw
            h_g = max(0.05, rh * (1.0 - abs(px) / (W * 0.5)))
            col = plank_cols[(i * 7 + 1) % len(plank_cols)]
            b.box((px, yw, z_eave + h_g * 0.5 - 0.02), (pw - 0.018, 0.045, h_g + 0.04), vary(col, 0.07, b.rnd))

    # 3) 正面(-Y) 略歪的 Z 字木板门（带锈铁长合页与门闩）+ 右侧暗旧木框方窗
    dx, dw, dh = -0.45, 1.12, 1.88
    yf = -D * 0.5 - 0.03
    b.box((dx, yf + 0.01, z0 + dh * 0.5), (dw + 0.14, 0.08, dh + 0.10), '#74604a')  # 门框
    # 略微歪斜 1.8° 的旧门板与 Z 字撑木
    b.box_rot((dx, yf - 0.03, z0 + dh * 0.5), (dw, 0.055, dh), (0.0, 0.03, 0.0), '#a68f72')
    b.box_rot((dx, yf - 0.06, z0 + dh - 0.16), (dw - 0.06, 0.04, 0.11), (0.0, 0.03, 0.0), '#8c765c')
    b.box_rot((dx, yf - 0.06, z0 + 0.18), (dw - 0.06, 0.04, 0.11), (0.0, 0.03, 0.0), '#8c765c')
    b.seg((dx - dw * 0.40, yf - 0.07, z0 + 0.24), (dx + dw * 0.40, yf - 0.07, z0 + dh - 0.22), 0.09, 0.04, '#8c765c')
    # 两条锈铁长合页
    for hz in (z0 + 0.36, z0 + dh - 0.34):
        b.box((dx - dw * 0.28, yf - 0.08, hz), (0.42, 0.025, 0.075), '#5a3624')
    # 右侧面带木十字格的暗小方窗
    wx, wy, wz = W * 0.5 + 0.02, 0.08, z0 + 1.28
    b.box((wx, wy, wz), (0.09, 0.88, 0.88), '#5e4c3a')
    b.box((wx + 0.02, wy, wz), (0.05, 0.70, 0.70), '#282a2c')
    b.box((wx + 0.04, wy, wz), (0.03, 0.72, 0.045), '#685440')
    b.box((wx + 0.04, wy, wz), (0.03, 0.045, 0.72), '#685440')

    # 4) 外露旧木椽子 + 锈蚀波纹镀锌铁皮人字屋顶（银灰与铁锈橙褐斑驳！）
    ovx, ovy = 0.42, 0.36
    hx = W * 0.5 + ovx
    hy = D * 0.5 + ovy
    z_r = z_eave + rh
    # 外露木椽子
    for i in range(7):
        ry = -hy + 0.15 + (2.0 * hy - 0.30) * i / 6.0
        for sx in (-1, 1):
            b.seg((0, ry, z_r - 0.10), (sx * (hx - 0.06), ry, z_eave - 0.16), 0.06, 0.09, '#62503e')

    # 左右两坡波纹锈铁皮（含厚度双面与锈蚀斑块渐变）
    n_waves = 18
    for sx in (-1, 1):
        p0 = Vector((sx * hx, -hy, z_eave - 0.06))
        p1 = Vector((sx * hx,  hy, z_eave - 0.06))
        q0 = Vector((0.0,     -hy, z_r + 0.04))
        q1 = Vector((0.0,      hy, z_r + 0.04))
        if sx < 0:
            p0, p1 = p1, p0
            q0, q1 = q1, q0
        nrm = (p1 - p0).cross(q0 - p0).normalized()
        if nrm.z < 0:
            nrm = -nrm
        steps_u = n_waves * 2
        steps_v = 4
        verts, vcs = [], []
        for iv in range(steps_v + 1):
            kv = iv / steps_v
            for iu in range(steps_u + 1):
                ku = iu / steps_u
                pt = p0.lerp(p1, ku).lerp(q0.lerp(q1, ku), kv)
                w_off = (0.022 if iu % 2 == 0 else -0.014)
                verts.append(pt + nrm * w_off)
                # 荒漠锈蚀铁皮：银灰镀锌基底叠加自然铁锈橙褐条带
                rust_k = 0.30 + 0.55 * abs(math.sin(ku * 9.3 + kv * 4.7 + sx * 2.0)) * (1.0 - 0.35 * kv)
                col = lerp_col('#a6aeb4', '#944e2a', min(1.0, rust_k))
                shade = 1.06 if iu % 2 == 0 else 0.86
                vcs.append(mul_col(col, shade))
        gw = steps_u + 1
        faces = [(iv * gw + iu, iv * gw + iu + 1, (iv + 1) * gw + iu + 1, (iv + 1) * gw + iu) for iv in range(steps_v) for iu in range(steps_u)]
        b.double_poly(verts, faces, None, vert_colors=vcs, back_darken=0.72)
    # 屋脊锈铁皮盖板
    b.box((0, 0, z_r + 0.07), (0.22, 2.0 * hy + 0.04, 0.06), '#8c5434')

    return b.finish(name)


# ---------------- 5. 12米木桩铁丝围栏 fence（x ∈ [-6.0, +6.0] 严格可首尾无缝拼接！对照 fence.png） ----------------

def build_fence(name='fence', seed=205):
    b = B(seed)
    rnd = random.Random(seed)
    # 4 根歪斜风化旧木桩，均匀位于 x = -4.5, -1.5, +1.5, +4.5（拼接后每根间距恒为 3.0m！）
    post_xs = [-4.5, -1.5, 1.5, 4.5]
    wire_zs = [0.42, 0.78, 1.14]  # 首尾 x = ±6.00 处铁丝精确落在 ( ±6.00, 0.0, z )，实现 100% 首尾无缝相接！
    staple_pts = {z: [Vector((-6.0, 0.0, z))] for z in wire_zs}

    for idx, px in enumerate(post_xs):
        lean_x = (rnd.random() - 0.5) * 0.14
        lean_y = (rnd.random() - 0.5) * 0.12
        ph = 1.32 + (rnd.random() - 0.5) * 0.14
        r_b = 0.078 + rnd.random() * 0.016
        r_t = 0.056 + rnd.random() * 0.014
        # 5 节粗糙微曲的劈裂杜松木桩
        pts, rads, cols = [], [], []
        for s in range(5):
            t = s / 4.0
            cx = px + lean_x * t + math.sin(t * 4.5 + idx) * 0.018
            cy = lean_y * t + math.cos(t * 3.8 + idx) * 0.016
            pts.append(Vector((cx, cy, ph * t)))
            rads.append((r_b * (1.0 - t) + r_t * t) * (0.92 + rnd.random() * 0.16))
            cols.append(ensure_non_leaf(lerp_col('#5a4636', '#988672', t * 0.85)))
        b.tube(pts, rads, None, seg=6, smooth=False, colors=cols)
        # 记录每道铁丝钉在木桩前侧(-Y)的精确挂点
        for z in wire_zs:
            u = max(0.0, min(1.0, z / ph))
            wx = px + lean_x * u
            wy = lean_y * u - (r_b * (1.0 - u) + r_t * u) * 0.95
            staple_pts[z].append(Vector((wx, wy, z)))
            # U 形锈铁钉扣
            b.box((wx, wy - 0.01, z), (0.025, 0.025, 0.032), '#4e3426')

    for z in wire_zs:
        staple_pts[z].append(Vector((6.0, 0.0, z)))

    # 3 道带微微自然垂度与刺结的生锈铁丝（首尾精确收在 x = ±6.0, y = 0.0）
    wire_col = '#4e3c32'
    for w_i, z in enumerate(wire_zs):
        anchors = staple_pts[z]
        full_pts = []
        for seg_i in range(len(anchors) - 1):
            a0, a1 = anchors[seg_i], anchors[seg_i + 1]
            sub = 4
            sag = 0.028 if (0 < seg_i < len(anchors) - 2) else 0.014
            for k in range(sub):
                t = k / sub
                p = a0.lerp(a1, t)
                p.z -= sag * 4.0 * t * (1.0 - t)
                full_pts.append(p)
                # 铁丝刺结（间隔放小小菱形锈结，增强近景质感）
                if k in (1, 3):
                    b.box_rot(p, (0.030, 0.030, 0.030), (0.5, 0.7, 0.3), '#3d2c22')
        full_pts.append(anchors[-1])
        b.tube(full_pts, 0.010, wire_col, seg=4, smooth=False)

    return b.finish(name)


# ---------------- 6. 路边老式邮箱 mailbox（对照 mailbox.png） ----------------

def build_mailbox(name='mailbox', seed=206):
    b = B(seed)
    wood_d = '#6a523c'
    wood_m = '#8c7258'
    wood_l = '#a48c72'

    # 1) 粗糙风化方木立柱 + 斜撑 + 顶托木板（底部略带粗糙埋土感）
    post_pts = [
        Vector((0.0, 0.0, 0.0)),
        Vector((0.01, -0.01, 0.36)),
        Vector((-0.01, 0.01, 0.72)),
        Vector((0.0, 0.0, 1.06)),
    ]
    b.tube(post_pts, [0.068, 0.065, 0.063, 0.060], None, seg=4, smooth=False, colors=[wood_d, wood_m, wood_m, wood_l])
    # 托架横板（沿 Y 方向长，箱口朝 -Y）与前斜木撑
    b.box((0.0, -0.05, 1.08), (0.24, 0.56, 0.048), wood_m)
    b.seg((0.0, -0.04, 0.74), (0.0, -0.25, 1.06), 0.072, 0.068, wood_d)

    # 2) 圆拱顶镀锌铁皮邮箱主体（沿 Y 轴长 0.54m，宽 0.24m，高 0.28m，箱门朝 -Y）
    mw, mh, ml = 0.24, 0.28, 0.54
    z_m0 = 1.105
    # 横截面轮廓（底宽 mw，直壁 0.14m，上半半圆拱 r=0.12m）
    prof_xz = [(-mw * 0.5, 0.0), (-mw * 0.5, 0.14)]
    n_arc = 10
    for k in range(1, n_arc):
        ang = math.pi * (1.0 - k / n_arc)
        prof_xz.append((math.cos(ang) * mw * 0.5, 0.14 + math.sin(ang) * (mw * 0.5)))
    prof_xz.extend([(mw * 0.5, 0.14), (mw * 0.5, 0.0)])

    n_p = len(prof_xz)
    y_f, y_b = -0.32, 0.22
    verts, vcs = [], []
    for y_c, luma in ((y_f, 1.02), (y_b, 0.94)):
        for rx, rz in prof_xz:
            verts.append(Vector((rx, y_c, z_m0 + rz)))
            # 上顶泛亮镀锌银，底沿泛铁锈微暖
            col = lerp_col('#8c7a6c', '#bec6cc', min(1.0, rz / 0.26))
            vcs.append(mul_col(col, luma))
    faces = []
    for k in range(n_p):
        nk = (k + 1) % n_p
        faces.append((k, n_p + k, n_p + nk, nk))
    faces.append(tuple(range(n_p)))
    faces.append(tuple(reversed(range(n_p, 2 * n_p))))
    b.poly(verts, faces, None, smooth=True, vert_colors=vcs)

    # 前后端卷边压筋箍 + 翻盖门框 + 小门拉手与卡扣
    for yy in (y_f + 0.015, y_b - 0.015):
        rim = [Vector((rx * 1.06, yy, z_m0 + rz * 1.03)) for rx, rz in prof_xz]
        b.tube(rim, 0.012, '#86786c', seg=5, smooth=True, cap_start=True, cap_end=True)
    # 正面门板拉手与顶部小锁扣片
    b.box((0.0, y_f - 0.025, z_m0 + 0.24), (0.04, 0.035, 0.05), '#6a584c')
    b.box((0.0, y_f - 0.018, z_m0 + 0.06), (0.16, 0.02, 0.06), '#9aa0a4')

    # 右侧标志性褪色红铁皮小旗（flag，朝前微收/翘起）
    fx = mw * 0.5 + 0.018
    b.cyl((fx, -0.18, z_m0 + 0.14), 0.018, 0.025, '#544a44', seg=8, axis='X')
    b.box((fx + 0.01, -0.06, z_m0 + 0.15), (0.014, 0.22, 0.024), '#b63c2c')
    b.box((fx + 0.01,  0.03, z_m0 + 0.11), (0.014, 0.075, 0.085), '#b63c2c')

    return b.finish(name)
