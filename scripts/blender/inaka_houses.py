# 民房（灰瓦、石州瓦、深蓝瓦、茅草顶）、土仓、蓝/红铁皮农具棚的高细节程序化建模
import math, random
from mathutils import Vector, Matrix
from inaka_core import (
    B, srgb, lerp_col, mul_col, vary, ensure_leaf_green,
    WOOD_VD, WOOD_D, WOOD, WOOD_M, WOOD_L, WOOD_W,
    PLASTER_W, PLASTER, PLASTER_S, PLASTER_C,
    STONE_L, STONE, STONE_D, STONE_M, CONCRETE, CONCRETE_D,
    IRON_D, IRON, STEEL, TILE_PAL,
    THATCH_L, THATCH, THATCH_D, THATCH_VD, MOSS,
)


# ---------------- 入母屋瓦顶（带曲线起翘、叠压瓦垄、垂脊、鬼瓦、椽子、雨樋） ----------------

def irimoya_tile(b, W, D, z0, pitch, ov, tile_key, gable_style='grid', white_shikkui=False, gutter=True):
    pal = TILE_PAL[tile_key]
    c_main, c_dark, c_vd, c_hi = pal
    X = W / 2.0 + ov
    Y = D / 2.0 + ov
    tanp = math.tan(math.radians(pitch))
    xg = W / 2.0 * 0.72
    yg = Y * 0.56
    e = 0.42  # 上坡山墙出檐
    zb = z0 + (Y - yg) * tanp
    zt = zb + yg * tanp
    sag_lo = 0.08
    sag_hi = 0.10
    lift = 0.14

    # 1) 下层四坡（前后两梯形 + 左右两梯形，带起翘弧度与叠瓦）
    s_front = b.tile_slope(
        (-X, -Y, z0), (X, -Y, z0), (-xg, -yg, zb), (xg, -yg, zb),
        pal, sag=sag_lo, corner_lift=lift, col_spacing=0.30, row_spacing=0.38,
        wave_amp=0.035, step_h=0.030, thick=0.11, soffit_col=WOOD_D, white_eave=False,
    )
    s_back = b.tile_slope(
        (X, Y, z0), (-X, Y, z0), (xg, yg, zb), (-xg, yg, zb),
        pal, sag=sag_lo, corner_lift=lift, col_spacing=0.30, row_spacing=0.38,
        wave_amp=0.035, step_h=0.030, thick=0.11, soffit_col=WOOD_D, white_eave=False,
    )
    b.tile_slope(
        (X, -Y, z0), (X, Y, z0), (xg, -yg, zb), (xg, yg, zb),
        pal, sag=sag_lo, corner_lift=lift, col_spacing=0.30, row_spacing=0.38,
        wave_amp=0.035, step_h=0.030, thick=0.11, soffit_col=WOOD_D, white_eave=False,
    )
    b.tile_slope(
        (-X, Y, z0), (-X, -Y, z0), (-xg, yg, zb), (-xg, -yg, zb),
        pal, sag=sag_lo, corner_lift=lift, col_spacing=0.30, row_spacing=0.38,
        wave_amp=0.035, step_h=0.030, thick=0.11, soffit_col=WOOD_D, white_eave=False,
    )

    # 2) 上层两坡（向两侧伸出 e 做破风出檐）
    b.tile_slope(
        (-xg - e, -yg - 0.04, zb - 0.01), (xg + e, -yg - 0.04, zb - 0.01),
        (-xg - e, 0.0, zt), (xg + e, 0.0, zt),
        pal, sag=sag_hi, corner_lift=0.03, col_spacing=0.30, row_spacing=0.36,
        wave_amp=0.035, step_h=0.030, thick=0.11, soffit_col=WOOD_D, white_eave=False,
    )
    b.tile_slope(
        (xg + e, yg + 0.04, zb - 0.01), (-xg - e, yg + 0.04, zb - 0.01),
        (xg + e, 0.0, zt), (-xg - e, 0.0, zt),
        pal, sag=sag_hi, corner_lift=0.03, col_spacing=0.30, row_spacing=0.36,
        wave_amp=0.035, step_h=0.030, thick=0.11, soffit_col=WOOD_D, white_eave=False,
    )

    # 3) 正脊（多层堆叠脊瓦 + 可选白漆喰条带 + 两端雕塑鬼瓦）
    ridge_len = 2.0 * (xg + e) + 0.16
    if white_shikkui:
        b.box((0, 0, zt + 0.09), (ridge_len - 0.04, 0.28, 0.13), PLASTER_W)
    else:
        b.box((0, 0, zt + 0.08), (ridge_len, 0.34, 0.14), c_dark)
    b.box((0, 0, zt + 0.21), (ridge_len + 0.08, 0.28, 0.14), c_vd)
    b.cyl((0, 0, zt + 0.31), 0.105, ridge_len + 0.16, c_dark, seg=8, axis='X')
    for sx in (-1, 1):
        b.onigawara((sx * (xg + e + 0.12), 0.0, zt + 0.04), (sx, 0, 0), 0.56, c_vd, trim=PLASTER_W if white_shikkui else c_hi)

    # 4) 破风斜脊（下り棟）+ 末端小鬼瓦 + 四角隅脊（隅棟）+ 翘角小鬼瓦
    for sx in (-1, 1):
        for sy in (-1, 1):
            # 破风斜脊
            p_top = Vector((sx * (xg + e - 0.04), 0.0, zt + 0.10))
            p_mid = Vector((sx * (xg + e - 0.04), sy * (yg + 0.02), zb + 0.06))
            mid_bend = p_top.lerp(p_mid, 0.5) - Vector((0, 0, sag_hi * 0.85))
            b.tube([p_top, mid_bend, p_mid], [0.11, 0.10, 0.10], c_vd, seg=6, smooth=False)
            b.onigawara(p_mid + Vector((0, sy * 0.06, -0.02)), (0, sy, 0.2), 0.30, c_vd, trim=PLASTER_W if white_shikkui else c_hi)

            # 四角隅脊（沿着下坡对角线优雅起翘）
            h0 = Vector((sx * xg, sy * yg, zb + 0.07))
            h2 = Vector((sx * X, sy * Y, z0 + lift + 0.08))
            h1 = h0.lerp(h2, 0.52) - Vector((0, 0, sag_lo * 0.85))
            b.tube([h0, h1, h2], [0.115, 0.105, 0.095], c_vd, seg=6, smooth=False)
            b.onigawara(h2 + Vector((sx * 0.03, sy * 0.03, -0.02)), (sx, sy, 0.35), 0.28, c_vd, trim=PLASTER_W if white_shikkui else c_hi)

    # 5) 两侧三角形山墙（白灰墙面 + 破风木板 + 精美木格）
    for sx in (-1, 1):
        x = sx * xg
        # 山墙底板（缩进一点有阴影层次）
        g_pts = [(x, -yg + 0.06, zb - 0.05), (x, yg - 0.06, zb - 0.05), (x, 0.0, zt - 0.08)]
        b.poly(g_pts, [(0, 1, 2) if sx > 0 else (2, 1, 0)], PLASTER_S if gable_style != 'grid' else PLASTER)
        # 粗壮破风板（悬鱼位置微突出）
        for sy in (-1, 1):
            b.seg((x + sx * (e * 0.55), sy * (yg + 0.05), zb - 0.08), (x + sx * (e * 0.55), 0.0, zt - 0.06), 0.08, 0.22, WOOD_D)
        # 悬鱼装饰（山墙顶的小木雕）
        b.box((x + sx * (e * 0.62), 0.0, zt - 0.26), (0.06, 0.22, 0.28), WOOD_M, top=(0.55, 0.55))
        # 山墙水平底梁
        b.seg((x + sx * 0.03, -yg, zb - 0.02), (x + sx * 0.03, yg, zb - 0.02), 0.09, 0.10, WOOD_D)
        if gable_style == 'grid':
            # 粗木框井字格（minka_gray 风格）
            for k in (1, 2):
                frac = k / 3.0
                yy = (yg - 0.08) * (1.0 - frac)
                zz = zb + (zt - zb - 0.12) * frac
                b.seg((x + sx * 0.03, -yy, zz), (x + sx * 0.03, yy, zz), 0.06, 0.07, WOOD_D)
            for y_off in (-yg * 0.36, 0.0, yg * 0.36):
                z_top = zt - 0.12 - abs(y_off) / yg * (zt - zb - 0.12)
                b.seg((x + sx * 0.03, y_off, zb), (x + sx * 0.03, y_off, z_top), 0.06, 0.07, WOOD_D)
        else:
            # 细密竖向通风木格栅（minka_sekishu / minka_navy 风格）
            b.poly(
                [(x + sx * 0.01, -yg * 0.78, zb + 0.06), (x + sx * 0.01, yg * 0.78, zb + 0.06), (x + sx * 0.01, 0.0, zt - 0.32)],
                [(0, 1, 2) if sx > 0 else (2, 1, 0)], WOOD_VD,
            )
            n_bars = 13
            for i in range(n_bars):
                yy = -yg * 0.72 + (1.44 * yg) * i / (n_bars - 1)
                z_top = zt - 0.32 - abs(yy) / (yg * 0.78) * (zt - zb - 0.38)
                if z_top > zb + 0.10:
                    b.seg((x + sx * 0.035, yy, zb + 0.04), (x + sx * 0.035, yy, z_top), 0.032, 0.032, WOOD_M)
            for k in (1, 2):
                frac = k / 3.0
                yy = yg * 0.74 * (1.0 - frac)
                zz = zb + 0.06 + (zt - zb - 0.38) * frac
                b.seg((x + sx * 0.04, -yy, zz), (x + sx * 0.04, yy, zz), 0.032, 0.04, WOOD_D)

    # 6) 屋檐下露出的木椽子（垂木）与檐檩（严格收在下凹曲面屋瓦底面下方，绝不穿模！）
    rafter_step = 0.44
    nx = int((2 * X - 1.2) / rafter_step)
    for sy in (-1, 1):
        for i in range(nx + 1):
            rx = -X + 0.60 + (2 * X - 1.2) * i / nx
            p_in = Vector((rx, sy * (D / 2.0 + 0.02), z0 + ov * tanp - 0.34))
            p_out = Vector((rx, sy * (Y - 0.08), z0 - 0.17))
            b.seg(p_in, p_out, 0.050, 0.062, WOOD_D)
        b.seg((-X + 0.50, sy * (D / 2.0 + 0.36), z0 + (ov - 0.36) * tanp - 0.34),
              (X - 0.50, sy * (D / 2.0 + 0.36), z0 + (ov - 0.36) * tanp - 0.34), 0.09, 0.10, WOOD_D)
    ny = int((2 * Y - 1.2) / rafter_step)
    for sx in (-1, 1):
        for i in range(ny + 1):
            ry = -Y + 0.60 + (2 * Y - 1.2) * i / ny
            p_in = Vector((sx * (W / 2.0 + 0.02), ry, z0 + ov * tanp - 0.34))
            p_out = Vector((sx * (X - 0.08), ry, z0 - 0.17))
            b.seg(p_in, p_out, 0.050, 0.062, WOOD_D)

    # 7) 雨樋（檐口水槽 + 四个转角落水管）
    if gutter:
        gz = z0 - 0.09
        gx_out = X + 0.04
        gy_out = Y + 0.04
        # 前、左、后、右四面雨樋，前左和后左角落水管
        b.gutter_run(
            (-gx_out, -gy_out, gz), (gx_out, -gy_out, gz),
            drop_at=((-gx_out + 0.12, -gy_out, gz), (-W / 2.0 - 0.06, -D / 2.0 - 0.06, gz)),
            color=IRON,
        )
        b.gutter_run(
            (-gx_out, -gy_out, gz), (-gx_out, gy_out, gz),
            drop_at=((-gx_out, gy_out - 0.12, gz), (-W / 2.0 - 0.06, D / 2.0 + 0.06, gz)),
            color=IRON,
        )
        b.gutter_run(
            (-gx_out, gy_out, gz), (gx_out, gy_out, gz),
            color=IRON,
        )
        b.gutter_run(
            (gx_out, -gy_out, gz), (gx_out, gy_out, gz),
            drop_at=((gx_out, gy_out - 0.12, gz), (W / 2.0 + 0.06, D / 2.0 + 0.06, gz)),
            color=IRON,
        )

    return zt


# ---------------- 茅草入母屋顶（厚重阶梯切檐、苔斑、烟出格栅、千木压脊） ----------------

def irimoya_thatch(b, W, D, z0, ov=1.05):
    X = W / 2.0 + ov
    Y = D / 2.0 + ov
    pitch = 43.0
    tanp = math.tan(math.radians(pitch))
    xg = W / 2.0 * 0.70
    yg = Y * 0.58
    zb = z0 + (Y - yg) * tanp
    zt = zb + yg * tanp
    T = 0.52  # 茅草檐口厚度
    rnd = b.rnd

    def thatch_slope(p0, p1, q0, q1, su=14, sv=7, sag=0.12, moss_edge=True):
        """ sculpted 茅草坡面：表层带竖向草束起伏与绿苔，檐口多层厚切断面 """
        p0, p1, q0, q1 = map(Vector, (p0, p1, q0, q1))
        nrm = (p1 - p0).cross(q0 - p0).normalized()
        if nrm.z < 0:
            nrm = -nrm
            p0, p1 = p1, p0
            q0, q1 = q1, q0

        def pt_at(u, v):
            base = p0.lerp(p1, u).lerp(q0.lerp(q1, u), v)
            # 微微鼓弧 + 下凹曲线，像厚重的古民家茅草
            curve = -sag * 4.0 * v * (1.0 - v)
            # 顺坡方向的茅草束凹凸纹理（更饱满、有干草束层理）
            tuft = (math.sin(u * 46.0 + v * 6.0) * 0.036 + math.sin(u * 96.0 - v * 11.0) * 0.020) * (0.45 + 0.55 * (1.0 - v))
            # 檐口蓬松厚实下垂
            fluff = 0.055 * (1.0 - v) ** 1.8
            return base + Vector((0, 0, curve)) + nrm * (tuft + fluff)

        # 上表面
        verts = []
        vcs = []
        for iv in range(sv + 1):
            v = iv / sv
            for iu in range(su + 1):
                u = iu / su
                p = pt_at(u, v)
                verts.append(p)
                # 色彩层次：顶近脊深褐、中段暖金黄茅草、檐口略带暗影与自然青苔斑块
                n_val = 0.5 + 0.5 * math.sin(u * 23.3 + v * 11.1) * math.cos(u * 41.0 - v * 15.0)
                col = lerp_col(THATCH, THATCH_L, 0.40 + 0.48 * (1.0 - abs(v - 0.52) * 1.35))
                col = mul_col(col, 0.88 + 0.24 * n_val)
                if v > 0.82:
                    col = lerp_col(col, THATCH_D, (v - 0.82) / 0.18 * 0.50)
                if moss_edge and v < 0.34:
                    mk = max(0.0, math.sin(u * 13.4 + 1.2) * math.cos(u * 27.0 + 0.5))
                    if mk > 0.30:
                        col = lerp_col(col, MOSS, min(0.82, (mk - 0.30) * 1.55 * (1.0 - v / 0.34)))
                vcs.append(col)
        gw = su + 1
        faces = []
        for iv in range(sv):
            for iu in range(su):
                i0 = iv * gw + iu
                faces.append((i0, i0 + 1, i0 + gw + 1, i0 + gw))
        b.poly(verts, faces, None, smooth=False, vert_colors=vcs)

        # 厚切檐口（3 层阶梯切面：由外草层叠向内暗色底层）
        edge_rings = []
        edge_cols = []
        layers = [(0.0, 0.0, THATCH_L), (-0.05, -T * 0.34, THATCH), (-0.11, -T * 0.68, THATCH_D), (-0.16, -T, THATCH_VD)]
        s_dir = (q0.lerp(q1, 0.5) - p0.lerp(p1, 0.5)).normalized()
        for back_d, dz, lcol in layers:
            ring = []
            rcol = []
            for iu in range(su + 1):
                u = iu / su
                p = pt_at(u, 0.0) + s_dir * (-back_d) + Vector((0, 0, dz))
                ring.append(p)
                rcol.append(vary(lcol, 0.08, rnd))
            edge_rings.append(ring)
            edge_cols.append(rcol)
        ev = [p for r in edge_rings for p in r]
        ec = [c for r in edge_cols for c in r]
        ef = []
        for l in range(len(layers) - 1):
            b0 = l * gw
            b1 = (l + 1) * gw
            for iu in range(su):
                ef.append((b0 + iu, b1 + iu, b1 + iu + 1, b0 + iu + 1))
        b.poly(ev, ef, None, vert_colors=ec)

        # 底面封闭（檐下深色暗影）
        b_verts = [edge_rings[-1][iu] for iu in range(su + 1)] + [pt_at(iu / su, 1.0) - Vector((0, 0, T * 0.85)) for iu in range(su + 1)]
        bf = [(iu, iu + gw, iu + gw + 1, iu + 1) for iu in range(su)]
        b.poly(b_verts, bf, THATCH_VD)

    # 下层四坡（提高细分使草束层理与青苔更自然细腻）
    thatch_slope((-X, -Y, z0), (X, -Y, z0), (-xg, -yg, zb), (xg, -yg, zb), su=24, sv=8, sag=0.10)
    thatch_slope((X, Y, z0), (-X, Y, z0), (xg, yg, zb), (-xg, yg, zb), su=24, sv=8, sag=0.10)
    thatch_slope((X, -Y, z0), (X, Y, z0), (xg, -yg, zb), (xg, yg, zb), su=18, sv=8, sag=0.08)
    thatch_slope((-X, Y, z0), (-X, -Y, z0), (-xg, yg, zb), (-xg, -yg, zb), su=18, sv=8, sag=0.08)

    # 上层两坡（厚茅草向前两侧微挑出覆盖烟出山墙）
    e = 0.55
    thatch_slope((-xg - e, -yg - 0.08, zb - 0.05), (xg + e, -yg - 0.08, zb - 0.05), (-xg - e * 0.65, 0.0, zt), (xg + e * 0.65, 0.0, zt), su=24, sv=10, sag=0.14, moss_edge=False)
    thatch_slope((xg + e, yg + 0.08, zb - 0.05), (-xg - e, yg + 0.08, zb - 0.05), (xg + e * 0.65, 0.0, zt), (-xg - e * 0.65, 0.0, zt), su=24, sv=10, sag=0.14, moss_edge=False)

    # 两侧烟出山墙（深凹在茅草挑眉里的深色木格栅）
    for sx in (-1, 1):
        x = sx * (xg - 0.05)
        b.poly([(x, -yg * 0.72, zb + 0.02), (x, yg * 0.72, zb + 0.02), (x, 0.0, zt - 0.55)], [(0, 1, 2) if sx > 0 else (2, 1, 0)], WOOD_VD)
        # 粗木框与密木格
        b.seg((x + sx * 0.05, -yg * 0.74, zb + 0.02), (x + sx * 0.05, yg * 0.74, zb + 0.02), 0.11, 0.12, WOOD_D)
        for sy in (-1, 1):
            b.seg((x + sx * 0.05, sy * yg * 0.74, zb + 0.02), (x + sx * 0.05, 0.0, zt - 0.45), 0.11, 0.12, WOOD_D)
        for i in range(9):
            yy = -yg * 0.62 + (1.24 * yg) * i / 8.0
            zt_bar = zt - 0.52 - abs(yy) / (yg * 0.72) * (zt - zb - 0.54)
            if zt_bar > zb + 0.12:
                b.seg((x + sx * 0.05, yy, zb + 0.05), (x + sx * 0.05, yy, zt_bar), 0.045, 0.045, WOOD)
        for k in (1, 2, 3):
            frac = k / 4.0
            yy = yg * 0.68 * (1.0 - frac)
            zz = zb + 0.05 + (zt - zb - 0.54) * frac
            b.seg((x + sx * 0.05, -yy, zz), (x + sx * 0.05, yy, zz), 0.04, 0.045, WOOD)
        # 山墙顶茅草卷边护眉
        for sy in (-1, 1):
            b.tube(
                [Vector((sx * (xg + e * 0.4), sy * (yg + 0.04), zb - 0.05)),
                 Vector((sx * (xg + e * 0.5), sy * (yg * 0.5), (zb + zt) * 0.5 - 0.08)),
                 Vector((sx * (xg + e * 0.55), 0.0, zt - 0.05))],
                [0.24, 0.26, 0.24], THATCH_L, seg=7, smooth=False, jitter=0.06,
            )

    # 屋脊（多层深色茅草脊盖 + 青苔 + 6 对交叉木压梁千木/馬乗 + 顶上横竹竿）
    rl = 2.0 * (xg + e * 0.68)
    b.box((0, 0, zt - 0.04), (rl + 0.25, 1.35, 0.28), THATCH_D, top=(0.82, 0.75), jitter=0.06)
    b.box((0, 0, zt + 0.16), (rl + 0.12, 0.92, 0.24), MOSS, top=(0.85, 0.76), jitter=0.10)
    b.box((0, 0, zt + 0.34), (rl, 0.64, 0.22), THATCH_VD, top=(0.85, 0.72), jitter=0.06)
    # 沿脊两侧压的细竹竿
    for sy in (-1, 1):
        b.cyl((0, sy * 0.56, zt - 0.02), 0.045, rl + 0.25, '#a89660', seg=7, axis='X')
        b.cyl((0, sy * 0.36, zt + 0.22), 0.042, rl + 0.16, '#968452', seg=7, axis='X')
    # 6 对交叉木鞍（千木/馬乗）
    for k in range(6):
        kx = -xg + (2.0 * xg) * k / 5.0
        b.seg((kx, -0.78, zt - 0.25), (kx, 0.36, zt + 0.78), 0.10, 0.11, WOOD_M, jitter=0.05)
        b.seg((kx, 0.78, zt - 0.25), (kx, -0.36, zt + 0.78), 0.10, 0.11, WOOD_M, jitter=0.05)
    # 架在交叉木鞍上的长横竹脊杆
    b.cyl((0, 0, zt + 0.58), 0.068, rl + 0.95, '#8c7650', seg=8, axis='X')
    return zt


# ---------------- 民房墙体、基础、檐廊、木格拉门、玄关与庭院小景 ----------------

def minka_body(b, W, D, H, seed, foundation='concrete', lower_col=WOOD, upper_col=PLASTER,
               tile_key='gray', thatch=False, ac=False, laundry=False, flowers=False):
    rnd = random.Random(seed)
    fh = 0.52  # 基础高度
    top = fh + H

    # 1) 基础（混凝土 / 块石砌筑 / 自然河卵石）+ 一圈地坪混凝土散水
    b.box((0, 0, 0.04), (W + 0.85, D + 0.85, 0.08), CONCRETE, jitter=0.03)
    if foundation == 'concrete':
        b.box((0, 0, fh / 2.0 + 0.02), (W + 0.16, D + 0.16, fh), CONCRETE, jitter=0.03, grad=(0.82, 1.0))
        # 通风口（床下換気口）
        for sy in (-1, 1):
            for x in (-W * 0.32, 0.0, W * 0.32):
                b.box((x, sy * (D / 2.0 + 0.09), 0.26), (0.38, 0.04, 0.16), IRON_D)
        for sx in (-1, 1):
            for y in (-D * 0.24, D * 0.24):
                b.box((sx * (W / 2.0 + 0.09), y, 0.26), (0.04, 0.38, 0.16), IRON_D)
    elif foundation == 'ashlar':
        b.box((0, 0, fh / 2.0 + 0.02), (W + 0.12, D + 0.12, fh), STONE_D)
        # 四周砌筑块石
        for sy in (-1, 1):
            n = int(W / 0.58)
            for row in range(2):
                off = 0.25 if row else 0.0
                for i in range(n):
                    bx = -W / 2.0 + (i + 0.5) * (W / n) + (off if i < n - 1 else 0)
                    b.stone_block((bx, sy * (D / 2.0 + 0.06), 0.16 + row * 0.23), (W / n - 0.03, 0.16, 0.21), STONE_L if (i + row) % 2 else STONE, jitter=0.08, bevel=0.025)
        for sx in (-1, 1):
            n = int(D / 0.58)
            for row in range(2):
                for i in range(n):
                    by = -D / 2.0 + (i + 0.5) * (D / n)
                    b.stone_block((sx * (W / 2.0 + 0.06), by, 0.16 + row * 0.23), (0.16, D / n - 0.03, 0.21), STONE if (i + row) % 2 else STONE_L, jitter=0.08, bevel=0.025)
        # 通风口
        for sx in (-1, 1):
            b.box((sx * (W / 2.0 + 0.12), -D * 0.18, 0.24), (0.05, 0.34, 0.16), IRON_D)
    else:
        # 茅草屋的自然河卵石基坛
        b.box((0, 0, fh / 2.0 + 0.02), (W + 0.08, D + 0.08, fh), STONE_D)
        for sy in (-1, 1):
            n = int(W / 0.44)
            for row in range(2):
                for i in range(n):
                    bx = -W / 2.0 + (i + 0.5) * (W / n) + (0.14 if row else 0)
                    b.sphere((bx, sy * (D / 2.0 + 0.05), 0.17 + row * 0.22), 0.17, STONE_M if rnd.random() < 0.3 else STONE_L, sub=1, scale=(1.25, 0.72, 0.78), smooth=False, jitter=0.12)
        for sx in (-1, 1):
            n = int(D / 0.44)
            for row in range(2):
                for i in range(n):
                    by = -D / 2.0 + (i + 0.5) * (D / n) + (0.12 if row else 0)
                    b.sphere((sx * (W / 2.0 + 0.05), by, 0.17 + row * 0.22), 0.17, STONE_M if rnd.random() < 0.3 else STONE, sub=1, scale=(0.72, 1.25, 0.78), smooth=False, jitter=0.12)

    # 2) 主墙体：下段腰板木壁 + 上段白灰漆喰（带檐下 AO 阴影渐变！）
    lower_h = 1.02
    upper_h = H - lower_h
    b.box((0, 0, fh + lower_h / 2.0), (W, D, lower_h), lower_col, jitter=0.03, grad=(0.86, 1.02))
    b.box((0, 0, fh + lower_h + upper_h / 2.0), (W - 0.02, D - 0.02, upper_h), upper_col, jitter=0.015, grad=(1.02, 0.80))

    # 下段腰板竖向压条（押縁）与水切横木
    for sy in (-1, 1):
        b.box((0, sy * (D / 2.0 + 0.025), fh + lower_h), (W + 0.08, 0.07, 0.065), WOOD_D)
        b.box((0, sy * (D / 2.0 + 0.02), fh + 0.04), (W + 0.08, 0.06, 0.07), WOOD_VD)
        n_b = int(W / 0.36)
        for i in range(n_b + 1):
            x = -W / 2.0 + W * i / n_b
            b.box((x, sy * (D / 2.0 + 0.012), fh + lower_h / 2.0), (0.035, 0.026, lower_h - 0.04), WOOD_D, jitter=0.06)
    for sx in (-1, 1):
        b.box((sx * (W / 2.0 + 0.025), 0, fh + lower_h), (0.07, D + 0.08, 0.065), WOOD_D)
        b.box((sx * (W / 2.0 + 0.02), 0, fh + 0.04), (0.06, D + 0.08, 0.07), WOOD_VD)
        n_b = int(D / 0.36)
        for i in range(n_b + 1):
            y = -D / 2.0 + D * i / n_b
            b.box((sx * (W / 2.0 + 0.012), y, fh + lower_h / 2.0), (0.026, 0.035, lower_h - 0.04), WOOD_D, jitter=0.06)

    # 3) 暴露的深色木结构柱、梁（真壁造）
    for sy in (-1, 1):
        n = max(4, round(W / 2.0))
        for i in range(n + 1):
            x = -W / 2.0 + W * i / n
            b.box((x, sy * (D / 2.0 + 0.035), fh + H / 2.0), (0.16, 0.08, H), WOOD_D, jitter=0.04)
        b.box((0, sy * (D / 2.0 + 0.045), top - 0.12), (W + 0.16, 0.10, 0.22), WOOD_D)
    for sx in (-1, 1):
        n = max(3, round(D / 2.0))
        for i in range(n + 1):
            y = -D / 2.0 + D * i / n
            b.box((sx * (W / 2.0 + 0.035), y, fh + H / 2.0), (0.08, 0.16, H), WOOD_D, jitter=0.04)
        b.box((sx * (W / 2.0 + 0.045), 0, top - 0.12), (0.10, D + 0.16, 0.22), WOOD_D)

    # 背面和右侧小木格窗（让房屋360度看都有细节）
    for y_win in (-D * 0.22, D * 0.22):
        # 右侧窗（避开玄关）
        if y_win > 0:
            b.box((W / 2.0 + 0.02, y_win, fh + 1.55), (0.05, 1.3, 1.05), '#8c949c', glow=True)
            b.box((W / 2.0 + 0.05, y_win, fh + 1.55), (0.05, 1.38, 0.06), WOOD_D)
            b.box((W / 2.0 + 0.05, y_win, fh + 2.08), (0.08, 1.44, 0.07), WOOD_D)
            b.box((W / 2.0 + 0.05, y_win, fh + 1.02), (0.08, 1.44, 0.07), WOOD_D)
            for dy in (-0.42, 0.0, 0.42):
                b.box((W / 2.0 + 0.05, y_win + dy, fh + 1.55), (0.04, 0.04, 1.05), WOOD_D)
    # 背面两扇宽木格窗
    for x_win in (-W * 0.24, W * 0.22):
        b.box((x_win, D / 2.0 + 0.02, fh + 1.55), (1.6, 0.05, 1.10), '#8c949c', glow=True)
        for dz in (-0.54, 0.0, 0.54):
            b.box((x_win, D / 2.0 + 0.05, fh + 1.55 + dz), (1.68, 0.07, 0.06), WOOD_D)
        for dx in (-0.80, -0.28, 0.28, 0.80):
            b.box((x_win + dx, D / 2.0 + 0.05, fh + 1.55), (0.05, 0.06, 1.12), WOOD_D)

    # 4) 正面（-Y）：玄关位于右侧，檐廊与落地障子/玻璃拉门 + 雨户箱位于左中段
    gx = W / 2.0 - 1.55
    gw = 2.45
    gd = 1.80
    eng_x0 = -W / 2.0 + 0.25
    eng_x1 = gx - gw / 2.0 - 0.15
    eng_w = eng_x1 - eng_x0
    eng_cx = (eng_x0 + eng_x1) * 0.5

    # 雨户箱（户袋 tobuku）放在檐廊最左端
    tobuku_w = 0.88
    tobuku_x = eng_x0 + tobuku_w * 0.5 + 0.08
    b.box((tobuku_x, -D / 2.0 - 0.12, fh + 1.06), (tobuku_w, 0.22, 2.05), WOOD_M, jitter=0.04)
    # 户袋横百叶条纹
    for k in range(13):
        zz = fh + 0.14 + k * 0.145
        b.box((tobuku_x, -D / 2.0 - 0.235, zz), (tobuku_w - 0.08, 0.025, 0.045), WOOD_D)
    b.box((tobuku_x, -D / 2.0 - 0.12, fh + 2.10), (tobuku_w + 0.08, 0.28, 0.06), WOOD_D)

    # 落地玻璃拉门与障子（雨户箱右侧到玄关左侧）
    door_x0 = eng_x0 + tobuku_w + 0.18
    door_x1 = eng_x1 - 0.22
    door_w = door_x1 - door_x0
    n_panels = 4
    pw = door_w / n_panels
    # 外门框与内陷底背板（放在门片后面 y=-D/2+0.01，绝不遮挡拉门！）
    b.box(((door_x0 + door_x1) * 0.5, -D / 2.0 + 0.015, fh + 1.04), (door_w + 0.12, 0.04, 2.06), WOOD_VD)
    b.box(((door_x0 + door_x1) * 0.5, -D / 2.0 - 0.09, fh + 2.06), (door_w + 0.20, 0.12, 0.10), WOOD_D)  # 鸭居门楣
    b.box(((door_x0 + door_x1) * 0.5, -D / 2.0 - 0.09, fh + 2.46), (door_w + 0.20, 0.10, 0.08), WOOD_D)  # 栏间上框
    # 栏间高窗（拉门上方窄玻璃窗）
    for i in range(2):
        rx = door_x0 + door_w * (i + 0.5) / 2.0
        b.box((rx, -D / 2.0 - 0.045, fh + 2.26), (door_w * 0.48, 0.03, 0.32), '#c4d0d8', glow=True)
        b.box((rx, -D / 2.0 - 0.070, fh + 2.26), (0.04, 0.03, 0.34), WOOD_D)
    # 4 扇拉门（外两扇玻璃拉门、内两扇格子障子，全部清楚可见且带暖光发光材质）
    for i in range(n_panels):
        px = door_x0 + (i + 0.5) * pw
        y_off = -D / 2.0 - (0.075 if i % 2 == 0 else 0.042)
        is_shoji = (i in (1, 2))
        pane_col = '#f4ebd4' if is_shoji else '#a8bac6'
        # 发光门芯
        b.box((px, y_off, fh + 1.15), (pw - 0.08, 0.024, 1.62), pane_col, glow=True)
        # 底部腰板
        b.box((px, y_off - 0.012, fh + 0.22), (pw - 0.04, 0.04, 0.36), WOOD_M, jitter=0.04)
        # 左右竖框
        for sx in (-1, 1):
            b.box((px + sx * (pw * 0.5 - 0.03), y_off - 0.015, fh + 1.02), (0.055, 0.045, 1.98), WOOD_M)
        # 上下横框
        b.box((px, y_off - 0.015, fh + 1.98), (pw, 0.045, 0.06), WOOD_M)
        # 细格栅（障子密格 / 玻璃稀格）
        rows_g = 6 if is_shoji else 3
        cols_g = 3 if is_shoji else 2
        for r in range(1, rows_g):
            zz = fh + 0.40 + 1.56 * r / rows_g
            b.box((px, y_off - 0.018, zz), (pw - 0.06, 0.022, 0.022), WOOD_D)
        for c_i in range(1, cols_g):
            xx = px - pw * 0.5 + pw * c_i / cols_g
            b.box((xx, y_off - 0.018, fh + 1.18), (0.022, 0.022, 1.56), WOOD_D)

    # 5) 檐廊（engawa）：一条条木地板 + 封边板 + 束柱与束石 + 踏脚石
    eng_d = 0.96
    eng_y = -D / 2.0 - eng_d * 0.5
    eng_z = fh - 0.04
    # 走廊木地板条
    n_planks = max(12, int(eng_w / 0.24))
    pw_e = eng_w / n_planks
    for i in range(n_planks):
        px = eng_x0 + (i + 0.5) * pw_e
        b.box((px, eng_y, eng_z), (pw_e - 0.012, eng_d, 0.07), WOOD_L if i % 2 else WOOD_W, jitter=0.05)
    # 檐廊前端厚边框梁
    b.box((eng_cx, -D / 2.0 - eng_d - 0.02, eng_z - 0.02), (eng_w + 0.06, 0.07, 0.11), WOOD_M)
    # 檐廊束柱与底下锥形束石（tsukaishi）
    n_legs = max(3, int(eng_w / 1.8) + 1)
    for i in range(n_legs):
        lx = eng_x0 + 0.18 + (eng_w - 0.36) * i / (n_legs - 1)
        b.box((lx, -D / 2.0 - eng_d + 0.10, eng_z * 0.5 + 0.04), (0.11, 0.11, eng_z - 0.10), WOOD_D)
        b.box((lx, -D / 2.0 - eng_d + 0.10, 0.08), (0.20, 0.20, 0.16), STONE_L, top=(0.75, 0.75), jitter=0.06)
    # 檐廊前的大块天然踏脚石（靴脱石）
    step_x = eng_cx + 0.35
    b.stone_block((step_x, -D / 2.0 - eng_d - 0.38, 0.11), (1.35, 0.52, 0.22), STONE_L, rot=0.03, jitter=0.06, bevel=0.04)
    if ac:  # 石州瓦款参考图里有两块高低错落踏脚石
        b.stone_block((step_x + 0.35, -D / 2.0 - eng_d - 0.85, 0.05), (0.72, 0.38, 0.10), STONE, rot=-0.06, jitter=0.06, bevel=0.03)

    # 6) 右前方凸出的玄关（genkan）：石台阶、木格拉门、暖色门灯、独立小瓦顶
    gy = -D / 2.0 - gd * 0.5
    g_front = -D / 2.0 - gd
    # 混凝土/石板玄关前踏步台
    b.box((gx, gy - 0.22, 0.09), (gw + 0.65, gd + 0.65, 0.18), CONCRETE, jitter=0.03)
    b.box((gx, g_front - 0.28, 0.045), (gw + 0.40, 0.42, 0.09), STONE_L, jitter=0.04)
    # 玄关墙体（下木上白灰 + 粗木柱）
    gh = 2.45
    b.box((gx, gy, 0.18 + 0.82 / 2.0), (gw, gd, 0.82), lower_col, jitter=0.03)
    b.box((gx, gy, 0.18 + 0.82 + (gh - 0.82) / 2.0), (gw - 0.02, gd - 0.02, gh - 0.82), upper_col, grad=(1.0, 0.84))
    for sx in (-1, 1):
        b.box((gx + sx * (gw * 0.5 + 0.02), g_front - 0.02, 0.18 + gh * 0.5), (0.14, 0.14, gh), WOOD_D)
        b.box((gx + sx * (gw * 0.5 + 0.02), -D / 2.0, 0.18 + gh * 0.5), (0.14, 0.14, gh), WOOD_D)
    b.box((gx, g_front - 0.03, 0.18 + gh - 0.08), (gw + 0.16, 0.12, 0.16), WOOD_D)
    # 玄关双扇细格木拉门（格子戸）+ 发光内衬
    gd_w = gw - 0.52
    b.box((gx, g_front - 0.02, 0.18 + 0.98), (gd_w, 0.04, 1.92), '#d8be8a', glow=True)
    b.box((gx, g_front - 0.045, 0.18 + 1.94), (gd_w + 0.10, 0.08, 0.07), WOOD_D)
    b.box((gx, g_front - 0.045, 0.18 + 0.96), (0.06, 0.06, 1.92), WOOD_D)
    b.box((gx, g_front - 0.045, 0.18 + 0.96), (gd_w + 0.04, 0.05, 0.05), WOOD_D)
    for k in range(11):
        xx = gx - gd_w * 0.46 + gd_w * 0.92 * k / 10.0
        b.box((xx, g_front - 0.045, 0.18 + 0.96), (0.024, 0.03, 1.90), WOOD_M)
    # 玄关门灯（发光灯罩 + 木/铁支架）
    lamp_z = 0.18 + gh - 0.22
    b.box((gx, g_front - 0.14, lamp_z + 0.10), (0.24, 0.24, 0.05), WOOD_VD)
    b.box((gx, g_front - 0.14, lamp_z), (0.18, 0.18, 0.18), '#ffe6a8', glow=True)
    b.box((gx, g_front - 0.14, lamp_z - 0.10), (0.20, 0.20, 0.03), WOOD_VD)

    # 玄关独立切妻小瓦顶（茅草屋的玄关也用灰瓦，对照 minka_thatch.png！）
    gtile = 'gray' if thatch else tile_key
    gpal = TILE_PAL[gtile]
    gz0 = 0.18 + gh - 0.06
    g_ovx = 0.48
    g_ovy = 0.50
    g_ridge_h = 0.88
    gzt = gz0 + g_ridge_h
    gy_f = g_front - g_ovy
    gy_b = -D / 2.0 + 0.65  # 深入主屋坡面避免缝隙
    for sx in (-1, 1):
        if sx < 0:
            p0, p1 = (gx - gw / 2.0 - g_ovx, gy_f, gz0), (gx - gw / 2.0 - g_ovx, gy_b, gz0)
            q0, q1 = (gx, gy_f, gzt), (gx, gy_b, gzt)
        else:
            p0, p1 = (gx + gw / 2.0 + g_ovx, gy_b, gz0), (gx + gw / 2.0 + g_ovx, gy_f, gz0)
            q0, q1 = (gx, gy_b, gzt), (gx, gy_f, gzt)
        b.tile_slope(
            p0, p1, q0, q1, gpal, sag=0.05, corner_lift=0.03,
            col_spacing=0.28, row_spacing=0.34, wave_amp=0.028, step_h=0.024, thick=0.09, soffit_col=WOOD_D,
        )
    # 玄关小脊 + 小鬼瓦 + 山墙白墙与破风板（破风板严格收在檐口内不外露）
    b.box((gx, (gy_f + gy_b) * 0.5, gzt + 0.08), (0.22, gy_b - gy_f + 0.08, 0.16), gpal[2])
    b.onigawara((gx, gy_f - 0.05, gzt + 0.02), (0, -1, 0), 0.30, gpal[2], trim=PLASTER_W if tile_key == 'navy' else gpal[3])
    b.poly(
        [(gx - gw / 2.0, g_front, gz0 + 0.02), (gx + gw / 2.0, g_front, gz0 + 0.02), (gx, g_front, gzt - 0.08)],
        [(0, 1, 2)], upper_col,
    )
    for sx in (-1, 1):
        b.seg((gx + sx * (gw / 2.0 + g_ovx - 0.08), gy_f + 0.04, gz0 - 0.07), (gx, gy_f + 0.04, gzt - 0.07), 0.065, 0.13, WOOD_D)
    # 玄关小落水管
    if not thatch:
        b.gutter_run(
            (gx - gw / 2.0 - g_ovx - 0.03, gy_f, gz0 - 0.07),
            (gx - gw / 2.0 - g_ovx - 0.03, -D / 2.0, gz0 - 0.07),
            drop_at=((gx - gw / 2.0 - g_ovx - 0.03, gy_f + 0.15, gz0 - 0.07), (gx - gw / 2.0 - 0.05, g_front + 0.08, gz0 - 0.07)),
            color=IRON,
        )

    # 7) 空调室外机 + 墙面冷媒管（minka_sekishu 风格）
    if ac:
        ax = -W / 2.0 - 0.32
        ay = -D * 0.18
        b.box((ax, ay, 0.10), (0.38, 0.78, 0.08), CONCRETE_D)
        b.box((ax, ay, 0.48), (0.34, 0.84, 0.68), '#e6e4dc', jitter=0.015)
        b.box((ax, ay, 0.83), (0.36, 0.86, 0.04), '#cfd0ca')
        # 圆形风扇护网（凹暗底 + 栅条）
        b.cyl((ax - 0.175, ay - 0.12, 0.48), 0.24, 0.02, '#3a3c40', seg=14, axis='X')
        for k in range(-3, 4):
            b.box((ax - 0.188, ay - 0.12, 0.48 + k * 0.06), (0.015, 0.44, 0.014), '#d4d4cc')
        # 墙面弯曲冷媒保温管
        p_pipe = [
            Vector((ax + 0.14, ay + 0.32, 0.36)),
            Vector((-W / 2.0 - 0.05, ay + 0.35, 0.42)),
            Vector((-W / 2.0 - 0.05, ay + 0.35, 1.45)),
            Vector((-W / 2.0 - 0.05, ay + 0.52, 1.60)),
            Vector((-W / 2.0 - 0.05, ay + 0.52, 2.35)),
            Vector((-W / 2.0 + 0.02, ay + 0.52, 2.35)),
        ]
        b.tube(p_pipe, 0.036, '#dcd8cc', seg=6, smooth=False)

    # 8) 晾衣架与夏日衣服（minka_gray / minka_navy）
    if laundry:
        # 放在左前方空地，对照参考图 minka_gray.png / minka_navy.png
        lx = -W / 2.0 - 0.85
        ly0, ly1 = -D / 2.0 + 0.2, D * 0.22
        for ly in (ly0, ly1):
            b.box((lx, ly, 0.12), (0.38, 0.38, 0.24), CONCRETE, top=(0.62, 0.62), jitter=0.04)
            b.cyl((lx, ly, 0.22), 0.025, 1.55, STEEL, seg=7)
            # 顶端 Y 形托叉
            b.seg((lx, ly, 1.72), (lx - 0.10, ly, 1.82), 0.025, 0.025, STEEL)
            b.seg((lx, ly, 1.72), (lx + 0.10, ly, 1.82), 0.025, 0.025, STEEL)
        b.cyl((lx, (ly0 + ly1) * 0.5, 1.78), 0.022, (ly1 - ly0) + 0.65, '#c4c4bc', seg=8, axis='Y')
        # 4 件立体夏装 T 恤/毛巾（带衣袖和微风下摆）
        palette = ['#f2eee6', '#a4c4e8', '#c6e29c', '#f4b4be'] if tile_key == 'gray' else ['#f4f2ec', '#7698c4', '#a8cce0', '#eceae4']
        for k, col in enumerate(palette):
            cy = ly0 + 0.35 + k * ((ly1 - ly0 - 0.65) / max(1, len(palette) - 1))
            # 衣架三角
            b.seg((lx, cy, 1.76), (lx, cy - 0.18, 1.65), 0.015, 0.015, WOOD_L)
            b.seg((lx, cy, 1.76), (lx, cy + 0.18, 1.65), 0.015, 0.015, WOOD_L)
            if k == 3 and tile_key == 'navy':
                # 一条搭着的长毛巾
                b.box((lx, cy, 1.38), (0.045, 0.34, 0.72), col, jitter=0.02)
                b.box((lx, cy, 1.09), (0.048, 0.34, 0.06), '#6a8cb8')
            else:
                # T 恤躯干 + 左右短袖
                b.box((lx, cy, 1.34), (0.055, 0.36, 0.58), col, rot=0.06 * (k - 1.5), jitter=0.02)
                b.box((lx, cy - 0.22, 1.52), (0.05, 0.16, 0.20), col, rot=0.08)
                b.box((lx, cy + 0.22, 1.52), (0.05, 0.16, 0.20), col, rot=-0.08)

    # 9) 庭院石灯笼 + 多盆陶土花草盆栽
    if thatch:
        b.stone_lantern((gx - gw / 2.0 - 0.45, -D / 2.0 - 1.35, 0.0), scale=1.05, mossy=True)
        b.potted_plant((-W / 2.0 - 0.35, -D / 2.0 - 0.95, 0.0), scale=1.15, pot_col='#a65a3c', leaf_col='#4a8234', seed=seed + 1)
        b.potted_plant((-W / 2.0 + 0.05, -D / 2.0 - 1.25, 0.0), scale=0.85, pot_col='#924e34', leaf_col='#56903a', seed=seed + 2)
        b.potted_plant((-W / 2.0 + 0.48, -D / 2.0 - 1.12, 0.0), scale=1.05, pot_col='#b06240', leaf_col='#3f762c', seed=seed + 3)
        b.potted_plant((gx - gw / 2.0 - 0.05, -D / 2.0 - 1.55, 0.0), scale=0.75, pot_col='#9c5438', leaf_col='#4c8432', flower_col='#e87c44', seed=seed + 4)
    elif ac:
        # minka_sekishu：苔石灯笼 + 丰富庭院灌木与开花盆栽
        b.stone_lantern((eng_x0 + 0.65, -D / 2.0 - 1.55, 0.0), scale=1.12, mossy=True)
        b.potted_plant((eng_x0 + 1.25, -D / 2.0 - 1.65, 0.0), scale=1.05, pot_col='#a4563a', leaf_col='#4c8832', seed=seed + 11)
        b.potted_plant((eng_x0 + 1.85, -D / 2.0 - 1.55, 0.0), scale=0.90, pot_col='#8c503a', leaf_col='#5c943c', seed=seed + 12)
        b.potted_plant((gx - gw / 2.0 - 0.25, -D / 2.0 - 1.38, 0.0), scale=1.35, pot_col='#6e4636', leaf_col='#468030', seed=seed + 13)
        b.potted_plant((gx - gw / 2.0 + 0.15, -D / 2.0 - 1.72, 0.0), scale=0.85, pot_col='#e0ded6', leaf_col='#4c8434', flower_col='#c896dc', seed=seed + 14)
        b.potted_plant((gx - gw / 2.0 + 0.58, -D / 2.0 - 1.62, 0.0), scale=0.95, pot_col='#a85c3e', leaf_col='#548c38', flower_col='#e676a0', seed=seed + 15)
    else:
        # minka_gray / minka_navy
        b.stone_lantern((-W / 2.0 - 0.55, -D / 2.0 - 0.85, 0.0), scale=1.05, mossy=False)
        for k, (px, py, sc, fc) in enumerate([
            (-W / 2.0 - 0.85, -D / 2.0 - 0.35, 0.85, '#e8788a' if flowers else None),
            (-W / 2.0 - 0.92, -D / 2.0 + 0.05, 1.05, None),
            (-W / 2.0 - 0.80, -D / 2.0 - 0.72, 0.78, '#f0c44c' if flowers else None),
            (gx - gw / 2.0 - 0.32, g_front - 0.15, 0.92, '#e86862' if flowers else None),
        ]):
            b.potted_plant((px, py, 0.0), scale=sc, pot_col='#a85c3c', leaf_col='#4a8434', flower_col=fc, seed=seed + 20 + k)

    return top


def build_minka(name, W, D, H, tile_key, seed, thatch=False, ac=False, laundry=False):
    b = B(seed)
    if thatch:
        top = minka_body(b, W, D, H, seed, foundation='boulder', lower_col=WOOD, upper_col=PLASTER_C,
                         tile_key='gray', thatch=True, ac=False, laundry=False, flowers=False)
        irimoya_thatch(b, W, D, top, ov=1.10)
    else:
        fnd = 'ashlar' if tile_key == 'sekishu' else 'concrete'
        low = WOOD_D if tile_key == 'navy' else (WOOD_M if tile_key == 'sekishu' else WOOD)
        upp = PLASTER_C if tile_key == 'sekishu' else PLASTER
        top = minka_body(b, W, D, H, seed, foundation=fnd, lower_col=low, upper_col=upp,
                         tile_key=tile_key, thatch=False, ac=ac, laundry=laundry, flowers=(tile_key == 'navy'))
        irimoya_tile(
            b, W, D, top, pitch=28.0, ov=1.12, tile_key=tile_key,
            gable_style='grid' if tile_key == 'gray' else 'louver',
            white_shikkui=(tile_key == 'navy'),
            gutter=True,
        )
    return b.finish(name, glow_color='#ffe4a8')


# ---------------- 土仓（对照 kura.png：妻入切妻黑瓦顶、三阶石梯、海参墙、白灰卷檐、双层小瓦庇） ----------------

def build_kura(name, seed=21):
    b = B(seed)
    W, D, H = 4.2, 4.8, 4.15
    fh = 0.56
    top = fh + H

    # 1) 粗切石基座（四面石块砌筑）+ 正面三级石阶
    b.box((0, 0, fh * 0.5), (W + 0.16, D + 0.16, fh), STONE_D)
    for sy in (-1, 1):
        n = 7
        for row in range(2):
            for i in range(n):
                bx = -W / 2.0 + (i + 0.5) * (W / n)
                if sy < 0 and abs(bx) < 0.90:
                    continue
                b.stone_block((bx, sy * (D / 2.0 + 0.08), 0.15 + row * 0.25), (W / n - 0.025, 0.16, 0.23), STONE_L if (i + row) % 2 else STONE, jitter=0.07, bevel=0.025)
    for sx in (-1, 1):
        n = 8
        for row in range(2):
            for i in range(n):
                by = -D / 2.0 + (i + 0.5) * (D / n)
                b.stone_block((sx * (W / 2.0 + 0.08), by, 0.15 + row * 0.25), (0.16, D / n - 0.025, 0.23), STONE if (i + row) % 2 else STONE_L, jitter=0.07, bevel=0.025)
    # 正面三级厚石台阶
    for st in range(3):
        sh = 0.18
        z_c = (2 - st) * sh + sh * 0.5
        y_c = -D / 2.0 - 0.22 - st * 0.28
        b.stone_block((0, y_c, z_c), (1.75 + st * 0.08, 0.34, sh), STONE_L, jitter=0.04, bevel=0.02)

    # 2) 主体厚白灰壁 + 下段海参墙（黑平瓦底 + 立体白漆喰菱形格子）
    b.box((0, 0, fh + H * 0.5), (W, D, H), PLASTER_W, jitter=0.01, grad=(1.0, 0.90))
    nh = 1.48  # 海参墙高度
    # 上下白灰收边线脚
    b.box((0, 0, fh + 0.04), (W + 0.10, D + 0.10, 0.08), PLASTER_W)
    b.box((0, 0, fh + nh + 0.04), (W + 0.12, D + 0.12, 0.09), PLASTER_W)
    # 黑色平瓦底板（正面中间留开门洞）
    b.box((0, 0, fh + nh * 0.5), (W + 0.04, D + 0.04, nh), '#23252a')

    # 四面立体海参墙菱格（严格裁在墙面范围里，绝不伸出转角！）
    def namako_panel(x0, x1, y_fixed, normal_sign, along_x=True):
        L = abs(x1 - x0)
        z_lo, z_hi = fh + 0.06, fh + nh - 0.02
        pitch = 0.44
        # 斜 45 度网格线：t = s ± (z - z_lo)
        n_diag = int((L + (z_hi - z_lo)) / pitch) + 2
        for k in range(-n_diag, n_diag + 1):
            # 正斜率线：s(z) = k*pitch + (z - z_lo)
            for slope in (1.0, -1.0):
                # 求直线与矩形 [0, L] x [z_lo, z_hi] 的交点
                pts_hit = []
                # z = z_lo / z_hi
                for zz in (z_lo, z_hi):
                    ss = k * pitch + slope * (zz - z_lo)
                    if -1e-4 <= ss <= L + 1e-4:
                        pts_hit.append((ss, zz))
                # s = 0 / L
                for ss in (0.0, L):
                    zz = z_lo + (ss - k * pitch) / slope
                    if z_lo + 1e-4 < zz < z_hi - 1e-4:
                        pts_hit.append((ss, zz))
                if len(pts_hit) >= 2:
                    pts_hit.sort()
                    (s0, zz0), (s1, zz1) = pts_hit[0], pts_hit[-1]
                    if math.hypot(s1 - s0, zz1 - zz0) < 0.08:
                        continue
                    if along_x:
                        pa = (x0 + s0, y_fixed + normal_sign * 0.035, zz0)
                        pb = (x0 + s1, y_fixed + normal_sign * 0.035, zz1)
                    else:
                        pa = (y_fixed + normal_sign * 0.035, x0 + s0, zz0)
                        pb = (y_fixed + normal_sign * 0.035, x0 + s1, zz1)
                    b.seg(pa, pb, 0.052, 0.042, PLASTER_W)
        # 左右竖白边框
        for s_edge in (0.02, L - 0.02):
            if along_x:
                b.seg((x0 + s_edge, y_fixed + normal_sign * 0.035, z_lo), (x0 + s_edge, y_fixed + normal_sign * 0.035, z_hi), 0.06, 0.05, PLASTER_W)
            else:
                b.seg((y_fixed + normal_sign * 0.035, x0 + s_edge, z_lo), (y_fixed + normal_sign * 0.035, x0 + s_edge, z_hi), 0.06, 0.05, PLASTER_W)

    # 正面门洞两侧的海参墙
    namako_panel(-W / 2.0 + 0.04, -0.84, -D / 2.0 - 0.02, -1, along_x=True)
    namako_panel(0.84, W / 2.0 - 0.04, -D / 2.0 - 0.02, -1, along_x=True)
    # 背面和两侧全宽海参墙
    namako_panel(-W / 2.0 + 0.04, W / 2.0 - 0.04, D / 2.0 + 0.02, 1, along_x=True)
    namako_panel(-D / 2.0 + 0.04, D / 2.0 - 0.04, -W / 2.0 - 0.02, -1, along_x=False)
    namako_panel(-D / 2.0 + 0.04, D / 2.0 - 0.04, W / 2.0 + 0.02, 1, along_x=False)

    # 3) 阶梯状白灰涂笼檐口（蛇腹檐 / 鉢巻）
    for tier, (dw, dz) in enumerate([(0.16, 0.14), (0.34, 0.14), (0.50, 0.12)]):
        b.box((0, 0, top - 0.28 + tier * 0.13), (W + dw, D + dw, dz), PLASTER_W if tier != 1 else PLASTER)

    # 4) 妻入厚黑瓦切妻顶（屋脊沿 Y 轴，山墙朝正面 -Y，完全还原 kura.png！）
    pal = TILE_PAL['black']
    ov_x = 0.62
    ov_y = 0.56
    pitch = 35.0
    tanp = math.tan(math.radians(pitch))
    X = W / 2.0 + ov_x
    Y = D / 2.0 + ov_y
    z_eave = top + 0.04
    zt = z_eave + X * tanp
    # 左右两坡
    b.tile_slope(
        (-X, -Y, z_eave), (-X, Y, z_eave), (0, -Y, zt), (0, Y, zt),
        pal, sag=0.10, corner_lift=0.05, col_spacing=0.28, row_spacing=0.34,
        wave_amp=0.034, step_h=0.028, thick=0.14, soffit_col=PLASTER_S,
    )
    b.tile_slope(
        (X, Y, z_eave), (X, -Y, z_eave), (0, Y, zt), (0, -Y, zt),
        pal, sag=0.10, corner_lift=0.05, col_spacing=0.28, row_spacing=0.34,
        wave_amp=0.034, step_h=0.028, thick=0.14, soffit_col=PLASTER_S,
    )
    # 前后白灰三角形山墙 + 阶梯白灰山墙檐线（挂瓦漆喰装饰）
    for sy in (-1, 1):
        y = sy * (D / 2.0)
        z_g = z_eave + (W / 2.0) * tanp
        b.poly([(-W / 2.0, y, top - 0.02), (W / 2.0, y, top - 0.02), (0, y, z_g + 0.04)],
               [(0, 1, 2) if sy < 0 else (2, 1, 0)], PLASTER_W)
        # 山墙斜向阶梯白漆喰包边
        for tier_off, thk in ((0.0, 0.16), (0.14, 0.12)):
            for sx in (-1, 1):
                b.seg(
                    (sx * (W / 2.0 + 0.25 + tier_off), y + sy * (0.12 + tier_off * 1.4), z_eave - 0.06),
                    (0, y + sy * (0.12 + tier_off * 1.4), zt - 0.14 + tier_off * 0.2),
                    0.12, thk, PLASTER_W if tier_off == 0 else PLASTER,
                )
    # 厚重正脊（带醒目白漆喰腰带 + 大鬼瓦）
    b.box((0, 0, zt + 0.10), (0.34, 2.0 * Y + 0.08, 0.16), PLASTER_W)
    b.box((0, 0, zt + 0.26), (0.38, 2.0 * Y + 0.16, 0.16), pal[2])
    b.cyl((0, 0, zt + 0.36), 0.11, 2.0 * Y + 0.22, pal[1], seg=8, axis='Y')
    for sy in (-1, 1):
        b.onigawara((0, sy * (Y + 0.12), zt + 0.04), (0, sy, 0), 0.60, pal[2], trim=PLASTER_W)

    # 5) 正面深凹观音开黑漆铁门 + 木撑小黑瓦门庇（hisashi）
    y_f = -D / 2.0
    # 阶梯白灰门框（三层阶梯内凹）
    for tier, (mw, mh, dy) in enumerate([(1.64, 2.18, 0.08), (1.46, 2.04, 0.04), (1.30, 1.92, -0.02)]):
        # 左右门柱 + 门楣
        for sx in (-1, 1):
            b.box((sx * (mw * 0.5 - 0.06), y_f - dy, fh + mh * 0.5), (0.12, 0.14, mh), PLASTER_W if tier == 0 else PLASTER_S)
        b.box((0, y_f - dy, fh + mh - 0.06), (mw, 0.14, 0.12), PLASTER_W if tier == 0 else PLASTER_S)
    # 双开黑铁厚大门 + 门环拉手
    b.box((0, y_f - 0.01, fh + 0.94), (1.20, 0.08, 1.84), '#1c1e22')
    for sx in (-1, 1):
        b.box((sx * 0.29, y_f - 0.05, fh + 0.94), (0.50, 0.04, 1.72), '#26282e')
        b.cyl((sx * 0.12, y_f - 0.085, fh + 0.98), 0.055, 0.025, '#4c4e54', seg=10, axis='Y')
    # 门庇小黑瓦顶 + 两个木撑臂
    hz_top = fh + 2.54
    hz_bot = fh + 2.14
    b.tile_slope(
        (-1.12, y_f - 0.78, hz_bot), (1.12, y_f - 0.78, hz_bot),
        (-1.12, y_f + 0.02, hz_top), (1.12, y_f + 0.02, hz_top),
        pal, sag=0.04, col_spacing=0.25, row_spacing=0.26, wave_amp=0.026, step_h=0.022, thick=0.08, soffit_col=WOOD_D,
    )
    for sx in (-1, 1):
        bx = sx * 0.88
        b.seg((bx, y_f - 0.02, hz_bot - 0.04), (bx, y_f - 0.70, hz_bot - 0.04), 0.09, 0.09, WOOD_D)
        b.seg((bx, y_f - 0.02, hz_bot - 0.58), (bx, y_f - 0.56, hz_bot - 0.05), 0.08, 0.08, WOOD_D)
        b.box((bx, y_f - 0.04, hz_bot - 0.34), (0.09, 0.08, 0.62), WOOD_D)

    # 6) 二层小防火土门窗 + 迷你黑瓦雨庇
    wz = fh + 3.22
    for tier, (ww, wh, dy) in enumerate([(0.92, 1.02, 0.07), (0.76, 0.86, 0.02)]):
        for sx in (-1, 1):
            b.box((sx * (ww * 0.5 - 0.05), y_f - dy, wz), (0.10, 0.12, wh), PLASTER_W if tier == 0 else PLASTER_S)
        for sz in (-1, 1):
            b.box((0, y_f - dy, wz + sz * (wh * 0.5 - 0.05)), (ww, 0.12, 0.10), PLASTER_W if tier == 0 else PLASTER_S)
    b.box((0, y_f + 0.02, wz), (0.64, 0.06, 0.74), '#1a1c20')
    # 窗顶小瓦庇 + 撑臂
    b.tile_slope(
        (-0.68, y_f - 0.44, wz + 0.50), (0.68, y_f - 0.44, wz + 0.50),
        (-0.68, y_f + 0.02, wz + 0.74), (0.68, y_f + 0.02, wz + 0.74),
        pal, sag=0.02, col_spacing=0.22, row_spacing=0.22, wave_amp=0.022, step_h=0.018, thick=0.06, soffit_col=WOOD_D,
    )
    for sx in (-1, 1):
        bx = sx * 0.50
        b.seg((bx, y_f - 0.02, wz + 0.16), (bx, y_f - 0.36, wz + 0.48), 0.06, 0.06, WOOD_D)

    return b.finish(name)


# ---------------- 蓝/红铁皮农具棚（对照 shed_blue.png / shed_red.png） ----------------

def build_shed(name, seed, wall_col='#5c7b96', roof_col='#a2603c', variant='blue'):
    b = B(seed)
    rnd = random.Random(seed)
    W, D, H = 4.8, 3.8, 2.65
    ridge_h = 1.05
    zt = H + ridge_h

    # 1) 地坪与混凝土基脚墩
    b.box((0, 0, 0.04), (W + 0.24, D + 0.24, 0.08), '#b8ae9c', jitter=0.06)
    # 三面墙底混凝土矮坎
    b.box((0, D / 2.0, 0.10), (W + 0.12, 0.18, 0.20), CONCRETE_D, jitter=0.04)
    for sx in (-1, 1):
        b.box((sx * (W / 2.0), 0.0, 0.10), (0.18, D + 0.12, 0.20), CONCRETE_D, jitter=0.04)
        # 前面两根门柱的锥形混凝土柱墩
        b.box((sx * (W / 2.0), -D / 2.0, 0.16), (0.30, 0.30, 0.32), CONCRETE, top=(0.72, 0.72), jitter=0.05)

    # 2) 外露木骨架（角柱、中柱、横檩、斜撑、正面及中部人字形屋架桁架！）
    wood_weath = '#847462' if variant == 'blue' else '#6c5a46'
    wood_dark = '#5c4e40' if variant == 'blue' else '#4a3c2e'
    # 竖柱（前2、中2、后3）
    for sx in (-1, 1):
        for y in (-D / 2.0, 0.0, D / 2.0):
            b.box((sx * (W / 2.0 - 0.04), y, 0.12 + (H - 0.12) * 0.5), (0.14, 0.14, H - 0.12), wood_weath, jitter=0.05)
    b.box((0, D / 2.0 - 0.04, 0.12 + (H - 0.12) * 0.5), (0.13, 0.13, H - 0.12), wood_weath, jitter=0.05)

    # 侧墙与背墙的横向穿枋（3 道）+ 斜拉支撑
    for hz in (0.72, 1.58, H - 0.07):
        b.box((0, D / 2.0 - 0.05, hz), (W - 0.1, 0.08, 0.10), wood_dark)
        for sx in (-1, 1):
            b.box((sx * (W / 2.0 - 0.05), 0.0, hz), (0.08, D - 0.1, 0.10), wood_dark)
    # 侧墙内斜撑（筋交い）
    b.seg((-W / 2.0 + 0.08, -D / 2.0 + 0.08, H - 0.12), (-W / 2.0 + 0.08, 0.0, 0.25), 0.05, 0.05, IRON)
    b.seg((W / 2.0 - 0.08, 0.0, 0.25), (W / 2.0 - 0.08, D / 2.0 - 0.08, H - 0.12), 0.06, 0.06, wood_dark)

    # 人字形木屋架（正面开口、中间、背面共 3 榀，正面最显眼！）
    for ty in (-D / 2.0 + 0.05, 0.0, D / 2.0 - 0.05):
        b.box((0, ty, H - 0.06), (W + 0.08, 0.12, 0.15), wood_weath)  # 主横梁
        b.box((0, ty, H + ridge_h * 0.5), (0.12, 0.11, ridge_h), wood_weath)  # 中央真束（king post）
        for sx in (-1, 1):
            # 主斜梁（合掌，严格压在波纹铁皮屋面下方 8cm，绝不穿模！）
            b.seg((sx * (W / 2.0 + 0.42), ty, H - 0.25), (0, ty, zt - 0.09), 0.10, 0.11, wood_weath)
            # 桁架斜撑
            b.seg((0, ty, H + 0.04), (sx * (W * 0.24), ty, H + ridge_h * 0.44), 0.085, 0.085, wood_dark)
            b.seg((sx * (W * 0.30), ty, H), (sx * (W * 0.30), ty, H + ridge_h * 0.32), 0.08, 0.08, wood_dark)
            # 角柱八字撑（頬杖）
            b.seg((sx * (W / 2.0 - 0.06), ty, H - 0.65), (sx * (W / 2.0 - 0.62), ty, H - 0.08), 0.09, 0.09, wood_weath)
    # 屋面纵向檩条（母屋，严格压低收在波纹铁皮屋面下方，绝不穿出！）
    for frac in (0.0, 0.45, 0.90):
        for sx in (-1, 1):
            if frac == 0.0 and sx == 1:
                continue
            px = sx * (W / 2.0) * frac
            pz = zt - ridge_h * frac - 0.16
            b.box((px, 0, pz), (0.08, D + 0.62, 0.08), wood_dark)

    # 3) 真正的波纹铁皮墙（左右 + 背面 + 背面山墙三角）
    rust = '#7c482c'
    b.corrugated_wall((-W / 2.0, D / 2.0), (W / 2.0, D / 2.0), 0.16, H - 0.02, (0, 1), wall_col, rust_color=rust, pitch=0.18, amp=0.024, rust_bot=0.35)
    b.corrugated_wall((-W / 2.0, -D / 2.0), (-W / 2.0, D / 2.0), 0.16, H - 0.02, (-1, 0), wall_col, rust_color=rust, pitch=0.18, amp=0.024, rust_bot=0.35)
    b.corrugated_wall((W / 2.0, -D / 2.0), (W / 2.0, D / 2.0), 0.16, H - 0.02, (1, 0), wall_col, rust_color=rust, pitch=0.18, amp=0.024, rust_bot=0.35)
    # 背面山墙三角铁皮封板（双面）
    b.double_poly([(-W / 2.0, D / 2.0 + 0.01, H), (W / 2.0, D / 2.0 + 0.01, H), (0, D / 2.0 + 0.01, zt)], [(0, 1, 2)], wall_col, back_darken=0.82)

    # 4) 波纹锈蚀铁皮两坡顶（左右倾斜，坡面沿 X 方向，波纹顺坡向！）
    ov_x = 0.55
    ov_y = 0.42
    X = W / 2.0 + ov_x
    Y = D / 2.0 + ov_y
    tanp = ridge_h / (W / 2.0)
    z_eave = zt - X * tanp
    c_r_main = srgb(roof_col)
    c_r_rust = srgb('#783c20' if variant == 'blue' else '#6a4a3a')
    c_r_hi = srgb('#c68256' if variant == 'blue' else '#b2624c')

    def tin_slope(p0, p1, q0, q1):
        """波纹铁皮屋面（带两面厚度、锈斑与明暗波纹）"""
        p0, p1, q0, q1 = map(Vector, (p0, p1, q0, q1))
        nrm = (p1 - p0).cross(q0 - p0).normalized()
        if nrm.z < 0:
            nrm = -nrm
            p0, p1 = p1, p0
            q0, q1 = q1, q0
        L_eave = (p1 - p0).length
        n_w = max(10, int(L_eave / 0.18))
        u_steps = n_w * 2
        v_steps = 4
        for side, flip in ((0.015, False), (-0.015, True)):
            verts, vcs = [], []
            for iv in range(v_steps + 1):
                v = iv / v_steps
                for iu in range(u_steps + 1):
                    u = iu / u_steps
                    pt = p0.lerp(p1, u).lerp(q0.lerp(q1, u), v)
                    w = (0.022 if iu % 2 == 0 else -0.022)
                    verts.append(pt + nrm * (side + w))
                    patch = 0.5 + 0.5 * math.sin(u * 13.0 + v * 7.0) * math.cos(u * 5.0 - v * 11.0)
                    col = lerp_col(c_r_main, c_r_rust if patch > 0.55 else c_r_hi, abs(patch - 0.5) * 1.3)
                    col = mul_col(col, (1.06 if iu % 2 == 0 else 0.86) * (0.68 if flip else 1.0))
                    vcs.append(col)
            gw = u_steps + 1
            faces = []
            for iv in range(v_steps):
                for iu in range(u_steps):
                    i0 = iv * gw + iu
                    faces.append((i0, i0 + gw, i0 + gw + 1, i0 + 1) if flip else (i0, i0 + 1, i0 + gw + 1, i0 + gw))
            b.poly(verts, faces, None, vert_colors=vcs)

    tin_slope((-X, -Y, z_eave), (-X, Y, z_eave), (0, -Y, zt + 0.04), (0, Y, zt + 0.04))
    tin_slope((X, Y, z_eave), (X, -Y, z_eave), (0, Y, zt + 0.04), (0, -Y, zt + 0.04))
    # 屋脊铁皮压帽
    b.box((0, 0, zt + 0.08), (0.28, 2.0 * Y + 0.06, 0.06), mul_col(roof_col, 0.85))
    # 两侧雨樋与落水管
    for sx in (-1, 1):
        gx = sx * (X + 0.03)
        b.gutter_run(
            (gx, -Y, z_eave - 0.05), (gx, Y, z_eave - 0.05),
            drop_at=((gx, Y - 0.18, z_eave - 0.05), (sx * (W / 2.0 + 0.06), D / 2.0 - 0.12, z_eave - 0.05)),
            color=IRON,
        )

    # 5) 棚内丰富农具与杂物（分别还原 shed_blue.png 和 shed_red.png！）
    def crate(cx, cy, cz, w=0.82, d=0.56, h=0.46, rot=0.0):
        b.box((cx, cy, cz + h * 0.5), (w, d, h), WOOD_L, rot=rot, jitter=0.06)
        b.box((cx, cy, cz + h * 0.5), (w - 0.06, d + 0.02, h - 0.10), WOOD_M, rot=rot)
        for kz in (-0.14, 0.0, 0.14):
            b.box((cx, cy, cz + h * 0.5 + kz), (w + 0.02, d + 0.025, 0.07), WOOD_W, rot=rot, jitter=0.05)

    def basket(cx, cy, cz, col='#3a78b4', rot=0.0, tilt=0.0):
        b.box_rot((cx, cy, cz + 0.14), (0.58, 0.42, 0.28), (tilt, 0, rot), col, top=(1.10, 1.10), jitter=0.04)
        b.box_rot((cx, cy, cz + 0.26), (0.52, 0.36, 0.06), (tilt, 0, rot), mul_col(col, 0.65))

    def shovel_and_rake(sx, sy):
        # 靠墙斜放铁锹
        b.seg((sx, sy - 0.18, 0.42), (sx + 0.10, sy + 0.16, 1.52), 0.04, 0.04, WOOD_L)
        b.box((sx - 0.02, sy - 0.22, 0.24), (0.24, 0.04, 0.34), STEEL, top=(0.8, 1.0))
        b.box((sx + 0.10, sy + 0.16, 1.54), (0.14, 0.04, 0.04), WOOD_D)
        # 靠墙斜放耙子
        rx = sx + 0.34
        b.seg((rx, sy - 0.14, 0.38), (rx + 0.12, sy + 0.18, 1.62), 0.036, 0.036, WOOD_W)
        b.box((rx, sy - 0.16, 0.22), (0.36, 0.04, 0.05), IRON)
        for t in range(7):
            b.seg((rx - 0.15 + t * 0.05, sy - 0.16, 0.22), (rx - 0.18 + t * 0.06, sy - 0.20, 0.06), 0.015, 0.015, IRON_D)

    if variant == 'blue':
        # 左侧两只叠放木板箱
        crate(-1.55, -0.45, 0.08, 0.86, 0.60, 0.46, rot=0.05)
        crate(-1.52, -0.42, 0.54, 0.82, 0.56, 0.44, rot=-0.04)
        # 中左叠放 4 只蓝色收获塑料筐
        for k in range(3):
            basket(-0.62, -0.42, 0.08 + k * 0.22, '#3c7eb8', rot=0.06 * k)
        basket(-0.58, -0.40, 0.74, '#4c8ec8', rot=0.18, tilt=0.18)
        # 后中柔和垂挂的蓝色防雨苫布堆（用软起伏褶皱代替生硬梯形盒）
        b.sphere((0.12, 0.72, 0.44), 0.58, '#2c6cc2', sub=2, scale=(1.15, 0.95, 0.72), smooth=False, jitter=0.06)
        b.box((0.12, 0.72, 0.22), (1.16, 0.92, 0.30), '#245aa6', top=(0.86, 0.86), jitter=0.04)
        # 右前叠放 4 袋鼓鼓的麻袋米包（往前移以便清楚看到！）
        for k in range(4):
            b.sphere((1.42 + (k % 2) * 0.05, -0.68 + (k % 2) * 0.06, 0.19 + k * 0.22), 0.34, '#d2bb88', sub=1, scale=(1.25, 1.50, 0.42), smooth=False, jitter=0.07)
        shovel_and_rake(0.78, 1.38)
    else:
        # shed_red：木板堆、橙黄收获筐、绿色盘绕水管、农具
        crate(-1.55, 0.55, 0.08, 0.84, 0.58, 0.48, rot=0.04)
        crate(-0.65, 0.95, 0.08, 0.82, 0.56, 0.52, rot=-0.03)
        # 橙色和黄色收获筐
        basket(-0.78, -0.25, 0.08, '#e06e28', rot=0.15)
        basket(-0.74, -0.20, 0.34, '#eb7e32', rot=-0.12, tilt=0.22)
        basket(0.28, 0.78, 0.08, '#dfa82c', rot=0.03)
        basket(0.28, 0.78, 0.34, '#e8b638', rot=-0.04)
        # 整齐堆放的木板条 + 左前散放木板
        for k in range(5):
            b.box((0.68, -0.10, 0.12 + k * 0.085), (1.75, 0.52, 0.07), WOOD_W if k % 2 else WOOD_L, jitter=0.05)
        for k in range(3):
            b.box((-1.35 + k * 0.18, -0.95, 0.11 + (k == 2) * 0.05), (1.15, 0.18, 0.05), WOOD_W, rot=0.12 + k * 0.08)
        # 地面盘绕的绿色橡胶水管
        for r_ring, zh in ((0.30, 0.12), (0.25, 0.16), (0.20, 0.20)):
            pts_h = [Vector((0.65 + math.cos(a) * r_ring, -0.82 + math.sin(a) * r_ring * 0.85, zh)) for a in [i * math.tau / 12.0 for i in range(13)]]
            b.tube(pts_h, 0.028, '#2c8a4c', seg=5, smooth=True)
        shovel_and_rake(1.45, -0.55)

    return b.finish(name)
