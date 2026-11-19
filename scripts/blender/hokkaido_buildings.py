# 北海道建筑高细节程序化建模：
# house_red / house_blue / house_green / house_flat / barn / station
import math, random
from mathutils import Vector, Matrix
from inaka_core import (
    B, srgb, lerp_col, mul_col, vary,
    WOOD_VD, WOOD_D, WOOD, WOOD_M, WOOD_L, WOOD_W,
    CONCRETE, CONCRETE_D, IRON_D, IRON, STEEL,
)
from vista_common import (
    SNOW_W, SNOW_M, SNOW_S, snow_col,
    add_snow_pillow, add_snow_slope, add_roof_snow_shell, add_clapboard_wall,
)


# ---------------- 北海道住宅共用精细组件 ----------------

def _window(b, cx, cy, cz, w, h, face_axis='-Y', frame_col='#3c424a', sill_snow=True, panes_x=2, panes_z=1, glow_col='#ffdca0'):
    """北海道双层保温窗：外窗框、中梃分格、夜里发光玻璃(glow)、微挑窗台与窗台小雪条"""
    # face_axis in ('-Y', '+Y', '-X', '+X')
    out = {'-Y': Vector((0, -1, 0)), '+Y': Vector((0, 1, 0)), '-X': Vector((-1, 0, 0)), '+X': Vector((1, 0, 0))}[face_axis]
    rt = Vector((1, 0, 0)) if face_axis in ('-Y', '+Y') else Vector((0, 1, 0))
    if face_axis in ('+Y', '-X'):
        rt = -rt
    up = Vector((0, 0, 1))
    ctr = Vector((cx, cy, cz))
    rot = 0.0 if face_axis in ('-Y', '+Y') else math.pi * 0.5

    def place_box(local_x, local_out, local_z, sx, sy, sz, col, glow=False):
        p = ctr + rt * local_x + out * local_out + up * local_z
        size = (sx, sy, sz) if face_axis in ('-Y', '+Y') else (sy, sx, sz)
        b.box(p, size, col, glow=glow)

    fw = 0.065
    # 发光玻璃（微凹在窗框内）
    place_box(0, 0.012, 0, w - fw * 1.4, 0.03, h - fw * 1.4, glow_col, glow=True)
    # 四周主窗框（微微凸出墙面）
    place_box(0, 0.032, h * 0.5 - fw * 0.5, w + 0.04, 0.075, fw, frame_col)
    place_box(0, 0.032, -h * 0.5 + fw * 0.5, w + 0.04, 0.075, fw, frame_col)
    place_box(-w * 0.5 + fw * 0.5, 0.032, 0, fw, 0.075, h, frame_col)
    place_box(w * 0.5 - fw * 0.5, 0.032, 0, fw, 0.075, h, frame_col)
    # 竖向与横向中梃
    for i in range(1, panes_x):
        lx = -w * 0.5 + w * i / panes_x
        place_box(lx, 0.035, 0, 0.045, 0.055, h - fw, frame_col)
    for j in range(1, panes_z):
        lz = -h * 0.5 + h * j / panes_z
        place_box(0, 0.035, lz, w - fw, 0.055, 0.040, frame_col)
    # 外挑窗台板 + 窗台积雪小枕
    place_box(0, 0.075, -h * 0.5 - 0.015, w + 0.12, 0.14, 0.045, '#cfd4da')
    if sill_snow:
        sp = ctr + out * 0.085 + up * (-h * 0.5 + 0.008)
        sz_xy = (w + 0.08, 0.12) if face_axis in ('-Y', '+Y') else (0.12, w + 0.08)
        add_snow_pillow(b, (sp.x, sp.y, sp.z), sz_xy, height=0.075, nx=4, ny=2, drip=0.02, seed=int(abs(cx * 17 + cy * 31 + cz * 13)))


def _kerosene_tank(b, wall_x, cy, z0, side_sign=1, tank_col='#eceee8', pipe_up_z=1.75):
    """北海道标志性卧式灯油罐（架在四腿铁架上 + 加油口 + 油表 + 弯进墙面的供油铜管 + 顶上小积雪）"""
    # side_sign = +1 在右墙外(+X)，-1 在左墙外(-X)
    tx = wall_x + side_sign * 0.56
    r_t = 0.34
    L_t = 1.18
    leg_h = 0.92
    zc = z0 + leg_h + r_t * 0.85

    # 四条略外张的深灰角钢支腿 + 横向拉杆 + 承托鞍座
    for dy in (-0.42, 0.42):
        for dx_in, dx_out in ((-0.22, -0.34), (0.22, 0.34)):
            b.seg((tx + dx_out, cy + dy * 1.14, z0), (tx + dx_in, cy + dy, zc - r_t * 0.65), 0.036, 0.036, IRON_D)
        # 横撑与承托弧板
        b.seg((tx - 0.30, cy + dy * 1.08, z0 + 0.28), (tx + 0.30, cy + dy * 1.08, z0 + 0.28), 0.028, 0.028, IRON_D)
        b.box((tx, cy + dy, zc - r_t * 0.78), (0.52, 0.055, 0.075), IRON)
    b.seg((tx - 0.28, cy - 0.44, z0 + 0.32), (tx - 0.28, cy + 0.44, z0 + 0.32), 0.026, 0.026, IRON_D)
    b.seg((tx + 0.28, cy - 0.44, z0 + 0.32), (tx + 0.28, cy + 0.44, z0 + 0.32), 0.026, 0.026, IRON_D)

    # 卧式圆角椭圆柱灯油罐（沿 Y 方向长）
    b.cyl((tx, cy, zc), r_t, L_t, tank_col, seg=14, axis='Y', smooth=True, grad=(0.88, 1.05))
    # 两端微鼓的圆顶封头
    for sy in (-1, 1):
        b.sphere((tx, cy + sy * L_t * 0.5, zc), r_t, tank_col, sub=2, scale=(1.0, 0.34, 1.0), smooth=True)
        # 两道压筋环
        b.cyl((tx, cy + sy * L_t * 0.44, zc), r_t + 0.012, 0.03, mul_col(tank_col, 0.85), seg=14, axis='Y')
    # 顶部加油口帽 & 油位表
    b.cyl((tx, cy - 0.26, zc + r_t - 0.01), 0.055, 0.085, IRON_D, seg=8)
    b.cyl((tx, cy + 0.22, zc + r_t - 0.01), 0.040, 0.055, '#c8ccd0', seg=8)
    # 罐底出油阀 + 弯曲进墙面的供油细管
    p0 = Vector((tx - side_sign * 0.08, cy + 0.12, zc - r_t))
    p1 = Vector((tx - side_sign * 0.08, cy + 0.12, zc - r_t - 0.16))
    p2 = Vector((wall_x + side_sign * 0.06, cy + 0.12, zc - r_t - 0.16))
    p3 = Vector((wall_x + side_sign * 0.06, cy + 0.12, z0 + pipe_up_z))
    p4 = Vector((wall_x - side_sign * 0.04, cy + 0.12, z0 + pipe_up_z))
    b.tube([p0, p1, p2, p3, p4], 0.018, '#686e74', seg=6, smooth=False)
    # 罐顶一小条积雪
    add_snow_pillow(b, (tx, cy, zc + r_t * 0.88), (r_t * 1.15, L_t * 0.86), height=0.095, nx=5, ny=6, drip=0.02, seed=int(abs(cy * 23 + 7)))


def _stove_chimney(b, x, y, z_start, z_top, col='#484e56', wall_attach=None):
    """北海道铁皮取暖炉细烟囱（带防雨锥帽、管箍与可选外墙弯头）"""
    if wall_attach is not None:
        wx, wy, wz = wall_attach
        pts = [
            Vector((wx, wy, wz)),
            Vector((x, y, wz)),
            Vector((x, y, wz + 0.18)),
        ]
        b.tube(pts, 0.085, col, seg=10, smooth=True)
        z_start = wz + 0.12
    h = z_top - z_start
    if h < 0.2:
        return
    b.cyl((x, y, z_start), 0.082, h, col, seg=10, smooth=True, grad=(0.88, 1.06))
    # 烟囱接缝节环
    for zz in (z_start + h * 0.35, z_start + h * 0.72):
        b.cyl((x, y, zz), 0.092, 0.035, IRON_D, seg=10)
    # 若贴外墙则加墙面固定撑架
    if wall_attach is not None:
        wx, wy, wz = wall_attach
        for frac in (0.35, 0.72):
            zz = wz + (z_top - wz) * frac
            if zz < z_top - 0.5:
                b.seg((wx, wy, zz), (x, y, zz), 0.03, 0.03, IRON_D)
    # 防雨H型/锥形顶帽
    for a in (0.0, 2.094, 4.188):
        b.seg((x + math.cos(a) * 0.075, y + math.sin(a) * 0.075, z_top - 0.02),
              (x + math.cos(a) * 0.085, y + math.sin(a) * 0.085, z_top + 0.14), 0.016, 0.016, IRON_D)
    b.lathe((x, y, z_top + 0.11), [(0.165, 0.0), (0.155, 0.02), (0.015, 0.11)], col, seg=10)
    # 帽顶一点点白雪
    b.lathe((x, y, z_top + 0.14), [(0.135, 0.0), (0.08, 0.055), (0.012, 0.09)], SNOW_W, seg=10)


def _windbreak_foyer(b, cx, wall_y, z0, w=2.25, d=1.65, h=2.55, roof_style='gable', roof_col='#a42c28', frame_col='#b8bec4', seed=1):
    """
    北海道标志性玄关封闭玻璃风除室（风除室三面铝框落地玻璃 glow、推拉门扇、水泥台阶、独立积雪小顶）
    wall_y 为主房前墙 Y（负值），风除室向 -Y 伸出 d。
    """
    y_front = wall_y - d
    yc = wall_y - d * 0.5

    # 水泥踏步台基
    b.box((cx, yc - 0.04, z0 * 0.5), (w + 0.14, d + 0.14, z0), CONCRETE_D)
    b.box((cx, y_front - 0.24, z0 * 0.30), (w * 0.72, 0.38, z0 * 0.60), CONCRETE)
    # 踏步边小积雪
    add_snow_pillow(b, (cx - w * 0.42, y_front - 0.12, z0 * 0.55), (0.42, 0.28), height=0.08, nx=3, ny=2, seed=seed + 9)

    # 下部踢脚矮墙 + 三面温暖发光玻璃（glow 材质，夜里像暖灯箱透光！）
    kick_h = 0.22
    b.box((cx, yc, z0 + kick_h * 0.5), (w - 0.04, d - 0.04, kick_h), '#7a8088')
    # 发光玻璃内芯（三面可见，缩进在金属窗框内侧）
    gz0 = z0 + kick_h
    gh = h - kick_h - 0.08
    b.box((cx, yc, gz0 + gh * 0.5), (w - 0.12, d - 0.12, gh), '#ffe0a6', glow=True)

    # 铝框/深色金属立柱与横档（正面双开推拉玻璃门 + 左右玻璃格）
    post = 0.075
    for sx in (-1, 1):
        for yy in (y_front + post * 0.5, wall_y - post * 0.5):
            b.box((cx + sx * (w * 0.5 - post * 0.5), yy, z0 + h * 0.5), (post, post, h), frame_col)
    # 正面两根门框中柱 + 上下横梁 + 中腰栏杆
    for mx in (-w * 0.22, 0.0, w * 0.22):
        b.box((cx + mx, y_front + 0.025, gz0 + gh * 0.5), (0.052, 0.06, gh), frame_col)
    for zz in (z0 + kick_h, z0 + 1.08, z0 + h - 0.05, z0 + h - 0.42):
        b.box((cx, y_front + 0.025, zz), (w, 0.065, 0.055), frame_col)
        for sx in (-1, 1):
            b.box((cx + sx * (w * 0.5 - 0.025), yc, zz), (0.065, d, 0.055), frame_col)
    # 两侧中竖梃
    for sx in (-1, 1):
        b.box((cx + sx * (w * 0.5 - 0.025), yc, gz0 + gh * 0.5), (0.055, 0.048, gh), frame_col)
    # 门把手
    b.box((cx - 0.055, y_front - 0.015, z0 + 1.06), (0.024, 0.035, 0.20), IRON_D)
    b.box((cx + 0.055, y_front - 0.015, z0 + 1.06), (0.024, 0.035, 0.20), IRON_D)

    # 风除室小顶 + 厚积雪
    rz = z0 + h
    ov = 0.22
    if roof_style == 'gable':
        rh = 0.68
        # 山墙三角板
        gpts = [(cx - w * 0.5, y_front + 0.02, rz), (cx + w * 0.5, y_front + 0.02, rz), (cx, y_front + 0.02, rz + rh)]
        b.poly(gpts, [(0, 1, 2)], '#dcd6c8')
        # 两坡彩色铁皮顶板
        for sx in (-1, 1):
            p_eave = Vector((cx + sx * (w * 0.5 + ov), y_front - ov, rz - 0.06))
            p_eave_b = Vector((cx + sx * (w * 0.5 + ov), wall_y + 0.05, rz - 0.06))
            p_rid_f = Vector((cx, y_front - ov, rz + rh + 0.04))
            p_rid_b = Vector((cx, wall_y + 0.05, rz + rh + 0.04))
            if sx < 0:
                verts = [p_eave, p_eave_b, p_rid_b, p_rid_f]
                verts_b = [v - Vector((0, 0, 0.07)) for v in verts]
                b.poly(verts, [(0, 1, 2, 3)], roof_col)
                b.poly(verts_b, [(0, 3, 2, 1)], mul_col(roof_col, 0.65))
                b.poly([verts[0], verts[3], verts_b[3], verts_b[0]], [(0, 1, 2, 3)], mul_col(roof_col, 0.85))
            else:
                verts = [p_eave_b, p_eave, p_rid_f, p_rid_b]
                verts_b = [v - Vector((0, 0, 0.07)) for v in verts]
                b.poly(verts, [(0, 1, 2, 3)], roof_col)
                b.poly(verts_b, [(0, 3, 2, 1)], mul_col(roof_col, 0.65))
                b.poly([verts[1], verts[2], verts_b[2], verts_b[1]], [(0, 3, 2, 1)], mul_col(roof_col, 0.85))
        # 一体成型连续圆润小人字雪被（无脊管接缝！）
        add_roof_snow_shell(
            b,
            [(cx - (w * 0.5 + ov), rz - 0.06), (cx, rz + rh + 0.04), (cx + (w * 0.5 + ov), rz - 0.06)],
            y_front - ov + 0.04, wall_y + 0.02, thick=0.22, eave_drip=0.10, ny=6, axis='Y', seed=seed + 1,
        )
    elif roof_style == 'shed':
        # 前倾单坡铁皮顶 + 厚雪垫（house_blue 风格）
        z_hi = rz + 0.36
        z_lo = rz - 0.04
        p0 = Vector((cx - w * 0.5 - ov, y_front - ov, z_lo))
        p1 = Vector((cx + w * 0.5 + ov, y_front - ov, z_lo))
        q0 = Vector((cx - w * 0.5 - ov, wall_y + 0.02, z_hi))
        q1 = Vector((cx + w * 0.5 + ov, wall_y + 0.02, z_hi))
        verts = [p0, p1, q1, q0]
        vb = [v - Vector((0, 0, 0.08)) for v in verts]
        b.poly(verts, [(0, 1, 2, 3)], roof_col)
        b.poly(vb, [(0, 3, 2, 1)], mul_col(roof_col, 0.65))
        # 前封边与侧封边
        b.poly([p0, p1, vb[1], vb[0]], [(0, 3, 2, 1)], mul_col(roof_col, 0.82))
        b.poly([p0, q0, vb[3], vb[0]], [(0, 1, 2, 3)], mul_col(roof_col, 0.78))
        b.poly([p1, q1, vb[2], vb[1]], [(0, 3, 2, 1)], mul_col(roof_col, 0.78))
        add_snow_slope(b, p0, p1, q0, q1, thick=0.22, eave_overhang=0.08, eave_drip=0.10, nx=6, ny=4, seed=seed + 3)
    else:
        # 平顶雨庇 + 圆润雪枕（house_flat 风格）
        b.box((cx, yc - 0.08, rz + 0.08), (w + 0.24, d + 0.22, 0.16), roof_col)
        add_snow_pillow(b, (cx, yc - 0.08, rz + 0.15), (w + 0.22, d + 0.20), height=0.20, nx=6, ny=5, drip=0.07, seed=seed + 4)


def _gable_tin_roof_snow(b, W, D, z_eave, rh, ov_x, ov_y, roof_col, ridge_axis='X', snow_thick=0.34, seed=1, partial_snow=False):
    """
    彩色站缝铁皮人字顶 + 厚实圆润积雪被 + 檐口垂雪檐：
    ridge_axis='X': 屋脊沿 X（左右山墙）；ridge_axis='Y': 屋脊沿 Y（前后山墙，如 house_red.png！）
    """
    c_main = srgb(roof_col)
    c_dark = mul_col(c_main, 0.74)
    c_hi = mul_col(c_main, 1.15)
    hx = W * 0.5 + ov_x
    hy = D * 0.5 + ov_y
    thick = 0.12

    def build_slope_metal(p0, p1, q0, q1, n_ribs):
        p0, p1, q0, q1 = map(Vector, (p0, p1, q0, q1))
        nrm = (p1 - p0).cross(q0 - p0).normalized()
        if nrm.z < 0:
            nrm = -nrm
            p0, p1 = p1, p0
            q0, q1 = q1, q0
        top = [p0, p1, q1, q0]
        bot = [v - nrm * thick for v in top]
        b.poly(top, [(0, 1, 2, 3)], c_main)
        b.poly(bot, [(0, 3, 2, 1)], c_dark)
        # 四边檐口封板（彩钢鲜明外缘，让屋顶颜色清晰可读！）
        for i in range(4):
            ni = (i + 1) % 4
            b.poly([top[i], top[ni], bot[ni], bot[i]], [(0, 3, 2, 1)], c_dark if i % 2 else mul_col(c_main, 0.88))
        # 站缝压筋肋条（standing seam）
        for k in range(1, n_ribs):
            u = k / n_ribs
            a = p0.lerp(p1, u) + nrm * 0.018
            c = q0.lerp(q1, u) + nrm * 0.018
            b.seg(a, c, 0.036, 0.036, c_hi)

    if ridge_axis == 'Y':
        # 屋脊沿 Y（前后为三角形山墙，左右为大斜坡 —— 对照 house_red.png！）
        p0_l, p1_l = (-hx, hy, z_eave), (-hx, -hy, z_eave)
        q0_l, q1_l = (0.0, hy, z_eave + rh), (0.0, -hy, z_eave + rh)
        build_slope_metal(p0_l, p1_l, q0_l, q1_l, 16)
        p0_r, p1_r = (hx, -hy, z_eave), (hx, hy, z_eave)
        q0_r, q1_r = (0.0, -hy, z_eave + rh), (0.0, hy, z_eave + rh)
        build_slope_metal(p0_r, p1_r, q0_r, q1_r, 16)
        # 醒目的彩色山墙斜檐破风封板（让红/绿屋顶色彩在厚雪下仍清晰明亮！）
        for sy in (-1, 1):
            ye = sy * (hy - 0.02)
            for sx in (-1, 1):
                b.seg((sx * hx, ye, z_eave - 0.04), (0.0, ye, z_eave + rh - 0.02), 0.11, 0.24, c_main)
        # 连续一体成型的厚圆润白雪壳（从左檐经圆脊滑落至右檐，留出外缘约 0.12m 彩色铁皮檐边）
        add_roof_snow_shell(
            b,
            [(-hx, z_eave), (0.0, z_eave + rh), (hx, z_eave)],
            -hy + 0.10, hy - 0.10, thick=snow_thick, eave_drip=0.26, ny=14, axis='Y', seed=seed + 10,
        )
        for sy in (-1, 1):
            y_w = sy * D * 0.5
            pts = [(-W * 0.5, y_w, z_eave + ov_x * (rh / hx) - 0.15), (W * 0.5, y_w, z_eave + ov_x * (rh / hx) - 0.15), (0.0, y_w, z_eave + rh - 0.05)]
            b.poly(pts, [(0, 1, 2) if sy < 0 else (2, 1, 0)], '#e2dcd0')
    else:
        # 屋脊沿 X（左右为三角形山墙，前后为大斜坡 —— 对照 house_blue.png & house_green.png！）
        p0_f, p1_f = (-hx, -hy, z_eave), (hx, -hy, z_eave)
        q0_f, q1_f = (-hx, 0.0, z_eave + rh), (hx, 0.0, z_eave + rh)
        build_slope_metal(p0_f, p1_f, q0_f, q1_f, 18)
        p0_b, p1_b = (hx, hy, z_eave), (-hx, hy, z_eave)
        q0_b, q1_b = (hx, 0.0, z_eave + rh), (-hx, 0.0, z_eave + rh)
        build_slope_metal(p0_b, p1_b, q0_b, q1_b, 18)
        for sx in (-1, 1):
            xe = sx * (hx - 0.02)
            for sy in (-1, 1):
                b.seg((xe, sy * hy, z_eave - 0.04), (xe, 0.0, z_eave + rh - 0.02), 0.11, 0.24, c_main)
        if partial_snow:
            # house_blue 风格：前坡中下部覆盖大片厚实滑落状雪被，上部露出一截鲜明的蓝色站缝铁皮屋顶！
            q0_f_mid = Vector(p0_f).lerp(Vector(q0_f), 0.68)
            q1_f_mid = Vector(p1_f).lerp(Vector(q1_f), 0.68)
            add_snow_slope(b, p0_f, p1_f, q0_f_mid, q1_f_mid, thick=snow_thick * 1.08, eave_overhang=0.18, eave_drip=0.25, nx=14, ny=6, seed=seed + 30)
            # 屋脊带也堆一条柔和的圆雪脊
            add_roof_snow_shell(
                b,
                [(-0.55, z_eave + rh - 0.32), (0.0, z_eave + rh), (hy, z_eave)],
                -hx + 0.12, hx - 0.12, thick=snow_thick * 0.92, eave_drip=0.22, ny=14, axis='X', seed=seed + 40,
            )
        else:
            # house_green 风格：连续圆润雪被覆盖整顶，但檐口略微露出一线鲜明深绿铁皮！
            add_roof_snow_shell(
                b,
                [(-hy, z_eave), (0.0, z_eave + rh), (hy, z_eave)],
                -hx + 0.10, hx - 0.10, thick=snow_thick, eave_drip=0.25, ny=14, axis='X', seed=seed + 30,
            )


def _gable_clapboard_tri(b, W, D, z_base, z_peak, wall_col, axis='Y'):
    """给三角形山墙贴水平雨淋板（避免大白三角块面）"""
    n_rows = 10
    dh = (z_peak - z_base) / n_rows
    c0 = srgb(wall_col)
    if axis == 'Y':
        for sy in (-1, 1):
            y = sy * (D * 0.5)
            for i in range(n_rows):
                za = z_base + i * dh
                zb = za + dh
                wa = W * max(0.02, 1.0 - i / n_rows)
                wb = W * max(0.01, 1.0 - (i + 1) / n_rows)
                ya = y + sy * 0.018
                yb = y
                col = mul_col(c0, 0.94 + 0.08 * (i / n_rows))
                if sy < 0:
                    verts = [(-wa * 0.5, ya, za), (wa * 0.5, ya, za), (wb * 0.5, yb, zb), (-wb * 0.5, yb, zb)]
                else:
                    verts = [(wa * 0.5, ya, za), (-wa * 0.5, ya, za), (-wb * 0.5, yb, zb), (wb * 0.5, yb, zb)]
                b.poly(verts, [(0, 1, 2, 3)], col)
    else:
        for sx in (-1, 1):
            x = sx * (W * 0.5)
            for i in range(n_rows):
                za = z_base + i * dh
                zb = za + dh
                da = D * max(0.02, 1.0 - i / n_rows)
                db = D * max(0.01, 1.0 - (i + 1) / n_rows)
                xa = x + sx * 0.018
                xb = x
                col = mul_col(c0, 0.94 + 0.08 * (i / n_rows))
                if sx > 0:
                    verts = [(xa, -da * 0.5, za), (xa, da * 0.5, za), (xb, db * 0.5, zb), (xb, -db * 0.5, zb)]
                else:
                    verts = [(xa, da * 0.5, za), (xa, -da * 0.5, za), (xb, -db * 0.5, zb), (xb, db * 0.5, zb)]
                b.poly(verts, [(0, 1, 2, 3)], col)


# ---------------- 1. 红顶北海道木板房 house_red（对照 house_red.png） ----------------

def build_house_red(name='house_red', seed=101):
    b = B(seed)
    W, D = 9.4, 11.0  # 12x9m 级（山墙朝前 -Y，深 11m，含风除室/油罐约 10.8×12.6m）
    z_base = 0.58
    H_wall = 5.15
    z_eave = z_base + H_wall
    rh = 2.85
    wall_col = '#ece3d0'
    trim_col = '#c6baa4'
    roof_col = '#a62c28'

    # 1) 防冻混凝土台基 + 通风孔
    b.box((0, 0, z_base * 0.5), (W + 0.12, D + 0.12, z_base), '#9a9fa4', grad=(0.86, 1.04))
    for vx in (-2.6, 2.6):
        b.box((vx, -D * 0.5 - 0.06, 0.30), (0.48, 0.04, 0.20), '#383c40')
    for vy in (-3.2, 0.0, 3.2):
        for sx in (-1, 1):
            b.box((sx * (W * 0.5 + 0.06), vy, 0.30), (0.04, 0.48, 0.20), '#383c40')

    # 2) 两层实心主体 + 四面水平雨淋板 + 四角包角柱 + 腰线
    b.box((0, 0, z_base + H_wall * 0.5), (W - 0.04, D - 0.04, H_wall), wall_col)
    add_clapboard_wall(b, -W * 0.5, W * 0.5, -D * 0.5, z_base, z_eave, -1, wall_col, plank_h=0.22, along='X')
    add_clapboard_wall(b, -W * 0.5, W * 0.5, D * 0.5, z_base, z_eave, 1, wall_col, plank_h=0.22, along='X')
    add_clapboard_wall(b, -D * 0.5, D * 0.5, W * 0.5, z_base, z_eave, 1, wall_col, plank_h=0.22, along='Y')
    add_clapboard_wall(b, -D * 0.5, D * 0.5, -W * 0.5, z_base, z_eave, -1, wall_col, plank_h=0.22, along='Y')
    _gable_clapboard_tri(b, W, D, z_eave - 0.05, z_eave + rh, wall_col, axis='Y')
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((sx * (W * 0.5), sy * (D * 0.5), z_base + H_wall * 0.5), (0.16, 0.16, H_wall + 0.04), trim_col)
    # 屋檐下檐带木条
    for sy in (-1, 1):
        b.box((0, sy * (D * 0.5 + 0.02), z_eave - 0.06), (W + 0.18, 0.08, 0.14), trim_col)

    # 3) 红色铁皮人字顶 + 厚圆润雪被 + 檐口垂雪
    _gable_tin_roof_snow(b, W, D, z_eave - 0.12, rh + 0.12, ov_x=0.68, ov_y=0.58, roof_col=roof_col, ridge_axis='Y', snow_thick=0.38, seed=seed)

    # 4) 正面(-Y) 封闭玻璃风除室（前左偏中，带小红顶与积雪）
    _windbreak_foyer(b, -1.65, -D * 0.5, z_base, w=2.45, d=1.70, h=2.65, roof_style='gable', roof_col=roof_col, frame_col='#d4d8dc', seed=seed)

    # 5) 一楼/二楼保温窗（全部带 glow + 雪窗台）
    # 正面二楼 2 扇大窗 + 一楼右侧窗
    _window(b, -1.65, -D * 0.5, z_base + 3.85, 1.85, 1.32, '-Y', frame_col='#4c4642')
    _window(b, 1.95, -D * 0.5, z_base + 3.85, 1.85, 1.32, '-Y', frame_col='#4c4642')
    _window(b, 1.95, -D * 0.5, z_base + 1.55, 1.95, 1.35, '-Y', frame_col='#4c4642')
    # 背面窗户
    _window(b, -2.0, D * 0.5, z_base + 3.85, 1.70, 1.25, '+Y', frame_col='#4c4642')
    _window(b, 2.0, D * 0.5, z_base + 3.85, 1.70, 1.25, '+Y', frame_col='#4c4642')
    _window(b, 0.0, D * 0.5, z_base + 1.55, 2.20, 1.30, '+Y', frame_col='#4c4642')
    # 两侧窗户（右侧避开灯油罐）
    _window(b, W * 0.5, 2.4, z_base + 1.60, 1.65, 1.20, '+X', frame_col='#4c4642')
    _window(b, -W * 0.5, -2.2, z_base + 1.60, 1.70, 1.25, '-X', frame_col='#4c4642')
    _window(b, -W * 0.5, 2.2, z_base + 1.60, 1.70, 1.25, '-X', frame_col='#4c4642')

    # 6) 右侧壁白色卧式灯油罐（架在铁架上）
    _kerosene_tank(b, W * 0.5, -2.15, 0.0, side_sign=1, tank_col='#eceee8')

    # 7) 细铁皮烟囱（从右侧屋坡雪中穿出，带雨帽与白雪）
    _stove_chimney(b, 2.35, -1.60, z_eave + 1.0, z_eave + rh + 0.95, col='#4c525a')

    # 8) 房脚四周少许柔和积雪边
    add_snow_pillow(b, (2.2, -D * 0.5 - 0.35, 0.0), (3.4, 0.75), height=0.22, nx=6, ny=3, seed=seed + 90)
    return b.finish(name, glow_color='#ffdda0')


# ---------------- 2. 蓝顶北海道两层房 house_blue（对照 house_blue.png） ----------------

def build_house_blue(name='house_blue', seed=102):
    b = B(seed)
    W, D = 11.2, 8.4  # 横向屋脊朝前 -Y
    z_base = 0.56
    H_wall = 5.20
    z_eave = z_base + H_wall
    rh = 2.60
    wall_col = '#cfd8e2'
    trim_col = '#4c5e72'
    roof_col = '#2d5c94'

    # 1) 混凝土防冻台基
    b.box((0, 0, z_base * 0.5), (W + 0.12, D + 0.12, z_base), '#9298a0', grad=(0.86, 1.04))

    # 2) 两层冷灰蓝水平雨淋板外墙 + 山墙三角雨淋板 + 深蓝灰包角
    b.box((0, 0, z_base + H_wall * 0.5), (W - 0.04, D - 0.04, H_wall), wall_col)
    add_clapboard_wall(b, -W * 0.5, W * 0.5, -D * 0.5, z_base, z_eave, -1, wall_col, plank_h=0.21, along='X')
    add_clapboard_wall(b, -W * 0.5, W * 0.5, D * 0.5, z_base, z_eave, 1, wall_col, plank_h=0.21, along='X')
    add_clapboard_wall(b, -D * 0.5, D * 0.5, W * 0.5, z_base, z_eave, 1, wall_col, plank_h=0.21, along='Y')
    add_clapboard_wall(b, -D * 0.5, D * 0.5, -W * 0.5, z_base, z_eave, -1, wall_col, plank_h=0.21, along='Y')
    _gable_clapboard_tri(b, W, D, z_eave - 0.05, z_eave + rh, wall_col, axis='X')
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((sx * (W * 0.5), sy * (D * 0.5), z_base + H_wall * 0.5), (0.16, 0.16, H_wall + 0.04), trim_col)
    # 二楼水平分界饰条
    for sy in (-1, 1):
        b.box((0, sy * (D * 0.5 + 0.02), z_base + 2.68), (W + 0.08, 0.05, 0.09), '#9aa6b4')

    # 3) 蓝色站缝铁皮人字顶（横脊沿 X）+ 厚实雪被（前坡上半部露出一条亮眼蓝铁皮，极具辨识度！）
    _gable_tin_roof_snow(b, W, D, z_eave - 0.10, rh + 0.10, ov_x=0.55, ov_y=0.65, roof_col=roof_col, ridge_axis='X', snow_thick=0.35, seed=seed, partial_snow=True)

    # 4) 前左封闭玻璃风除室（单坡蓝色雪顶，对照 house_blue.png！）
    _windbreak_foyer(b, -3.15, -D * 0.5, z_base, w=2.55, d=1.80, h=2.52, roof_style='shed', roof_col=roof_col, frame_col='#424c58', seed=seed)

    # 5) 二楼和一楼大保温窗（glow + 雪窗台）
    _window(b, -3.15, -D * 0.5, z_base + 3.92, 2.05, 1.28, '-Y', frame_col='#525c68')
    _window(b, 0.45, -D * 0.5, z_base + 3.92, 2.05, 1.28, '-Y', frame_col='#525c68')
    _window(b, 3.65, -D * 0.5, z_base + 3.92, 1.55, 1.28, '-Y', frame_col='#525c68')
    _window(b, 0.85, -D * 0.5, z_base + 1.50, 2.35, 1.42, '-Y', frame_col='#525c68')
    _window(b, 3.75, -D * 0.5, z_base + 1.50, 1.45, 1.32, '-Y', frame_col='#525c68')
    # 右山墙侧窗（对照 house_blue.png）
    _window(b, W * 0.5, -1.65, z_base + 3.92, 1.45, 1.22, '+X', frame_col='#525c68')
    _window(b, W * 0.5, 1.65, z_base + 3.92, 1.45, 1.22, '+X', frame_col='#525c68')
    _window(b, W * 0.5, 1.85, z_base + 1.50, 1.55, 1.28, '+X', frame_col='#525c68')
    # 左侧与背面窗
    _window(b, -W * 0.5, 1.20, z_base + 3.92, 1.60, 1.22, '-X', frame_col='#525c68')
    _window(b, -2.5, D * 0.5, z_base + 3.92, 1.90, 1.25, '+Y', frame_col='#525c68')
    _window(b, 2.5, D * 0.5, z_base + 3.92, 1.90, 1.25, '+Y', frame_col='#525c68')
    _window(b, 0.0, D * 0.5, z_base + 1.50, 2.10, 1.30, '+Y', frame_col='#525c68')

    # 6) 右外墙深绿色卧式灯油罐（对照 house_blue.png！）+ 贴墙上行细铁皮烟囱
    _kerosene_tank(b, W * 0.5, -1.75, 0.0, side_sign=1, tank_col='#2c5240', pipe_up_z=2.0)
    _stove_chimney(b, W * 0.5 + 0.32, -0.15, z_base + 1.4, z_eave + rh + 0.85, col='#363c44', wall_attach=(W * 0.5, -0.15, z_base + 1.65))

    return b.finish(name, glow_color='#ffe0a4')


# ---------------- 3. 绿顶北海道木板房 house_green（对照 house_green.png） ----------------

def build_house_green(name='house_green', seed=103):
    b = B(seed)
    W, D = 10.6, 8.6
    z_base = 0.55
    H_wall = 5.10
    z_eave = z_base + H_wall
    rh = 2.65
    wall_col = '#d6b88e'
    trim_col = '#4c3e32'
    roof_col = '#285e44'

    # 1) 防冻石基台
    b.box((0, 0, z_base * 0.5), (W + 0.12, D + 0.12, z_base), '#90969c', grad=(0.86, 1.04))

    # 2) 暖木色水平雨淋板两层主体
    b.box((0, 0, z_base + H_wall * 0.5), (W - 0.04, D - 0.04, H_wall), wall_col)
    add_clapboard_wall(b, -W * 0.5, W * 0.5, -D * 0.5, z_base, z_eave, -1, wall_col, plank_h=0.22, along='X')
    add_clapboard_wall(b, -W * 0.5, W * 0.5, D * 0.5, z_base, z_eave, 1, wall_col, plank_h=0.22, along='X')
    add_clapboard_wall(b, -D * 0.5, D * 0.5, W * 0.5, z_base, z_eave, 1, wall_col, plank_h=0.22, along='Y')
    add_clapboard_wall(b, -D * 0.5, D * 0.5, -W * 0.5, z_base, z_eave, -1, wall_col, plank_h=0.22, along='Y')
    _gable_clapboard_tri(b, W, D, z_eave - 0.05, z_eave + rh, wall_col, axis='X')
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((sx * (W * 0.5), sy * (D * 0.5), z_base + H_wall * 0.5), (0.16, 0.16, H_wall + 0.04), trim_col)

    # 3) 深松绿铁皮人字顶 + 厚实圆润积雪被 + 檐口雪唇
    _gable_tin_roof_snow(b, W, D, z_eave - 0.10, rh + 0.10, ov_x=0.60, ov_y=0.66, roof_col=roof_col, ridge_axis='X', snow_thick=0.38, seed=seed)

    # 4) 前右封闭玻璃风除室（带绿顶人字小顶与厚雪，对照 house_green.png！）
    _windbreak_foyer(b, 2.55, -D * 0.5, z_base, w=2.40, d=1.72, h=2.60, roof_style='gable', roof_col=roof_col, frame_col='#52463a', seed=seed)

    # 5) 窗户（二楼宽窗 + 一楼左侧大窗）
    _window(b, -2.35, -D * 0.5, z_base + 3.88, 2.10, 1.30, '-Y', frame_col='#56483a')
    _window(b, 2.55, -D * 0.5, z_base + 3.88, 1.85, 1.30, '-Y', frame_col='#56483a')
    _window(b, -2.35, -D * 0.5, z_base + 1.52, 2.30, 1.38, '-Y', frame_col='#56483a')
    _window(b, -2.2, D * 0.5, z_base + 3.88, 1.85, 1.25, '+Y', frame_col='#56483a')
    _window(b, 2.2, D * 0.5, z_base + 3.88, 1.85, 1.25, '+Y', frame_col='#56483a')
    _window(b, 0.0, D * 0.5, z_base + 1.52, 2.20, 1.30, '+Y', frame_col='#56483a')
    _window(b, W * 0.5, 0.5, z_base + 3.88, 1.60, 1.22, '+X', frame_col='#56483a')
    _window(b, W * 0.5, 0.5, z_base + 1.52, 1.65, 1.28, '+X', frame_col='#56483a')

    # 6) 左侧壁白色卧式灯油罐 + 贴墙银灰细铁皮烟囱（对照 house_green.png！）
    _kerosene_tank(b, -W * 0.5, -1.55, 0.0, side_sign=-1, tank_col='#eceee8')
    _stove_chimney(b, -W * 0.5 - 0.30, 0.65, z_base + 1.2, z_eave + rh + 0.85, col='#a4acb4', wall_attach=(-W * 0.5, 0.65, z_base + 1.45))

    return b.finish(name, glow_color='#ffdfa2')


# ---------------- 4. 无落雪平顶 / M 形顶两层房 house_flat（对照 house_flat.png） ----------------

def build_house_flat(name='house_flat', seed=104):
    b = B(seed)
    W, D = 10.6, 8.6
    z_base = 0.58
    H_wall = 5.65
    z_top = z_base + H_wall
    wall_col = '#e4e5e0'
    fascia_col = '#9aa6b4'

    # 1) 深灰混凝土防冻基座
    b.box((0, 0, z_base * 0.5), (W + 0.14, D + 0.14, z_base), '#7e848c', grad=(0.85, 1.04))

    # 2) 方正主体 + 四面竖向镀锌压型钢板肌理
    b.box((0, 0, z_base + H_wall * 0.5), (W - 0.04, D - 0.04, H_wall), wall_col)
    # 四面竖向镀锌板条纹（节奏细密干净、面数克制）
    step = 0.36
    nx = int(W / step)
    for sy in (-1, 1):
        for i in range(nx + 1):
            rx = -W * 0.5 + W * i / nx
            b.box((rx, sy * (D * 0.5 + 0.012), z_base + H_wall * 0.5), (0.04, 0.025, H_wall), '#cfd4d8' if i % 2 == 0 else '#eceee8')
    ny = int(D / step)
    for sx in (-1, 1):
        for i in range(ny + 1):
            ry = -D * 0.5 + D * i / ny
            b.box((sx * (W * 0.5 + 0.012), ry, z_base + H_wall * 0.5), (0.025, 0.04, H_wall), '#cfd4d8' if i % 2 == 0 else '#eceee8')
    # 四角金属收边与楼层间水平收边带
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((sx * (W * 0.5), sy * (D * 0.5), z_base + H_wall * 0.5), (0.14, 0.14, H_wall), '#848e98')
    b.box((0, 0, z_base + 2.85), (W + 0.08, D + 0.08, 0.10), '#a8b0b8')

    # 3) 北海道「无落雪」高女儿墙金属檐冠（略微外挑）+ 内部微凹 M 形天沟屋顶 + 厚实圆润边缘积雪枕！
    par_h = 0.78
    b.box((0, 0, z_top + par_h * 0.5), (W + 0.38, D + 0.38, par_h), fascia_col, grad=(0.90, 1.06))
    # 檐冠下口金属挑檐底边与顶沿金属压顶
    b.box((0, 0, z_top + 0.04), (W + 0.44, D + 0.44, 0.08), '#7a8490')
    b.box((0, 0, z_top + par_h + 0.03), (W + 0.44, D + 0.44, 0.07), '#7c8896')
    # 檐冠表面竖向接缝装饰
    for i in range(16):
        rx = -W * 0.48 + W * 0.96 * i / 15.0
        for sy in (-1, 1):
            b.box((rx, sy * (D * 0.5 + 0.20), z_top + par_h * 0.5), (0.03, 0.02, par_h - 0.10), '#828e9c')
    # 厚厚一层圆润边缘积雪（完整覆盖无落雪女儿墙顶，并柔和溢出檐口形成雪檐！）
    add_snow_pillow(b, (0, 0, z_top + par_h + 0.02), (W + 0.62, D + 0.62), height=0.68, nx=14, ny=12, drip=0.22, seed=seed, overhang=0.14)

    # 4) 正面左偏中平顶封闭玻璃风除室（glow）
    _windbreak_foyer(b, -2.35, -D * 0.5, z_base, w=2.35, d=1.65, h=2.55, roof_style='flat', roof_col='#8c96a2', frame_col='#b8c0c8', seed=seed)

    # 5) 整齐现代矩形大保温窗（glow + 雪窗台）
    _window(b, -2.35, -D * 0.5, z_base + 4.25, 1.85, 1.45, '-Y', frame_col='#9ea6ae')
    _window(b, 1.85, -D * 0.5, z_base + 4.25, 2.35, 1.50, '-Y', frame_col='#9ea6ae')
    _window(b, 1.85, -D * 0.5, z_base + 1.55, 2.35, 1.48, '-Y', frame_col='#9ea6ae')
    # 右侧面（含小高窗与一楼窗，对照 house_flat.png）
    _window(b, W * 0.5, -1.6, z_base + 4.50, 0.95, 0.78, '+X', frame_col='#9ea6ae', panes_x=1)
    _window(b, W * 0.5, 2.2, z_base + 1.55, 1.35, 1.25, '+X', frame_col='#9ea6ae')
    # 左侧与背面窗
    _window(b, -W * 0.5, 1.6, z_base + 4.25, 1.65, 1.35, '-X', frame_col='#9ea6ae')
    _window(b, -2.2, D * 0.5, z_base + 4.25, 1.95, 1.40, '+Y', frame_col='#9ea6ae')
    _window(b, 2.2, D * 0.5, z_base + 4.25, 1.95, 1.40, '+Y', frame_col='#9ea6ae')
    _window(b, 0.0, D * 0.5, z_base + 1.55, 2.35, 1.40, '+Y', frame_col='#9ea6ae')

    # 6) 右侧壁白色卧式灯油罐 + 贴墙通风排气管（对照 house_flat.png）
    _kerosene_tank(b, W * 0.5, -1.45, 0.0, side_sign=1, tank_col='#eceee8', pipe_up_z=3.8)
    _stove_chimney(b, -W * 0.5 - 0.25, -1.50, z_base + 1.5, z_top + par_h + 1.15, col='#788088', wall_attach=(-W * 0.5, -1.50, z_base + 1.8))

    return b.finish(name, glow_color='#ffe2aa')


# ---------------- 5. 北海道红谷仓 + 圆筒筒仓 barn（对照 barn.png） ----------------

def build_barn(name='barn', seed=105):
    b = B(seed)
    # 谷仓主体偏左，圆筒筒仓紧挨右侧，整体底面中心近似落在原点
    bx = -2.35
    W, D = 9.2, 13.6
    z_base = 0.62
    H_wall = 4.25
    z_eave = z_base + H_wall
    barn_red = '#942e28'
    barn_red_d = '#74221e'
    trim_w = '#f0eee8'

    # 1) 谷仓混凝土石基
    b.box((bx, 0, z_base * 0.5), (W + 0.18, D + 0.18, z_base), '#8a8e94', grad=(0.86, 1.04))

    # 2) 谷仓红色竖向木板外墙（board-and-batten）
    b.box((bx, 0, z_base + H_wall * 0.5), (W - 0.04, D - 0.04, H_wall), barn_red)
    # 竖向压缝木条（前后左右）
    for sy in (-1, 1):
        for i in range(17):
            rx = bx - W * 0.5 + W * i / 16.0
            b.box((rx, sy * (D * 0.5 + 0.015), z_base + H_wall * 0.5), (0.05, 0.03, H_wall), barn_red_d)
    for sx in (-1, 1):
        for i in range(23):
            ry = -D * 0.5 + D * i / 22.0
            b.box((bx + sx * (W * 0.5 + 0.015), ry, z_base + H_wall * 0.5), (0.03, 0.05, H_wall), barn_red_d)
    # 醒目白色转角木柱与底部踢脚边
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((bx + sx * (W * 0.5), sy * (D * 0.5), z_base + H_wall * 0.5), (0.22, 0.22, H_wall + 0.04), trim_w)

    # 3) 复斜屋顶（Gambrel Roof）：陡峭下折坡 + 平缓上折坡，带厚实圆润白雪被与白色山墙框边！
    # 断面节点（相对 bx）：檐口 x=±4.60 z=z_eave -> 折脊 x=±2.85 z=z_eave+3.05 -> 正脊 x=0 z=z_eave+4.35
    x_e, z_e = W * 0.5 + 0.55, z_eave - 0.22
    x_k, z_k = W * 0.31, z_eave + 3.05
    z_r = z_eave + 4.32
    hy = D * 0.5 + 0.58

    # 前后五边形复斜山墙红板 + 白色斜檐破风板
    for sy in (-1, 1):
        yw = sy * (D * 0.5)
        gpts = [
            (bx - W * 0.5, yw, z_eave - 0.02),
            (bx + W * 0.5, yw, z_eave - 0.02),
            (bx + x_k, yw, z_k),
            (bx, yw, z_r),
            (bx - x_k, yw, z_k),
        ]
        b.poly(gpts, [(0, 1, 2, 3, 4) if sy < 0 else (4, 3, 2, 1, 0)], barn_red)
        # 复斜山墙竖条纹
        for k in range(-7, 8):
            rx = k * 0.56
            ar = abs(rx)
            if ar < x_k:
                zt_bar = z_r - (z_r - z_k) * (ar / x_k)
            elif ar < W * 0.5:
                zt_bar = z_k - (z_k - z_eave) * ((ar - x_k) / (W * 0.5 - x_k))
            else:
                continue
            b.box((bx + rx, yw + sy * 0.016, (z_eave + zt_bar) * 0.5), (0.045, 0.03, max(0.1, zt_bar - z_eave)), barn_red_d)
        # 白色复斜檐口破风板
        ye = sy * (hy - 0.06)
        for sx in (-1, 1):
            b.seg((bx + sx * x_e, ye, z_e), (bx + sx * x_k, ye, z_k), 0.14, 0.22, trim_w)
            b.seg((bx + sx * x_k, ye, z_k), (bx, ye, z_r), 0.14, 0.22, trim_w)

    # 复斜屋顶 4 个坡面（底板暗铁皮）+ 整顶一次成型连续圆润复斜白雪壳（绝无折脊硬管！）
    roof_dark = '#3c4048'
    slopes = [
        ((bx - x_e, hy, z_e), (bx - x_e, -hy, z_e), (bx - x_k, hy, z_k), (bx - x_k, -hy, z_k)),
        ((bx - x_k, hy, z_k), (bx - x_k, -hy, z_k), (bx, hy, z_r), (bx, -hy, z_r)),
        ((bx + x_e, -hy, z_e), (bx + x_e, hy, z_e), (bx + x_k, -hy, z_k), (bx + x_k, hy, z_k)),
        ((bx + x_k, -hy, z_k), (bx + x_k, hy, z_k), (bx, -hy, z_r), (bx, hy, z_r)),
    ]
    for p0, p1, q0, q1 in slopes:
        vp0, vp1, vq0, vq1 = map(Vector, (p0, p1, q0, q1))
        nrm = (vp1 - vp0).cross(vq0 - vp0).normalized()
        if nrm.z < 0:
            nrm = -nrm
        top = [vp0, vp1, vq1, vq0]
        bot = [v - nrm * 0.14 for v in top]
        b.poly(top, [(0, 1, 2, 3)], roof_dark)
        b.poly(bot, [(0, 3, 2, 1)], '#2a2d32')
    add_roof_snow_shell(
        b,
        [(bx - x_e, z_e), (bx - x_k, z_k), (bx, z_r), (bx + x_k, z_k), (bx + x_e, z_e)],
        -hy + 0.08, hy - 0.08, thick=0.38, eave_drip=0.28, ny=16, axis='Y', seed=seed + 15,
    )

    # 屋脊中央通风小天窗亭（Cupola，带白框红墙与雪帽，对照 barn.png！）
    cz_c = z_r + 0.15
    b.box((bx, -0.4, cz_c + 0.55), (1.35, 1.55, 1.10), barn_red)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((bx + sx * 0.68, -0.4 + sy * 0.78, cz_c + 0.55), (0.10, 0.10, 1.12), trim_w)
    # 小百叶窗
    for sy in (-1, 1):
        b.box((bx, -0.4 + sy * 0.79, cz_c + 0.62), (0.68, 0.05, 0.55), '#3c3430')
    # 小亭雪帽
    add_snow_pillow(b, (bx, -0.4, cz_c + 1.08), (1.75, 1.95), height=0.45, nx=6, ny=6, drip=0.10, seed=seed + 55)

    # 4) 正面(-Y) 白色门框双开大推拉谷仓门 + 上层干草阁楼门 + 侧面白色方窗
    yf = -D * 0.5 - 0.04
    # 大门滑轨与门扇
    b.box((bx, yf - 0.04, z_base + 3.05), (4.60, 0.12, 0.14), trim_w)
    dw, dh = 3.20, 2.95
    b.box((bx, yf, z_base + dh * 0.5), (dw + 0.26, 0.10, dh + 0.18), trim_w)
    for sx in (-1, 1):
        dx = bx + sx * (dw * 0.25 + 0.02)
        b.box((dx, yf - 0.03, z_base + dh * 0.5), (dw * 0.48, 0.08, dh - 0.08), barn_red_d)
        # 白色门扇框与中横撑/斜撑
        b.box((dx, yf - 0.06, z_base + dh - 0.08), (dw * 0.48, 0.05, 0.12), trim_w)
        b.box((dx, yf - 0.06, z_base + 0.08), (dw * 0.48, 0.05, 0.12), trim_w)
        b.box((dx, yf - 0.06, z_base + dh * 0.52), (dw * 0.48, 0.05, 0.12), trim_w)
        b.seg((dx - dw * 0.22, yf - 0.07, z_base + 0.12), (dx + dw * 0.22, yf - 0.07, z_base + dh * 0.50), 0.09, 0.04, trim_w)
    # 上层白色边框干草阁楼门
    b.box((bx, yf, z_eave + 1.15), (1.58, 0.10, 1.95), trim_w)
    b.box((bx, yf - 0.03, z_eave + 1.15), (1.30, 0.08, 1.68), barn_red_d)
    # 正面两侧与左右侧壁白框小方窗
    for sx in (-1, 1):
        b.box((bx + sx * 3.15, yf, z_base + 1.65), (0.92, 0.09, 0.92), trim_w)
        b.box((bx + sx * 3.15, yf - 0.03, z_base + 1.65), (0.70, 0.07, 0.70), '#282c34')
    for wy in (-4.4, -1.4, 1.6, 4.4):
        for sx in (-1, 1):
            wx = bx + sx * (W * 0.5 + 0.03)
            b.box((wx, wy, z_base + 2.05), (0.09, 1.05, 1.05), trim_w)
            b.box((wx + sx * 0.03, wy, z_base + 2.05), (0.07, 0.80, 0.80), '#282c34')
            b.box((wx + sx * 0.04, wy, z_base + 2.05), (0.04, 0.80, 0.05), trim_w)
            b.box((wx + sx * 0.04, wy, z_base + 2.05), (0.04, 0.05, 0.80), trim_w)

    # 5) 紧挨谷仓右侧的高大圆筒筒仓（Silo：靠前偏右，浅灰混凝土砖筒 + 铁箍 + 侧梯井 + 圆顶 + 厚雪帽！）
    sx_s, sy_s = bx + W * 0.5 + 2.38, -1.05
    sr = 2.18
    sh = 11.40
    # 筒仓基座与分段浅灰砖筒
    b.cyl((sx_s, sy_s, 0.0), sr + 0.12, 0.58, '#82868c', seg=18)
    n_rings = 9
    rh_s = (sh - 0.58) / n_rings
    for i in range(n_rings):
        zb = 0.58 + i * rh_s
        col = vary('#c2c4be', 0.06, b.rnd)
        b.cyl((sx_s, sy_s, zb), sr, rh_s + 0.01, col, seg=18, smooth=True, cap=(i == n_rings - 1))
        # 深色紧固钢箍
        b.cyl((sx_s, sy_s, zb + 0.06), sr + 0.045, 0.065, '#4c5258', seg=18)
    # 筒仓与谷仓之间的衔接通道小屋
    b.box((bx + W * 0.5 + 0.55, sy_s, z_base + 1.85), (1.35, 2.15, 3.70), barn_red_d)
    # 筒仓外侧竖向铁爬梯与安全护笼
    lx = sx_s + sr + 0.16
    for dy in (-0.22, 0.22):
        b.seg((lx, sy_s + dy, 0.6), (lx, sy_s + dy, sh - 0.3), 0.04, 0.04, IRON_D)
    for k in range(22):
        zz = 0.9 + k * 0.48
        b.seg((lx, sy_s - 0.22, zz), (lx, sy_s + 0.22, zz), 0.025, 0.025, IRON)
    # 筒仓顶部金属圆穹顶（分瓣浅灰金属）+ 顶部厚圆润白雪盖！
    dome_prof = []
    dome_cols = []
    for k in range(9):
        ang = k / 8.0 * (math.pi * 0.5)
        rr = (sr + 0.06) * math.cos(ang)
        zz = math.sin(ang) * 2.15
        dome_prof.append((max(0.02, rr), zz))
        dome_cols.append(lerp_col('#78808a', '#b6bec6', k / 8.0))
    b.lathe((sx_s, sy_s, sh - 0.05), dome_prof, None, seg=18, smooth=True, cap_top=True, colors=dome_cols)
    # 筒仓顶圆润白雪帽
    snow_prof = [
        (sr * 0.90, 0.85),
        (sr * 0.94, 1.05),
        (sr * 0.82, 1.55),
        (sr * 0.56, 2.05),
        (sr * 0.22, 2.38),
        (0.02, 2.48),
    ]
    snow_cols = [snow_col(0.45), snow_col(0.68), snow_col(0.84), snow_col(0.95), snow_col(1.0), snow_col(1.0)]
    b.lathe((sx_s, sy_s, sh - 0.02), snow_prof, None, seg=16, smooth=True, colors=snow_cols)

    return b.finish(name, glow_color='#ffe2aa')


# ---------------- 6. 无人小车站 station（对照 station.png） ----------------

def build_station(name='station', seed=106):
    b = B(seed)
    # 1) 抬升的短站台（10.4m 宽 × 4.8m 深 × 0.85m 高，混凝土板+木枕护壁+黄色盲道安全线+厚积雪）
    PW, PD, PH = 10.4, 4.8, 0.84
    b.box((0, 0, PH * 0.5), (PW, PD, PH), '#90887e', grad=(0.82, 1.02))
    # 站台前端竖向枕木护板与混凝土挑边
    for i in range(18):
        px = -PW * 0.5 + 0.30 + (PW - 0.60) * i / 17.0
        b.box((px, -PD * 0.5 - 0.03, PH * 0.45), (0.14, 0.08, PH * 0.90), '#6a5c4c')
    b.box((0, -PD * 0.5 + 0.20, PH + 0.04), (PW + 0.14, 0.55, 0.09), '#c8ccd0')
    # 站台顶面混凝土铺装 + 醒目黄色安全警示条
    b.box((0, 0.15, PH + 0.03), (PW + 0.06, PD - 0.20, 0.07), '#aeb2b6')
    b.box((0, -PD * 0.5 + 0.62, PH + 0.075), (PW - 0.30, 0.24, 0.018), '#e6c634')
    # 右侧下站台两级混凝土小台阶
    b.box((PW * 0.5 + 0.38, -0.8, 0.24), (0.75, 1.50, 0.48), CONCRETE_D)
    b.box((PW * 0.5 + 0.88, -0.8, 0.12), (0.55, 1.50, 0.24), CONCRETE)
    # 站台边缘积雪（后沿与左前端自然堆雪，留出中间清扫过的通道）
    add_snow_pillow(b, (-3.95, -0.85, PH + 0.05), (2.25, 2.20), height=0.20, nx=6, ny=5, drip=0.05, seed=seed + 1)
    add_snow_pillow(b, (3.45, 1.45, PH + 0.05), (3.10, 1.65), height=0.22, nx=6, ny=4, drip=0.05, seed=seed + 2)
    add_snow_pillow(b, (0.0, 2.05, PH + 0.05), (5.20, 0.65), height=0.18, nx=7, ny=3, drip=0.04, seed=seed + 3)

    # 2) 小木站房（位于站台左中后部，宽 5.2m × 深 3.1m）
    hx, hy = -1.25, 0.55
    HW, HD, HH = 5.2, 3.05, 2.75
    z0 = PH + 0.06
    wall_c = '#d8cfb8'
    trim_c = '#5c4e3e'
    roof_c = '#36585e'

    b.box((hx, hy, z0 + HH * 0.5), (HW - 0.04, HD - 0.04, HH), wall_c)
    add_clapboard_wall(b, hx - HW * 0.5, hx + HW * 0.5, hy - HD * 0.5, z0, z0 + HH, -1, wall_c, plank_h=0.20, along='X')
    add_clapboard_wall(b, hx - HW * 0.5, hx + HW * 0.5, hy + HD * 0.5, z0, z0 + HH, 1, wall_c, plank_h=0.20, along='X')
    add_clapboard_wall(b, hy - HD * 0.5, hy + HD * 0.5, hx + HW * 0.5, z0, z0 + HH, 1, wall_c, plank_h=0.20, along='Y')
    add_clapboard_wall(b, hy - HD * 0.5, hy + HD * 0.5, hx - HW * 0.5, z0, z0 + HH, -1, wall_c, plank_h=0.20, along='Y')
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((hx + sx * HW * 0.5, hy + sy * HD * 0.5, z0 + HH * 0.5), (0.14, 0.14, HH + 0.04), trim_c)

    # 站房山墙三角板与人字蓝绿铁皮顶 + 厚实白雪被
    rh = 1.45
    z_eave = z0 + HH
    # 左右三角形山墙
    for sx in (-1, 1):
        xw = hx + sx * (HW * 0.5)
        pts = [(xw, hy - HD * 0.5, z_eave - 0.04), (xw, hy + HD * 0.5, z_eave - 0.04), (xw, hy, z_eave + rh)]
        b.poly(pts, [(0, 1, 2) if sx > 0 else (2, 1, 0)], '#c8bfa8')
    # 两坡金属屋顶 + 厚雪
    ovx, ovy = 0.52, 0.56
    for sy in (-1, 1):
        p0 = Vector((hx - HW * 0.5 - ovx, hy + sy * (HD * 0.5 + ovy), z_eave - 0.16))
        p1 = Vector((hx + HW * 0.5 + ovx, hy + sy * (HD * 0.5 + ovy), z_eave - 0.16))
        q0 = Vector((hx - HW * 0.5 - ovx, hy, z_eave + rh))
        q1 = Vector((hx + HW * 0.5 + ovx, hy, z_eave + rh))
        if sy > 0:
            p0, p1 = p1, p0
            q0, q1 = q1, q0
        nrm = (p1 - p0).cross(q0 - p0).normalized()
        if nrm.z < 0:
            nrm = -nrm
        verts = [p0, p1, q1, q0]
        vb = [v - nrm * 0.09 for v in verts]
        b.poly(verts, [(0, 1, 2, 3)], roof_c)
        b.poly(vb, [(0, 3, 2, 1)], mul_col(roof_c, 0.7))
        for i in range(4):
            ni = (i + 1) % 4
            b.poly([verts[i], verts[ni], vb[ni], vb[i]], [(0, 3, 2, 1)], mul_col(roof_c, 0.8))
    add_roof_snow_shell(
        b,
        [(hy - (HD * 0.5 + ovy), z_eave - 0.16), (hy, z_eave + rh), (hy + (HD * 0.5 + ovy), z_eave - 0.16)],
        hx - HW * 0.5 - ovx + 0.06, hx + HW * 0.5 + ovx - 0.06, thick=0.35, eave_drip=0.18, ny=12, axis='X', seed=seed + 15,
    )

    # 候车室正面木格推拉门（半玻璃 glow）+ 门上小雪雨庇 + 左右两扇候车室多格木窗（glow）
    yf = hy - HD * 0.5
    # 推拉双开门
    b.box((hx, yf - 0.02, z0 + 1.05), (1.72, 0.08, 2.10), '#7a5c40')
    b.box((hx, yf - 0.05, z0 + 1.38), (1.50, 0.04, 1.15), '#ffdfa2', glow=True)
    for mx in (-0.38, 0.0, 0.38):
        b.box((hx + mx, yf - 0.065, z0 + 1.38), (0.045, 0.04, 1.18), '#684c34')
    b.box((hx, yf - 0.065, z0 + 1.38), (1.56, 0.04, 0.045), '#684c34')
    # 门上方小雨庇 + 积雪枕
    b.box((hx, yf - 0.34, z0 + 2.26), (2.15, 0.72, 0.08), roof_c)
    add_snow_pillow(b, (hx, yf - 0.34, z0 + 2.30), (2.10, 0.68), height=0.16, nx=6, ny=3, drip=0.06, seed=seed + 30)
    # 正面两侧窗 & 左右侧墙窗（glow）
    _window(b, hx - 1.65, yf, z0 + 1.48, 1.18, 1.12, '-Y', frame_col='#684e38', panes_x=3, panes_z=2)
    _window(b, hx + 1.65, yf, z0 + 1.48, 1.18, 1.12, '-Y', frame_col='#684e38', panes_x=3, panes_z=2)
    _window(b, hx - HW * 0.5, hy, z0 + 1.48, 1.38, 1.12, '-X', frame_col='#684e38', panes_x=3, panes_z=2)
    _window(b, hx + HW * 0.5, hy, z0 + 1.48, 1.38, 1.12, '+X', frame_col='#684e38', panes_x=3, panes_z=2)

    # 3) 无人站站名牌（空白无真实站名，仅干净蓝白装饰横条 + 顶雪）
    sx_p, sy_p = 2.65, -0.15
    for dx in (-0.62, 0.62):
        b.cyl((sx_p + dx, sy_p, z0), 0.036, 2.32, '#c8ced4', seg=8)
    b.box((sx_p, sy_p, z0 + 1.72), (1.46, 0.08, 0.88), '#e6eaee')  # 铁皮边框
    b.box((sx_p, sy_p, z0 + 1.72), (1.36, 0.095, 0.78), '#f6f8fa')  # 空白牌面
    b.box((sx_p, sy_p, z0 + 1.98), (1.36, 0.102, 0.12), '#2e68a6')  # 抽象蓝带（无文字）
    b.box((sx_p, sy_p, z0 + 1.44), (1.36, 0.102, 0.06), '#3a8652')  # 细绿下饰带
    add_snow_pillow(b, (sx_p, sy_p, z0 + 2.16), (1.44, 0.14), height=0.075, nx=5, ny=2, seed=seed + 40)

    # 4) 站台细金属路灯（顶雪 + 暖光发光灯罩 glow）
    lx, ly = 4.25, 0.45
    b.cyl((lx, ly, z0), 0.062, 0.35, '#525860', seg=8)
    b.cyl((lx, ly, z0 + 0.35), 0.044, 3.65, '#6a727a', seg=8, r2=0.032)
    arm_pts = [
        Vector((lx, ly, z0 + 3.92)),
        Vector((lx, ly - 0.16, z0 + 4.18)),
        Vector((lx, ly - 0.56, z0 + 4.24)),
        Vector((lx, ly - 0.76, z0 + 4.10)),
    ]
    b.tube(arm_pts, 0.024, '#6a727a', seg=7, smooth=True)
    b.lathe((lx, ly - 0.76, z0 + 3.98), [(0.24, 0.0), (0.14, 0.09), (0.05, 0.14)], '#545c66', seg=12)
    b.sphere((lx, ly - 0.76, z0 + 3.96), 0.12, '#fff0c8', sub=2, scale=(1.0, 1.0, 0.72), smooth=True, glow=True)
    add_snow_pillow(b, (lx, ly - 0.76, z0 + 4.07), (0.34, 0.34), height=0.08, nx=4, ny=4, seed=seed + 50)

    return b.finish(name, glow_color='#ffe2a8')
