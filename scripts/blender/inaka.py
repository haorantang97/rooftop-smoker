# 「夏日乡间」远景高细节 3D 模型生成主脚本（Blender 5.2 Python 后台运行）
# 跑法：
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/blender/inaka.py -- web/public/vista-models/inaka [.tmp/previews] [--only name1,name2]
# 约定：Blender Z 朝上、正面朝 -Y、单位米、底面落在 z=0、原点在底面中心；
# 仅使用两种材质 body（顶点颜色 Color）与 glow（夜里发光），不带贴图。
import bpy, sys, os, json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from inaka_core import finish_export
from inaka_houses import build_minka, build_kura, build_shed
from inaka_props import build_pole, build_vending, build_mirror, build_busstop, build_shrine
from inaka_flora import build_keyaki, build_oak, build_maple, build_cedar, build_bamboo, build_sunflower


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    only = None
    pos = []
    i = 0
    while i < len(argv):
        if argv[i] == '--only' and i + 1 < len(argv):
            only = set(x.strip() for x in argv[i + 1].split(',') if x.strip())
            i += 2
        else:
            pos.append(argv[i])
            i += 1
    out_dir = pos[0] if len(pos) > 0 else 'web/public/vista-models/inaka'
    prev_dir = pos[1] if len(pos) > 1 else None
    return out_dir, prev_dir, only


def run():
    out_dir, prev_dir, only = parse_args()
    os.makedirs(out_dir, exist_ok=True)
    if prev_dir:
        os.makedirs(prev_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)

    # (模型名, 三角面预算, 预览相机方向, 构建函数)
    jobs = [
        # 4 种传统民房
        ('minka_gray',     30000, (-1.15, -1.55, 0.72), lambda: build_minka('minka_gray',    11.0, 7.2, 2.75, 'gray',    3,  laundry=True)),
        ('minka_sekishu',  30000, (-1.15, -1.55, 0.72), lambda: build_minka('minka_sekishu', 10.2, 7.0, 2.75, 'sekishu', 5,  ac=True)),
        ('minka_navy',     30000, (-1.15, -1.55, 0.72), lambda: build_minka('minka_navy',     9.4, 6.5, 2.65, 'navy',    9,  laundry=True)),
        ('minka_thatch',   30000, (-1.15, -1.55, 0.72), lambda: build_minka('minka_thatch',  11.8, 7.8, 2.65, 'gray',    13, thatch=True)),
        # 土仓与铁皮农具棚
        ('kura',           30000, ( 1.05, -1.50, 0.52), lambda: build_kura('kura', 21)),
        ('shed_blue',      30000, ( 1.05, -1.55, 0.42), lambda: build_shed('shed_blue', 23, wall_col='#5c7b96', roof_col='#a2603c', variant='blue')),
        ('shed_red',       30000, (-1.05, -1.55, 0.42), lambda: build_shed('shed_red',  24, wall_col='#8e3d32', roof_col='#924c3e', variant='red')),
        # 水泥电线杆（普通 / 变压器 / 路灯）
        ('pole',            5000, ( 0.75, -1.65, 0.25), lambda: build_pole('pole',      31)),
        ('pole_tr',         5000, ( 1.10, -1.35, 0.25), lambda: build_pole('pole_tr',   32, transformer=True)),
        ('pole_lamp',       5000, ( 0.95, -1.50, 0.25), lambda: build_pole('pole_lamp', 33, lamp=True)),
        # 自动贩卖机（红 / 蓝 / 白）
        ('vending_red',     5000, (-0.85, -1.65, 0.26), lambda: build_vending('vending_red',   41, style='red')),
        ('vending_blue',    5000, (-0.85, -1.65, 0.26), lambda: build_vending('vending_blue',  42, style='blue')),
        ('vending_white',   5000, (-0.85, -1.65, 0.26), lambda: build_vending('vending_white', 43, style='white')),
        # 反射镜、公交站、小神社
        ('mirror',          5000, ( 0.85, -1.60, 0.20), lambda: build_mirror('mirror',   51)),
        ('busstop',         5000, ( 0.95, -1.65, 0.40), lambda: build_busstop('busstop', 52)),
        ('shrine',          5000, (-1.28, -1.32, 0.72), lambda: build_shrine('shrine',   53)),
        # 英雄级植物与树木
        ('tree_keyaki',    15000, (-0.35, -1.75, 0.16), lambda: build_keyaki('tree_keyaki', 61, lo=False)),
        ('tree_oak',       15000, (-0.35, -1.75, 0.16), lambda: build_oak('tree_oak',       62, lo=False)),
        ('tree_maple',     15000, (-0.35, -1.75, 0.16), lambda: build_maple('tree_maple',   63)),
        ('tree_cedar',     15000, (-0.35, -1.75, 0.14), lambda: build_cedar('tree_cedar',   71, lo=False)),
        ('bamboo',         15000, (-0.35, -1.75, 0.14), lambda: build_bamboo('bamboo',      81)),
        ('sunflower',      15000, (-0.30, -1.75, 0.16), lambda: build_sunflower('sunflower', 91)),
        # 远景低面数 _lo 树
        ('tree_keyaki_lo',  1500, (-0.35, -1.75, 0.16), lambda: build_keyaki('tree_keyaki_lo', 61, lo=True)),
        ('tree_oak_lo',     1500, (-0.35, -1.75, 0.16), lambda: build_oak('tree_oak_lo',       62, lo=True)),
        ('tree_cedar_lo',   1500, (-0.35, -1.75, 0.14), lambda: build_cedar('tree_cedar_lo',   71, lo=True)),
    ]

    results = []
    over_budget = []
    for name, budget, cam_dir, fn in jobs:
        if only and name not in only:
            continue
        ob = fn()
        info = finish_export(ob, name, out_dir, prev_dir, cam_dir=cam_dir)
        info['budget'] = budget
        info['ok'] = info['tris'] <= budget
        results.append(info)
        if not info['ok']:
            over_budget.append(info)

    print('\n=== SUMMARY ===')
    for r in results:
        flag = 'OK' if r['ok'] else 'OVER!'
        print(f"  {r['name']:16s}  {r['tris']:6d} / {r['budget']:6d} tris  {flag:5s}  size={r['size']}  minZ={r['min_z']:.3f}")
    if prev_dir:
        with open(os.path.join(prev_dir, 'stats.json'), 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
    if over_budget:
        print('WARNING OVER BUDGET:', [r['name'] for r in over_budget])


if __name__ == '__main__':
    run()
