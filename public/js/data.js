// 抽根烟 · 共享数据（前端和服务端都会 import）
// 香烟全部是虚构品牌，只借用各地的烟草风格

export const CIGS = [
  { id: 'jiangnan', region: '中国', name: '江南', note: '软包，入口柔和，适合一个人站着发呆', pack: ['#b8282c', '#e8c35a'], paper: '#f2f0ea', filter: '#d39a4a', smoke: [214, 214, 224] },
  { id: 'yofuke', region: '日本', name: '夜更 Yofuke', note: '细支，淡，像深夜便利店的冷光', pack: ['#f4f2ee', '#26335c'], paper: '#ffffff', filter: '#ffffff', smoke: [220, 222, 232], slim: true },
  { id: 'hangang', region: '韩国', name: '한강 Hangang', note: '薄荷爆珠，一捏就凉', pack: ['#9fd3e8', '#ffffff'], paper: '#ffffff', filter: '#e9e4d8', smoke: [210, 225, 232], slim: true },
  { id: 'brume', region: '法国', name: 'Brume', note: '黑烟草，味道很冲，烟是灰蓝色的', pack: ['#3a5f9e', '#e8e3d5'], paper: '#efece4', filter: '#efece4', smoke: [190, 200, 220] },
  { id: 'prairie', region: '美国', name: 'Prairie Red', note: '硬盒，粗支，公路电影的味道', pack: ['#ffffff', '#c62a2a'], paper: '#f6f4ee', filter: '#c98a3a', smoke: [214, 214, 220] },
  { id: 'siesta', region: '古巴', name: 'La Siesta', note: '小雪茄，抽得慢，烟很浓', pack: ['#6b3f22', '#e6c27a'], paper: '#7a4a2a', filter: '#7a4a2a', smoke: [205, 200, 195], cigarillo: true },
  { id: 'melati', region: '印尼', name: 'Kretek Melati', note: '丁香烟，烧起来噼啪作响，有点甜', pack: ['#2f6b3a', '#f0d36a'], paper: '#5a3a24', filter: '#c99a5a', smoke: [222, 214, 200], crackle: true },
  { id: 'ganga', region: '印度', name: 'Ganga Bidi', note: '比迪烟，用树叶卷的，细得像根火柴', pack: ['#e98a2b', '#ffffff'], paper: '#6e5232', filter: '#6e5232', smoke: [210, 205, 195], bidi: true },
  { id: 'bosphorus', region: '土耳其', name: 'Bosphorus', note: '东方烟叶，带一点蜂蜜味', pack: ['#1f6f8b', '#e0c068'], paper: '#f4f0e6', filter: '#d7a65a', smoke: [218, 212, 204] },
  { id: 'belka', region: '俄罗斯', name: 'Белка Belka', note: '老式卷纸烟，长纸管，要先捏扁', pack: ['#d9d2bf', '#8a2b2b'], paper: '#f2efe6', filter: '#f2efe6', smoke: [200, 200, 205], papirosa: true },
  { id: 'foggy', region: '英国', name: 'Foggy Mild', note: '淡，像伦敦下午的雾', pack: ['#cfd4d8', '#3b3f4a'], paper: '#ffffff', filter: '#e3d2b4', smoke: [225, 225, 230] },
  { id: 'nile', region: '埃及', name: 'Nile Gold', note: '金色烟纸，看起来比抽起来贵', pack: ['#1a1a1a', '#d9b44a'], paper: '#e6c45a', filter: '#e6c45a', smoke: [222, 216, 200] },
  { id: 'samba', region: '巴西', name: 'Samba', note: '水果味，适合晴天', pack: ['#2fa86a', '#f7d43c'], paper: '#ffffff', filter: '#e8b04a', smoke: [215, 228, 215] },
  { id: 'nordwind', region: '德国', name: 'Nordwind', note: '方方正正，每一口都一样长', pack: ['#2b2b2b', '#ffffff'], paper: '#ffffff', filter: '#d39a4a', smoke: [210, 210, 214] },
];
export const CIG = Object.fromEntries(CIGS.map((c) => [c.id, c]));

// 货架上的东西：每次只能拿一份，拿新的会放回旧的
// look：[外形, 主色, 副色, 包装上的字]，3D 模型照这个做
// style：怎么吃喝 —— sip 单手举起来喝 / bite 单手咬 / pour 撕开后仰头倒着吃 / noodle 一手端杯一手拿筷子 / pick 另一只手捏一块放进嘴里（piece 是捏出来的那块）
// open：第一次用之前要先打开（tab 拉环 / cap 拧盖 / peel 撕盖 / tear 双手撕开 / flap 掀开盒盖），没有就是直接吃
// bites：吃喝几次就没了
export const ITEMS = [
  // 原则：挑全世界最有名、看包装就认得出的那几样，保留配色、版式、外形，名字和图案全部原创（不用真名、不用近音名、不用 logo）
  // look 第五项 design：用哪种包装印刷（items3d.js 里画）；注释里写的是参考了哪类产品，只给内部核对
  // —— 冷饮柜：汽水 ——
  { id: 'cola', shelf: 'fridge', name: '可乐', verb: '喝一口', look: ['can', '#d61f26', '#ffffff', 'Cola', 'wave'], style: 'sip', open: 'tab', bites: 12 },          // 红罐白飘带
  { id: 'cola_blue', shelf: 'fridge', name: '蓝可乐', verb: '喝一口', look: ['can', '#0b3c96', '#e2232a', 'COLA', 'roundel'], style: 'sip', open: 'tab', bites: 12 },  // 蓝罐红白蓝圆标
  { id: 'lemon_lime', shelf: 'fridge', name: '柠檬汽水', verb: '喝一口', look: ['can', '#0a8a3a', '#f2e13a', 'lemon·lime', 'splash'], style: 'sip', open: 'tab', bites: 12 }, // 绿罐黄绿水花
  { id: 'energy', shelf: 'fridge', name: '能量饮料', verb: '灌一口', look: ['slimcan', '#1b3f8f', '#d71f26', 'ENERGY', 'checker'], style: 'sip', open: 'tab', bites: 10 }, // 蓝银格子细罐红太阳
  { id: 'energy_claw', shelf: 'fridge', name: '魔爪能量', verb: '灌一口', look: ['tallcan', '#121212', '#7dff1f', 'CLAW', 'claw'], style: 'sip', open: 'tab', bites: 14 }, // 黑高罐荧光绿爪痕
  // —— 冷饮柜：酒 ——
  { id: 'lager_green', shelf: 'fridge', name: '荷兰绿啤', verb: '喝一口', look: ['longneck', '#1f6b2a', '#ffffff', 'Lager', 'oval'], style: 'sip', open: 'cap', bites: 12 },  // 绿瓶白椭圆标
  { id: 'lager_beach', shelf: 'fridge', name: '海滩啤酒', verb: '喝一口', look: ['longneck', '#f4e9c8', '#1d3f8f', 'Playa', 'beach'], style: 'sip', open: 'cap', bites: 12 }, // 透明长颈瓶，瓶口塞青柠
  { id: 'beer_dry', shelf: 'fridge', name: '辛口生啤', verb: '喝一口', look: ['can', '#c9ccd2', '#16171a', 'DRY', 'dry'], style: 'sip', open: 'tab', bites: 12 },        // 银罐黑斜带
  { id: 'beer_tall', shelf: 'fridge', name: '大罐生啤', verb: '喝一口', look: ['tallcan', '#c8a24a', '#1d2a5a', 'DRAFT', 'band'], style: 'sip', open: 'tab', bites: 16 },
  { id: 'stout', shelf: 'fridge', name: '爱尔兰黑啤', verb: '喝一口', look: ['can', '#141414', '#d9c48a', 'STOUT', 'stout'], style: 'sip', open: 'tab', bites: 12 },     // 黑罐奶油金
  { id: 'highball', shelf: 'fridge', name: '柠檬嗨棒', verb: '喝一口', look: ['can', '#f2e66a', '#2a6fb0', 'HIGHBALL', 'band'], style: 'sip', open: 'tab', bites: 12 },
  { id: 'soju', shelf: 'fridge', name: '烧酒', verb: '抿一口', look: ['bottle', '#3f9a5a', '#e8f6ea', '烧酒', 'band'], style: 'sip', open: 'cap', bites: 10 },            // 绿瓶
  { id: 'sake', shelf: 'fridge', name: '杯装清酒', verb: '抿一口', look: ['cup', '#eef0f2', '#c94f4f', '清酒', 'band'], style: 'sip', open: 'peel', bites: 8 },
  { id: 'whisky', shelf: 'fridge', name: '田纳西威士忌', verb: '抿一口', look: ['square', '#8a4a16', '#111111', 'OLD TIME', 'blacklabel'], style: 'sip', open: 'cap', bites: 8 }, // 方瓶黑标
  // —— 冷饮柜：茶、水、咖啡 ——
  { id: 'coffee', shelf: 'fridge', name: '罐装咖啡', verb: '喝一口', look: ['scan', '#5a3a24', '#e8c38a', 'COFFEE', 'band'], style: 'sip', open: 'tab', bites: 8 },
  { id: 'tea', shelf: 'fridge', name: '瓶装绿茶', verb: '喝一口', look: ['pet', '#2f8a4a', '#e8f0d8', '绿茶', 'tea'], style: 'sip', open: 'cap', bites: 14 },
  { id: 'sports', shelf: 'fridge', name: '电解质水', verb: '喝一口', look: ['pet', '#e8f2fa', '#1d4fa8', 'ION', 'ion'], style: 'sip', open: 'cap', bites: 14 },      // 蓝白运动饮料
  { id: 'water', shelf: 'fridge', name: '矿泉水', verb: '喝一口', look: ['pet', '#cfe8f4', '#e8a0b8', 'ALPES', 'alps'], style: 'sip', open: 'cap', bites: 14 },     // 雪山标
  { id: 'milk', shelf: 'chill', name: '牛奶', verb: '喝一口', look: ['carton', '#f6f6f2', '#2f6fc0', '牛乳', 'box'], style: 'sip', bites: 10 },
  { id: 'juice', shelf: 'chill', name: '橙汁', verb: '喝一口', look: ['carton', '#f29a2a', '#ffffff', 'ORANGE', 'box'], style: 'sip', bites: 10 },
  // —— 冷藏柜 ——
  { id: 'onigiri', shelf: 'chill', name: '鲑鱼饭团', verb: '咬一口', look: ['onigiri', '#f8f8f4', '#1e2a22', '鲑'], style: 'bite', open: 'tear', bites: 4 },
  { id: 'sandwich', shelf: 'chill', name: '鸡蛋三明治', verb: '咬一口', look: ['sandwich', '#f2e6c8', '#f2d24a', 'EGG'], style: 'bite', open: 'tear', bites: 4 },
  // —— 货架：薯片膨化 ——
  { id: 'chips', shelf: 'snack', name: '原味薯片', verb: '倒一口', look: ['bag', '#ffd21f', '#d8262c', 'Sunny', 'sunny'], style: 'pour', open: 'tear', bites: 10 },   // 黄袋红飘带圆标
  { id: 'chips_tube', shelf: 'snack', name: '叠叠薯片', verb: '拿一片', look: ['tube', '#d8262c', '#ffd23a', 'STAX', 'tube'], style: 'pick', piece: 'chip', open: 'peel', bites: 10 }, // 红色长筒
  { id: 'chips_tri', shelf: 'snack', name: '玉米片', verb: '倒一口', look: ['bag', '#1a1a1c', '#e8401c', 'TRI', 'tri'], style: 'pour', open: 'tear', bites: 10 },        // 黑袋三角片
  { id: 'puffs', shelf: 'snack', name: '芝士条', verb: '倒一口', look: ['bag', '#f2781c', '#ffd23a', 'Cheez', 'puffs'], style: 'pour', open: 'tear', bites: 10 },      // 橙袋芝士条
  { id: 'shrimp', shelf: 'snack', name: '虾条', verb: '倒一口', look: ['bag', '#e23a2a', '#ffffff', '虾条', 'sunny'], style: 'pour', open: 'tear', bites: 10 },
  // —— 货架：巧克力糖果饼干 ——
  { id: 'bar_nut', shelf: 'snack', name: '花生巧克力棒', verb: '咬一口', look: ['bar', '#4a2a1a', '#1d3f9a', 'NUTTY', 'nutbar'], style: 'bite', open: 'tear', bites: 5 },   // 棕色包装蓝字红边
  { id: 'bar_wafer', shelf: 'snack', name: '威化巧克力', verb: '掰一条', look: ['bar', '#d6202a', '#ffffff', 'break', 'wafer'], style: 'bite', open: 'tear', bites: 4 },  // 红包装白椭圆，四条
  { id: 'choco_dots', shelf: 'snack', name: '巧克力豆', verb: '倒一口', look: ['pouch', '#ffd21f', '#5a3020', 'dots', 'dots'], style: 'pour', open: 'tear', bites: 8 },  // 黄袋彩色豆
  { id: 'cookie', shelf: 'snack', name: '夹心饼干', verb: '拿一块', look: ['sleeve', '#1d3f9a', '#ffffff', 'CREAM', 'sandwich'], style: 'pick', piece: 'oreo', open: 'flap', bites: 6 }, // 蓝色长条装
  { id: 'pocky', shelf: 'snack', name: '巧克力棒', verb: '抽一根', look: ['box', '#d6202a', '#ffffff', 'Stick', 'pocky'], style: 'pick', piece: 'stick', open: 'flap', bites: 8 },  // 红盒细棒
  { id: 'toblerone', shelf: 'snack', name: '三角巧克力', verb: '掰一块', look: ['prism', '#f2c83a', '#c8262c', 'ALPINE', 'alpine'], style: 'bite', open: 'flap', bites: 5 }, // 三棱柱
  { id: 'gummy', shelf: 'snack', name: '小熊软糖', verb: '拿一颗', look: ['pouch', '#f2d23a', '#d6202a', 'BEARS', 'gummy'], style: 'pick', piece: 'gummy', open: 'tear', bites: 8 },
  { id: 'mints', shelf: 'snack', name: '薄荷糖', verb: '含一颗', look: ['roll', '#2f9a4a', '#ffffff', 'MINT', 'mint'], style: 'pick', piece: 'mint', open: 'tear', bites: 8 },      // 一卷
  { id: 'gum', shelf: 'snack', name: '口香糖', verb: '嚼', look: ['gum', '#7bc96f', '#ffffff', 'GUM', 'box'], style: 'pick', piece: 'gum', bites: 10 },
  // —— 货架：杯面 ——
  { id: 'noodle', shelf: 'snack', name: '杯面', verb: '吸一口面', look: ['cupnoodle', '#f6f2e8', '#d8262c', 'CUP RAMEN', 'cupband'], style: 'noodle', open: 'peel', bites: 7 }, // 白杯红带
  { id: 'noodle_spicy', shelf: 'snack', name: '辣拉面', verb: '吸一口面', look: ['cupnoodle', '#d8262c', '#141414', '辣', 'fire'], style: 'noodle', open: 'peel', bites: 7 },   // 红杯黑字
  // —— 收银台、冰柜 ——
  { id: 'oden', shelf: 'hot', name: '关东煮', verb: '吃一个', look: ['skewer', '#efd8a8', '#a8743a', ''], style: 'bite', bites: 3 },
  { id: 'sausage', shelf: 'hot', name: '烤肠', verb: '咬一口', look: ['sausage', '#c0603a', '#d8b48a', ''], style: 'bite', bites: 4 },
  { id: 'icebar', shelf: 'ice', name: '汽水冰棍', verb: '咬一口', look: ['icebar', '#7cc8f0', '#d8b48a', ''], style: 'bite', bites: 4 },
];
export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// ---------- Gemini 做的世界各国香烟（web/public/catalog/cigarettes.json）----------
// 把资产目录的一条转成游戏内部用的格式；字段说明见 docs/gemini-asset-brief.md
const FILTER_COLOR = { white: '#ffffff', charcoal: '#ffffff', hollow: '#ffffff' };
export function adaptCatalogCig(e) {
  if (!e || typeof e.id !== 'string' || !e.pack || !e.stick) return null;
  const st = e.stick, style = e.style || 'regular', ft = st.filter || 'white';
  return {
    id: e.id, catalog: true, region: e.country || '', country: e.country_code || '', name: e.name || e.id, nameEn: e.name_en || '',
    note: e.note_zh || '', taste: e.taste_zh || '', strength: e.strength || 3, style, regionNote: e.region_note || '', flavor: st.flavor || '',
    pack: [e.pack.primary || '#cccccc', e.pack.secondary || '#333333'], accent: e.pack.accent, packType: e.pack.type || 'hard', count: e.pack.count || 20,
    paper: st.paper_color || '#f4f2ec', filter: ft === 'cork' ? (st.filter_color || '#d39a4a') : ft === 'tube' ? (st.paper_color || '#f2efe6') : (FILTER_COLOR[ft] || '#ffffff'),
    filterType: ft, tipping: st.tipping_band || null, capsule: !!st.capsule,
    lenMm: st.length_mm || 84, diaMm: st.diameter_mm || 7.8, filterMm: ft === 'none' ? 0 : (st.filter_length_mm || 22),
    smoke: Array.isArray(e.smoke_tint) ? e.smoke_tint : [214, 214, 224],
    slim: style === 'slim' || style === 'superslim', bidi: style === 'bidi', cigarillo: style === 'cigarillo', papirosa: style === 'papirosa' || ft === 'tube', crackle: style === 'kretek',
    img: e.images?.front || null, insp: e.inspiration || '',
  };
}
// 合并进 CIGS / CIG（前端读 JSON 后调一次，服务端启动和文件变化时调）；返回新加了几条
export function addCatalogCigs(list) {
  let n = 0;
  for (const e of Array.isArray(list) ? list : []) { const c = adaptCatalogCig(e); if (!c) continue; if (!CIG[c.id]) { CIGS.push(c); n++; } else Object.assign(CIG[c.id], c); CIG[c.id] = CIGS.find((x) => x.id === c.id); }
  return n;
}

// Gemini 做的各国饮料（catalog/drinks.json）：按容器换成游戏里的外形，包装图贴在罐身 / 瓶身上（items3d 读 label）
// container → [外形, 玻璃颜色（瓶子才用）, 打开方式]
const DRINK_SHAPE = {
  can: ['can', null, 'tab'], tallcan: ['tallcan', null, 'tab'], slimcan: ['slimcan', null, 'tab'], shortcan: ['scan', null, 'tab'],
  'green-bottle': ['bottle', '#2f7a3f', 'cap'], stubby: ['bottle', '#6a3a14', 'cap'], bottle: ['longneck', '#5a3412', 'cap'],
  pet: ['pet', null, 'cap'], cup: ['cup', null, 'peel'], carton: ['carton', null, null],
};
const DRINK_TYPE = { beer: '啤酒', lager: '啤酒', soda: '汽水', cola: '可乐', energy: '能量饮料', highball: '嗨棒', soju: '烧酒', sake: '清酒', wine: '果酒', spirit: '烈酒', tea: '茶', coffee: '咖啡', water: '水', juice: '果汁', sports: '运动饮料', dairy: '乳饮' }; // 只写种类，不写品牌
export function adaptCatalogDrink(e) {
  if (!e || !e.id || !e.name) return null;
  const [shape, glass, open] = DRINK_SHAPE[e.container] || DRINK_SHAPE.can;
  const a = glass || e.colors?.primary || '#888888', b = e.colors?.secondary || '#ffffff';
  return { id: e.id, shelf: 'fridge', name: e.type_zh || DRINK_TYPE[e.kind] || '饮料', verb: '喝一口', look: [shape, a, b, '', 'band'], style: 'sip', ...(open ? { open } : {}), bites: 12,
    catalog: true, kind: e.kind || 'drink', country: e.country || '', label: e.images?.label || null };
}
// 合并进 ITEMS / ITEM（前端读 JSON 后调一次，服务端启动和文件变化时调）；返回新加了几条
export function addCatalogDrinks(list) {
  let n = 0;
  for (const e of Array.isArray(list) ? list : []) { const d = adaptCatalogDrink(e); if (!d) continue; if (!ITEM[d.id]) { ITEMS.push(d); ITEM[d.id] = d; n++; } else Object.assign(ITEM[d.id], d); }
  return n;
}

// Gemini 做的各国零食（catalog/snacks.json）：按包装换成游戏里的外形，正面贴 Gemini 画的包装图（items3d 读 gen/snack/<id>.png）
// package → 外形；kind → 怎么吃（pour 倒 / pick 一块一块拿 / bite 咬 / noodle 吸面）和手里捏的那一小块
const SNACK_SHAPE = { bag: 'bag', pouch: 'pouch', bar: 'bar', tin: 'tube', stick: 'roll', cup: 'cupnoodle' };
const SNACK_EAT = {
  chips: ['pour', 'chip'], snack: ['pour', 'chip'], nuts: ['pour', 'nut'], jerky: ['bite'], cookies: ['pick', 'cookie'],
  chocolate: ['bite'], candy: ['pick', 'candy'], gum: ['pick', 'gum'], noodles: ['noodle'],
};
const SNACK_OPEN = { bag: 'tear', pouch: 'tear', bar: 'tear', box: 'flap', tin: 'peel', cup: 'peel', stick: 'tear' };
export function adaptCatalogSnack(e) {
  if (!e || !e.id) return null;
  const pk = e.package || 'bag', [w, h, d] = Array.isArray(e.size_mm) ? e.size_mm : [120, 160, 30];
  let shape = SNACK_SHAPE[pk] || (d >= 35 ? 'sleeve' : 'box');
  const sticks = /棒/.test(e.type_zh || '') && pk === 'box'; // 饼干棒：盒子里露出一排细棒
  let [style, piece] = SNACK_EAT[e.kind] || ['bite'];
  if (shape === 'tube' && style === 'pour') style = 'pick'; // 长筒薯片一片一片拿
  if ((shape === 'box' || shape === 'sleeve' || shape === 'pouch') && style === 'bite') style = 'pick';
  if (style === 'pick' && sticks) piece = 'stick';
  if (style === 'pick' && !piece) piece = 'candy';
  if (shape === 'roll') { style = 'pick'; piece = e.kind === 'gum' ? 'gum' : 'mint'; }
  if (shape === 'cupnoodle') style = 'noodle';
  const a = e.colors?.primary || '#cccccc', b = e.colors?.secondary || '#333333';
  return { id: e.id, shelf: 'snack', name: e.type_zh || '零食', verb: e.verb_zh || '吃一口', look: [shape, a, b, '', sticks ? 'pocky' : shape === 'bar' ? 'nutbar' : 'box'],
    style, ...(piece && style === 'pick' ? { piece } : {}), open: SNACK_OPEN[pk] || 'tear', bites: style === 'bite' ? 5 : 8,
    catalog: true, catDir: 'snack', kind: e.kind || 'snack', country: e.country || '', label: e.images?.front || null, insp: e.inspiration || '', family: e.family || '' };
}
export function addCatalogSnacks(list) {
  let n = 0;
  for (const e of Array.isArray(list) ? list : []) { const d = adaptCatalogSnack(e); if (!d) continue; if (!ITEM[d.id]) { ITEMS.push(d); ITEM[d.id] = d; n++; } else Object.assign(ITEM[d.id], d); }
  return n;
}

export const PACK_SIZE = 20;
export const LOOSE_MAX = 3;
export const PHRASES = ['唉…', '累了', '有火吗', '下班了吗', '再来一根', '今天也辛苦了', '嗯', '走了'];
// 天台对面的风景：每种风景是一个单独的天台，站在同一个天台的人能互相看到
export const VISTAS = [
  { id: 'city', name: '城市夜景', note: '一整座城市的灯，越晚越好看' },
  { id: 'sea', name: '海', note: '日落、月光和灯塔' },
  { id: 'snow', name: '雪山', note: '日出日落的时候山顶会变成粉色' },
  { id: 'clouds', name: '云海', note: '比云还高的天台' },
  { id: 'aurora', name: '极光', note: '天黑以后才看得到' },
  { id: 'desert', name: '沙漠星空', note: '夜里头顶是银河' },
  // 下面三个只有 3D 版有（2D 版找不到画法会退回城市）
  { id: 'nyc', name: '纽约', note: '五十层楼顶看中城的灯' },
  { id: 'hokkaido', name: '北海道', note: '雪原小镇的日落' },
  { id: 'wilds', name: '旷野', note: '一层平房顶上看银河' },
  { id: 'inaka', name: '乡间', note: '夏天的稻田、老屋和积雨云' },
  { id: 'miami', name: '迈阿密霓虹', en: 'Neon Beach', note: '粉紫色晚霞下的海滩、粉彩酒店和霓虹灯' },
];
export const VISTA = Object.fromEntries(VISTAS.map((v) => [v.id, v]));
export function isPlace(p) { return p === 'shop' || p === 'street' || (typeof p === 'string' && p.startsWith('roof:') && !!VISTA[p.slice(5)]); }
export function placeName(p) { if (p === 'shop') return '店里'; if (p === 'street') return '楼下街边'; const v = VISTA[String(p).slice(5)]; return v ? `天台 · ${v.name}` : ''; }
export const PLACE_NAMES = new Proxy({}, { get: (_, k) => placeName(k) });
