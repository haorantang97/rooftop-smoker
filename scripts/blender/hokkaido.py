# 「北海道冬日海边小镇」高细节 3D 模型生成主脚本（Blender 5.2 Python 后台运行）
# 跑法：
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/blender/hokkaido.py -- web/public/vista-models/hokkaido .tmp/previews/hokkaido [--only name1,name2]
import bpy, sys, os, json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from vista_common import finish_export_multi
from hokkaido_buildings import (
    build_house_red, build_house_blue, build_house_green, build_house_flat,
    build_barn, build_station,
)
from hokkaido_rail_port import (
    build_train, build_crossing, build_pole_hk, build_boat, build_lighthouse, build_vending_snow,
)
from hokkaido_nature import build_todomatsu, build_birch, build_larch

BG_WINTER = '#96a2b2'  # 偏冷中灰蓝棚拍背景，便于清晰检查白雪轮廓与积雪边缘


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
    out_dir = pos[0] if len(pos) > 0 else 'web/public/vista-models/hokkaido'
    prev_dir = pos[1] if len(pos) > 1 else None
    return out_dir, prev_dir, only


def run():
    out_dir, prev_dir, only = parse_args()
    os.makedirs(out_dir, exist_ok=True)
    if prev_dir:
        os.makedirs(prev_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)

    jobs = [
        # 4 款北海道两层房（红/蓝/绿人字雪顶 + 无落雪平顶）
        ('house_red',     30000, ( 1.05, -1.55, 0.65), lambda: build_house_red('house_red', 101)),
        ('house_blue',    30000, ( 1.05, -1.55, 0.65), lambda: build_house_blue('house_blue', 102)),
        ('house_green',   30000, (-1.05, -1.55, 0.65), lambda: build_house_green('house_green', 103)),
        ('house_flat',    30000, ( 1.05, -1.55, 0.65), lambda: build_house_flat('house_flat', 104)),
        # 红谷仓 + 圆筒筒仓、无人小车站
        ('barn',          20000, (-1.05, -1.55, 0.62), lambda: build_barn('barn', 105)),
        ('station',       20000, ( 0.95, -1.55, 0.58), lambda: build_station('station', 106)),
        # 单厢柴油车、铁路道口（含独立子物体 arm）
        ('train',         20000, (-1.10, -1.45, 0.42), lambda: build_train('train', 111)),
        ('crossing',       5000, (-0.75, -1.65, 0.35), lambda: build_crossing('crossing', 112)),
        # 电线杆（普通 + 路灯款）、渔船、红白灯塔、落雪贩卖机
        ('pole',           5000, ( 0.80, -1.60, 0.25), lambda: build_pole_hk('pole', 113, lamp=False)),
        ('pole_lamp',      5000, ( 0.95, -1.50, 0.25), lambda: build_pole_hk('pole_lamp', 114, lamp=True)),
        ('boat',           5000, (-1.15, -1.45, 0.62), lambda: build_boat('boat', 115)),
        ('lighthouse',     5000, ( 0.72, -1.65, 0.30), lambda: build_lighthouse('lighthouse', 116)),
        ('vending_snow',   5000, ( 0.85, -1.65, 0.26), lambda: build_vending_snow('vending_snow', 117)),
        # 冬季树木（英雄版 + 远景 _lo 版）
        ('todomatsu',     12000, (-0.35, -1.75, 0.16), lambda: build_todomatsu('todomatsu', 121, lo=False)),
        ('todomatsu_lo',   1500, (-0.35, -1.75, 0.16), lambda: build_todomatsu('todomatsu_lo', 121, lo=True)),
        ('birch',         12000, (-0.35, -1.75, 0.16), lambda: build_birch('birch', 122, lo=False)),
        ('birch_lo',       1500, (-0.35, -1.75, 0.16), lambda: build_birch('birch_lo', 122, lo=True)),
        ('larch',         12000, (-0.35, -1.75, 0.16), lambda: build_larch('larch', 123, lo=False)),
        ('larch_lo',       1500, (-0.35, -1.75, 0.16), lambda: build_larch('larch_lo', 123, lo=True)),
    ]

    results = []
    over_budget = []
    for name, budget, cam_dir, fn in jobs:
        if only and name not in only:
            continue
        objs = fn()
        info = finish_export_multi(objs, name, out_dir, prev_dir, cam_dir=cam_dir, bg_color=BG_WINTER)
        info['budget'] = budget
        info['ok'] = info['tris'] <= budget
        results.append(info)
        if not info['ok']:
            over_budget.append(info)

    print('\n=== HOKKAIDO SUMMARY ===')
    for r in results:
        flag = 'OK' if r['ok'] else 'OVER!'
        print(f"  {r['name']:18s}  {r['tris']:6d} / {r['budget']:6d} tris  {flag:5s}  size={r['size']}  minZ={r['min_z']:.3f}")
    if prev_dir:
        with open(os.path.join(prev_dir, 'stats.json'), 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
    if over_budget:
        print('WARNING OVER BUDGET:', [r['name'] for r in over_budget])


if __name__ == '__main__':
    run()
