# 给 Gemini 的任务：世界各地的香烟、零食、啤酒饮料资产

> **2026-11-17 起：做什么、做多少、按什么顺序，一律以 `docs/gemini-hot-list.md`（热门清单）为准**；这份任务书里的数量要求和「香烟目标清单」作废，只沿用第二节侵权规则、第三节文件夹结构、第四节图片规格、第五节 JSON 字段。


> 把这份文件整个发给 Gemini（在 Antigravity 里打开 `~/Data/Projects/smoke-break` 这个文件夹再发）。
> 产出会被 3D 游戏「抽根烟」直接读取，所以**文件夹、文件名、JSON 字段必须严格按下面的格式**。

## 背景

「抽根烟」是一个网页 3D 游戏：玩家匿名进一家便利店，从烟柜、冰柜、零食架拿东西，再上天台跟陌生人一起抽烟。烟和东西都要尽量还原世界各地真实存在的样子（包装配色、版式、烟支形制），但**不能侵权**。

## 一、要搜集的数量

| 类别 | 最少数量 | 覆盖要求 |
|---|---|---|
| 香烟 | **200 种**，越多越好 | 至少 70 个国家和地区；每个烟草大国（中国、日本、韩国、美国、俄罗斯、印尼、印度、土耳其、德国、法国、英国、巴西、埃及、越南、泰国、菲律宾、伊朗等）各至少 5 种，中国至少 25 种（覆盖各省代表性风格） |
| 啤酒和酒 | 80 种 | 各国代表啤酒、烧酒、清酒、米酒、精酿、预调酒 |
| 软饮 | 40 种 | 汽水、茶饮、罐装咖啡、乳饮、能量饮料 |
| 零食 | 80 种 | 薯片、饼干、巧克力、糖果、方便面、饭团、关东煮、肉干、坚果等，各国特色 |

**零食和饮料优先挑全世界最有名、看包装一眼就认得出的那一批**，冷门的地方特产放后面。先做下面这些（括号里是参考对象，只写进 `inspiration` 给内部核对，名字和图案照样要原创）：

- 汽水：红罐白飘带的可乐（可口可乐）、蓝罐红白蓝圆标的可乐（百事）、绿罐柠檬汽水（雪碧）、橙色汽水（芬达）
- 能量饮料：蓝银格子细罐（红牛）、黑高罐荧光绿爪痕（Monster）
- 啤酒：绿瓶白椭圆标（喜力）、透明长颈瓶塞青柠（科罗娜）、银罐黑字（朝日 Super Dry）、红白蓝罐（百威）、黑罐（健力士）、绿瓶烧酒（真露）、清酒杯（大关）、方瓶黑标威士忌（杰克丹尼）
- 茶水咖啡：蓝白运动饮料（宝矿力）、日本瓶装绿茶（伊藤园）、矮罐咖啡（BOSS / Georgia）、雪山标矿泉水（依云）
- 薯片膨化：黄袋红飘带（乐事）、红色长筒（品客）、黑袋三角片（多力多滋）、橙袋芝士条（奇多）、虾条（卡乐比）
- 巧克力糖果饼干：棕色包装蓝字（士力架）、红包装白椭圆（奇巧）、黄袋彩豆（M&M's）、蓝色夹心饼干（奥利奥）、红盒巧克力棒（Pocky）、三棱柱巧克力（瑞士三角 Toblerone）、小熊软糖（哈瑞宝）、一卷薄荷糖（曼妥思）、口香糖（益达 / Orbit）
- 速食：白杯红带杯面（日清合味道）、红杯辣面（辛拉面）

做法：配色、版式、包装外形（罐、长颈瓶、长筒、三棱柱、长条装）尽量贴近，让人一眼联想到；但不能出现真实品牌名、近音名、真实 logo、吉祥物（比如品客的小胡子、奇多的豹子都不能画）。

香烟要尽可能多、尽可能细，**不是差不多就行**。同一个牌子的不同规格（比如硬盒红、软盒、细支、爆珠、薄荷、短支）算不同条目。特殊形制都要有：丁香烟（kretek）、比迪烟（bidi）、卷纸烟（papirosa，长纸管）、小雪茄（cigarillo）、超细支、炭滤嘴、空心滤嘴、金色或彩色烟纸、无滤嘴等。

### 香烟目标清单（优先做完这些，按市面上真实热销的规格）

**要求：玩家一眼认出「这是利群 / 这是七星」**——盒子配色、版式、盒型（硬盒/软盒/细支盒/中支）、烟支长短粗细、滤嘴颜色、爆珠颗数和口味都按真实产品做；**名字照样原创**，不用真名、近音名、真实 logo 和图案（比如利群的楼阁、中华的华表、芙蓉王的芙蓉花图案都要换成原创图形）。`inspiration` 里写清楚参考的是哪一款。每个规格、每种口味、每种爆珠单独一条。现有 99 条里跟下面清单对不上的冷门款，最多保留 30 条，其余按清单重做。

**中国（约 105 条）**
- 中华：硬红、软红、细支、金中支、双中支
- 玉溪：软、硬、和谐、初心、中支境界
- 云烟：软珍品、紫、细支珍品、印象、小熊猫
- 红塔山：经典 1956、硬经典、软经典、大国精品
- 芙蓉王：硬、蓝、钻石、细支
- 利群：新版、软红长嘴、阳光、休闲云端、西子阳光
- 黄鹤楼：软蓝、硬峡谷情、1916、天下名楼、雅韵
- 南京：炫赫门、红、雨花石、十二钗、九五
- 钻石（荷花）：荷花、软荷花、荷花细支、硬红
- 白沙：精品、精品二代、和天下、和天下细支
- 黄山：红方印、硬一品、徽商新概念、天都
- 苏烟：五星红杉树、软金砂、铂晶
- 娇子：宽窄如意、宽窄好运、X 娇子
- 双喜：硬经典、春天、软红双喜
- 七匹狼：通仙、纯境、锋芒
- 泰山：红将军、心悦、佛光
- 长白山：777、红、迎春
- 黄金叶：天叶、乐途、大金圆
- 贵烟：跨越、国酒香、萃
- 中南海：8mg、5mg、典 8
- 真龙：凌云、起源；红河：软甲、道；牡丹：软红、蓝；红梅：软黄、硬；大前门：短支、软；兰州：硬珍品、飞天；天子：千里江山、金；好猫：长乐、金丝猴
- 各一款：熊猫、延安 1935、阿诗玛、红金龙硬神州、金圣吉祥、哈德门精品、猴王、人民大会堂、恒大烟魁、钓鱼台细支、大重九、红旗渠银河、椰树

**日本（约 56 条）**——日本烟以爆珠和细分口味出名，每种口味单独一条
- Mevius：Original、Lights 10、Super Lights 6、One 1、Extra Lights、Premium Menthol Option Purple 8、Option Yellow、Option Red、Extra Menthol、Sky Blue、Premium Menthol Option One
- Seven Stars：七星 14mg、Real Smooth、Menthol、Blue Wind、Box
- Peace：Infinity、Light、Aroma Royal、Super Light
- Hope、Hope Menthol、Hi-Lite、Hi-Lite Menthol、Echo、Wakaba、Golden Bat、Short Peace
- Cabin、Cabin Red；Pianissimo：Peche、Aria Menthol、One Melon
- Winston 日版：Caster White、XS 系列；Camel 日版：Crafted、Menthol
- Marlboro 日版爆珠：Ice Blast One、Black Menthol、Purple Menthol、Black Menthol Edge、Red、Gold
- Lark：Classic Milds、Ice Mint；Kent：1、5、Neo；Lucky Strike 日版；American Spirit 日版：Gold、Light、Menthol

**韩国（约 28 条）**
- ESSE：Change、Change Up、Change Himalaya、Change Linz、Golden Leaf、Special Gold、One、Classic
- Raison：French Black、Ice Blast、Sun；This：This、This Plus、This Fresh；The One：Orange、Blue、Impact
- Bohem Cigar：Mojito、No.6、Shuffle、Asis；Dunhill 韩版：Fine Cut、Frost；Parliament 韩版：Aqua 5、Hybrid；Marlboro 韩版：Ice Blast、Vista；Hallasan

**欧美及其他（约 57 条）**
- Marlboro：Red、Gold、Silver、Ice Blast、Touch、Menthol、Black
- Camel：Blue、Filters、Turkish Gold、Crush；Lucky Strike：Red、Blue、Click；Winston：Red、Blue、XStyle
- Parliament：Aqua Blue、Night Blue、Reserve；Pall Mall：Red、Blue；L&M：Red、Blue、Link；Chesterfield：Red、Blue
- Dunhill：International、Fine Cut；Davidoff：Classic、Gold；Kent：Blue、Nanotek；Newport：Menthol、Box
- American Spirit：Turquoise、Yellow、Black；Benson & Hedges：Gold、Silver；Rothmans Blue；Vogue Superslims
- Sobranie：Black Russian、Cocktail；Gauloises：Brunes、Blondes；Gitanes Brunes；Belomorkanal（卷纸烟）
- 印尼丁香烟：Djarum Super、Djarum Black、Gudang Garam Surya、Gudang Garam International、Sampoerna A Mild、Dji Sam Soe

## 二、侵权规则（非常重要）

- **名字必须原创**：不能用真实品牌名，也不能用读音或拼写相近的名字（比如把某个品牌改一两个字母不行）。可以从产地、城市、风格、意象取名。
- **不能出现任何真实的商标、徽章、Logo、字体设计、吉祥物、标语。**
- **可以保留的是特征**：整体配色、色块的大致布局（比如顶部一条横色带、中间一个大色块、斜切的条纹）、盒型（硬盒、软盒、扁盒、铁盒）、烟支的形制和颜色。玩家看到能联想到「这是某国那种烟」，但找不到任何一个能对上真实品牌的标识。
- 每个条目在 JSON 里写清楚 `inspiration`（参考了哪类真实产品的哪些特征），只给我们内部核对用，不会出现在游戏里。
- 烟盒正面按产地习惯加**健康警示区**（比如底部黑白警示条、文字），警示文字也用原创措辞。

## 三、文件夹结构

全部放在项目里的 `web/public/catalog/` 下：

```
web/public/catalog/
├── cigarettes.json
├── drinks.json
├── snacks.json
├── cig/<id>/front.png        烟盒正面
├── cig/<id>/side.png         烟盒侧面（可选）
├── cig/<id>/top.png          烟盒顶面（可选）
├── drink/<id>/label.png      瓶身或罐身的一整圈标签展开图
├── snack/<id>/front.png      包装正面
└── README.md                 你做了什么、有多少条、哪些没做完
```

`id` 用英文小写加连字符，全局唯一，比如 `jp-mild-seven-style-1` 这种**不行**（含真实品牌），要写成 `jp-yokocho-blue-slim`。

## 四、图片规格

| 图 | 尺寸 | 说明 |
|---|---|---|
| 烟盒正面 `front.png` | 512 × 768（宽 × 高），硬盒；软盒同尺寸 | 正对、无透视、无阴影、无背景（铺满整个画面），像扫描件一样平。要能直接贴到 3D 烟盒上 |
| 烟盒侧面 / 顶面 | 侧面 192 × 768，顶面 512 × 192 | 同上 |
| 饮料标签 `label.png` | 1024 × 512 | 罐身或瓶身一整圈展开，左右两端能无缝接上；只画标签本身，不画瓶子 |
| 零食正面 `front.png` | 512 × 640 | 包装正面平铺，无透视无阴影 |

画风：写实的印刷品质感（纸张、烫金、亮面油墨的效果可以有），**不要**卡通、不要立体渲染、不要拍成照片放在桌上。可以用你自带的生图能力。

## 五、JSON 字段

### cigarettes.json

```json
[
  {
    "id": "cn-jiangnan-soft-red",
    "name": "江南 · 软红",
    "name_en": "Jiangnan Soft Red",
    "country": "中国",
    "country_code": "CN",
    "region_note": "长三角一带常见的软包风格",
    "inspiration": "参考中国软包红色系卷烟：红底、金色横带、软包铝箔顶。名字和图案全部原创。",
    "style": "regular",
    "pack": { "type": "soft", "primary": "#b8282c", "secondary": "#e8c35a", "accent": "#ffffff", "count": 20 },
    "stick": {
      "length_mm": 84, "diameter_mm": 7.8,
      "filter": "cork", "filter_length_mm": 25, "filter_color": "#d39a4a",
      "tipping_band": "#e8c45a", "paper_color": "#f4f2ec",
      "capsule": false, "flavor": "原味"
    },
    "smoke_tint": [214, 214, 224],
    "strength": 3,
    "taste_zh": "入口柔和，回味带点甜",
    "note_zh": "软包，适合一个人站着发呆",
    "images": { "front": "cig/cn-jiangnan-soft-red/front.png" }
  }
]
```

字段说明：
- `style`：`regular` / `slim` / `superslim` / `short` / `kretek` / `bidi` / `papirosa` / `cigarillo` / `roll-your-own` / `menthol` 之一。
- `pack.type`：`hard` / `soft` / `flat`（扁盒）/ `tin`（铁盒）/ `bundle`（比迪烟那种一扎）。
- `stick.filter`：`cork`（软木纹）/ `white` / `charcoal`（炭）/ `hollow`（空心）/ `tube`（卷纸烟的纸管）/ `none`。
- `strength`：1–5，烟味浓淡。
- 尺寸用真实数据，查不到就按同类产品的常见规格。

### drinks.json

```json
[
  {
    "id": "jp-harbor-lager-can",
    "name": "港町 生啤",
    "country": "日本", "country_code": "JP",
    "inspiration": "参考日本罐装生啤：银色罐身、红色横带。名字图案原创。",
    "kind": "beer",
    "container": "can",
    "volume_ml": 350, "abv": 5.0,
    "colors": { "primary": "#c8ccd2", "secondary": "#c62a2a" },
    "verb_zh": "喝一口",
    "note_zh": "冰柜最下层，冰得刚好",
    "images": { "label": "drink/jp-harbor-lager-can/label.png" }
  }
]
```

- `kind`：`beer` / `soju` / `sake` / `wine` / `spirit` / `highball` / `soda` / `tea` / `coffee` / `milk` / `energy` / `water`。
- `container`：`can`（330/350ml 标准罐）/ `tallcan`（500ml）/ `slimcan`（细高罐）/ `shortcan`（罐装咖啡那种矮罐）/ `bottle`（长颈瓶）/ `stubby`（短粗瓶）/ `green-bottle`（烧酒绿瓶）/ `cup`（杯装清酒）/ `carton`（纸盒）/ `pet`（塑料瓶）。

### snacks.json

```json
[
  {
    "id": "kr-seaside-shrimp-chips",
    "name": "海边虾条",
    "country": "韩国", "country_code": "KR",
    "inspiration": "参考韩国虾味膨化零食的包装：红白配色、大幅虾的图案。名字图案原创。",
    "kind": "chips",
    "package": "bag",
    "size_mm": [150, 220, 50],
    "colors": { "primary": "#e23a2a", "secondary": "#ffffff" },
    "verb_zh": "吃一根",
    "note_zh": "停不下来",
    "images": { "front": "snack/kr-seaside-shrimp-chips/front.png" }
  }
]
```

- `package`：`bag` / `box` / `bar` / `cup`（杯面）/ `onigiri` / `skewer` / `stick` / `pouch` / `tin`。
- `size_mm`：宽、高、厚。

## 六、做完时自己检查

1. 三个 JSON 都能被 `JSON.parse` 读出来，`id` 没有重复，每条 `images` 里写的文件都真的存在。
2. 图片尺寸完全符合第四节。
3. 逐条核对：没有真实品牌名、近似名、真实 Logo 或徽章。拿不准的条目改得更远一点。
4. `README.md` 写清楚每个类别的条数、覆盖了哪些国家、还缺什么。
5. 不要改项目里 `web/public/catalog/` 以外的任何文件。
