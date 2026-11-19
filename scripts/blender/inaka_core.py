# 共享几何构建器、配色工具、屋面/瓦片/石作/树叶原语、导出与预览渲染器
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix, Euler

# ---------------- 色彩与材质辅助 ----------------

def srgb(h):
    if not isinstance(h, str):
        return tuple(h[:3])
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def lerp_col(a, b, t):
    ca = srgb(a)
    cb = srgb(b)
    t = max(0.0, min(1.0, t))
    return tuple(ca[i] + (cb[i] - ca[i]) * t for i in range(3))


def mul_col(c, f):
    cc = srgb(c)
    return tuple(max(0.0, min(1.0, x * f)) for x in cc)


def vary(c, k, rnd):
    cc = srgb(c)
    f = 1.0 + (rnd.random() - 0.5) * 2.0 * k
    return tuple(max(0.0, min(1.0, x * f)) for x in cc)


def ensure_leaf_green(c):
    """确保线性 RGB 满足游戏 softFoliage 的叶子判定条件：g > r * 1.1 且 g > b"""
    r, g, b = srgb(c)
    g = max(g, 0.015)
    if r > g / 1.18:
        r = g / 1.18
    if b > g * 0.85:
        b = g * 0.85
    return (max(0.0, min(1.0, r)), max(0.0, min(1.0, g)), max(0.0, min(1.0, b)))


def ensure_non_leaf(c):
    """确保树干/枝条线性 RGB 不会被 softFoliage 误判为叶子（g <= r * 1.04）"""
    r, g, b = srgb(c)
    if g > r * 1.04:
        g = r * 1.04
    return (max(0.0, min(1.0, r)), max(0.0, min(1.0, g)), max(0.0, min(1.0, b)))


# 统一夏日乡间暖色调色板（对照 docs/inaka-refs/*.png）
WOOD_VD = '#2c2017'
WOOD_D  = '#443122'
WOOD    = '#6a4d35'
WOOD_M  = '#826042'
WOOD_L  = '#a88258'
WOOD_W  = '#b89468'
CEDAR_BARK  = '#7a5238'
KEYAKI_BARK = '#867e72'
OAK_BARK    = '#645b50'
MAPLE_BARK  = '#8c867a'

PLASTER_W = '#f7f4ec'
PLASTER   = '#f2eadc'
PLASTER_S = '#dcd2be'
PLASTER_C = '#efe5ce'

STONE_L   = '#b8b6ae'
STONE     = '#9a988e'
STONE_D   = '#76766e'
STONE_M   = '#869072'  # 带苔石色
CONCRETE  = '#c4c2b8'
CONCRETE_D = '#9c9a90'

IRON_D    = '#363a3e'
IRON      = '#5a6066'
STEEL     = '#9ea4aa'
COPPER_G  = '#68a28c'
COPPER_GL = '#86beaa'
COPPER_GD = '#487464'

TILE_PAL = {
    'gray':    ('#8c929a', '#686e76', '#4c525a', '#a6acb4'),
    'sekishu': ('#bc5632', '#943c20', '#6e2814', '#d46c44'),
    'navy':    ('#345080', '#243a62', '#182848', '#48689c'),
    'black':   ('#3c4048', '#2a2e34', '#1d2026', '#525860'),
}

THATCH_L  = '#d6b670'
THATCH    = '#ba9856'
THATCH_D  = '#826b3e'
THATCH_VD = '#58482a'
MOSS      = '#788e3e'


# ---------------- 几何构建器 ----------------

class B:
    """高细节 bmesh 构建器：所有面带顶点颜色 Color 与材质索引（0=body, 1=glow）"""

    def __init__(self, seed=1):
        self.bm = bmesh.new()
        self.cl = self.bm.loops.layers.float_color.new('Color')
        self.rnd = random.Random(seed)

    def poly(self, verts, faces, color, glow=False, jitter=0.0, smooth=False, vert_colors=None):
        c0 = srgb(color) if color is not None else (1.0, 1.0, 1.0)
        vs = [self.bm.verts.new(Vector(v)) for v in verts]
        vc_lin = [srgb(c) for c in vert_colors] if vert_colors else None
        for f in faces:
            try:
                face = self.bm.faces.new([vs[i] for i in f])
            except ValueError:
                continue
            face.material_index = 1 if glow else 0
            face.smooth = smooth
            if vc_lin:
                for idx, lp in zip(f, face.loops):
                    c = vary(vc_lin[idx], jitter, self.rnd) if jitter else vc_lin[idx]
                    lp[self.cl] = (*c, 1.0)
            else:
                c = vary(c0, jitter, self.rnd) if jitter else c0
                for lp in face.loops:
                    lp[self.cl] = (*c, 1.0)
        return vs

    def double_poly(self, verts, faces, color, glow=False, jitter=0.0, smooth=False, vert_colors=None, back_darken=0.88):
        """薄片双面（游戏体材质是单面渲染，薄叶/花瓣/纸垂必须双面）"""
        self.poly(verts, faces, color, glow=glow, jitter=jitter, smooth=smooth, vert_colors=vert_colors)
        rev = [tuple(reversed(f)) for f in faces]
        if vert_colors:
            bc = [mul_col(c, back_darken) for c in vert_colors]
            self.poly(verts, rev, None, glow=glow, jitter=jitter, smooth=smooth, vert_colors=bc)
        else:
            self.poly(verts, rev, mul_col(color, back_darken), glow=glow, jitter=jitter, smooth=smooth)

    def box(self, c, s, color, rot=0.0, glow=False, jitter=0.0, top=None, grad=None):
        """中心 c，尺寸 s=(sx,sy,sz)，绕 Z 转 rot，top=(kx,ky) 顶面收分，grad=(bot_mul, top_mul) 竖向明暗"""
        hx, hy, hz = s[0] / 2.0, s[1] / 2.0, s[2] / 2.0
        tx, ty = top or (1.0, 1.0)
        pts = [
            (-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
            (-hx * tx, -hy * ty, hz), (hx * tx, -hy * ty, hz),
            (hx * tx, hy * ty, hz), (-hx * tx, hy * ty, hz),
        ]
        R = Matrix.Rotation(rot, 3, 'Z')
        verts = [Vector(c) + R @ Vector(p) for p in pts]
        faces = [
            (0, 3, 2, 1), (4, 5, 6, 7),
            (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
        ]
        if grad:
            c0 = vary(color, jitter, self.rnd) if jitter else srgb(color)
            cb = mul_col(c0, grad[0])
            ct = mul_col(c0, grad[1])
            vcs = [cb, cb, cb, cb, ct, ct, ct, ct]
            return self.poly(verts, faces, None, glow=glow, vert_colors=vcs)
        return self.poly(verts, faces, color, glow=glow, jitter=jitter)

    def box_rot(self, c, s, euler, color, glow=False, jitter=0.0, top=None):
        """支持任意 XYZ 欧拉角旋转的盒子"""
        hx, hy, hz = s[0] / 2.0, s[1] / 2.0, s[2] / 2.0
        tx, ty = top or (1.0, 1.0)
        pts = [
            (-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
            (-hx * tx, -hy * ty, hz), (hx * tx, -hy * ty, hz),
            (hx * tx, hy * ty, hz), (-hx * tx, hy * ty, hz),
        ]
        R = Euler(euler, 'XYZ').to_matrix()
        verts = [Vector(c) + R @ Vector(p) for p in pts]
        faces = [
            (0, 3, 2, 1), (4, 5, 6, 7),
            (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
        ]
        return self.poly(verts, faces, color, glow=glow, jitter=jitter)

    def seg(self, a, b, w, h, color, glow=False, jitter=0.0, cap=True):
        """从 a 到 b 的方料（宽 w，高 h）"""
        a, b = Vector(a), Vector(b)
        d = b - a
        L = d.length
        if L < 1e-6:
            return
        z = d.normalized()
        up = Vector((0, 0, 1)) if abs(z.z) < 0.96 else Vector((1, 0, 0))
        x = z.cross(up).normalized()
        y = x.cross(z).normalized()
        pts = []
        for t in (0.0, 1.0):
            for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                pts.append(a + d * t + x * (sx * w / 2.0) + y * (sy * h / 2.0))
        faces = [(0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
        if cap:
            faces = [(0, 1, 2, 3), (7, 6, 5, 4)] + faces
        return self.poly(pts, faces, color, glow=glow, jitter=jitter)

    def cyl(self, c, r, h, color, seg=10, r2=None, glow=False, jitter=0.0, axis='Z', smooth=False, cap=True, grad=None):
        """圆柱/圆台：axis='Z' 时底部在 c.z，顶在 c.z+h；axis='X'/'Y' 时中心在 c"""
        r2 = r if r2 is None else r2
        verts = []
        for k in range(2):
            rr = r if k == 0 else r2
            for i in range(seg):
                a = 2.0 * math.pi * i / seg
                p = Vector((math.cos(a) * rr, math.sin(a) * rr, h * k))
                if axis == 'X':
                    p = Vector((p.z - h / 2.0, p.x, p.y))
                elif axis == 'Y':
                    p = Vector((p.x, p.z - h / 2.0, p.y))
                verts.append(Vector(c) + p)
        faces = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
        if cap:
            faces.append(tuple(reversed(range(seg))))
            faces.append(tuple(range(seg, 2 * seg)))
        if grad:
            c0 = vary(color, jitter, self.rnd) if jitter else srgb(color)
            cb = mul_col(c0, grad[0])
            ct = mul_col(c0, grad[1])
            vcs = [cb] * seg + [ct] * seg
            return self.poly(verts, faces, None, glow=glow, smooth=smooth, vert_colors=vcs)
        return self.poly(verts, faces, color, glow=glow, jitter=jitter, smooth=smooth)

    def lathe(self, c, profile, color, seg=12, rot_z=0.0, glow=False, jitter=0.0, smooth=False, cap_bot=True, cap_top=True, colors=None):
        """旋转体：profile = [(r, z), ...] 从下到上"""
        c = Vector(c)
        m = len(profile)
        verts = []
        vcs = [] if colors else None
        for idx, (r, z) in enumerate(profile):
            for i in range(seg):
                a = rot_z + 2.0 * math.pi * i / seg
                verts.append(c + Vector((math.cos(a) * r, math.sin(a) * r, z)))
                if colors:
                    vcs.append(colors[idx])
        faces = []
        for j in range(m - 1):
            b0 = j * seg
            b1 = (j + 1) * seg
            for i in range(seg):
                ni = (i + 1) % seg
                faces.append((b0 + i, b0 + ni, b1 + ni, b1 + i))
        if cap_bot and profile[0][0] > 1e-5:
            faces.append(tuple(reversed(range(seg))))
        if cap_top and profile[-1][0] > 1e-5:
            faces.append(tuple(range((m - 1) * seg, m * seg)))
        return self.poly(verts, faces, None if colors else color, glow=glow, jitter=jitter, smooth=smooth, vert_colors=vcs)

    def tube(self, pts, radii, color, seg=7, glow=False, jitter=0.0, smooth=True, cap_start=True, cap_end=True, colors=None):
        """沿折线 pts 放样光滑圆管，支持每节半径 radii 与颜色 colors（稳定平行输运标架）"""
        pts = [Vector(p) for p in pts]
        n = len(pts)
        if n < 2:
            return
        if isinstance(radii, (int, float)):
            radii = [radii] * n
        # 初始切向和法向
        t0 = (pts[1] - pts[0]).normalized()
        ref = Vector((0, 0, 1)) if abs(t0.z) < 0.92 else Vector((1, 0, 0))
        u = t0.cross(ref).normalized()
        v = t0.cross(u).normalized()
        verts = []
        vcs = [] if colors else None
        prev_t = t0
        for idx in range(n):
            if idx == 0:
                t = (pts[1] - pts[0]).normalized()
            elif idx == n - 1:
                t = (pts[-1] - pts[-2]).normalized()
            else:
                t1 = (pts[idx] - pts[idx - 1]).normalized()
                t2 = (pts[idx + 1] - pts[idx]).normalized()
                t = (t1 + t2)
                t = t.normalized() if t.length > 1e-6 else t1
            # 平行输运更新 u, v
            axis = prev_t.cross(t)
            if axis.length > 1e-6:
                ang = math.acos(max(-1.0, min(1.0, prev_t.dot(t))))
                R = Matrix.Rotation(ang, 3, axis.normalized())
                u = (R @ u).normalized()
                v = t.cross(u).normalized()
            prev_t = t
            r = radii[idx]
            for i in range(seg):
                a = 2.0 * math.pi * i / seg
                # 确保侧面外法线朝外：从 pts[0]->pts[1] 方向看逆时针
                p = pts[idx] + (u * math.cos(a) + v * math.sin(a)) * r
                verts.append(p)
                if colors:
                    vcs.append(colors[idx])
        faces = []
        for j in range(n - 1):
            b0 = j * seg
            b1 = (j + 1) * seg
            for i in range(seg):
                ni = (i + 1) % seg
                faces.append((b0 + i, b0 + ni, b1 + ni, b1 + i))
        if cap_start and radii[0] > 1e-5:
            faces.append(tuple(reversed(range(seg))))
        if cap_end and radii[-1] > 1e-5:
            faces.append(tuple(range((n - 1) * seg, n * seg)))
        return self.poly(verts, faces, None if colors else color, glow=glow, jitter=jitter, smooth=smooth, vert_colors=vcs)

    def sphere(self, c, r, color, sub=2, scale=(1, 1, 1), smooth=True, glow=False, jitter=0.0):
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=sub, radius=r)
        verts = [Vector(c) + Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) for v in tmp.verts]
        faces = [[v.index for v in f.verts] for f in tmp.faces]
        tmp.free()
        return self.poly(verts, faces, color, glow=glow, jitter=jitter, smooth=smooth)

    def stone_block(self, c, s, color, rot=0.0, jitter=0.08, bevel=0.03):
        """略带不规则倒角/起伏的石块或基石"""
        hx, hy, hz = s[0] / 2.0, s[1] / 2.0, s[2] / 2.0
        b = min(bevel, hx * 0.35, hy * 0.35, hz * 0.35)
        rnd = self.rnd
        R = Matrix.Rotation(rot, 3, 'Z')
        # 顶面稍收、四边轻微随机抖动
        pts = [
            (-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
            (-(hx - b), -(hy - b), hz), (hx - b, -(hy - b), hz),
            (hx - b, hy - b, hz), (-(hx - b), hy - b, hz),
        ]
        verts = []
        for idx, (x, y, z) in enumerate(pts):
            dx = (rnd.random() - 0.5) * b * 0.7
            dy = (rnd.random() - 0.5) * b * 0.7
            dz = (rnd.random() - 0.5) * b * 0.4 if idx >= 4 else 0.0
            verts.append(Vector(c) + R @ Vector((x + dx, y + dy, z + dz)))
        faces = [
            (0, 3, 2, 1), (4, 5, 6, 7),
            (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
        ]
        return self.poly(verts, faces, color, jitter=jitter)

    def corrugated_wall(self, a, b, z0, z1, normal_dir, color, rust_color=None, pitch=0.14, amp=0.022, thick=0.015, rust_bot=0.25):
        """波纹铁皮墙面（带厚度双面与底部锈蚀顶点渐变）"""
        a, b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
        d = b - a
        L = d.length
        if L < 1e-4:
            return
        t_dir = d.normalized()
        n_dir = Vector((normal_dir[0], normal_dir[1], 0)).normalized()
        # 确保 t_dir x up 与 n_dir 同向，否则交换 a,b 保证正面朝外
        if t_dir.cross(Vector((0, 0, 1))).dot(n_dir) < 0:
            a, b = b, a
            t_dir = -t_dir
        n_waves = max(4, int(L / pitch))
        steps = n_waves * 2  # 每半波一个折点（足够出清晰的波纹光影，面数可控）
        z_rows = 3
        c_base = srgb(color)
        c_rust = srgb(rust_color) if rust_color else mul_col(c_base, 0.72)

        def make_side(offset, flip=False):
            verts = []
            vcs = []
            for iz in range(z_rows + 1):
                kz = iz / z_rows
                z = z0 + (z1 - z0) * kz
                for ix in range(steps + 1):
                    kx = ix / steps
                    w = (1.0 if ix % 2 == 0 else -1.0) * amp
                    p = a + t_dir * (L * kx) + n_dir * (offset + w) + Vector((0, 0, z))
                    verts.append(p)
                    # 底部锈蚀 + 波谷微暗 + 随机斑驳
                    rust_k = max(0.0, 1.0 - kz / max(0.05, rust_bot)) * (0.45 + 0.55 * abs(math.sin(kx * 13.7 + kz * 4.1)))
                    if rust_color:
                        col = lerp_col(c_base, c_rust, rust_k * 0.75)
                    else:
                        col = c_base
                    shade = (0.90 if ix % 2 == 1 else 1.05) * (0.86 + 0.16 * kz)
                    vcs.append(mul_col(col, shade))
            faces = []
            row_w = steps + 1
            for iz in range(z_rows):
                for ix in range(steps):
                    i0 = iz * row_w + ix
                    i1 = i0 + 1
                    i2 = i0 + row_w + 1
                    i3 = i0 + row_w
                    faces.append((i0, i3, i2, i1) if flip else (i0, i1, i2, i3))
            self.poly(verts, faces, None, vert_colors=vcs)

        make_side(thick * 0.5, flip=False)
        make_side(-thick * 0.5, flip=True)

    def tile_slope(self, p0, p1, q0, q1, pal, sag=0.14, corner_lift=0.0, col_spacing=0.28, row_spacing=0.34, wave_amp=0.036, step_h=0.032, thick=0.11, soffit_col=WOOD_D, white_eave=False):
        """
        高细节曲面瓦坡：
        p0->p1 为檐口线（左->右），q0->q1 为上沿线（左->右），正面朝上/外。
        自动生成：带弧度下凹（起翘）的波形瓦垄 + 一排排叠压的阶梯瓦片 + 檐口滴水圆瓦当 + 屋面底板！
        """
        p0, p1, q0, q1 = map(Vector, (p0, p1, q0, q1))
        w_eave = (p1 - p0).length
        w_top = (q1 - q0).length
        w_avg = max(w_eave, w_top)
        slope_len = ((p0 + p1) * 0.5 - (q0 + q1) * 0.5).length
        if w_avg < 0.05 or slope_len < 0.05:
            return

        # 坡面法向（朝上）
        nrm = (p1 - p0).cross(q0 - p0)
        if nrm.length < 1e-6:
            return
        nrm.normalize()
        if nrm.z < 0:
            nrm = -nrm
            p0, p1 = p1, p0
            q0, q1 = q1, q0

        n_cols = max(3, int(round(w_eave / col_spacing)))
        n_rows = max(2, int(round(slope_len / row_spacing)))

        c_main, c_dark, c_vd, c_hi = pal
        c_m = srgb(c_main)
        c_d = srgb(c_dark)
        c_h = srgb(c_hi)

        def surf_pt(u, v):
            """u in [0,1] 沿檐口，v in [0,1] 从檐口到脊"""
            bot = p0.lerp(p1, u)
            top = q0.lerp(q1, u)
            pt = bot.lerp(top, v)
            # 屋面弧度：中间下凹 sag，两端檐角起翘 corner_lift
            curve_z = -sag * 4.0 * v * (1.0 - v)
            edge_k = (2.0 * u - 1.0) ** 2  # 两侧为 1，中间为 0
            lift_z = corner_lift * edge_k * ((1.0 - v) ** 1.6)
            return pt + Vector((0, 0, curve_z + lift_z))

        # 1) 屋面瓦片主体网格（每个横排有叠压台阶，纵向每列是槽-脊-槽的波形）
        # 为了面数高效且每片瓦边界清晰，每列用 2 段（槽、峰），每排用 2 条边（下檐起高、上沿压低）
        u_steps = n_cols * 2
        row_w = u_steps + 1
        for r in range(n_rows):
            v0 = r / n_rows
            v1 = (r + 1) / n_rows
            # 这一排瓦片的上表面（从下沿略抬高到上沿贴坡）与前端小立面（瓦片叠压的厚度感！）
            verts = []
            vcs = []
            # 3 条横向折线：下前底(贴坡)、下前顶(抬高 step_h)、上后顶(贴坡)
            profiles = [
                (v0, 0.0, 0.72),          # 台阶阴暗底边
                (v0 + 0.015 / max(0.3, slope_len), step_h, 1.06),  # 瓦片下沿亮面
                (v1, 0.0, 0.92),          # 瓦片上沿（被上一排压住处微暗）
            ]
            # 每块瓦的轻微色调抖动
            col_jit = [1.0 + (self.rnd.random() - 0.5) * 0.14 for _ in range(n_cols + 1)]
            for pv, dh, luma in profiles:
                for iu in range(u_steps + 1):
                    u = iu / u_steps
                    # 偶数=瓦峰（凸），奇数=瓦槽（凹）
                    is_ridge = (iu % 2 == 0)
                    w_off = (wave_amp if is_ridge else -wave_amp * 0.45) + dh
                    pt = surf_pt(u, pv) + nrm * w_off
                    verts.append(pt)
                    ci = min(n_cols, iu // 2)
                    base_c = c_h if is_ridge else c_d
                    if white_eave and r == 0 and dh > 0 and not is_ridge:
                        col = srgb(PLASTER_W)
                    else:
                        col = mul_col(lerp_col(c_m, base_c, 0.55), luma * col_jit[ci])
                    vcs.append(col)
            faces = []
            for p_idx in range(2):
                b0 = p_idx * row_w
                b1 = (p_idx + 1) * row_w
                for iu in range(u_steps):
                    faces.append((b0 + iu, b0 + iu + 1, b1 + iu + 1, b1 + iu))
            self.poly(verts, faces, None, vert_colors=vcs)

        # 2) 屋面厚度底板（檐口可见的木望板/椽背与侧边封闭，保证从下面看无穿帮）
        su, sv = 6, 4
        top_grid = []
        bot_grid = []
        for iv in range(sv + 1):
            v = iv / sv
            for iu in range(su + 1):
                u = iu / su
                pt = surf_pt(u, v)
                top_grid.append(pt - nrm * (wave_amp * 0.4))
                bot_grid.append(pt - nrm * thick)
        gw = su + 1
        # 底面（朝下）
        bfaces = []
        for iv in range(sv):
            for iu in range(su):
                i0 = iv * gw + iu
                bfaces.append((i0, i0 + gw, i0 + gw + 1, i0 + 1))
        self.poly(bot_grid, bfaces, soffit_col)
        # 檐口前封边（v=0）与左右侧封边
        e_verts = []
        for iu in range(su + 1):
            e_verts.append(top_grid[iu])
        for iu in range(su + 1):
            e_verts.append(bot_grid[iu])
        efaces = [(iu, iu + gw, iu + gw + 1, iu + 1) for iu in range(su)]
        self.poly(e_verts, efaces, c_vd if not white_eave else PLASTER_S)
        # 左右封边
        for side_u in (0, su):
            svs = [top_grid[iv * gw + side_u] for iv in range(sv + 1)] + [bot_grid[iv * gw + side_u] for iv in range(sv + 1)]
            sf = []
            for iv in range(sv):
                if side_u == 0:
                    sf.append((iv, iv + 1, iv + sv + 2, iv + sv + 1))
                else:
                    sf.append((iv, iv + sv + 1, iv + sv + 2, iv + 1))
            self.poly(svs, sf, c_vd)

        # 3) 檐口圆瓦当（瓦垄端头的半圆小装饰）
        for ic in range(n_cols + 1):
            u = ic / n_cols
            ep = surf_pt(u, 0.0) + nrm * (wave_amp * 0.7)
            e_tan = (p1 - p0).normalized()
            s_dir = (surf_pt(u, 0.08) - surf_pt(u, 0.0)).normalized()
            # 用一个小八角柱做圆瓦当
            r_cap = min(0.055, col_spacing * 0.22)
            self.seg(ep - s_dir * 0.04, ep + s_dir * 0.06, r_cap * 1.9, r_cap * 1.5, PLASTER_W if white_eave else c_dark)

        return surf_pt

    def onigawara(self, pos, normal_dir, size, color, trim=None):
        """传统日式鬼瓦（正脊/垂脊端头的弧形翘饰）"""
        pos = Vector(pos)
        nd = Vector(normal_dir).normalized()
        up = Vector((0, 0, 1))
        rt = nd.cross(up)
        if rt.length < 1e-4:
            rt = Vector((1, 0, 0))
        rt.normalize()
        # 阶梯弧形轮廓（底座 + 主盾 + 上翘云耳）
        w, h, t = size * 0.9, size, size * 0.34
        # 主盾体
        pts_2d = [
            (-w * 0.55, 0.0), (w * 0.55, 0.0),
            (w * 0.48, h * 0.52), (w * 0.58, h * 0.78),
            (w * 0.28, h * 0.96), (0.0, h * 1.05),
            (-w * 0.28, h * 0.96), (-w * 0.58, h * 0.78),
            (-w * 0.48, h * 0.52),
        ]
        n = len(pts_2d)
        verts = []
        for s_off in (-t * 0.5, t * 0.5):
            for rx, rz in pts_2d:
                verts.append(pos + rt * rx + up * rz + nd * s_off)
        faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
        for i in range(n):
            ni = (i + 1) % n
            faces.append((i, ni, n + ni, n + i))
        # 验证朝向（用第 0 个面法向）
        v0, v1, v2 = verts[0], verts[1], verts[2]
        if (v1 - v0).cross(v2 - v0).dot(-nd) < 0:
            faces = [tuple(reversed(f)) for f in faces]
        self.poly(verts, faces, color)
        if trim:
            # 正面凸起一圈装饰边/纹饰
            self.seg(pos + nd * (t * 0.55) + up * (h * 0.22), pos + nd * (t * 0.55) + up * (h * 0.72), w * 0.32, w * 0.14, trim)

    def stone_lantern(self, c, scale=1.0, mossy=True):
        """精致日式庭院石灯笼（基础、竿、中台、火袋镂空、翘角笠、宝珠）"""
        c = Vector(c)
        s = scale
        st = STONE_L
        sd = STONE_D
        sm = STONE_M if mossy else STONE
        # 1) 基坛（两层方形基座）
        self.box(c + Vector((0, 0, 0.05 * s)), (0.44 * s, 0.44 * s, 0.10 * s), sd, jitter=0.05)
        self.box(c + Vector((0, 0, 0.13 * s)), (0.34 * s, 0.34 * s, 0.07 * s), sm, top=(0.86, 0.86), jitter=0.05)
        # 2) 竿（略收分的圆柱/八棱柱 + 中间节环）
        self.cyl(c + Vector((0, 0, 0.16 * s)), 0.10 * s, 0.54 * s, st, seg=8, r2=0.088 * s, jitter=0.04)
        self.cyl(c + Vector((0, 0, 0.40 * s)), 0.112 * s, 0.05 * s, sm, seg=8)
        # 3) 中台（莲瓣状向外展开的托盘）
        self.lathe(
            c + Vector((0, 0, 0.69 * s)),
            [(0.095 * s, 0.0), (0.19 * s, 0.06 * s), (0.21 * s, 0.11 * s), (0.17 * s, 0.13 * s)],
            st, seg=6, jitter=0.04,
            colors=[sd, sm, st, sm],
        )
        # 4) 火袋（四根角柱 + 内部微暗石芯，镂空效果！）
        hz0 = 0.82 * s
        hh = 0.22 * s
        self.box(c + Vector((0, 0, hz0 + hh * 0.5)), (0.14 * s, 0.14 * s, hh * 0.88), '#3e3d38')
        for sx in (-1, 1):
            for sy in (-1, 1):
                self.box(c + Vector((sx * 0.11 * s, sy * 0.11 * s, hz0 + hh * 0.5)), (0.045 * s, 0.045 * s, hh), st, jitter=0.03)
        self.box(c + Vector((0, 0, hz0 + 0.02 * s)), (0.27 * s, 0.27 * s, 0.04 * s), sd)
        self.box(c + Vector((0, 0, hz0 + hh - 0.02 * s)), (0.27 * s, 0.27 * s, 0.04 * s), sd)
        # 5) 笠（六角/四角翘檐石顶，带苔斑）
        kz0 = hz0 + hh
        self.lathe(
            c + Vector((0, 0, kz0)),
            [(0.28 * s, 0.0), (0.31 * s, 0.04 * s), (0.20 * s, 0.13 * s), (0.09 * s, 0.21 * s)],
            sm, seg=6, jitter=0.06,
            colors=[sd, st, sm, st],
        )
        # 6) 宝珠（顶端莲苞）
        self.lathe(
            c + Vector((0, 0, kz0 + 0.21 * s)),
            [(0.075 * s, 0.0), (0.085 * s, 0.04 * s), (0.055 * s, 0.09 * s), (0.008 * s, 0.15 * s)],
            st, seg=8,
        )

    def potted_plant(self, c, scale=1.0, pot_col='#a4563a', leaf_col='#4c8634', flower_col=None, seed=0):
        """精致陶土花盆 + 多片立体小叶/小花"""
        rnd = random.Random(seed)
        c = Vector(c)
        s = scale
        # 带卷边沿口的陶盆
        self.lathe(
            c,
            [(0.11 * s, 0.0), (0.155 * s, 0.24 * s), (0.17 * s, 0.25 * s), (0.17 * s, 0.29 * s), (0.145 * s, 0.29 * s), (0.135 * s, 0.24 * s)],
            pot_col, seg=10, jitter=0.04,
            colors=[mul_col(pot_col, 0.78), pot_col, mul_col(pot_col, 1.08), mul_col(pot_col, 1.05), mul_col(pot_col, 0.8), '#3a2b1f'],
        )
        # 土壤面
        self.cyl(c + Vector((0, 0, 0.23 * s)), 0.138 * s, 0.025 * s, '#3b2b1e', seg=8)
        # 细小立体叶片簇
        n_leaves = 10
        for k in range(n_leaves):
            a = k * 2.399 + rnd.random() * 0.4
            h_stem = (0.10 + rnd.random() * 0.24) * s
            rad = (0.06 + rnd.random() * 0.14) * s
            p0 = c + Vector((math.cos(a) * rad * 0.25, math.sin(a) * rad * 0.25, 0.25 * s))
            p1 = c + Vector((math.cos(a) * rad, math.sin(a) * rad, 0.25 * s + h_stem))
            side = Vector((-math.sin(a), math.cos(a), 0)) * (0.055 * s)
            mid = p0.lerp(p1, 0.55) + Vector((0, 0, 0.03 * s))
            col = vary(ensure_leaf_green(leaf_col), 0.14, rnd)
            self.double_poly([p0, mid - side, p1, mid + side], [(0, 1, 2, 3)], col)
        if flower_col:
            for k in range(5):
                a = k * 1.25 + rnd.random() * 0.5
                rad = (0.04 + rnd.random() * 0.09) * s
                z = (0.42 + rnd.random() * 0.10) * s
                self.sphere(c + Vector((math.cos(a) * rad, math.sin(a) * rad, z)), 0.038 * s, flower_col, sub=1, jitter=0.08)

    def gutter_run(self, p0, p1, drop_at=None, drop_z=0.12, color=IRON):
        """檐口半圆雨樋（带支架）+ 可选拐弯落水管"""
        p0, p1 = Vector(p0), Vector(p1)
        self.seg(p0, p1, 0.075, 0.055, color)
        # 上沿微暗内槽线
        self.seg(p0 + Vector((0, 0, 0.022)), p1 + Vector((0, 0, 0.022)), 0.052, 0.018, IRON_D)
        if drop_at is not None:
            dp, wall_pt = drop_at
            dp = Vector(dp)
            wp = Vector(wall_pt)
            # 集水漏斗
            self.box(dp + Vector((0, 0, -0.05)), (0.11, 0.11, 0.10), color, top=(1.2, 1.2))
            # 弯管进墙边再竖直落到地面
            knee_z = dp.z - 0.38
            pts = [
                dp + Vector((0, 0, -0.09)),
                Vector((wp.x, wp.y, knee_z)),
                Vector((wp.x, wp.y, drop_z + 0.12)),
                Vector((wp.x, wp.y, drop_z)) + (dp - wp).normalized() * 0.08 * Vector((1, 1, 0)).length,
            ]
            # 修正最后一个排水口弯头方向
            out_dir = Vector((dp.x - wp.x, dp.y - wp.y, 0))
            out_dir = out_dir.normalized() if out_dir.length > 1e-4 else Vector((0, -1, 0))
            pts[3] = Vector((wp.x, wp.y, drop_z)) + out_dir * 0.10
            self.tube(pts, 0.032, color, seg=7, smooth=False)
            # 管卡箍
            for frac in (0.28, 0.62, 0.88):
                zz = drop_z + (knee_z - drop_z) * frac
                self.cyl((wp.x, wp.y, zz), 0.042, 0.035, IRON_D, seg=8)

    def finish(self, name, glow_color='#f4e8c8'):
        me = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        me.color_attributes.active_color_index = 0
        me.color_attributes.render_color_index = 0
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        for mname, col in (('body', '#ffffff'), ('glow', glow_color)):
            m = bpy.data.materials.get(mname) or bpy.data.materials.new(mname)
            m.diffuse_color = (*srgb(col), 1.0)
            m.use_nodes = True
            bsdf = m.node_tree.nodes.get('Principled BSDF')
            if bsdf:
                bsdf.inputs['Base Color'].default_value = (*srgb(col), 1.0)
                bsdf.inputs['Roughness'].default_value = 0.85 if mname == 'body' else 0.35
                if mname == 'body':
                    # 避免重复创建节点
                    vc = next((n for n in m.node_tree.nodes if n.type == 'VERTEX_COLOR'), None)
                    if not vc:
                        vc = m.node_tree.nodes.new('ShaderNodeVertexColor')
                    vc.layer_name = 'Color'
                    m.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
            me.materials.append(m)
        return ob


# ---------------- 网格检查、导出与高质量预览 ----------------

def mesh_stats(ob):
    me = ob.data
    me.calc_loop_triangles()
    tris = len(me.loop_triangles)
    verts = [v.co for v in me.vertices]
    if not verts:
        return tris, (0, 0, 0), (0, 0, 0)
    mn = tuple(min(v[i] for v in verts) for i in range(3))
    mx = tuple(max(v[i] for v in verts) for i in range(3))
    return tris, mn, mx


def ground_to_zero(ob, eps=0.0):
    """确保模型最低点精确落在 z = eps（默认 0.0）"""
    me = ob.data
    if not me.vertices:
        return
    min_z = min(v.co.z for v in me.vertices)
    if abs(min_z - eps) > 1e-4:
        dz = eps - min_z
        for v in me.vertices:
            v.co.z += dz
        me.update()


def preview(ob, name, prev_dir, cam_dir=None):
    """渲染高清晰度、完整构图不裁切的 3/4 预览图（浅暖灰棚拍背景，便于对照参考图）"""
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
    sc.world.color = srgb('#d8d2c6')
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'

    bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    dims = mx - mn
    ctr = (mn + mx) * 0.5

    # 根据高宽比自适应横屏/竖屏，绝不裁切细高模型（电线杆/杉树/向日葵/贩卖机）
    tall = dims.z > max(dims.x, dims.y) * 1.15
    sc.render.resolution_x, sc.render.resolution_y = (720, 960) if tall else (960, 720)
    aspect = sc.render.resolution_x / sc.render.resolution_y

    camd = bpy.data.cameras.new('prev_cam')
    camd.lens = 50.0
    camd.sensor_fit = 'HORIZONTAL'
    camd.sensor_width = 36.0
    camd.clip_end = 500.0
    co = bpy.data.objects.new('prev_cam', camd)
    sc.collection.objects.link(co)
    sc.camera = co

    # 正面朝 -Y：默认从前左偏上（-X, -Y, +Z）看过去，与 docs/inaka-refs/*.png 视角一致！
    d = Vector(cam_dir or ((-0.75, -1.55, 0.32) if tall else (-1.12, -1.52, 0.72))).normalized()
    # 计算相机坐标系，精确反推包围盒所需的最小距离（留 14% 边距，绝不裁切！）
    z_axis = d
    x_axis = Vector((0, 0, 1)).cross(z_axis).normalized()
    y_axis = z_axis.cross(x_axis).normalized()
    fov_x = 2.0 * math.atan((camd.sensor_width * 0.5) / camd.lens)
    fov_y = 2.0 * math.atan((camd.sensor_width * 0.5 / aspect) / camd.lens)
    tan_x = math.tan(fov_x * 0.5)
    tan_y = math.tan(fov_y * 0.5)
    dist = 1.0
    for v in bb:
        rel = v - ctr
        px = abs(rel.dot(x_axis))
        py = abs(rel.dot(y_axis))
        pz = rel.dot(z_axis)
        dist = max(dist, pz + px / (tan_x * 0.84), pz + py / (tan_y * 0.84))

    co.location = ctr + d * dist
    co.rotation_euler = (ctr - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(prev_dir, name + '.png')
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(co, do_unlink=True)
    bpy.data.cameras.remove(camd, do_unlink=True)


def finish_export(ob, name, out_dir, prev_dir=None, cam_dir=None, snap_ground=True):
    if snap_ground:
        ground_to_zero(ob, 0.0)
    tris, mn, mx = mesh_stats(ob)
    path = os.path.join(out_dir, name + '.glb')
    for o in bpy.context.scene.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
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
        preview(ob, name, prev_dir, cam_dir=cam_dir)
    me = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me, do_unlink=True)
    sz = tuple(round(mx[i] - mn[i], 2) for i in range(3))
    print(f'exported {name:16s} | tris={tris:6d} | size={sz} | minZ={mn[2]:.3f}')
    return {'name': name, 'tris': tris, 'size': sz, 'min_z': round(mn[2], 3)}
