# 北海道铁路、港口与街景小物高细节程序化建模：
# train / crossing (带可抬落子物体 arm) / pole / pole_lamp / boat / lighthouse / vending_snow
import bpy, math, random
from mathutils import Vector, Matrix
from inaka_core import (
    B, srgb, lerp_col, mul_col, vary,
    CONCRETE, CONCRETE_D, IRON_D, IRON, STEEL,
)
from inaka_props import _porcelain_insulator
from vista_common import SNOW_W, SNOW_M, snow_col, add_snow_pillow


# ---------------- 1. 单厢柴油车 train（长 21m 沿 X 轴，双端驾驶室，无真实标志，对照 train.png） ----------------

def build_train(name='train', seed=111):
    b = B(seed)
    L = 21.0
    W = 2.90
    z_floor = 1.12
    z_roof = 3.68
    body_w = '#f4f7f8'
    body_roof = '#e4e8ec'
    stripe_g = '#2b924e'
    stripe_y = '#eed024'
    dark_u = '#2b2e34'
    frame_s = '#9ca4ac'

    # 1) 两副双轴转向架（车轮精准落在 z=0！）+ 车底柴油动力设备
    wheel_r = 0.43
    for bx in (-6.85, 6.85):
        # 转向架侧梁与中央摇枕
        for sy in (-1, 1):
            b.box((bx, sy * 0.92, wheel_r + 0.12), (2.55, 0.16, 0.24), '#30343a')
            # 两组螺旋弹簧与轴箱
            for dx in (-0.95, 0.95):
                b.cyl((bx + dx, sy * 0.98, wheel_r), 0.13, 0.14, '#3c4048', seg=8, axis='Y')
            b.cyl((bx, sy * 0.94, wheel_r - 0.04), 0.12, 0.26, '#444850', seg=8)
        b.box((bx, 0, wheel_r + 0.26), (0.85, 1.95, 0.26), dark_u)
        # 4 个钢轮（带踏面与轮缘，最低点精确落在 z = 0.0）
        for dx in (-0.95, 0.95):
            b.cyl((bx + dx, 0, wheel_r), 0.075, 1.72, '#3a3e44', seg=8, axis='Y')
            for sy in (-1, 1):
                b.cyl((bx + dx, sy * 0.72, wheel_r), wheel_r, 0.11, '#4c525a', seg=14, axis='Y', smooth=True)
                b.cyl((bx + dx, sy * 0.65, wheel_r), wheel_r + 0.03, 0.03, '#383c42', seg=14, axis='Y')
    # 车底纵梁、柴油发动机组、油箱、风缸
    b.box((0, 0, z_floor - 0.10), (L - 0.35, W - 0.18, 0.20), dark_u)
    b.box((-2.2, 0, z_floor - 0.45), (3.4, 1.65, 0.56), '#2e3238')
    b.box((2.1, 0, z_floor - 0.42), (2.8, 1.50, 0.50), '#353a42')
    for rx in (-0.2, 0.45):
        b.cyl((rx, -0.65, z_floor - 0.42), 0.16, 1.05, '#464c54', seg=10, axis='X')

    # 2) 两端除雪犁（排障器）与自动车钩（±X 端）
    for sx in (-1, 1):
        ex = sx * (L * 0.5)
        # V 形重型深灰除雪犁
        plow_pts = [
            (ex - sx * 0.28, -1.18, 0.20),
            (ex + sx * 0.12, 0.0, 0.18),
            (ex - sx * 0.28, 1.18, 0.20),
            (ex - sx * 0.38, -1.16, 0.76),
            (ex - sx * 0.05, 0.0, 0.76),
            (ex - sx * 0.38, 1.16, 0.76),
        ]
        f1 = (0, 1, 4, 3) if sx > 0 else (3, 4, 1, 0)
        f2 = (1, 2, 5, 4) if sx > 0 else (4, 5, 2, 1)
        b.double_poly(plow_pts, [f1, f2], '#2c3038')
        # 车钩 + 缓冲板
        b.box((ex + sx * 0.14, 0, 0.86), (0.48, 0.28, 0.26), '#24282e')
        b.box((ex - sx * 0.02, 0, 0.98), (0.12, W - 0.16, 0.22), '#32363e')

    # 3) 车身主体（横断面带圆润肩部与拱形车顶，沿 X 拉伸）
    # 车体下半白/绿/黄腰线与上半带窗墙面分层，色带锐利清晰！
    z_g0, z_g1 = 1.48, 1.84  # 绿色宽腰线
    z_y0, z_y1 = 1.84, 1.98  # 黄色细腰线
    z_eave = 3.44
    # 实心主体各色带（微缩 0.01 防窗洞穿插，由干净带状分段组成）
    bands = [
        (z_floor, z_g0, body_w),
        (z_g0, z_g1, stripe_g),
        (z_y0, z_y1, stripe_y),
        (z_y1, z_eave, body_w),
    ]
    for za, zb, col in bands:
        b.box((0, 0, (za + zb) * 0.5), (L - 0.16, W, zb - za + 0.002), col)
    # 两端微斜/微收的前脸面板（让车头有 KiHa 40/54 立体折面感）
    for sx in (-1, 1):
        ex = sx * (L * 0.5 - 0.08)
        for za, zb, col in bands:
            b.box((ex + sx * 0.05, 0, (za + zb) * 0.5), (0.12, W - 0.14, zb - za + 0.002), col)

    # 拱形光滑车顶
    roof_prof_yz = [
        (-W * 0.5, z_eave),
        (-W * 0.46, z_eave + 0.16),
        (-W * 0.30, z_roof - 0.04),
        (0.0, z_roof),
        (W * 0.30, z_roof - 0.04),
        (W * 0.46, z_eave + 0.16),
        (W * 0.5, z_eave),
    ]
    n_p = len(roof_prof_yz)
    r_verts = []
    for sx in (-1, 1):
        xx = sx * (L * 0.5 - 0.04)
        for ry, rz in roof_prof_yz:
            r_verts.append(Vector((xx, ry, rz)))
    r_faces = []
    for k in range(n_p - 1):
        r_faces.append((k, k + 1, n_p + k + 1, n_p + k))
    r_faces.append(tuple(range(n_p)))
    r_faces.append(tuple(reversed(range(n_p, 2 * n_p))))
    b.poly(r_verts, r_faces, body_roof, smooth=True)

    # 4) 两侧客室车窗（8 组田字/上下推拉发光车窗 glow + 银色窗框）与两端车门
    win_z = 2.66
    win_h = 0.86
    win_w = 1.24
    # 8 扇主体客窗，分布在 x = -5.6..+5.6
    for sy in (-1, 1):
        yw = sy * (W * 0.5)
        for i in range(8):
            wx = -5.60 + i * 1.60
            # 外银框 + 发光玻璃 + 中横梃
            b.box((wx, yw + sy * 0.015, win_z), (win_w + 0.09, 0.04, win_h + 0.09), frame_s)
            b.box((wx, yw + sy * 0.025, win_z), (win_w, 0.03, win_h), '#ffdfa4', glow=True)
            b.box((wx, yw + sy * 0.038, win_z + 0.12), (win_w + 0.02, 0.02, 0.04), frame_s)
        # 两端客室车门（x = ±7.85）+ 驾驶室侧窗（x = ±9.45）
        for sx in (-1, 1):
            dx = sx * 7.82
            b.box((dx, yw + sy * 0.010, 2.28), (1.06, 0.04, 2.16), '#d2d8dc')
            b.box((dx, yw + sy * 0.022, 2.66), (0.64, 0.03, 0.84), '#ffdfa4', glow=True)
            # 车门底部不锈钢踏阶
            b.box((dx, yw + sy * 0.03, 1.10), (1.08, 0.12, 0.18), '#586068')
            # 驾驶室侧小窗
            cx = sx * 9.45
            b.box((cx, yw + sy * 0.015, win_z), (0.90, 0.04, win_h + 0.06), frame_s)
            b.box((cx, yw + sy * 0.025, win_z), (0.80, 0.03, win_h - 0.02), '#ffdfa4', glow=True)
        # 车门旁小竖向扶手
        for sx in (-1, 1):
            for ox in (-0.60, 0.60):
                b.cyl((sx * 7.82 + ox, yw + sy * 0.055, 1.55), 0.014, 0.72, STEEL, seg=6)

    # 5) 双端车头驾驶室细节（前挡风窗 glow、中央贯通门、两盏圆形发光车头灯 glow、红色尾灯、空白方向幕）
    for sx in (-1, 1):
        ex = sx * (L * 0.5 + 0.02)
        # 中央贯通门框与橡胶风挡折框
        b.box((ex + sx * 0.02, 0, 2.38), (0.09, 0.84, 2.18), '#7a828a')
        b.box((ex + sx * 0.05, 0, 2.38), (0.05, 0.68, 2.02), body_w)
        b.box((ex + sx * 0.065, 0, 2.74), (0.04, 0.44, 0.72), '#ffe4b0', glow=True)
        # 左右前驾驶挡风玻璃（glow）
        for sy in (-1, 1):
            b.box((ex + sx * 0.01, sy * 0.88, 2.76), (0.06, 0.78, 0.76), frame_s)
            b.box((ex + sx * 0.03, sy * 0.88, 2.76), (0.04, 0.68, 0.66), '#ffe4b0', glow=True)
            # 顶部空白方向幕/前额灯箱外框
            b.box((ex + sx * 0.02, sy * 0.75, 3.40), (0.14, 0.44, 0.24), '#6c747c')
            # 两盏车头大灯（上方标准双圆大灯，glow！）
            b.cyl((ex + sx * 0.08, sy * 0.76, 3.40), 0.115, 0.12, '#424850', seg=10, axis='X')
            b.cyl((ex + sx * 0.13, sy * 0.76, 3.40), 0.088, 0.05, '#fff6d8', seg=10, axis='X', glow=True)
            # 下方腰线处的红色尾灯与雨刷/扶手
            b.cyl((ex + sx * 0.04, sy * 0.98, 1.66), 0.068, 0.06, '#383c42', seg=8, axis='X')
            b.cyl((ex + sx * 0.065, sy * 0.98, 1.66), 0.050, 0.03, '#d62820', seg=8, axis='X')
            b.cyl((ex + sx * 0.06, sy * 1.28, 1.65), 0.016, 1.05, STEEL, seg=6)
        # 顶部中央空白终点牌箱
        b.box((ex + sx * 0.02, 0, 3.42), (0.12, 0.74, 0.24), '#3c4248')
        b.box((ex + sx * 0.08, 0, 3.42), (0.02, 0.62, 0.14), '#d8dee4')

    # 6) 车顶空调/通风罩、柴油排气管、以及车顶轻柔积雪！
    for vx in (-7.2, -3.2, 0.0, 3.2, 7.2):
        b.box((vx, 0, z_roof + 0.10), (1.75 if abs(vx) < 5 else 1.25, 1.28, 0.22), '#aeb6be', top=(0.90, 0.90))
        add_snow_pillow(b, (vx, 0, z_roof + 0.20), (1.45 if abs(vx) < 5 else 1.05, 1.08), height=0.10, nx=4, ny=3, seed=seed + int(abs(vx * 7)))
    # 两个紧凑柴油排气管（车顶一侧）
    for ex_x in (-1.45, 1.45):
        b.cyl((ex_x, 0.55, z_roof - 0.05), 0.09, 0.34, '#44484e', seg=8)
    # 车顶两段轻柔积雪条
    add_snow_pillow(b, (-5.1, 0, z_roof - 0.03), (3.1, 1.95), height=0.13, nx=6, ny=4, drip=0.02, seed=seed + 71)
    add_snow_pillow(b, (5.1, 0, z_roof - 0.03), (3.1, 1.95), height=0.13, nx=6, ny=4, drip=0.02, seed=seed + 72)

    return b.finish(name, glow_color='#ffe4a8')


# ---------------- 2. 铁路道口 crossing（含独立可抬落栏杆子物体 arm，对照 crossing.png） ----------------

def build_crossing(name='crossing', seed=112):
    # 主体立柱 + 红灯 + 黄黑叉形牌 + 继电器箱 + 底座
    b = B(seed)
    yellow = '#ecc822'
    black = '#24262a'

    # 1) 混凝土基础与底座法兰
    b.box((0, 0, 0.13), (0.58, 0.58, 0.26), CONCRETE_D, top=(0.92, 0.92))
    b.cyl((0, 0, 0.26), 0.16, 0.10, '#444850', seg=10)

    # 2) 黄黑相间警示立柱（z=0.34..3.65m）
    z0, z1 = 0.34, 3.65
    n_seg = 12
    dh = (z1 - z0) / n_seg
    for i in range(n_seg):
        col = yellow if i % 2 == 0 else black
        b.cyl((0, 0, z0 + i * dh), 0.088, dh + 0.002, col, seg=12, r2=0.085, cap=(i == n_seg - 1))
    # 杆顶圆帽 + 小雪点
    b.sphere((0, 0, z1 + 0.02), 0.095, '#383c42', sub=1, scale=(1, 1, 0.6))

    # 3) 底部灰铁皮控制箱（带顶雪）
    b.box((0.28, 0.02, 0.72), (0.34, 0.28, 0.54), '#8a929a')
    b.box((0.28, -0.13, 0.72), (0.28, 0.02, 0.46), '#9aa2aa')
    b.seg((0.06, 0.02, 0.85), (0.14, 0.02, 0.85), 0.05, 0.05, IRON_D)
    add_snow_pillow(b, (0.28, 0.02, 0.99), (0.34, 0.28), height=0.07, nx=4, ny=3, seed=seed + 1)

    # 4) 栏杆转轴驱动电机箱（pivot 在 (-0.12, -0.08, 1.15)）
    pivot = Vector((-0.12, -0.08, 1.15))
    b.box((0.18, -0.06, 1.15), (0.36, 0.34, 0.36), '#d4aa24')
    b.box((0.18, -0.06, 1.15), (0.24, 0.38, 0.24), '#3a3e44')
    b.cyl((pivot.x + 0.08, pivot.y, pivot.z), 0.065, 0.28, IRON_D, seg=10, axis='Y')
    add_snow_pillow(b, (0.18, -0.06, 1.33), (0.34, 0.32), height=0.065, nx=3, ny=3, seed=seed + 2)

    # 5) 两盏经典红灯（横杆 + 圆形黑背板 + 鲜红灯镜 + 黑色圆柱遮阳罩 + 罩顶积雪）
    lz = 2.48
    b.box((0, -0.09, lz), (0.94, 0.075, 0.085), black)
    for sx in (-1, 1):
        lx = sx * 0.38
        # 圆形黑背景盘
        b.cyl((lx, -0.14, lz), 0.21, 0.04, black, seg=14, axis='Y')
        # 鲜红信号灯镜面（清晰易辨，留给游戏程序或材质独立闪烁）
        b.cyl((lx, -0.175, lz), 0.145, 0.045, '#e2241c', seg=14, axis='Y', smooth=True)
        # 上半圈圆柱形防雪遮阳罩（半圆拱）
        visor_pts = []
        n_v = 8
        for k in range(n_v + 1):
            ang = math.pi * k / n_v
            vx = lx + math.cos(ang) * 0.165
            vz = lz + math.sin(ang) * 0.165
            visor_pts.append((vx, -0.15, vz))
            visor_pts.append((vx, -0.34, vz))
        vfaces = [(k * 2, k * 2 + 1, (k + 1) * 2 + 1, (k + 1) * 2) for k in range(n_v)]
        b.double_poly(visor_pts, vfaces, '#26282e')
        # 遮阳罩顶小雪帽
        add_snow_pillow(b, (lx, -0.24, lz + 0.165), (0.24, 0.18), height=0.055, nx=3, ny=2, seed=seed + (10 if sx < 0 else 11))

    # 6) 顶部黄黑斜纹叉形牌（X 形，朝向 -Y，无文字）
    xz = 3.22
    arm_len = 1.18
    for ang in (0.64, -0.64):
        n_st = 7
        sl = arm_len / n_st
        ca, sa = math.cos(ang), math.sin(ang)
        for k in range(n_st):
            t0 = -0.5 + k / n_st
            t1 = t0 + 1.0 / n_st
            tm = (t0 + t1) * 0.5 * arm_len
            cx = tm * ca
            cz = xz + tm * sa
            col = yellow if k % 2 == 0 else black
            # 沿局部旋转放置条段
            b.box_rot((cx, -0.12 + (0.015 if ang > 0 else -0.015), cz), (sl + 0.005, 0.032, 0.175), (0.0, -ang, 0.0), col)

    post_ob = b.finish(name)

    # 7) 独立子物体 arm（原点精确落在转轴 pivot，栏杆水平放下状态沿 -X 伸出 4.5m！）
    ba = B(seed + 100)
    # 铰接夹板与向 +X 伸出的配重块
    ba.box((0.0, 0.0, 0.0), (0.28, 0.14, 0.18), IRON_D)
    ba.seg((0.0, 0.0, 0.0), (0.72, 0.0, 0.0), 0.07, 0.07, yellow)
    ba.cyl((0.68, 0.0, 0.0), 0.145, 0.16, '#3a3e44', seg=12, axis='Y')
    ba.cyl((0.68, 0.0, 0.0), 0.115, 0.18, yellow, seg=12, axis='Y')
    # 黄黑交替细长栏杆（沿 -X 延伸 4.5m，微收细，末端红反光帽）
    bar_len = 4.50
    n_b = 14
    bl = bar_len / n_b
    for k in range(n_b):
        x0 = -0.10 - k * bl
        r0 = 0.044 - 0.016 * (k / n_b)
        r1 = 0.044 - 0.016 * ((k + 1) / n_b)
        col = yellow if k % 2 == 0 else black
        ba.cyl((x0 - bl * 0.5, 0.0, 0.0), r0, bl + 0.002, col, seg=8, r2=r1, axis='X', smooth=True)
    ba.sphere((-0.10 - bar_len, 0.0, 0.0), 0.034, '#d82820', sub=1)
    arm_ob = ba.finish('arm')
    arm_ob.parent = post_ob
    arm_ob.location = pivot

    return [post_ob, arm_ob]


# ---------------- 3. 北海道冬季电线杆 pole / pole_lamp（精确对齐 hokkaido.js 挂线高度！） ----------------

def build_pole_hk(name='pole', seed=113, lamp=False):
    b = B(seed)
    H = 10.12  # 匹配 hokkaido.js 约 10m 杆高（加顶雪约 10.3m）

    # 1) 偏暖灰褐的旧木/风化水泥杆身（下部略深潮湿）
    b.cyl((0, 0, 0.0), 0.175, 2.2, '#7d7366', seg=12, r2=0.158, smooth=True, grad=(0.86, 1.0))
    b.cyl((0, 0, 2.2), 0.158, H - 2.2, '#a8a296', seg=12, r2=0.102, smooth=True, grad=(0.92, 1.04))
    # 杆顶圆润一小撮白雪帽（对照 pole.png！）
    add_snow_pillow(b, (0, 0, H - 0.01), (0.28, 0.28), height=0.17, nx=6, ny=6, drip=0.04, seed=seed + 1)

    # 2) 两层钢横担 + V 形斜撑 + 白色瓷瓶 + 横担上细雪条
    # 对齐 hokkaido.js 电线挂点：上层 x=(-0.9, 0, 0.9) z=9.40；下层 x=(-0.65, 0.65) z=8.40
    arms = [
        (9.23, 2.15, (-0.90, 0.0, 0.90), 8.68),
        (8.23, 1.56, (-0.65, 0.65),      7.74),
    ]
    for idx, (z_arm, w, ins_xs, z_brace) in enumerate(arms):
        r_here = 0.175 + (0.102 - 0.175) * (z_arm / H)
        b.cyl((0, 0, z_arm - 0.04), r_here + 0.016, 0.08, STEEL, seg=12)
        b.box((0, -r_here - 0.04, z_arm), (w, 0.085, 0.095), '#686e74')
        r_b = 0.175 + (0.102 - 0.175) * (z_brace / H)
        b.cyl((0, 0, z_brace - 0.03), r_b + 0.016, 0.065, STEEL, seg=12)
        for sx in (-1, 1):
            b.seg((0, -r_b - 0.02, z_brace), (sx * (w * 0.34), -r_here - 0.04, z_arm - 0.02), 0.032, 0.028, '#5c6268')
        for ix in ins_xs:
            _porcelain_insulator(b, ix, -r_here - 0.04, z_arm + 0.045, scale=0.80)
        # 横担顶上的薄雪脊（避开瓷瓶）
        add_snow_pillow(b, (0, -r_here - 0.04, z_arm + 0.048), (w - 0.10, 0.09), height=0.055, nx=8, ny=2, drip=0.015, seed=seed + 10 + idx)

    # 3) 中下部通讯线挂架（z=6.20 对齐 hokkaido.js 第 5 根线）+ 攀登脚钉
    r_c = 0.175 + (0.102 - 0.175) * (6.20 / H)
    b.cyl((0, 0, 6.16), r_c + 0.016, 0.065, STEEL, seg=10)
    b.box((0.20, 0.0, 6.20), (0.44, 0.055, 0.055), '#6a7076')
    if not lamp:
        loop_pts = [Vector((0.26 + math.cos(k / 14.0 * math.tau) * 0.17, 0.04, 5.95 + math.sin(k / 14.0 * math.tau) * 0.22)) for k in range(15)]
        b.tube(loop_pts, 0.014, IRON_D, seg=5, smooth=True, cap_start=False, cap_end=False)

    for i in range(12):
        zz = 2.40 + i * 0.50
        rr = 0.175 + (0.102 - 0.175) * (zz / H)
        sx = 1 if i % 2 == 0 else -1
        b.seg((sx * (rr - 0.01), 0, zz), (sx * (rr + 0.16), 0, zz), 0.022, 0.022, '#6c7074')
        b.box((sx * (rr + 0.16), 0, zz + 0.024), (0.022, 0.024, 0.048), '#6c7074')

    # 4) 可选：北海道路灯款（对照 pole_lamp.png，弯曲镀锌鹅颈臂 + 白灯伞 + 顶雪 + 暖光 glow 灯罩！）
    if lamp:
        for bz in (6.80, 7.20):
            rr = 0.175 + (0.102 - 0.175) * (bz / H)
            b.cyl((0, 0, bz - 0.03), rr + 0.018, 0.065, STEEL, seg=12)
        arm_pts = [
            Vector((0, -0.15, 6.75)),
            Vector((0, -0.16, 7.38)),
            Vector((0, -0.34, 7.72)),
            Vector((0, -0.78, 7.90)),
            Vector((0, -1.08, 7.82)),
            Vector((0, -1.12, 7.68)),
        ]
        b.tube(arm_pts, 0.028, '#9aa2aa', seg=8, smooth=True)
        # 复古弧形防雪灯伞 + 顶上小雪枕 + 发光灯罩 (glow)
        b.lathe(
            (0, -1.12, 7.52),
            [(0.31, 0.0), (0.30, 0.035), (0.15, 0.12), (0.075, 0.15), (0.065, 0.20)],
            '#dde2e6', seg=14, smooth=True, cap_bot=False,
            colors=['#6c747c', '#dce0e4', '#eaedf0', '#848c94', '#6c747c'],
        )
        b.cyl((0, -1.12, 7.525), 0.29, 0.015, '#f2f0e6', seg=14)
        b.sphere((0, -1.12, 7.49), 0.165, '#fff0c4', sub=2, scale=(1.0, 1.0, 0.65), smooth=True, glow=True)
        add_snow_pillow(b, (0, -1.12, 7.62), (0.48, 0.48), height=0.11, nx=6, ny=6, drip=0.03, seed=seed + 25)

    return b.finish(name, glow_color='#fff0c4')


# ---------------- 4. 白色小渔船 boat（船头朝 -Y，长约 10.4m，对照 boat.png） ----------------

def build_boat(name='boat', seed=114):
    b = B(seed)
    # 沿 Y 轴放样 11 个优雅外飘渔船横截面：y = -5.2 (船艏) .. +5.1 (船艉)
    # 船艏过渡平顺柔和，无折痕扭曲！
    stations = [
        (-5.20, 0.08, 0.03, 0.78, 0.90, 1.88),
        (-4.85, 0.36, 0.14, 0.42, 0.68, 1.83),
        (-4.25, 0.74, 0.36, 0.18, 0.52, 1.74),
        (-3.30, 1.12, 0.68, 0.06, 0.44, 1.62),
        (-2.00, 1.42, 1.04, 0.02, 0.40, 1.50),
        (-0.40, 1.56, 1.24, 0.00, 0.40, 1.42),
        ( 1.20, 1.58, 1.28, 0.02, 0.42, 1.38),
        ( 2.80, 1.54, 1.24, 0.06, 0.46, 1.38),
        ( 4.20, 1.44, 1.16, 0.12, 0.50, 1.40),
        ( 5.10, 1.34, 1.08, 0.18, 0.54, 1.42),
    ]
    hull_w = '#f4f7fa'
    hull_navy = '#224676'
    hull_red = '#902626'
    pts_per_s = 7
    verts, vcs = [], []
    for y, bt, bc, zk, zc, zg in stations:
        zw = zc + (zg - zc) * 0.20
        bw = bc + (bt - bc) * 0.24
        ring = [
            ((-bt, y, zg), hull_w),
            ((-bw, y, zw), hull_navy),
            ((-bc, y, zc), hull_red),
            ((0.0, y, zk), mul_col(hull_red, 0.78)),
            ((bc, y, zc), hull_red),
            ((bw, y, zw), hull_navy),
            ((bt, y, zg), hull_w),
        ]
        for p, col in ring:
            verts.append(Vector(p))
            vcs.append(srgb(col))
    faces = []
    n_s = len(stations)
    for j in range(n_s - 1):
        b0 = j * pts_per_s
        b1 = (j + 1) * pts_per_s
        for k in range(pts_per_s - 1):
            faces.append((b0 + k, b1 + k, b1 + k + 1, b0 + k + 1))
    last = (n_s - 1) * pts_per_s
    faces.append(tuple(range(last, last + pts_per_s)))
    faces.append(tuple(reversed(range(pts_per_s))))
    b.poly(verts, faces, None, smooth=True, vert_colors=vcs)

    # 甲板底面与内舷壁 + 前船艏抬升甲板 + 黑色防撞橡胶护舷 + 船舷顶雪边！
    deck_z = 0.96
    for j in range(n_s - 1):
        y0, bt0, bc0, _, zc0, zg0 = stations[j]
        y1, bt1, bc1, _, zc1, zg1 = stations[j + 1]
        in0, in1 = max(0.03, bt0 - 0.15), max(0.03, bt1 - 0.15)
        dz0 = deck_z + (0.36 if j <= 2 else 0.0)
        dz1 = deck_z + (0.36 if j + 1 <= 2 else 0.0)
        # 严格按当前高度插值船体实际内宽，防止前船艏甲板角穿出外飘船壳！
        k0 = max(0.0, min(1.0, (dz0 - zc0) / max(0.1, zg0 - zc0)))
        k1 = max(0.0, min(1.0, (dz1 - zc1) / max(0.1, zg1 - zc1)))
        dw0 = max(0.02, min(in0, bc0 + (bt0 - bc0) * k0 - 0.12))
        dw1 = max(0.02, min(in1, bc1 + (bt1 - bc1) * k1 - 0.12))
        b.poly([(-dw0, y0, dz0), (dw0, y0, dz0), (dw1, y1, dz1), (-dw1, y1, dz1)], [(0, 1, 2, 3)], '#d8e0e6')
        for sx in (-1, 1):
            p_out0 = Vector((sx * bt0, y0, zg0))
            p_out1 = Vector((sx * bt1, y1, zg1))
            p_in0 = Vector((sx * in0, y0, zg0))
            p_in1 = Vector((sx * in1, y1, zg1))
            p_d0 = Vector((sx * dw0, y0, dz0))
            p_d1 = Vector((sx * dw1, y1, dz1))
            if sx < 0:
                b.poly([p_out0, p_out1, p_in1, p_in0], [(0, 1, 2, 3)], hull_w)
                b.poly([p_in0, p_in1, p_d1, p_d0], [(0, 1, 2, 3)], '#dce2e8')
            else:
                b.poly([p_out0, p_in0, p_in1, p_out1], [(0, 1, 2, 3)], hull_w)
                b.poly([p_in0, p_d0, p_d1, p_in1], [(0, 1, 2, 3)], '#dce2e8')
            b.seg(p_out0 + Vector((sx * 0.025, 0, -0.06)), p_out1 + Vector((sx * 0.025, 0, -0.06)), 0.065, 0.075, '#262a30')
            if 1 <= j <= n_s - 2:
                b.seg(p_out0.lerp(p_in0, 0.5) + Vector((0, 0, 0.04)), p_out1.lerp(p_in1, 0.5) + Vector((0, 0, 0.04)), 0.15, 0.075, SNOW_W)
    y_last, bt_last, _, _, _, zg_last = stations[-1]
    in_last = bt_last - 0.15
    b.poly([(-in_last, y_last - 0.10, deck_z), (in_last, y_last - 0.10, deck_z), (in_last, y_last - 0.10, zg_last), (-in_last, y_last - 0.10, zg_last)], [(0, 3, 2, 1)], '#dce2e8')

    # 船头高甲板与不锈钢船首护栏
    bow_rail = []
    for j in (4, 3, 2, 1, 0):
        y, bt, _, _, _, zg = stations[j]
        bow_rail.append(Vector((-bt + 0.06, y, zg + 0.44)))
    for j in (1, 2, 3, 4):
        y, bt, _, _, _, zg = stations[j]
        bow_rail.append(Vector((bt - 0.06, y, zg + 0.44)))
    b.tube(bow_rail, 0.022, '#cfd6de', seg=6, smooth=True)
    for j in (0, 2, 4):
        y, bt, _, _, _, zg = stations[j]
        if j == 0:
            b.seg((0, y + 0.14, zg), (0, y + 0.06, zg + 0.44), 0.025, 0.025, '#c0c8d0')
        else:
            for sx in (-1, 1):
                b.seg((sx * (bt - 0.06), y, zg), (sx * (bt - 0.06), y, zg + 0.44), 0.024, 0.024, '#c0c8d0')

    # 2) 蓝白相间驾驶舱（中后部 y = 0.0..2.65）
    cab_y0, cab_y1 = 0.05, 2.55
    cab_yc = (cab_y0 + cab_y1) * 0.5
    cab_w = 2.02
    cab_h = 1.92
    cab_blue = '#2a5896'
    # 下半深蓝舱壁、上半白色窗带（前窗微向前倾）
    b.box((0, cab_yc, deck_z + 0.52), (cab_w, cab_y1 - cab_y0, 1.04), cab_blue)
    b.box((0, cab_yc + 0.05, deck_z + 1.44), (cab_w - 0.06, cab_y1 - cab_y0 - 0.10, 0.84), hull_w, top=(0.94, 0.92))
    # 驾驶舱顶檐与积雪枕
    b.box((0, cab_yc - 0.04, deck_z + cab_h), (cab_w + 0.16, cab_y1 - cab_y0 + 0.22, 0.12), cab_blue)
    add_snow_pillow(b, (0, cab_yc - 0.02, deck_z + cab_h + 0.05), (cab_w + 0.08, cab_y1 - cab_y0 + 0.12), height=0.17, nx=6, ny=6, drip=0.04, seed=seed + 10)
    # 前挡风三联玻璃窗（深蓝反光玻璃 + 白色窗框）+ 两侧驾驶舱窗与小门
    for wx in (-0.56, 0.0, 0.56):
        b.box((wx, cab_y0 - 0.01, deck_z + 1.44), (0.48, 0.05, 0.56), '#304458')
    for sx in (-1, 1):
        b.box((sx * (cab_w * 0.5 - 0.01), cab_yc - 0.35, deck_z + 1.44), (0.05, 0.88, 0.54), '#304458')
        b.box((sx * (cab_w * 0.5 + 0.01), cab_yc + 0.52, deck_z + 0.96), (0.04, 0.68, 1.56), '#d8e0e6')
        b.box((sx * (cab_w * 0.5 + 0.025), cab_yc + 0.52, deck_z + 1.42), (0.03, 0.44, 0.50), '#304458')

    # 3) 驾驶舱顶桅杆 + 小雷达罩 + 横担信号灯
    mz0 = deck_z + cab_h + 0.08
    for sx in (-1, 1):
        b.seg((sx * 0.56, cab_yc + 0.35, mz0), (sx * 0.34, cab_yc + 0.52, mz0 + 1.45), 0.045, 0.045, hull_w)
    b.seg((-0.44, cab_yc + 0.48, mz0 + 1.15), (0.44, cab_yc + 0.48, mz0 + 1.15), 0.04, 0.04, hull_w)
    b.seg((-0.36, cab_yc + 0.52, mz0 + 1.45), (0.36, cab_yc + 0.52, mz0 + 1.45), 0.035, 0.035, hull_w)
    # 白色圆形小航海雷达罩 + 顶部细天线
    b.cyl((0, cab_yc + 0.40, mz0 + 0.62), 0.30, 0.20, '#f0f4f8', seg=12, smooth=True)
    b.seg((0, cab_yc + 0.52, mz0 + 1.45), (0, cab_yc + 0.52, mz0 + 2.15), 0.025, 0.025, '#c4ccd4')
    b.cyl((-0.34, cab_yc + 0.48, mz0 + 1.24), 0.04, 0.08, '#cc2820', seg=8)  # 左红航灯
    b.cyl((0.34, cab_yc + 0.48, mz0 + 1.24), 0.04, 0.08, '#289a44', seg=8)   # 右绿航灯

    # 4) 甲板渔箱、缆绳与前甲板轻柔积雪（严丝合缝收在船舷内侧，绝不穿船壳！）
    b.box((-0.55, -0.58, deck_z + 0.24), (0.72, 0.52, 0.48), '#346aa6')
    b.box((0.22, -0.52, deck_z + 0.22), (0.68, 0.48, 0.44), '#3d74b0')
    add_snow_pillow(b, (0.0, -2.05, deck_z + 0.02), (1.50, 1.65), height=0.14, nx=5, ny=5, seed=seed + 22)
    add_snow_pillow(b, (0.0, -3.72, deck_z + 0.36), (0.76, 1.05), height=0.13, nx=4, ny=4, seed=seed + 24)
    add_snow_pillow(b, (-0.55, -0.58, deck_z + 0.48), (0.68, 0.48), height=0.06, nx=3, ny=3, seed=seed + 23)

    # 船尾舵与螺旋桨轴保护踵
    b.box((0, 3.8, 0.14), (0.14, 2.1, 0.28), '#581c1c')
    return b.finish(name)


# ---------------- 5. 红白小灯塔 lighthouse（高约 12.2m，灯室 glow，对照 lighthouse.png） ----------------

def build_lighthouse(name='lighthouse', seed=115):
    b = B(seed)
    red = '#cc3422'
    white = '#f0f2f4'

    # 1) 八角形厚重混凝土基台（z=0..2.25m）+ 铁门 + 基台肩部白雪圈
    b.cyl((0, 0, 0.0), 1.92, 0.35, '#8a8e94', seg=8, rot_z=math.pi / 8.0) if False else None
    # 用 lathe 带 rot_z=pi/8 做正对 -Y 的八角形基台！
    b.lathe(
        (0, 0, 0.0),
        [(1.94, 0.0), (1.92, 0.28), (1.84, 0.34), (1.76, 2.18), (1.82, 2.26), (1.42, 2.32)],
        CONCRETE, seg=8, rot_z=math.pi / 8.0,
        colors=['#7c8086', '#8a8e94', '#a8acb0', '#b4b8bc', '#989ca2', '#c8ccd0'],
    )
    # 正面(-Y) 凹陷小铁门
    b.box((0, -1.66, 1.05), (0.86, 0.18, 1.62), '#52565c')
    b.box((0, -1.73, 1.05), (0.68, 0.06, 1.46), '#6c7278')
    # 基台顶一圈厚雪领子
    b.lathe(
        (0, 0, 2.24),
        [(1.82, 0.0), (1.86, 0.10), (1.72, 0.26), (1.36, 0.34)],
        SNOW_W, seg=12, smooth=True,
        colors=[snow_col(0.50), snow_col(0.75), snow_col(0.95), snow_col(1.0)],
    )

    # 2) 红白相间微收分圆柱塔身（5 段：红-白-红-白-红，z=2.25..9.00m）
    z_t0, z_t1 = 2.25, 8.95
    r_t0, r_t1 = 1.38, 1.08
    n_bands = 5
    bh = (z_t1 - z_t0) / n_bands
    for i in range(n_bands):
        za = z_t0 + i * bh
        zb = za + bh
        ra = r_t0 + (r_t1 - r_t0) * (i / n_bands)
        rb = r_t0 + (r_t1 - r_t0) * ((i + 1) / n_bands)
        col = red if i % 2 == 0 else white
        b.cyl((0, 0, za), ra, bh + 0.004, col, seg=20, r2=rb, smooth=True, cap=False)
    # 塔身小观察窗
    b.box((0, -1.24, 5.45), (0.34, 0.10, 0.52), '#3c4248')

    # 3) 顶部外挑圆形观景挑台（Gallery）+ 暗灰铁护栏 + 走廊雪边
    b.lathe(
        (0, 0, 8.85),
        [(1.09, 0.0), (1.24, 0.18), (1.58, 0.36), (1.60, 0.50), (1.54, 0.52)],
        '#d6dce0', seg=20, smooth=True,
        colors=['#8e949a', '#aeb4ba', '#d8dde2', '#eef2f5', '#c8ced4'],
    )
    # 护栏（14 根立柱 + 上中两道圆环扶手）
    gz = 9.37
    gr = 1.50
    for k in range(14):
        a = k / 14.0 * math.tau
        b.cyl((math.cos(a) * gr, math.sin(a) * gr, gz), 0.025, 0.88, '#383e46', seg=6)
    for rz in (gz + 0.44, gz + 0.86):
        ring_pts = [Vector((math.cos(k / 20.0 * math.tau) * gr, math.sin(k / 20.0 * math.tau) * gr, rz)) for k in range(21)]
        b.tube(ring_pts, 0.026, '#383e46', seg=6, smooth=True, cap_start=False, cap_end=False)
    # 走廊外圈轻柔白雪圈
    b.lathe((0, 0, gz - 0.01), [(1.52, 0.0), (1.54, 0.12), (1.32, 0.15), (1.02, 0.02)], SNOW_W, seg=18, smooth=True)

    # 4) 顶部灯室（下半铁皮围裙 + 温暖发光玻璃灯笼 glow + 竖向黑色窗框筋）
    b.cyl((0, 0, gz), 0.96, 0.58, '#d4d8dc', seg=16, smooth=True)
    b.cyl((0, 0, gz + 0.58), 0.88, 0.92, '#ffe8a8', seg=16, smooth=True, glow=True)
    for k in range(8):
        a = k / 8.0 * math.tau + math.pi / 8.0
        b.cyl((math.cos(a) * 0.91, math.sin(a) * 0.91, gz + 0.56), 0.030, 0.96, '#323840', seg=6)
    b.cyl((0, 0, gz + 1.48), 0.98, 0.10, '#363c44', seg=16)

    # 5) 红色圆穹顶盖 + 檐边白雪领 + 顶球与避雷针（总高 ~12.3m）
    dz0 = gz + 1.56
    dome_p = [(1.06, 0.0), (1.02, 0.12), (0.86, 0.42), (0.58, 0.72), (0.24, 0.90), (0.04, 0.96)]
    b.lathe((0, 0, dz0), dome_p, red, seg=18, smooth=True)
    # 圆顶檐边小雪圈（完整包裹檐口外沿，避免与红顶穿插）
    b.lathe((0, 0, dz0 + 0.02), [(1.10, 0.0), (1.12, 0.10), (1.00, 0.25), (0.86, 0.30)], SNOW_W, seg=18, smooth=True)
    # 顶球与细针尖
    b.sphere((0, 0, dz0 + 1.06), 0.11, '#c8ced4', sub=2, smooth=True)
    b.cyl((0, 0, dz0 + 1.14), 0.026, 0.52, '#687078', seg=6, r2=0.008)

    return b.finish(name, glow_color='#ffe69c')


# ---------------- 6. 落雪自动贩卖机 vending_snow（沿用 inaka 贩卖机风格 + 厚圆雪顶，对照 vending_snow.png） ----------------

def build_vending_snow(name='vending_snow', seed=116):
    b = B(seed)
    W, D, H = 1.04, 0.76, 1.84
    base_z = 0.06
    body_lo = '#2864b8'
    body_hi = '#f2f4f6'
    top_col = '#2458a4'

    # 1) 四支脚
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.cyl((sx * W * 0.42, sy * D * 0.40, 0.0), 0.036, 0.024, '#4e545c', seg=8)
            b.cyl((sx * W * 0.42, sy * D * 0.40, 0.024), 0.018, 0.045, STEEL, seg=8)

    # 2) 蓝白两段机身与内凹发光展示橱窗框
    mid_z = 0.70
    b.box((0, 0, base_z + (mid_z - base_z) * 0.5), (W, D, mid_z - base_z), body_lo, grad=(0.92, 1.0))
    win_z0, win_z1 = 0.94, 1.72
    win_x0, win_x1 = -0.44, 0.34
    win_d = 0.11
    b.box((0, win_d * 0.5, mid_z + (H - mid_z) * 0.5), (W, D - win_d, H - mid_z), body_hi)
    b.box((0, -D * 0.5 + win_d * 0.5, mid_z + (win_z0 - mid_z) * 0.5), (W, win_d, win_z0 - mid_z), body_hi)
    b.box((0, -D * 0.5 + win_d * 0.5, win_z1 + (H - win_z1) * 0.5), (W, win_d, H - win_z1), body_hi)
    lw = win_x0 - (-W * 0.5)
    rw = W * 0.5 - win_x1
    b.box((-W * 0.5 + lw * 0.5, -D * 0.5 + win_d * 0.5, (win_z0 + win_z1) * 0.5), (lw, win_d, win_z1 - win_z0), body_hi)
    b.box((W * 0.5 - rw * 0.5, -D * 0.5 + win_d * 0.5, (win_z0 + win_z1) * 0.5), (rw, win_d, win_z1 - win_z0), body_hi)
    # 顶沿蓝色防雨帽檐
    b.box((0, -0.02, H + 0.028), (W + 0.06, D + 0.08, 0.056), top_col)

    # 3) 发光橱窗 + 3 排 21 个立体易拉罐/PET 饮料瓶 + 热(红)/冷(蓝)按钮条
    wx_c = (win_x0 + win_x1) * 0.5
    win_w = win_x1 - win_x0
    win_h = win_z1 - win_z0
    y_back = -D * 0.5 + win_d - 0.015
    y_front = -D * 0.5
    b.box((wx_c, y_back, (win_z0 + win_z1) * 0.5), (win_w - 0.02, 0.02, win_h - 0.02), '#f8fcff', glow=True)
    for sz in (win_z0, win_z1):
        b.box((wx_c, y_front - 0.005, sz), (win_w + 0.03, 0.028, 0.022), '#c4cad0')
    for sx in (win_x0, win_x1):
        b.box((sx, y_front - 0.005, (win_z0 + win_z1) * 0.5), (0.022, 0.028, win_h + 0.02), '#c4cad0')

    drink_cols = ['#d83428', '#38a64c', '#2c74d4', '#f0a626', '#6b4228', '#e6dc44', '#a8d8ea', '#8a522c', '#f2f2ee', '#5eb642']
    n_cols = 7
    step_x = (win_w - 0.07) / n_cols
    for row in range(3):
        rz = win_z0 + 0.055 + row * (win_h - 0.08) / 3.0
        b.box((wx_c, y_back - 0.042, rz - 0.012), (win_w - 0.03, 0.075, 0.018), '#e6e8ec')
        b.box((wx_c, y_front + 0.022, rz - 0.028), (win_w - 0.04, 0.032, 0.038), '#eef0f2')
        for k in range(n_cols):
            dx = win_x0 + 0.035 + (k + 0.5) * step_x
            col = drink_cols[(row * 7 + k * 3 + seed) % len(drink_cols)]
            dy = y_back - 0.040
            if row == 2:
                b.cyl((dx, dy, rz), 0.024, 0.112, col, seg=7)
                b.cyl((dx, dy, rz + 0.112), 0.024, 0.030, lerp_col(col, '#ffffff', 0.4), seg=7, r2=0.011)
                b.cyl((dx, dy, rz + 0.142), 0.012, 0.014, '#f0f0ea' if k % 2 else '#2a78c8', seg=6)
            else:
                ch = 0.105 + (k % 2) * 0.016
                b.cyl((dx, dy, rz), 0.024, ch, col, seg=7)
                b.cyl((dx, dy, rz + ch), 0.022, 0.008, '#d0d4d8', seg=7)
            # 冬天热饮多（下排全红「あったか〜い」热饮！）
            is_hot = (row == 0) or (row == 1 and k < 3)
            b.box((dx, y_front + 0.005, rz - 0.016), (step_x * 0.72, 0.008, 0.010), '#de3428' if is_hot else '#2a78d8')
            b.box((dx, y_front + 0.003, rz - 0.032), (step_x * 0.48, 0.012, 0.016), '#dc4030' if is_hot else '#444850')

    # 4) 投币口、纸币口、取货口
    cx, cz = 0.34, 0.80
    b.box((cx, y_front - 0.010, cz), (0.16, 0.022, 0.22), '#bfc4c8')
    b.cyl((cx + 0.03, y_front - 0.022, cz + 0.04), 0.024, 0.012, '#34383c', seg=10, axis='Y')
    b.box((cx - 0.02, y_front - 0.022, cz - 0.04), (0.085, 0.014, 0.045), '#2a2e32')
    b.box((-0.06, y_front - 0.004, 0.36), (0.64, 0.02, 0.22), '#1a1c20')
    b.box((-0.06, y_front - 0.012, 0.38), (0.60, 0.018, 0.16), '#4c5258')
    b.box((-0.06, y_front - 0.018, 0.46), (0.66, 0.024, 0.022), '#2e3236')

    # 5) 顶部厚实蓬松的圆润大积雪帽（对照 vending_snow.png！）+ 底部一点积雪缘
    add_snow_pillow(b, (0, -0.02, H + 0.05), (W + 0.12, D + 0.14), height=0.34, nx=10, ny=8, drip=0.11, seed=seed + 5, overhang=0.04)
    add_snow_pillow(b, (-0.12, y_front - 0.02, base_z + 0.01), (0.65, 0.10), height=0.045, nx=5, ny=2, seed=seed + 6)

    return b.finish(name, glow_color='#f6faff')
