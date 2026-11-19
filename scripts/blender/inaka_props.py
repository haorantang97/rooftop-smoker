# 乡间小物的高细节程序化建模：电线杆（普通/变压器/路灯）、自动贩卖机（红/蓝/白）、凸面反射镜、公交站、路边小神社
import math, random
from mathutils import Vector, Matrix
from inaka_core import (
    B, srgb, lerp_col, mul_col, vary,
    WOOD_VD, WOOD_D, WOOD, WOOD_M, WOOD_L, WOOD_W,
    PLASTER_W, PLASTER, PLASTER_S,
    STONE_L, STONE, STONE_D, STONE_M, CONCRETE, CONCRETE_D,
    IRON_D, IRON, STEEL, COPPER_G, COPPER_GL, COPPER_GD,
)


# ---------------- 水泥电线杆（精确对齐游戏电线坐标与路灯发光点） ----------------

def _porcelain_insulator(b, cx, cy, z_base, scale=1.0):
    """三层伞裙的白色瓷瓶（顶端落在 z_base + 0.16*scale）"""
    s = scale
    prof = [
        (0.016 * s, 0.0),
        (0.016 * s, 0.04 * s),
        (0.056 * s, 0.055 * s),
        (0.036 * s, 0.08 * s),
        (0.054 * s, 0.095 * s),
        (0.034 * s, 0.12 * s),
        (0.044 * s, 0.145 * s),
        (0.028 * s, 0.16 * s),
    ]
    b.lathe((cx, cy, z_base), prof, '#eeece4', seg=8, colors=[STEEL, STEEL, '#e2e2da', '#c8c8c0', '#eaeae2', '#ccccbe', '#f2f2ea', '#dcdcd4'])


def build_pole(name, seed, transformer=False, lamp=False):
    b = B(seed)
    H = 11.02

    # 1) 上细下粗的水泥电线杆（阳光晒暖的浅灰混凝土 + 接缝环）
    b.cyl((0, 0, 0.0), 0.175, H, '#c8c4b8', seg=12, r2=0.098, smooth=True, grad=(0.86, 1.04))
    b.cyl((0, 0, H - 0.02), 0.100, 0.05, '#a09e94', seg=12)  # 杆顶防雨帽
    for jz in (3.6, 7.1):
        rr = 0.175 + (0.098 - 0.175) * (jz / H) + 0.008
        b.cyl((0, 0, jz), rr, 0.045, '#7c7a74', seg=12)

    # 2) 两道钢制角铁横担 + V 形斜拉撑 + 抱箍 + 多层伞裙瓷瓶
    # 精确对齐 inaka.js 电线挂点：上层 x=(-0.98, 0, 0.98) z=10.50；下层 x=(-0.68, 0.68) z=9.70
    arms = [
        (10.34, 2.24, (-0.98, 0.0, 0.98), 9.76),
        (9.54,  1.64, (-0.68, 0.68),      9.02),
    ]
    for z_arm, w, ins_xs, z_brace in arms:
        r_here = 0.175 + (0.098 - 0.175) * (z_arm / H)
        # 抱箍 + 主角铁横担
        b.cyl((0, 0, z_arm - 0.04), r_here + 0.016, 0.08, STEEL, seg=12)
        b.box((0, -r_here - 0.04, z_arm), (w, 0.075, 0.085), '#868c92')
        # 下方抱箍与 V 形双斜撑（arm tie）
        r_b = 0.175 + (0.098 - 0.175) * (z_brace / H)
        b.cyl((0, 0, z_brace - 0.03), r_b + 0.016, 0.065, STEEL, seg=12)
        for sx in (-1, 1):
            b.seg((0, -r_b - 0.02, z_brace), (sx * (w * 0.34), -r_here - 0.04, z_arm - 0.02), 0.032, 0.028, '#7a8086')
        # 瓷瓶精确落在挂线位置（x=ins_x, y=0 稍前或中心均可，让顶端 z=z_arm+0.16=10.50 / 9.70）
        for ix in ins_xs:
            _porcelain_insulator(b, ix, -r_here - 0.04, z_arm + 0.035, scale=0.82)

    # 3) 中上部通讯线挂架（z=7.40，对齐第 6 根电线）+ 预留盘线（普通杆款）
    r_c = 0.175 + (0.098 - 0.175) * (7.40 / H)
    b.cyl((0, 0, 7.36), r_c + 0.015, 0.06, STEEL, seg=10)
    b.box((0.22, 0.0, 7.40), (0.48, 0.055, 0.055), STEEL)
    if not transformer and not lamp:
        # 挂在支架下的盘绕通讯线环（对照 pole.png）
        loop_pts = []
        for k in range(15):
            a = k / 14.0 * math.tau
            loop_pts.append(Vector((0.30 + math.cos(a) * 0.18, 0.05 + math.sin(a) * 0.03, 7.12 + math.sin(a) * 0.24)))
        b.tube(loop_pts, 0.014, IRON_D, seg=5, smooth=True, cap_start=False, cap_end=False)

    # 4) 交替排列的防滑攀登脚钉（z=2.25..8.75）
    for i in range(14):
        zz = 2.25 + i * 0.48
        rr = 0.175 + (0.098 - 0.175) * (zz / H)
        sx = 1 if i % 2 == 0 else -1
        b.seg((sx * (rr - 0.01), 0, zz), (sx * (rr + 0.17), 0, zz), 0.022, 0.022, '#707478')
        b.box((sx * (rr + 0.17), 0, zz + 0.025), (0.022, 0.024, 0.05), '#707478')  # 脚钉上翘防滑头

    # 5) 底部黄黑斑马警示保护套（z=0.45..2.00）+ 绑扎铁丝箍
    z_g0, g_h = 0.48, 1.50
    r_g0 = 0.175 + (0.098 - 0.175) * (z_g0 / H) + 0.010
    r_g1 = 0.175 + (0.098 - 0.175) * ((z_g0 + g_h) / H) + 0.010
    n_bands = 9
    bh = g_h / n_bands
    for k in range(n_bands):
        zb = z_g0 + k * bh
        rb0 = r_g0 + (r_g1 - r_g0) * (k / n_bands)
        rb1 = r_g0 + (r_g1 - r_g0) * ((k + 1) / n_bands)
        col = '#ecc424' if k % 2 == 0 else '#202224'
        b.cyl((0, 0, zb), rb0, bh + 0.002, col, seg=12, r2=rb1, cap=False)
    for fz in (z_g0 + 0.08, z_g0 + g_h * 0.5, z_g0 + g_h - 0.08):
        rr = r_g0 + (r_g1 - r_g0) * ((fz - z_g0) / g_h) + 0.006
        b.cyl((0, 0, fz), rr, 0.025, STEEL, seg=12)

    # 6) 可选：柱上圆柱形变压器（对照 pole_tr.png：抱箍、散热筋、三根高压瓷套管与弯曲引上线）
    if transformer:
        tx, ty, tz = 0.0, 0.44, 7.15
        tr_r, tr_h = 0.27, 0.92
        # 变压器圆桶主体与上下法兰盖
        b.cyl((tx, ty, tz), tr_r, tr_h, '#9ba4ae', seg=14, smooth=True, grad=(0.86, 1.06))
        b.cyl((tx, ty, tz - 0.03), tr_r + 0.025, 0.05, '#7e868e', seg=14)
        b.cyl((tx, ty, tz + tr_h - 0.02), tr_r + 0.03, 0.07, '#b4bcc4', seg=14)
        # 10 片纵向散热鳍片
        for k in range(10):
            a = k / 10.0 * math.tau
            fx = tx + math.cos(a) * (tr_r + 0.025)
            fy = ty + math.sin(a) * (tr_r + 0.025)
            b.box((fx, fy, tz + tr_h * 0.48), (0.06, 0.022, tr_h * 0.78), '#848e98', rot=a)
        # 两道与电线杆连接的钢抱箍与挂耳
        for bz in (tz + 0.22, tz + tr_h - 0.20):
            rr = 0.175 + (0.098 - 0.175) * (bz / H)
            b.cyl((0, 0, bz - 0.03), rr + 0.018, 0.07, STEEL, seg=12)
            b.box((0, ty * 0.45, bz), (0.14, ty * 0.85, 0.07), '#788088')
        # 顶部 3 根高压波纹瓷套管 + 优雅流畅曲线高压引上线（9 点三次贝塞尔平滑弧线）
        for idx, (bx, target_x, target_z) in enumerate([(-0.13, -0.68, 9.58), (0.0, 0.0, 10.38), (0.13, 0.68, 9.58)]):
            bp = Vector((tx + bx, ty, tz + tr_h + 0.04))
            _porcelain_insulator(b, bp.x, bp.y, bp.z, scale=1.35)
            p0 = bp + Vector((0, 0, 0.22))
            p3 = Vector((target_x, -0.15, target_z))
            p1 = p0 + Vector((bx * 1.6, 0.28, 0.55))
            p2 = p3 + Vector((bx * 0.4, 0.34, -0.35))
            wire_pts = []
            for s_i in range(9):
                u = s_i / 8.0
                pt = p0 * ((1 - u) ** 3) + p1 * (3 * (1 - u) ** 2 * u) + p2 * (3 * (1 - u) * u ** 2) + p3 * (u ** 3)
                wire_pts.append(pt)
            b.tube(wire_pts, 0.014, IRON_D, seg=5, smooth=True)

    # 7) 可选：日式乡下防犯路灯（对照 pole_lamp.png，发光灯罩精准对准 (0, -1.35, 6.45)！）
    if lamp:
        # 两道固定抱箍与竖直管座
        for bz in (5.62, 6.02):
            rr = 0.175 + (0.098 - 0.175) * (bz / H)
            b.cyl((0, 0, bz - 0.03), rr + 0.018, 0.065, STEEL, seg=12)
        # 优雅鹅颈形镀锌灯臂管
        arm_pts = [
            Vector((0, -0.17, 5.56)),
            Vector((0, -0.17, 6.18)),
            Vector((0, -0.26, 6.40)),
            Vector((0, -0.68, 6.62)),
            Vector((0, -1.24, 6.84)),
            Vector((0, -1.35, 6.80)),
            Vector((0, -1.35, 6.66)),
        ]
        b.tube(arm_pts, 0.028, '#a6acb2', seg=8, smooth=True)
        # 复古搪瓷锥形白色防雨灯伞 + 灯座颈 + 发光暖白半圆灯罩（glow 材质）
        b.lathe(
            (0, -1.35, 6.50),
            [(0.32, 0.0), (0.31, 0.03), (0.14, 0.12), (0.075, 0.14), (0.065, 0.20)],
            '#e8e8e2', seg=14, smooth=True, cap_bot=False,
            colors=['#7c8288', '#e6e8e4', '#eff0ec', '#888e94', '#72787e'],
        )
        # 伞底白色反射面
        b.cyl((0, -1.35, 6.505), 0.30, 0.015, '#f2f0e6', seg=14)
        # 半球发光灯罩（中心精确在 (0, -1.35, 6.45)）
        b.sphere((0, -1.35, 6.47), 0.17, '#fff2d0', sub=2, scale=(1.0, 1.0, 0.62), smooth=True, glow=True)

    return b.finish(name, glow_color='#fff2d0')


# ---------------- 日式自动贩卖机（红 / 蓝白 / 乳白三色高细节版） ----------------

def build_vending(name, seed, style='red'):
    b = B(seed)
    rnd = random.Random(seed)
    W, D, H = 1.02, 0.74, 1.84
    base_z = 0.06

    # 1) 四个带橡胶垫的可调支脚
    for sx in (-1, 1):
        for sy in (-1, 1):
            fx, fy = sx * (W * 0.42), sy * (D * 0.40)
            b.cyl((fx, fy, 0.0), 0.036, 0.022, '#62666c', seg=8)
            b.cyl((fx, fy, 0.022), 0.018, 0.045, STEEL, seg=8)

    # 2) 机身主柜体（按红/蓝/白三张参考图做差异化配色与造型，同色机身无接缝色差！）
    if style == 'red':
        body_lo = '#dc3628'
        body_hi = '#dc3628'
        top_col = '#c22a1e'
    elif style == 'blue':
        body_lo = '#286cc0'
        body_hi = '#f4f2ea'
        top_col = '#a8aeb4'
    else:
        body_lo = '#f4eee0'
        body_hi = '#f4eee0'
        top_col = '#eae2cf'

    # 下半柜体 & 上半柜体（蓝白款清晰分色，红款与白款上下色泽完全衔接无接缝！）
    mid_z = 0.72
    b.box((0, 0, base_z + (mid_z - base_z) * 0.5), (W, D, mid_z - base_z), body_lo, grad=(0.94, 1.0) if style == 'blue' else (0.96, 1.0))
    # 背面与左右侧板（围绕上段内凹展示窗构建实体围框，使展示窗真正内凹！）
    win_z0, win_z1 = 0.96, 1.72
    win_x0, win_x1 = -0.43, 0.30 if style != 'red' else 0.43
    if style == 'red':
        win_x0, win_x1 = -0.43, 0.43
    win_d = 0.11  # 展示窗内凹深度
    # 展示窗后方的实心机身块
    b.box((0, win_d * 0.5, mid_z + (H - mid_z) * 0.5), (W, D - win_d, H - mid_z), body_hi)
    # 展示窗下方的中段面板（装投币口和按键）
    b.box((0, -D * 0.5 + win_d * 0.5, mid_z + (win_z0 - mid_z) * 0.5), (W, win_d, win_z0 - mid_z), body_hi)
    # 展示窗上方眉板
    b.box((0, -D * 0.5 + win_d * 0.5, win_z1 + (H - win_z1) * 0.5), (W, win_d, H - win_z1), body_hi)
    # 展示窗左侧立柱 & 右侧立柱
    lw = win_x0 - (-W * 0.5)
    rw = W * 0.5 - win_x1
    b.box((-W * 0.5 + lw * 0.5, -D * 0.5 + win_d * 0.5, (win_z0 + win_z1) * 0.5), (lw, win_d, win_z1 - win_z0), body_hi)
    b.box((W * 0.5 - rw * 0.5, -D * 0.5 + win_d * 0.5, (win_z0 + win_z1) * 0.5), (rw, win_d, win_z1 - win_z0), body_hi)

    # 顶盖造型（红款前伸防雨檐、蓝款银色金属盖+蓝条、白款红绿横条+顶部圆透气帽）
    if style == 'red':
        b.box((0, -0.04, H + 0.025), (W + 0.06, D + 0.10, 0.05), top_col)
        # 左侧下部散热百叶槽
        for k in range(8):
            b.box((-W * 0.5 - 0.005, -D * 0.30, 0.18 + k * 0.036), (0.015, 0.16, 0.016), '#5c1410')
    elif style == 'blue':
        b.box((0, 0, H + 0.028), (W + 0.04, D + 0.04, 0.055), top_col)
        b.box((0, -D * 0.5 - 0.004, H - 0.035), (W + 0.005, 0.012, 0.065), body_lo)
    else:
        b.box((0, 0, H + 0.012), (W + 0.01, D + 0.01, 0.025), top_col)
        b.box((0, -D * 0.5 - 0.005, H - 0.035), (W - 0.04, 0.010, 0.024), '#348f54')
        b.box((0, -D * 0.5 - 0.005, H - 0.062), (W - 0.04, 0.010, 0.016), '#cc3f30')
        # 顶部银色通风小圆帽（对照 vending_white.png）
        b.cyl((0, 0, H + 0.02), 0.11, 0.02, STEEL, seg=12)
        b.cyl((0, 0, H + 0.04), 0.085, 0.075, '#b6babf', seg=12)

    # 3) 发光商品展示橱窗（glow 背板 + 银色边框 + 3 层陈列架 + 立体瓶罐与冷热按钮！）
    wx_c = (win_x0 + win_x1) * 0.5
    win_w = win_x1 - win_x0
    win_h = win_z1 - win_z0
    y_back = -D * 0.5 + win_d - 0.015
    y_front = -D * 0.5
    # 发光灯箱背板与顶灯条（夜里整窗透出清亮冷白光！）
    b.box((wx_c, y_back, (win_z0 + win_z1) * 0.5), (win_w - 0.02, 0.02, win_h - 0.02), '#f8fafc', glow=True)
    # 银色展示窗边框
    for sz in (win_z0, win_z1):
        b.box((wx_c, y_front - 0.005, sz), (win_w + 0.03, 0.028, 0.022), '#c8ccd0')
    for sx in (win_x0, win_x1):
        b.box((sx, y_front - 0.005, (win_z0 + win_z1) * 0.5), (0.022, 0.028, win_h + 0.02), '#c8ccd0')

    # 3 排立体饮料瓶罐（每排 7–8 个，既有易拉罐也有带瓶肩瓶盖的 PET 饮料瓶！）
    drink_cols = ['#d43428', '#36a64c', '#2a74d0', '#f0a626', '#6b4228', '#e6dc44', '#a8d8ea', '#8a522c', '#f2f2ee', '#5eb642']
    n_cols = 8 if style == 'red' else 7
    step_x = (win_w - 0.08) / n_cols
    for row in range(3):
        rz = win_z0 + 0.055 + row * (win_h - 0.08) / 3.0
        # 白色商品层板与按钮条
        b.box((wx_c, y_back - 0.042, rz - 0.012), (win_w - 0.03, 0.075, 0.018), '#e6e8ec')
        b.box((wx_c, y_front + 0.022, rz - 0.028), (win_w - 0.04, 0.032, 0.038), '#eef0f2')
        for k in range(n_cols):
            dx = win_x0 + 0.04 + (k + 0.5) * step_x
            col = drink_cols[(row * 7 + k * 3 + seed) % len(drink_cols)]
            is_pet = (row == 0 and k >= 2) if style != 'white' else (row == 2 and k < 5)
            dy = y_back - 0.040
            if is_pet:
                # PET 塑料饮料瓶（瓶身 + 收肩 + 瓶盖）
                b.cyl((dx, dy, rz), 0.024, 0.115, col, seg=7)
                b.cyl((dx, dy, rz + 0.115), 0.024, 0.030, lerp_col(col, '#ffffff', 0.4), seg=7, r2=0.011)
                b.cyl((dx, dy, rz + 0.145), 0.012, 0.014, '#f0f0ea' if k % 2 else '#2a78c8', seg=6)
            else:
                # 铝制易拉罐（罐身 + 银色顶盖边）
                ch = 0.105 + (k % 2) * 0.018
                b.cyl((dx, dy, rz), 0.024, ch, col, seg=7)
                b.cyl((dx, dy, rz + ch), 0.022, 0.008, '#d0d4d8', seg=7)
            # 冷/热条（蓝=冷 / 红=热）+ 小圆形选货按钮
            is_hot = (row == 0 and k < 3) or (row == 1 and style == 'red' and k < 2)
            b.box((dx, y_front + 0.005, rz - 0.016), (step_x * 0.72, 0.008, 0.010), '#d83828' if is_hot else '#2a78d8')
            b.box((dx, y_front + 0.003, rz - 0.032), (step_x * 0.48, 0.012, 0.016), '#d84030' if is_hot else '#444850')

    # 4) 投币口、纸币口、退币拨杆与数字屏
    cx = 0.24 if style == 'red' else 0.40
    cz = 0.80 if style == 'red' else 1.05
    b.box((cx, y_front - 0.010, cz), (0.14, 0.022, 0.26), '#bfc4c8')
    b.box((cx, y_front - 0.022, cz + 0.085), (0.09, 0.010, 0.035), '#22262a')  # 数字屏
    b.cyl((cx + 0.02, y_front - 0.024, cz + 0.02), 0.026, 0.012, '#34383c', seg=10, axis='Y')  # 投币口
    b.box((cx - 0.02, y_front - 0.024, cz - 0.055), (0.085, 0.014, 0.045), '#2a2e32')  # 纸币口
    b.box((cx - 0.02, y_front - 0.030, cz - 0.055), (0.06, 0.008, 0.010), '#40b858')  # 绿指示灯
    # 右下找零口
    b.box((0.36, y_front - 0.004, 0.36), (0.08, 0.025, 0.085), '#1e2024')

    # 5) 底部凹陷大取货口（带透明烟灰推板与阴影凹槽）
    b.box((-0.05, y_front - 0.004, 0.36), (0.64, 0.02, 0.22), '#1a1c20')
    b.box((-0.05, y_front - 0.012, 0.38), (0.60, 0.018, 0.16), '#4c5258')
    b.box((-0.05, y_front - 0.018, 0.46), (0.66, 0.024, 0.022), '#2e3236')
    # 底部脚踢凹槽线
    b.box((0, y_front - 0.004, base_z + 0.05), (W * 0.68, 0.02, 0.045), '#282c30')

    return b.finish(name, glow_color='#f6faff')


# ---------------- 路口橙色凸面反射镜（对照 mirror.png） ----------------

def build_mirror(name, seed=51):
    b = B(seed)
    orange = '#f27422'
    orange_d = '#cc5814'

    # 1) 圆形混凝土基座领圈 + 细长橙色钢管立柱（精确止于镜壳底沿 z=2.39，绝不伸入镜面前！）
    b.cyl((0, 0, 0.0), 0.15, 0.15, CONCRETE, seg=12, r2=0.135, jitter=0.04)
    b.cyl((0, 0, 0.14), 0.042, 2.25, orange, seg=10, smooth=True, grad=(0.92, 1.04))

    # 2) 柱身上部白反光圈 + 黄色三角「注意」小铭牌（对照 mirror.png）
    b.cyl((0, 0, 2.24), 0.045, 0.075, '#f4f2ec', seg=10)
    b.box((0, -0.052, 2.00), (0.12, 0.016, 0.25), '#ece8dc')
    b.box((0, -0.062, 2.07), (0.07, 0.006, 0.07), '#ecc024')  # 警告黄三角示意
    b.box((0, -0.062, 1.96), (0.06, 0.006, 0.09), '#36383a')  # 文字块
    for bz in (1.92, 2.08):
        b.cyl((0, 0, bz), 0.048, 0.02, STEEL, seg=10)

    # 3) 后侧弯曲橙色撑臂与镀锌夹具（完全还原 mirror.png 的标志性弯臂！）
    arm_pts = [
        Vector((0, 0.02, 2.08)),
        Vector((0, 0.26, 2.40)),
        Vector((0, 0.30, 2.58)),
        Vector((0, 0.30, 2.98)),
    ]
    b.tube(arm_pts, 0.032, orange, seg=8, smooth=True)
    # 镀锌安装抱夹与横轴
    b.box((0, 0.30, 2.76), (0.14, 0.14, 0.18), '#b8bec4')
    b.cyl((0, 0.20, 2.76), 0.035, 0.24, STEEL, seg=8, axis='Y')

    # 4) 圆形橙色镜壳 + 上方弧形防雨遮阳檐（hood visor）
    mc = Vector((0, 0.02, 2.78))
    R = 0.40
    # 镜背碗壳（lathe 绕 Y 轴手动构建，平滑圆润！）
    seg = 20
    # 镜框主圆环（侧面 + 背面）
    b.cyl(mc + Vector((0, 0.04, 0)), R, 0.09, orange, seg=seg, r2=R * 0.90, axis='Y', smooth=True)
    # 背面半球鼓起
    b.sphere(mc + Vector((0, 0.08, 0)), R * 0.88, orange_d, sub=2, scale=(1.0, 0.30, 1.0), smooth=True)
    # 顶部半圆弧形突出遮雨檐（上半圈 -25° 到 +205°）
    visor_segs = 14
    v_verts = []
    for k in range(2):  # 后沿、前沿
        y_v = mc.y + (0.04 if k == 0 else -0.15)
        for s_in in (0, 1):  # 外壁、内壁
            rr = (R + 0.025) if s_in == 0 else (R - 0.015)
            for i in range(visor_segs + 1):
                a = math.radians(-18.0 + 216.0 * i / visor_segs)
                # 顶部更深、两侧渐收
                y_extra = -0.05 * math.sin(max(0.0, a)) if k == 1 else 0.0
                v_verts.append(Vector((mc.x + math.cos(a) * rr, y_v + y_extra, mc.z + math.sin(a) * rr)))
    stride = visor_segs + 1
    v_faces = []
    # 外弧面(0->2)、内弧面(1->3)、前缘封口(2->3)
    for i in range(visor_segs):
        # 0: back_out, 1: back_in, 2: front_out, 3: front_in
        b_out, b_in = i, stride + i
        f_out, f_in = 2 * stride + i, 3 * stride + i
        v_faces.append((b_out, f_out, f_out + 1, b_out + 1))
        v_faces.append((b_in, b_in + 1, f_in + 1, f_in))
        v_faces.append((f_out, f_in, f_in + 1, f_out + 1))
    # 遮雨檐两端封闭
    v_faces.append((0, stride, 3 * stride, 2 * stride))
    v_faces.append((visor_segs, 2 * stride + visor_segs, 3 * stride + visor_segs, stride + visor_segs))
    b.poly(v_verts, v_faces, orange, smooth=True)

    # 5) 光滑凸面镜镜面（用顶点渐变模拟蓝天白云 + 乡间绿坡的微反射感！）
    rings = 4
    m_verts = [mc + Vector((0, -0.125, 0))]  # 中心最凸点
    m_cols = [srgb('#cfe6f4')]
    for ir in range(1, rings + 1):
        frac = ir / rings
        rr = R * 0.91 * frac
        dy = -0.125 * math.cos(frac * math.pi * 0.5)
        for i in range(seg):
            a = i / seg * math.tau
            vx = math.cos(a) * rr
            vz = math.sin(a) * rr
            m_verts.append(mc + Vector((vx, dy, vz)))
            # 上半映夏空蓝白，下半略映田野柔和灰绿
            if vz >= -0.02:
                c = lerp_col('#d6eaf8', '#68aae0', min(1.0, (vz / R) * 1.15))
            else:
                c = lerp_col('#b4c8bc', '#789868', min(1.0, (-vz / R) * 1.05))
            m_cols.append(c)
    m_faces = []
    # 中心扇形（法线朝 -Y）
    for i in range(seg):
        ni = (i + 1) % seg
        m_faces.append((0, 1 + i, 1 + ni))
    for ir in range(rings - 1):
        r0 = 1 + ir * seg
        r1 = 1 + (ir + 1) * seg
        for i in range(seg):
            ni = (i + 1) % seg
            m_faces.append((r0 + i, r1 + i, r1 + ni, r0 + ni))
    b.poly(m_verts, m_faces, None, smooth=True, vert_colors=m_cols)

    return b.finish(name)


# ---------------- 乡下公交站（对照 busstop.png：三面木灰候车亭 + 镂空侧窗 + 绿铁皮坡顶 + 蓝白圆站牌） ----------------

def build_busstop(name, seed=52):
    b = B(seed)
    W, D, H = 2.60, 1.48, 2.26
    wall_c = '#eee6ce'
    wall_s = '#dcd3b8'
    trim_c = '#e0d6bc'
    plinth = '#c0bcb0'

    # 1) 地坪与三面墙混凝土矮基脚
    b.box((0, 0.02, 0.04), (W + 0.18, D + 0.16, 0.08), CONCRETE, jitter=0.03)
    b.box((0, D * 0.5, 0.11), (W + 0.10, 0.14, 0.14), plinth)
    for sx in (-1, 1):
        b.box((sx * (W * 0.5), 0.0, 0.11), (0.14, D + 0.10, 0.14), plinth)

    # 2) 三面墙体（背墙、左墙、右墙带真正镂空方窗洞！）
    # 背墙（下段竖木护墙板 + 上段旧灰浆墙）
    b.box((0, D * 0.5, 0.18 + 0.72 * 0.5), (W, 0.09, 0.72), '#dfd5b8', jitter=0.02)
    b.box((0, D * 0.5, 0.90 + (H - 0.90) * 0.5), (W, 0.08, H - 0.90), wall_c, grad=(1.0, 0.82))
    b.box((0, D * 0.5, 0.90), (W + 0.06, 0.11, 0.06), trim_c)
    # 护墙板竖缝
    for i in range(13):
        xx = -W * 0.46 + W * 0.92 * i / 12.0
        b.box((xx, D * 0.5 - 0.048, 0.54), (0.016, 0.012, 0.70), '#b4aa90')

    # 左墙（实心）
    b.box((-W * 0.5, 0, 0.18 + 0.72 * 0.5), (0.09, D, 0.72), '#dfd5b8')
    b.box((-W * 0.5, 0, 0.90 + (H - 0.90) * 0.5), (0.08, D, H - 0.90), wall_c, grad=(1.0, 0.82))
    b.box((-W * 0.5, 0, 0.90), (0.11, D + 0.06, 0.06), trim_c)
    for i in range(7):
        yy = -D * 0.42 + D * 0.84 * i / 6.0
        b.box((-W * 0.5 - 0.048, yy, 0.54), (0.012, 0.016, 0.70), '#b4aa90')

    # 右墙（中间开 0.62×0.56m 方形穿洞小窗 + 立体木窗框，完全还原 busstop.png！）
    rx = W * 0.5
    b.box((rx, 0, 0.18 + 0.72 * 0.5), (0.09, D, 0.72), '#dfd5b8')
    b.box((rx, 0, 0.90), (0.11, D + 0.06, 0.06), trim_c)
    wz0, wz1 = 1.16, 1.72
    wy0, wy1 = -0.32, 0.30
    b.box((rx, 0, 0.90 + (wz0 - 0.90) * 0.5), (0.08, D, wz0 - 0.90), wall_c)
    b.box((rx, 0, wz1 + (H - wz1) * 0.5), (0.08, D, H - wz1), wall_c, grad=(0.94, 0.82))
    b.box((rx, (-D * 0.5 + wy0) * 0.5, (wz0 + wz1) * 0.5), (0.08, wy0 - (-D * 0.5), wz1 - wz0), wall_c)
    b.box((rx, (wy1 + D * 0.5) * 0.5, (wz0 + wz1) * 0.5), (0.08, D * 0.5 - wy1, wz1 - wz0), wall_c)
    # 突出方窗框
    for zz in (wz0, wz1):
        b.box((rx, (wy0 + wy1) * 0.5, zz), (0.13, wy1 - wy0 + 0.10, 0.06), trim_c)
    for yy in (wy0, wy1):
        b.box((rx, yy, (wz0 + wz1) * 0.5), (0.13, 0.06, wz1 - wz0 + 0.04), trim_c)
    for i in range(7):
        yy = -D * 0.42 + D * 0.84 * i / 6.0
        b.box((rx + 0.048, yy, 0.54), (0.012, 0.016, 0.70), '#b4aa90')

    # 四角立柱与门楣
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((sx * (W * 0.5), sy * (D * 0.5), 0.12 + (H - 0.12) * 0.5), (0.12, 0.12, H - 0.12), trim_c)
    b.box((0, -D * 0.5, H - 0.05), (W + 0.12, 0.11, 0.11), trim_c)

    # 3) 内部暖木板条长椅（靠背立柱严格在板条后方 y=0.65，绝不挡住靠背！）+ 左侧挂框时刻表告示板
    bw = 2.26
    for i in range(3):
        b.box((0, 0.24 + i * 0.14, 0.46), (bw, 0.12, 0.042), WOOD_L if i % 2 == 0 else WOOD_W, jitter=0.05)
    for i in range(3):
        b.box((0, 0.60, 0.65 + i * 0.145), (bw, 0.036, 0.12), WOOD_L if i % 2 else WOOD_W, jitter=0.05)
    for lx in (-0.96, 0.0, 0.96):
        b.box((lx, 0.24, 0.24), (0.075, 0.075, 0.44), WOOD)
        b.box((lx, 0.645, 0.48), (0.065, 0.055, 0.94), WOOD)
        b.box((lx, 0.44, 0.20), (0.055, 0.40, 0.055), WOOD_D)
    b.box((0, 0.26, 0.19), (1.96, 0.05, 0.05), WOOD_D)
    # 左墙内侧木框时刻表告示板（白纸面微凸出木框表面以便清晰可见）
    b.box((-W * 0.5 + 0.052, -0.05, 1.48), (0.036, 0.46, 0.60), WOOD_M)
    b.box((-W * 0.5 + 0.074, -0.05, 1.48), (0.012, 0.36, 0.50), '#f8f4e8')
    for k in range(5):
        b.box((-W * 0.5 + 0.082, -0.05, 1.32 + k * 0.072), (0.004, 0.28, 0.012), '#98948a')

    # 4) 深苔绿波纹铁皮双坡顶（前长后短不对称斜顶 + 檐下外露木椽子，还原 busstop.png！）
    ridge_y = 0.22
    ridge_z = H + 0.62
    ov_x = 0.36
    y_f, z_f = -D * 0.5 - 0.56, H - 0.10
    y_b, z_b = D * 0.5 + 0.36, H + 0.02
    X = W * 0.5 + ov_x
    # 左右山墙三角实心封板（双面加厚避免屋檐缝隙）
    for sx in (-1, 1):
        xx = sx * (W * 0.5)
        b.double_poly([(xx, -D * 0.5 - 0.04, H - 0.02), (xx, D * 0.5 + 0.04, H - 0.02), (xx, ridge_y, ridge_z - 0.01)],
                      [(0, 1, 2) if sx > 0 else (2, 1, 0)], wall_s)
        b.box((xx, ridge_y, H + 0.28), (0.09, 0.09, 0.56), trim_c)
    # 外露木椽子
    for i in range(8):
        rx = -X + 0.18 + (2 * X - 0.36) * i / 7.0
        b.seg((rx, y_f + 0.06, z_f - 0.04), (rx, ridge_y, ridge_z - 0.06), 0.055, 0.075, WOOD)
        b.seg((rx, ridge_y, ridge_z - 0.06), (rx, y_b - 0.06, z_b - 0.04), 0.055, 0.075, WOOD)
    # 前后两片绿铁皮波纹屋面
    c_g = srgb('#3b6238')
    c_gd = srgb('#264424')
    c_gm = srgb('#547a38')

    def green_tin(p0, p1, q0, q1):
        p0, p1, q0, q1 = map(Vector, (p0, p1, q0, q1))
        nrm = (p1 - p0).cross(q0 - p0).normalized()
        if nrm.z < 0:
            nrm = -nrm
            p0, p1 = p1, p0
            q0, q1 = q1, q0
        u_steps = 32
        v_steps = 3
        for side, flip in ((0.015, False), (-0.015, True)):
            verts, vcs = [], []
            for iv in range(v_steps + 1):
                v = iv / v_steps
                for iu in range(u_steps + 1):
                    u = iu / u_steps
                    pt = p0.lerp(p1, u).lerp(q0.lerp(q1, u), v)
                    w = 0.018 if iu % 2 == 0 else -0.018
                    verts.append(pt + nrm * (side + w))
                    col = lerp_col(c_g, c_gm, (1.0 - v) * 0.45) if iu % 2 == 0 else c_gd
                    if flip:
                        col = mul_col(col, 0.65)
                    vcs.append(col)
            gw = u_steps + 1
            faces = []
            for iv in range(v_steps):
                for iu in range(u_steps):
                    i0 = iv * gw + iu
                    faces.append((i0, i0 + gw, i0 + gw + 1, i0 + 1) if flip else (i0, i0 + 1, i0 + gw + 1, i0 + gw))
            b.poly(verts, faces, None, vert_colors=vcs)

    green_tin((-X, y_f, z_f), (X, y_f, z_f), (-X, ridge_y, ridge_z), (X, ridge_y, ridge_z))
    green_tin((X, y_b, z_b), (-X, y_b, z_b), (X, ridge_y, ridge_z), (-X, ridge_y, ridge_z))
    b.box((0, ridge_y, ridge_z + 0.04), (2 * X + 0.06, 0.22, 0.06), '#2a4628')

    # 5) 右侧经典日本蓝白圆公交站牌（混凝土底座 + 白杆 + 时刻表框 + 蓝白双色圆牌）
    px, py = W * 0.5 + 0.58, -0.35
    b.stone_block((px, py, 0.13), (0.44, 0.44, 0.26), CONCRETE, jitter=0.04, bevel=0.025)
    b.cyl((px, py, 0.24), 0.036, 1.88, '#e8e8e2', seg=10, smooth=True)
    # 白色矩形时刻表牌（带边框与横线）
    b.box((px, py, 1.38), (0.38, 0.045, 0.54), '#e8e8e2')
    b.box((px, py - 0.024, 1.38), (0.31, 0.008, 0.46), '#f8f6f0')
    for k in range(5):
        b.box((px, py - 0.030, 1.22 + k * 0.075), (0.26, 0.005, 0.012), '#9ca0a4')
    # 蓝白双色经典圆形站牌（圆盘中心在 z=2.24）
    sz = 2.24
    b.cyl((px, py, sz), 0.285, 0.036, '#e6e8ec', seg=18, axis='Y')
    b.cyl((px, py - 0.018, sz), 0.255, 0.010, '#2c72be', seg=18, axis='Y')
    b.cyl((px, py + 0.018, sz), 0.255, 0.010, '#2c72be', seg=18, axis='Y')
    # 站牌中间标志性的白色横带（正反两面）
    b.box((px, py - 0.025, sz), (0.49, 0.008, 0.18), '#f8f8f4')
    b.box((px, py + 0.025, sz), (0.49, 0.008, 0.18), '#f8f8f4')
    b.box((px, py - 0.030, sz), (0.32, 0.004, 0.055), '#2c343e')  # 「バス停」字样色块

    return b.finish(name)


# ---------------- 乡间路边小神社（对照 shrine.png，严格控制在 5000 三角面内！） ----------------

def build_shrine(name, seed=53):
    b = B(seed)
    vermilion = '#dc4426'
    vermilion_d = '#ae301a'
    black_cap = '#282a2e'

    # 1) 切石围边境地石坛 + 正面双石阶 + 参道石板
    PW, PD, PH = 3.30, 4.10, 0.24
    b.box((0, -0.15, PH * 0.5), (PW, PD, PH), '#cbbd9c', jitter=0.04)  # 沙土地面
    # 围边石块框
    for sx in (-1, 1):
        b.box((sx * (PW * 0.5 - 0.12), -0.15, PH * 0.5 + 0.01), (0.24, PD, PH + 0.02), STONE_L, jitter=0.04)
    for sy in (-1, 1):
        b.box((0, -0.15 + sy * (PD * 0.5 - 0.12), PH * 0.5 + 0.01), (PW - 0.48, 0.24, PH + 0.02), STONE_L, jitter=0.04)
    # 参道铺石板
    for k in range(5):
        b.box((0, -1.90 + k * 0.42, PH + 0.012), (1.08, 0.36, 0.035), STONE_L if k % 2 else '#b2b0a4', jitter=0.04)
    # 入口两块石踏阶
    b.stone_block((0, -2.38, 0.06), (1.42, 0.34, 0.12), STONE_L, jitter=0.04, bevel=0.02)

    # 2) 明神朱红鸟居（微内倾立柱、黑石根卷、贯+楔子、额束匾额、优雅上翘的黑顶笠木+岛木）
    ty = -1.72
    for sx in (-1, 1):
        # 黑色底座根卷（nemaki）
        b.cyl((sx * 0.94, ty, PH), 0.135, 0.52, '#2a2c30', seg=10, r2=0.118)
        # 微向内收的朱红柱
        p_bot = Vector((sx * 0.94, ty, PH + 0.48))
        p_top = Vector((sx * 0.87, ty, PH + 2.66))
        b.tube([p_bot, p_top], [0.105, 0.090], vermilion, seg=10, smooth=True)
        # 柱顶台轮（daiwa）
        b.cyl((sx * 0.87, ty, PH + 2.58), 0.112, 0.06, black_cap, seg=10)
        # 贯木两侧黑木楔（kusabi）
        b.box((sx * 0.89, ty, PH + 2.16), (0.26, 0.09, 0.12), vermilion_d)
    # 下横梁贯（nuki）
    b.box((0, ty, PH + 2.14), (2.46, 0.085, 0.15), vermilion)
    # 优雅上翘的岛木（shimaki）+ 黑色笠木（kasagi）：9 段曲线放样！
    n_arc = 8
    arc_xs = [-1.52 + 3.04 * i / n_arc for i in range(n_arc + 1)]
    shimaki_pts, kasagi_pts = [], []
    for ax in arc_xs:
        u = abs(ax) / 1.52
        curve = 0.24 * (u ** 2.4)
        shimaki_pts.append(Vector((ax, ty, PH + 2.68 + curve)))
        kasagi_pts.append(Vector((ax, ty, PH + 2.81 + curve)))
    b.tube(shimaki_pts, [0.085 + 0.01 * (abs(x) / 1.52) for x in arc_xs], vermilion, seg=6, smooth=False)
    b.tube(kasagi_pts, [0.115 + 0.02 * (abs(x) / 1.52) for x in arc_xs], black_cap, seg=6, smooth=False)
    # 中央额束神匾（木框 + 暗金匾心）
    b.box((0, ty, PH + 2.42), (0.14, 0.10, 0.44), vermilion_d)
    b.box((0, ty - 0.055, PH + 2.44), (0.34, 0.05, 0.44), WOOD_D)
    b.box((0, ty - 0.075, PH + 2.44), (0.24, 0.025, 0.34), '#a88446')

    # 3) 参道两侧一对苔斑石灯笼（精简但完整：基坛、竿、中台、火袋、六角笠、宝珠）
    for sx in (-1, 1):
        b.stone_lantern((sx * 1.05, -0.90, PH), scale=0.80, mossy=True)

    # 4) 抬高木造小祠堂（本殿/祠：高脚基柱、高栏回廊、木阶、赛钱箱、注连绳+纸垂）
    sy0 = 0.65
    SH_W, SH_D = 1.48, 1.38
    deck_z = PH + 0.66
    # 6 根高脚木桩 + 柱础石
    for sx in (-1, 0, 1):
        for ky in (-1, 1):
            px = sx * (SH_W * 0.48)
            py = sy0 + ky * (SH_D * 0.48)
            b.box((px, py, PH + 0.06), (0.16, 0.16, 0.12), STONE_L)
            b.box((px, py, PH + 0.38), (0.10, 0.10, 0.56), WOOD_D)
    # 祠堂架空木台板（回廊浜床）
    b.box((0, sy0, deck_z), (SH_W + 0.36, SH_D + 0.36, 0.09), WOOD, jitter=0.04)
    # 三面高栏木扶手（前留楼梯口）
    rx0, rx1 = -(SH_W * 0.5 + 0.15), (SH_W * 0.5 + 0.15)
    ry0, ry1 = sy0 - (SH_D * 0.5 + 0.15), sy0 + (SH_D * 0.5 + 0.15)
    for rz in (deck_z + 0.24, deck_z + 0.42):
        # 左右栏杆
        for rx in (rx0, rx1):
            b.box((rx, sy0, rz), (0.045, ry1 - ry0, 0.045), WOOD_M)
        # 背面栏杆
        b.box((0, ry1, rz), (rx1 - rx0, 0.045, 0.045), WOOD_M)
        # 正面左右两段栏杆
        for sx in (-1, 1):
            b.box((sx * 0.62, ry0, rz), (0.56, 0.045, 0.045), WOOD_M)
    # 栏杆立柱与拟宝珠
    for px, py in [(rx0, ry0), (rx1, ry0), (rx0, ry1), (rx1, ry1), (-0.34, ry0), (0.34, ry0)]:
        b.box((px, py, deck_z + 0.25), (0.06, 0.06, 0.48), WOOD_D)
        b.sphere((px, py, deck_z + 0.52), 0.04, IRON_D, sub=1)
    # 正面四级木阶（木階）+ 斜向扶手木
    for st in range(4):
        b.box((0, ry0 - 0.08 - st * 0.12, deck_z - 0.12 - st * 0.14), (0.64, 0.16, 0.06), WOOD_M)
    for sx in (-1, 1):
        b.seg((sx * 0.34, ry0, deck_z + 0.05), (sx * 0.34, ry0 - 0.48, PH + 0.08), 0.06, 0.10, WOOD_D)

    # 祠堂木结构殿身 + 正面双扉格子门 + 赛钱箱
    BH = 1.24
    b.box((0, sy0 + 0.06, deck_z + 0.04 + BH * 0.5), (SH_W - 0.16, SH_D - 0.22, BH), WOOD, jitter=0.04, grad=(0.95, 0.78))
    for sx in (-1, 1):
        for ky in (-1, 1):
            b.box((sx * (SH_W * 0.42), sy0 + 0.06 + ky * (SH_D * 0.38), deck_z + 0.04 + BH * 0.5), (0.11, 0.11, BH + 0.06), WOOD_D)
    # 正面神门与横竖木格
    dy_f = sy0 - SH_D * 0.38 - 0.05
    b.box((0, dy_f, deck_z + 0.62), (0.76, 0.05, 1.06), WOOD_D)
    for gx in (-0.18, 0.0, 0.18):
        b.box((gx, dy_f - 0.03, deck_z + 0.62), (0.03, 0.025, 0.98), WOOD_M)
    # 木制赛钱箱
    b.box((0, ry0 + 0.16, deck_z + 0.24), (0.48, 0.28, 0.38), WOOD_M, top=(1.08, 1.05))
    b.box((0, ry0 + 0.16, deck_z + 0.435), (0.46, 0.24, 0.02), WOOD_VD)
    # 注连绳（shimenawa）与 5 片醒目白色锯齿纸垂（shide），略往前移以便檐下清晰可见
    rope_pts = [
        Vector((-0.68, ry0 - 0.04, deck_z + BH - 0.04)),
        Vector((-0.34, ry0 - 0.08, deck_z + BH - 0.18)),
        Vector((0.0,   ry0 - 0.10, deck_z + BH - 0.22)),
        Vector((0.34,  ry0 - 0.08, deck_z + BH - 0.18)),
        Vector((0.68,  ry0 - 0.04, deck_z + BH - 0.04)),
    ]
    b.tube(rope_pts, [0.032, 0.060, 0.078, 0.060, 0.032], '#d6b868', seg=7, smooth=True)
    for k in range(5):
        u = -0.44 + k * 0.22
        zz = deck_z + BH - 0.23 + (u / 0.68) ** 2 * 0.14
        yy = ry0 - 0.11
        p0 = (u, yy, zz)
        p1 = (u - 0.055, yy - 0.01, zz - 0.11)
        p2 = (u + 0.055, yy - 0.01, zz - 0.20)
        p3 = (u - 0.045, yy - 0.01, zz - 0.32)
        b.double_poly([p0, (u + 0.038, yy, zz - 0.02), p1, (p1[0] + 0.07, yy - 0.01, p1[2] - 0.03)], [(0, 1, 3, 2)], '#fbfbf6')
        b.double_poly([p1, (p1[0] + 0.07, yy - 0.01, p1[2] - 0.03), p3, p2], [(0, 1, 3, 2)], '#fbfbf6')

    # 5) 氧化铜绿弯曲流造大屋顶（Nagare-zukuri + 前唐破风弧檐 + 交叉千木 + 鲣木！）
    rz0 = deck_z + BH + 0.08
    r_w = 1.18  # 半宽
    y_fr, y_bk = sy0 - 1.38, sy0 + 1.15
    z_ridge = rz0 + 1.18
    # 弯曲铜皮坡面（u 沿 X，v 从脊到檐）
    def copper_slope(y_eave, z_eave, sag_k=0.26, su=8, sv=6):
        verts_t, verts_b, cols_t = [], [], []
        for iv in range(sv + 1):
            v = iv / sv  # 0=脊，1=檐
            for iu in range(su + 1):
                u = iu / su
                xx = -r_w + 2.0 * r_w * u
                yy = sy0 + (y_eave - sy0) * v
                # 优雅凹弧 + 两侧翘角
                edge_lift = 0.12 * ((2.0 * u - 1.0) ** 2) * (v ** 1.5)
                zz = z_ridge + (z_eave - z_ridge) * (v ** 0.72) - sag_k * 4.0 * v * (1.0 - v) + edge_lift
                verts_t.append(Vector((xx, yy, zz)))
                verts_b.append(Vector((xx, yy, zz - 0.075)))
                c = lerp_col(COPPER_G, COPPER_GL, 0.25 + 0.55 * (1.0 - v))
                if iu % 2 == 0:
                    c = mul_col(c, 1.06)
                cols_t.append(c)
        gw = su + 1
        flip = (y_eave > sy0)
        f_top, f_bot = [], []
        for iv in range(sv):
            for iu in range(su):
                i0 = iv * gw + iu
                if flip:
                    f_top.append((i0, i0 + gw, i0 + gw + 1, i0 + 1))
                    f_bot.append((i0, i0 + 1, i0 + gw + 1, i0 + gw))
                else:
                    f_top.append((i0, i0 + 1, i0 + gw + 1, i0 + gw))
                    f_bot.append((i0, i0 + gw, i0 + gw + 1, i0 + 1))
        b.poly(verts_t, f_top, None, smooth=False, vert_colors=cols_t)
        b.poly(verts_b, f_bot, WOOD_D)
        # 檐口前封边
        e0 = sv * gw
        ev = verts_t[e0:e0 + gw] + verts_b[e0:e0 + gw]
        ef = [(i, i + gw, i + gw + 1, i + 1) if not flip else (i, i + 1, i + gw + 1, i + gw) for i in range(su)]
        b.poly(ev, ef, COPPER_GD)

    copper_slope(y_fr, rz0 - 0.18, sag_k=0.22, su=8, sv=6)
    copper_slope(y_bk, rz0 + 0.02, sag_k=0.18, su=8, sv=5)

    # 正面拱形唐破风小门廊雨庇（抬高并前伸干净突出于主坡之前，带弧形木破风与小鬼瓦，还原 shrine.png！）
    k_su, k_sv = 8, 3
    kv_t, kv_b, kc = [], [], []
    for iv in range(k_sv + 1):
        v = iv / k_sv  # 0=后接主坡，1=前檐
        yy = sy0 - 0.68 - v * 0.92
        for iu in range(k_su + 1):
            u = iu / k_su
            t = 2.0 * u - 1.0  # -1..1
            xx = t * 0.92
            # 经典的钟形唐破风拱线：中间鼓起，两侧优雅反翘
            arch = 0.34 * (math.cos(t * math.pi * 0.5) ** 2) + 0.06 * (t ** 4)
            zz = rz0 + 0.24 - v * 0.18 + arch
            kv_t.append(Vector((xx, yy, zz)))
            kv_b.append(Vector((xx, yy, zz - 0.065)))
            kc.append(lerp_col(COPPER_G, COPPER_GL, 0.35 + 0.50 * (1.0 - abs(t))))
    kw = k_su + 1
    kf_t = [(iv * kw + iu, iv * kw + iu + 1, (iv + 1) * kw + iu + 1, (iv + 1) * kw + iu) for iv in range(k_sv) for iu in range(k_su)]
    kf_b = [tuple(reversed(f)) for f in kf_t]
    b.poly(kv_t, kf_t, None, vert_colors=kc)
    b.poly(kv_b, kf_b, WOOD_D)
    # 唐破风前缘封边与正中铜脊
    fe = k_sv * kw
    b.poly(kv_t[fe:fe + kw] + kv_b[fe:fe + kw], [(i, i + kw, i + kw + 1, i + 1) for i in range(k_su)], WOOD_D)
    b.box((0, sy0 - 1.12, rz0 + 0.54), (0.14, 0.94, 0.13), COPPER_GD)
    b.box((0, sy0 - 1.60, rz0 + 0.52), (0.20, 0.08, 0.20), COPPER_GL, top=(0.75, 1.0))

    # 两侧山墙三角木板
    for sx in (-1, 1):
        xx = sx * (SH_W * 0.48)
        b.poly([(xx, sy0 - 0.60, rz0), (xx, sy0 + 0.65, rz0), (xx, sy0, z_ridge - 0.06)],
               [(0, 1, 2) if sx > 0 else (2, 1, 0)], WOOD_D)

    # 屋脊箱、交叉千木（chigi）与 3 根水平鲣木（katsuogi）
    b.box((0, sy0, z_ridge + 0.08), (2.0 * r_w + 0.12, 0.24, 0.22), COPPER_GD)
    b.cyl((0, sy0, z_ridge + 0.22), 0.075, 2.0 * r_w + 0.32, COPPER_GL, seg=8, axis='X')
    for sx in (-1, 1):
        cx = sx * (r_w * 0.72)
        b.seg((cx, sy0 - 0.34, z_ridge - 0.12), (cx, sy0 + 0.32, z_ridge + 0.78), 0.07, 0.11, COPPER_GL)
        b.seg((cx, sy0 + 0.34, z_ridge - 0.12), (cx, sy0 - 0.32, z_ridge + 0.78), 0.07, 0.11, COPPER_GL)
    for kx in (-0.52, 0.0, 0.52):
        b.cyl((kx, sy0, z_ridge + 0.28), 0.07, 0.56, COPPER_GL, seg=8, r2=0.065, axis='Y')

    return b.finish(name)
