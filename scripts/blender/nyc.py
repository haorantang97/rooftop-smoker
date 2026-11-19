# 「纽约大都会（俯瞰曼哈顿中城）」高细节 3D 模型生成主脚本（Blender 5.2 Python 后台运行）
# 跑法：
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/blender/nyc.py -- web/public/vista-models/nyc .tmp/previews/nyc [--only name1,name2]
import bpy, sys, os, json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from vista_common import finish_export_multi
from nyc_towers import (
    build_deco_tower, build_crown_tower, build_supertall,
    build_slant_tower, build_pencil_tower, build_pyramid_tower,
)
from nyc_structures import (
    build_bridge_tower_stone, build_bridge_tower_steel,
    build_water_tower, build_rooftop_set,
)

BG_NYC = '#8894a6'


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
    out_dir = pos[0] if len(pos) > 0 else 'web/public/vista-models/nyc'
    prev_dir = pos[1] if len(pos) > 1 else None
    return out_dir, prev_dir, only


def run():
    out_dir, prev_dir, only = parse_args()
    os.makedirs(out_dir, exist_ok=True)
    if prev_dir:
        os.makedirs(prev_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)

    jobs = [
        # 6 座纽约地标摩天楼（按真实米制尺度建模，每栋 <= 60,000 面）
        ('deco_tower',         60000, (-0.95, -1.55, 0.38), lambda: build_deco_tower('deco_tower', 301)),
        ('crown_tower',        60000, (-1.00, -1.50, 0.42), lambda: build_crown_tower('crown_tower', 302)),
        ('supertall',          60000, (-0.95, -1.55, 0.35), lambda: build_supertall('supertall', 303)),
        ('slant_tower',        60000, (-1.05, -1.45, 0.40), lambda: build_slant_tower('slant_tower', 304)),
        ('pencil_tower',       60000, (-0.95, -1.55, 0.30), lambda: build_pencil_tower('pencil_tower', 305)),
        ('pyramid_tower',      60000, (-1.00, -1.50, 0.42), lambda: build_pyramid_tower('pyramid_tower', 306)),
        # 2 座东河悬索桥桥塔（石砌哥特尖拱 / 钢结构，~90m 高 × 40m 宽）
        ('bridge_tower_stone', 20000, (-0.70, -1.65, 0.26), lambda: build_bridge_tower_stone('bridge_tower_stone', 311)),
        ('bridge_tower_steel', 20000, (-1.05, -1.50, 0.36), lambda: build_bridge_tower_steel('bridge_tower_steel', 312)),
        # 屋顶木水箱 & 屋顶机械设备一组
        ('water_tower',         3000, (-0.85, -1.60, 0.28), lambda: build_water_tower('water_tower', 313)),
        ('rooftop_set',         5000, (-1.05, -1.50, 0.68), lambda: build_rooftop_set('rooftop_set', 314)),
    ]

    results = []
    over_budget = []
    for name, budget, cam_dir, fn in jobs:
        if only and name not in only:
            continue
        objs = fn()
        info = finish_export_multi(objs, name, out_dir, prev_dir, cam_dir=cam_dir, bg_color=BG_NYC)
        info['budget'] = budget
        info['ok'] = info['tris'] <= budget
        results.append(info)
        if not info['ok']:
            over_budget.append(info)

    print('\n=== NYC SUMMARY ===')
    for r in results:
        flag = 'OK' if r['ok'] else 'OVER!'
        print(f"  {r['name']:20s}  {r['tris']:6d} / {r['budget']:6d} tris  {flag:5s}  size={r['size']}  minZ={r['min_z']:.3f}")
    if prev_dir:
        with open(os.path.join(prev_dir, 'stats.json'), 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
    if over_budget:
        print('WARNING OVER BUDGET:', [r['name'] for r in over_budget])


if __name__ == '__main__':
    run()
