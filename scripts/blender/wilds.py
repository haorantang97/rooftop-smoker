# 「旷野星辰（美国西南高原荒漠）」高细节 3D 模型生成主脚本（Blender 5.2 Python 后台运行）
# 跑法：
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/blender/wilds.py -- web/public/vista-models/wilds .tmp/previews/wilds [--only name1,name2]
import bpy, sys, os, json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from vista_common import finish_export_multi
from wilds_props import (
    build_windmill, build_trough, build_pickup, build_shed, build_fence, build_mailbox,
)
from wilds_nature import (
    build_juniper, build_juniper_b, build_sage, build_yucca, build_cholla, build_boulder,
)

BG_DESERT = '#cfc8bc'


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
    out_dir = pos[0] if len(pos) > 0 else 'web/public/vista-models/wilds'
    prev_dir = pos[1] if len(pos) > 1 else None
    return out_dir, prev_dir, only


def run():
    out_dir, prev_dir, only = parse_args()
    os.makedirs(out_dir, exist_ok=True)
    if prev_dir:
        os.makedirs(prev_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)

    jobs = [
        # 牧场机械与小物
        ('windmill',     15000, (-1.05, -1.45, 0.30), lambda: build_windmill('windmill', 201)),
        ('trough',        5000, (-0.90, -1.55, 0.62), lambda: build_trough('trough', 202)),
        ('pickup',       15000, (-1.15, -1.45, 0.45), lambda: build_pickup('pickup', 203)),
        ('shed',          5000, ( 1.05, -1.55, 0.50), lambda: build_shed('shed', 204)),
        ('fence',         5000, (-0.85, -1.55, 0.38), lambda: build_fence('fence', 205)),
        ('mailbox',       5000, ( 0.95, -1.50, 0.32), lambda: build_mailbox('mailbox', 206)),
        # 荒漠植物（英雄版 + _lo <= 600）
        ('juniper',       4000, (-0.45, -1.70, 0.25), lambda: build_juniper('juniper', 211, lo=False)),
        ('juniper_lo',     600, (-0.45, -1.70, 0.25), lambda: build_juniper('juniper_lo', 211, lo=True)),
        ('juniper_b',     4000, (-0.35, -1.75, 0.25), lambda: build_juniper_b('juniper_b', 212, lo=False)),
        ('juniper_b_lo',   600, (-0.35, -1.75, 0.25), lambda: build_juniper_b('juniper_b_lo', 212, lo=True)),
        ('sage',          4000, (-0.50, -1.65, 0.38), lambda: build_sage('sage', 213, lo=False)),
        ('sage_lo',        600, (-0.50, -1.65, 0.38), lambda: build_sage('sage_lo', 213, lo=True)),
        ('yucca',         4000, (-0.35, -1.75, 0.22), lambda: build_yucca('yucca', 214, lo=False)),
        ('yucca_lo',       600, (-0.35, -1.75, 0.22), lambda: build_yucca('yucca_lo', 214, lo=True)),
        ('cholla',        4000, (-0.45, -1.70, 0.28), lambda: build_cholla('cholla', 215, lo=False)),
        ('cholla_lo',      600, (-0.45, -1.70, 0.28), lambda: build_cholla('cholla_lo', 215, lo=True)),
        # 风化分层红砂岩大石
        ('boulder_a',     3000, (-0.95, -1.55, 0.45), lambda: build_boulder('boulder_a', 221, 'a')),
        ('boulder_b',     3000, (-0.85, -1.60, 0.35), lambda: build_boulder('boulder_b', 222, 'b')),
        ('boulder_c',     3000, (-0.95, -1.55, 0.45), lambda: build_boulder('boulder_c', 223, 'c')),
    ]

    results = []
    over_budget = []
    for name, budget, cam_dir, fn in jobs:
        if only and name not in only:
            continue
        objs = fn()
        info = finish_export_multi(objs, name, out_dir, prev_dir, cam_dir=cam_dir, bg_color=BG_DESERT)
        info['budget'] = budget
        info['ok'] = info['tris'] <= budget
        results.append(info)
        if not info['ok']:
            over_budget.append(info)

    print('\n=== WILDS SUMMARY ===')
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
