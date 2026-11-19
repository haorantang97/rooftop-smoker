# 第二批三套风景（北海道 / 旷野 / 纽约）共享建模与导出工具
# 基于 scripts/blender/inaka_core.py 扩展：支持多子物体层级导出（如 windmill/wheel、crossing/arm）、
# 动态预览相机裁切距离（支持 540m 纽约摩天楼）、可调棚拍背景色、以及雪檐/雪顶/岩层/窗格辅助原语。
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix, Euler
from inaka_core import (
    B, srgb, lerp_col, mul_col, vary, ensure_leaf_green, ensure_non_leaf,
    mesh_stats, ground_to_zero,
)

# 常用雪色（线性 RGB 均满足非绿叶条件 g <= 1.06*r 且 b >= g，不会误触发 softFoliage）
SNOW_W = '#ffffff'
SNOW_M = '#f0f5fc'
SNOW_S = '#dbe6f5'
SNOW_D = '#c2d2e8'


def snow_col(shade=1.0):
    """返回接近纯白的雪色（顶面明亮纯白、阴影面柔和冷蓝白，保证不触发绿叶判定）"""
    if shade >= 0.55:
        t = min(1.0, (shade - 0.55) / 0.45)
        return lerp_col(SNOW_M, SNOW_W, t)
    t = max(0.0, shade / 0.55)
    return lerp_col(SNOW_S, SNOW_M, t)


def add_roof_snow_shell(b, profile_xz, y0, y1, thick=0.34, eave_drip=0.22, ny=14, axis='Y', seed=0):
    """
    沿整条屋顶断面（从左檐口经折脊/正脊到右檐口）一次成型生成连续圆润的厚积雪壳！
    彻底消除两坡拼缝和正脊圆柱管子感！
    profile_xz: [(u_coord, z_coord), ...] 从一侧檐口到另一侧檐口（若 axis='Y' 则 u=x 沿 Y 挤出；若 axis='X' 则 u=y 沿 X 挤出）
    """
    pts_2d = [(float(u), float(z)) for u, z in profile_xz]
    # 在断面中细密插值并在折角处做二次贝塞尔圆角柔化，让雪顶呈现蓬松厚雪的自然圆弧！
    dense = []
    m = len(pts_2d)
    for i in range(m - 1):
        u0, z0 = pts_2d[i]
        u1, z1 = pts_2d[i + 1]
        sub = 4
        for s in range(sub if i < m - 2 else sub + 1):
            t = s / sub
            dense.append((u0 + (u1 - u0) * t, z0 + (z1 - z0) * t))
    # 2 次拉普拉斯平滑内部折角（保留首尾檐口位置），同时确保平滑后绝不下陷低于原屋脊/折脊包络线！
    orig_z = [z for _, z in dense]
    for _ in range(2):
        sm = [dense[0]]
        for i in range(1, len(dense) - 1):
            nu_c = dense[i - 1][0] * 0.25 + dense[i][0] * 0.50 + dense[i + 1][0] * 0.25
            nz_c = dense[i - 1][1] * 0.25 + dense[i][1] * 0.50 + dense[i + 1][1] * 0.25
            # 防止屋脊尖角被平滑压低导致下方金属屋脊穿模
            nz_c = max(nz_c, orig_z[i] + 0.03)
            sm.append((nu_c, nz_c))
        sm.append(dense[-1])
        dense = sm

    nu = len(dense)
    # 计算每个断面点的外法向 (nu_x, nu_z)
    nrms = []
    for i in range(nu):
        i0 = max(0, i - 1)
        i1 = min(nu - 1, i + 1)
        du = dense[i1][0] - dense[i0][0]
        dz = dense[i1][1] - dense[i0][1]
        L = max(1e-5, math.hypot(du, dz))
        nx_v, nz_v = -dz / L, du / L
        if nz_v < 0:
            nx_v, nz_v = -nx_v, -nz_v
        nrms.append((nx_v, nz_v))

    def to_vec(u_c, l_c, z_c):
        return Vector((u_c, l_c, z_c)) if axis == 'Y' else Vector((l_c, u_c, z_c))

    top_pts, bot_pts = [], []
    top_cols, bot_cols = [], []
    for iy in range(ny + 1):
        vy = iy / ny  # 0..1 along extrusion axis
        l_c = y0 + (y1 - y0) * vy
        y_edge = abs(2.0 * vy - 1.0)
        y_fade = 1.0 - (y_edge ** 5.0) * 0.52  # 两端山墙缘柔和圆收
        for iu in range(nu):
            ku = iu / (nu - 1)  # 0=左檐, 0.5=脊, 1=右檐
            u_c, z_c = dense[iu]
            nx_v, nz_v = nrms[iu]
            # 檐口端点处加厚垂雪唇
            eave_k = max(0.0, 1.0 - min(ku, 1.0 - ku) / 0.14)
            wob = 1.0 + 0.14 * math.sin(vy * 13.7 + seed * 1.9 + ku * 5.3) * math.cos(ku * 9.1 + seed)
            h_here = thick * y_fade * wob * (0.92 + 0.28 * eave_k)
            # 檐口边缘柔垂
            drip_z = -eave_drip * (eave_k ** 2.2) * (0.72 + 0.28 * math.sin(vy * 19.0 + seed * 2.7)) * y_fade
            eave_out = (0.14 if ku < 0.5 else -0.14) * (-1.0) * (eave_k ** 1.5) * y_fade
            # 外推方向：左檐 ku=0 向 -u 外伸，右檐 ku=1 向 +u 外伸
            out_s = (-1.0 if ku < 0.5 else 1.0) * 0.13 * (eave_k ** 1.6) * y_fade
            p_top = to_vec(u_c + nx_v * h_here + out_s, l_c, z_c + nz_v * h_here + drip_z * 0.45)
            p_bot = to_vec(u_c + out_s * 0.65, l_c, z_c - 0.02 + drip_z)
            top_pts.append(p_top)
            bot_pts.append(p_bot)
            sh = 0.68 + 0.32 * nz_v - 0.12 * (eave_k ** 2)
            top_cols.append(snow_col(sh))
            bot_cols.append(snow_col(0.32))

    # 顶面与底面（确保法向朝外/朝上）
    tfaces, bfaces = [], []
    flip_winding = (axis == 'Y')
    for iy in range(ny):
        for iu in range(nu - 1):
            i0 = iy * nu + iu
            i1 = i0 + 1
            i2 = i0 + nu + 1
            i3 = i0 + nu
            if flip_winding:
                tfaces.append((i0, i1, i2, i3))
                bfaces.append((i0, i3, i2, i1))
            else:
                tfaces.append((i0, i3, i2, i1))
                bfaces.append((i0, i1, i2, i3))
    b.poly(top_pts, tfaces, None, smooth=True, vert_colors=top_cols)
    b.poly(bot_pts, bfaces, None, smooth=True, vert_colors=bot_cols)

    # 四周封闭厚雪边（左檐、前端、右檐、后端）
    ring = []
    for iu in range(nu - 1):
        ring.append(iu)
    for iy in range(ny):
        ring.append(iy * nu + (nu - 1))
    for iu in range(nu - 1, 0, -1):
        ring.append(ny * nu + iu)
    for iy in range(ny, 0, -1):
        ring.append(iy * nu)
    nr = len(ring)
    sverts = [top_pts[i] for i in ring] + [bot_pts[i] for i in ring]
    scols = [snow_col(0.75) for _ in range(nr)] + [snow_col(0.35) for _ in range(nr)]
    sfaces = []
    for k in range(nr):
        nk = (k + 1) % nr
        if flip_winding:
            sfaces.append((k, nr + k, nr + nk, nk))
        else:
            sfaces.append((k, nk, nr + nk, nr + k))
    b.poly(sverts, sfaces, None, smooth=True, vert_colors=scols)


def add_snow_pillow(b, center, size, height=0.25, nx=8, ny=6, drip=0.0, seed=0, rot_z=0.0, overhang=0.0):
    """
    圆润蓬松的立体积雪垫（带底部包裹、柔和起伏与可选边缘下垂雪檐）：
    适合平顶、檐口、贩卖机顶、站牌顶、船舱顶、灯箱顶等。
    center = 底面中心 (cx, cy, z_base)，size = (sx, sy)
    """
    rnd = random.Random(seed)
    cx, cy, zb = center
    sx, sy = size
    hx, hy = sx * 0.5 + overhang, sy * 0.5 + overhang
    R = Matrix.Rotation(rot_z, 3, 'Z')
    base = Vector((cx, cy, zb))

    def pt_world(lx, ly, lz):
        return base + R @ Vector((lx, ly, lz))

    top_verts = []
    top_cols = []
    bot_verts = []
    bot_cols = []

    for iy in range(ny + 1):
        vy = iy / ny * 2.0 - 1.0  # -1..1
        for ix in range(nx + 1):
            vx = ix / nx * 2.0 - 1.0  # -1..1
            # 边缘圆润度（superellipse 软化）
            r_edge = max(abs(vx), abs(vy))
            r_rad = min(1.0, math.hypot(vx, vy) * 0.85 + r_edge * 0.15)
            dome = max(0.0, 1.0 - (r_edge ** 2.6)) ** 0.58
            # 微小自然雪丘起伏
            wob = 1.0 + 0.14 * math.sin(vx * 3.7 + seed * 1.3) * math.cos(vy * 3.1 - seed * 0.7) + (rnd.random() - 0.5) * 0.06
            # 边缘向下垂一点形成软雪檐
            edge_drop = -drip * (r_edge ** 3.2) * (0.75 + 0.35 * math.sin(vx * 7.3 + vy * 5.9 + seed))
            # 边缘内收圆角
            round_k = 1.0 - 0.08 * (vx * vx * vy * vy)
            lx = vx * hx * round_k
            ly = vy * hy * round_k
            lz_top = max(0.015, height * dome * wob) + edge_drop
            lz_bot = edge_drop - 0.015 * (1.0 - r_edge)

            top_verts.append(pt_world(lx, ly, lz_top))
            bot_verts.append(pt_world(lx, ly, lz_bot))

            # 顶部明亮雪白，边缘和底面偏冷蓝白阴影
            sh_top = 0.72 + 0.28 * dome - 0.12 * r_rad
            top_cols.append(snow_col(sh_top))
            bot_cols.append(snow_col(0.35))

    gw = nx + 1
    # 顶面
    tfaces = []
    for iy in range(ny):
        for ix in range(nx):
            i0 = iy * gw + ix
            tfaces.append((i0, i0 + 1, i0 + gw + 1, i0 + gw))
    b.poly(top_verts, tfaces, None, smooth=True, vert_colors=top_cols)

    # 底面（朝下）
    bfaces = [(i0, i0 + gw, i0 + gw + 1, i0 + 1) for iy in range(ny) for ix in range(nx) for i0 in (iy * gw + ix,)]
    b.poly(bot_verts, bfaces, None, smooth=True, vert_colors=bot_cols)

    # 四周封边（圆润厚雪唇边）
    ring_idx = []
    for ix in range(nx):
        ring_idx.append(ix)
    for iy in range(ny):
        ring_idx.append(iy * gw + nx)
    for ix in range(nx, 0, -1):
        ring_idx.append(ny * gw + ix)
    for iy in range(ny, 0, -1):
        ring_idx.append(iy * gw)
    n_r = len(ring_idx)
    sverts = [top_verts[i] for i in ring_idx] + [bot_verts[i] for i in ring_idx]
    scols = [snow_col(0.68) for _ in range(n_r)] + [snow_col(0.32) for _ in range(n_r)]
    sfaces = []
    for k in range(n_r):
        nk = (k + 1) % n_r
        sfaces.append((k, n_r + k, n_r + nk, nk))
    b.poly(sverts, sfaces, None, smooth=True, vert_colors=scols)


def add_snow_slope(b, p0, p1, q0, q1, thick=0.28, eave_overhang=0.14, eave_drip=0.18, nx=10, ny=6, seed=0):
    """
    斜坡屋顶上的厚圆润雪被（带檐口垂挂雪檐与柔和波浪厚度）：
    p0->p1 为檐口线（左->右），q0->q1 为屋脊线（左->右），正面朝上/外。
    """
    p0, p1, q0, q1 = map(Vector, (p0, p1, q0, q1))
    nrm = (p1 - p0).cross(q0 - p0)
    if nrm.length < 1e-6:
        return
    nrm.normalize()
    if nrm.z < 0:
        nrm = -nrm
        p0, p1 = p1, p0
        q0, q1 = q1, q0

    # 檐口向外微伸出
    slope_down = ((p0 + p1) * 0.5 - (q0 + q1) * 0.5).normalized()
    p0e = p0 + slope_down * eave_overhang
    p1e = p1 + slope_down * eave_overhang

    top_pts, bot_pts = [], []
    top_cols, bot_cols = [], []
    for iv in range(ny + 1):
        v = iv / ny  # 0=檐口, 1=屋脊
        for iu in range(nx + 1):
            u = iu / nx
            base = p0e.lerp(p1e, u).lerp(q0.lerp(q1, u), v)
            # 沿坡面与山墙边缘圆润收薄，但檐口厚实且带雪檐垂挂
            u_edge = abs(2.0 * u - 1.0)
            side_fade = (1.0 - (u_edge ** 4.0) * 0.65)
            ridge_round = (1.0 - max(0.0, (v - 0.82) / 0.18) ** 2 * 0.35)
            eave_plump = 1.0 + 0.25 * ((1.0 - v) ** 1.8)
            wob = 1.0 + 0.14 * math.sin(u * 11.3 + seed * 1.7) * math.cos(v * 5.7 + seed)
            h_here = thick * side_fade * ridge_round * eave_plump * wob
            # 檐口波浪垂挂雪唇
            drip_z = -eave_drip * ((1.0 - v) ** 3.2) * (0.72 + 0.28 * math.sin(u * 17.0 + seed * 2.3)) * side_fade
            top_pts.append(base + nrm * h_here + Vector((0, 0, drip_z * 0.45)))
            bot_pts.append(base - nrm * 0.02 + Vector((0, 0, drip_z)))
            sh = 0.72 + 0.28 * v - 0.14 * (u_edge ** 2)
            top_cols.append(snow_col(sh))
            bot_cols.append(snow_col(0.36))

    gw = nx + 1
    tfaces = [(iv * gw + iu, iv * gw + iu + 1, (iv + 1) * gw + iu + 1, (iv + 1) * gw + iu) for iv in range(ny) for iu in range(nx)]
    bfaces = [(iv * gw + iu, (iv + 1) * gw + iu, (iv + 1) * gw + iu + 1, iv * gw + iu + 1) for iv in range(ny) for iu in range(nx)]
    b.poly(top_pts, tfaces, None, smooth=True, vert_colors=top_cols)
    b.poly(bot_pts, bfaces, None, smooth=True, vert_colors=bot_cols)

    # 檐口厚雪唇边 (v=0) + 左右山墙封边 + 屋脊封边
    ring = []
    for iu in range(nx):
        ring.append(iu)
    for iv in range(ny):
        ring.append(iv * gw + nx)
    for iu in range(nx, 0, -1):
        ring.append(ny * gw + iu)
    for iv in range(ny, 0, -1):
        ring.append(iv * gw)
    n_r = len(ring)
    sverts = [top_pts[i] for i in ring] + [bot_pts[i] for i in ring]
    scols = [snow_col(0.65) for _ in range(n_r)] + [snow_col(0.32) for _ in range(n_r)]
    sfaces = [(k, n_r + k, n_r + (k + 1) % n_r, (k + 1) % n_r) for k in range(n_r)]
    b.poly(sverts, sfaces, None, smooth=True, vert_colors=scols)


def add_clapboard_wall(b, x0, x1, y, z0, z1, face_sign, color, plank_h=0.22, depth=0.018, jitter=0.04, along='X'):
    """
    水平雨淋板（木板外墙）：一排排略微斜叠的横板，极富光影层次！
    along='X': 墙沿 X 从 x0..x1，位于 y，法向朝 (0, face_sign, 0)
    along='Y': 墙沿 Y 从 x0..x1，位于 x=y，法向朝 (face_sign, 0, 0)
    """
    h_tot = z1 - z0
    if h_tot < 0.05 or abs(x1 - x0) < 0.05:
        return
    n_planks = max(2, int(round(h_tot / plank_h)))
    ph = h_tot / n_planks
    c0 = srgb(color)
    for i in range(n_planks):
        za = z0 + i * ph
        zb = za + ph
        # 下沿外凸 depth，上沿贴墙 0，形成经典水平叠板阴影线！
        c_top = mul_col(vary(c0, jitter, b.rnd), 0.90 + 0.12 * (i / n_planks))
        c_bot = mul_col(c_top, 1.08)
        c_lip = mul_col(c_top, 0.72)
        if along == 'X':
            ya = y + face_sign * depth
            yb = y
            if face_sign < 0:
                verts = [
                    (x0, ya, za), (x1, ya, za), (x1, yb, zb), (x0, yb, zb),
                    (x0, yb, za), (x1, yb, za),
                ]
            else:
                verts = [
                    (x1, ya, za), (x0, ya, za), (x0, yb, zb), (x1, yb, zb),
                    (x1, yb, za), (x0, yb, za),
                ]
        else:
            xa = y + face_sign * depth
            xb = y
            if face_sign > 0:
                verts = [
                    (xa, x0, za), (xa, x1, za), (xb, x1, zb), (xb, x0, zb),
                    (xb, x0, za), (xb, x1, za),
                ]
            else:
                verts = [
                    (xa, x1, za), (xa, x0, za), (xb, x0, zb), (xb, x1, zb),
                    (xb, x1, za), (xb, x0, za),
                ]
        # 正面斜板 + 底沿窄阴暗折边
        b.poly(verts, [(0, 1, 2, 3), (4, 5, 1, 0)], None, vert_colors=[c_bot, c_bot, c_top, c_top, c_lip, c_lip])


# ---------------- 多物体/通用导出与高质量预览 ----------------

def _world_bbox(objs):
    pts = []
    bpy.context.view_layer.update()
    for ob in objs:
        if ob.type != 'MESH':
            continue
        mw = ob.matrix_world
        for c in ob.bound_box:
            pts.append(mw @ Vector(c))
    if not pts:
        return Vector((0, 0, 0)), Vector((0, 0, 0)), []
    mn = Vector((min(v.x for v in pts), min(v.y for v in pts), min(v.z for v in pts)))
    mx = Vector((max(v.x for v in pts), max(v.y for v in pts), max(v.z for v in pts)))
    return mn, mx, pts


def _ground_objects(objs, eps=0.0):
    bpy.context.view_layer.update()
    min_z = None
    for ob in objs:
        if ob.type != 'MESH' or not ob.data.vertices:
            continue
        mw = ob.matrix_world
        oz = min((mw @ v.co).z for v in ob.data.vertices)
        min_z = oz if min_z is None else min(min_z, oz)
    if min_z is None or abs(min_z - eps) <= 1e-4:
        return
    dz = eps - min_z
    # 仅平移顶层物体（无 parent 或 parent 不在 objs 内）
    obj_set = set(objs)
    roots = [o for o in objs if o.parent is None or o.parent not in obj_set]
    for r in roots:
        if len(objs) == 1 and r.type == 'MESH' and r.matrix_world == Matrix.Identity(4):
            for v in r.data.vertices:
                v.co.z += dz
            r.data.update()
        else:
            r.location.z += dz
    bpy.context.view_layer.update()


def preview_multi(objs, name, prev_dir, cam_dir=None, bg_color='#d8d2c6'):
    """支持单物体或多物体层级、以及 540m 超高楼动态远裁剪面的高质量 3/4 预览渲染"""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.studio_light = 'Default'
    sc.display.shading.color_type = 'VERTEX'
    sc.display.shading.show_shadows = True
    sc.display.shading.shadow_intensity = 0.42
    sc.display.shading.show_cavity = True
    sc.display.shading.cavity_type = 'BOTH'
    sc.display.shading.cavity_ridge_factor = 0.55
    sc.display.shading.cavity_valley_factor = 0.75
    sc.display.shading.background_type = 'WORLD'
    if not sc.world:
        sc.world = bpy.data.worlds.new('World')
    sc.world.color = srgb(bg_color)
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'

    mn, mx, bb = _world_bbox(objs)
    dims = mx - mn
    ctr = (mn + mx) * 0.5

    tall = dims.z > max(dims.x, dims.y) * 1.15
    wide = max(dims.x, dims.y) > dims.z * 2.6
    if tall:
        sc.render.resolution_x, sc.render.resolution_y = (720, 960)
    elif wide:
        sc.render.resolution_x, sc.render.resolution_y = (1120, 640)
    else:
        sc.render.resolution_x, sc.render.resolution_y = (960, 720)
    aspect = sc.render.resolution_x / sc.render.resolution_y

    camd = bpy.data.cameras.new('prev_cam')
    camd.lens = 50.0
    camd.sensor_fit = 'HORIZONTAL'
    camd.sensor_width = 36.0

    d = Vector(cam_dir or ((-0.75, -1.55, 0.32) if tall else (-1.12, -1.52, 0.72))).normalized()
    z_axis = d
    x_axis = Vector((0, 0, 1)).cross(z_axis)
    if x_axis.length < 1e-4:
        x_axis = Vector((1, 0, 0))
    x_axis.normalize()
    y_axis = z_axis.cross(x_axis).normalized()
    fov_x = 2.0 * math.atan((camd.sensor_width * 0.5) / camd.lens)
    fov_y = 2.0 * math.atan((camd.sensor_width * 0.5 / aspect) / camd.lens)
    tan_x = math.tan(fov_x * 0.5)
    tan_y = math.tan(fov_y * 0.5)

    # 用 8 个合并包围盒角点精确推算距离
    corners = [
        Vector((x, y, z))
        for x in (mn.x, mx.x) for y in (mn.y, mx.y) for z in (mn.z, mx.z)
    ]
    dist = 1.0
    for v in corners:
        rel = v - ctr
        px = abs(rel.dot(x_axis))
        py = abs(rel.dot(y_axis))
        pz = rel.dot(z_axis)
        dist = max(dist, pz + px / (tan_x * 0.84), pz + py / (tan_y * 0.84))

    camd.clip_start = max(0.05, dist * 0.002)
    camd.clip_end = max(500.0, dist * 4.0 + dims.length * 2.0)

    co = bpy.data.objects.new('prev_cam', camd)
    sc.collection.objects.link(co)
    sc.camera = co
    co.location = ctr + d * dist
    co.rotation_euler = (ctr - co.location).to_track_quat('-Z', 'Y').to_euler()

    sc.render.filepath = os.path.join(prev_dir, name + '.png')
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(co, do_unlink=True)
    bpy.data.cameras.remove(camd, do_unlink=True)


def finish_export_multi(objs, name, out_dir, prev_dir=None, cam_dir=None, snap_ground=True, bg_color='#d8d2c6'):
    """
    导出单个或多个物体（支持父子层级，如 windmill + 子物体 wheel）到 <out_dir>/<name>.glb，
    并渲染预览图到 <prev_dir>/<name>.png，随后清理场景对象与网格。
    """
    if not isinstance(objs, (list, tuple)):
        objs = [objs]
    objs = list(objs)
    if snap_ground:
        _ground_objects(objs, 0.0)
    bpy.context.view_layer.update()

    total_tris = 0
    for ob in objs:
        if ob.type == 'MESH':
            t, _, _ = mesh_stats(ob)
            total_tris += t
    mn, mx, _ = _world_bbox(objs)

    path = os.path.join(out_dir, name + '.glb')
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_vertex_color='ACTIVE',
        export_all_vertex_colors=False,
        export_yup=True,
        export_apply=True,
        export_normals=True,
        export_materials='EXPORT',
        export_texcoords=False,
    )
    if prev_dir:
        preview_multi(objs, name, prev_dir, cam_dir=cam_dir, bg_color=bg_color)

    meshes = [o.data for o in objs if o.type == 'MESH' and o.data is not None]
    for ob in objs:
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in meshes:
        if me.users == 0:
            bpy.data.meshes.remove(me, do_unlink=True)

    sz = tuple(round(mx[i] - mn[i], 2) for i in range(3))
    print(f'exported {name:20s} | tris={total_tris:6d} | size={sz} | minZ={mn.z:.3f}')
    return {'name': name, 'tris': total_tris, 'size': sz, 'min_z': round(mn.z, 3)}
