# 「迈阿密霓虹」风景调研笔记

2026-11-19。给 `web/src/vistas/miami.js` 用。

规矩：只借氛围、配色、光线，以及真实迈阿密的建筑类型。不出现那款游戏的名字、标志、角色、虚构地名，也不做只在游戏里存在的地标或广告牌。下面提到它时一律叫「本周上市的犯罪题材开放世界游戏」。

## 一、那款游戏里的城市现在给玩家的观感

官方截图站和论坛在抓取时都返回 403，内置浏览器打不开外站，所以这一节只能依据评测、报道和配色分析的文字。

- **夜景是招牌**：评测普遍把夜里的城市评为最好看的画面，霓虹被反复提到（[playday.one 评测](https://playday.one/2026/11/18/grand-theft-auto-6-review/)、[GamesRadar 评测](https://www.gamesradar.com/games/grand-theft-auto/gta-6-review/)、[Creative Bloq 评测](https://www.creativebloq.com/reviews/gta-6-review-holy-sh-t-its-good)）。
- **湿街和反光**：官方夜景图的报道都提到积水路面映着霓虹，霓虹把楼面和湿路面一起照亮（[Kotaku](https://kotaku.com/damn-this-gta-6-screenshot-looks-so-good-people-dont-believe-its-real-2000742750)、[Vice](https://www.vice.com/en/article/new-gta-6-screenshots-rockstar-polish/)）。
- **湿气和雾**：远处岛屿的轮廓融进雾里；HDR 下日落和霓虹更有体积感（[GameGPU 测试](https://en.gamegpu.com/test-gpu/playstation/grand-theft-auto-vi-obzor-i-testirovanie-na-playstation-5-i-playstation-5-pro)）。配色分析也说光线偏表现而不追求写实：湿雾、霓虹溢光、强烈的剪影。
- **分区的色调**：白天暖而自然，夜里偏霓虹；海滨装饰艺术区比别的区更浅、更粉彩。这是作者的观察（[配色分析汇总](https://gtapulse.com/reviews/gta-6-color-palette-art-direction/)，页面本身没抓到，内容来自搜索摘要）。
- **主色调**：粉、青、紫，加一点橙，是对八十年代迈阿密的致敬。官方没有公布色板，下面这组是粉丝按预告片配的（[fc94af 配色文章](https://www.fc94af.com/post/welcome-to-vice-city-which-pink-hex-code-nails-the-gta-6-look)）：
  - 天空渐变：`#3B1C6E`（暮紫）→ `#FC94AF`（火烈鸟粉）→ `#FF8A3D`（日落橙，贴地平线）
  - 夜色：`#1A0B2E`（午夜紫）
  - 霓虹：`#FF6EC7`、`#FF1493`，只作点缀、勾边
  - 水和热带夜：`#12C2C4`（泻湖青）
  - 沙：`#FFD1B8`
  - 建议比例：紫 60%、粉 25%、青 10%、橙和沙 5%
- **画面元素**：霓虹跑车开在湿漉漉的海滨大道上，两边棕榈和亮着青、品红灯的装饰艺术楼；还有日落下的天际线、桥和快艇（[官方截图报道](https://gamerant.com/gta-6-new-vice-city-screenshots/)、[RockstarINTEL](https://rockstarintel.com/12-new-gta-6-screenshots-released/)）。

## 二、真实的迈阿密

- **装饰艺术酒店**：保护区里有 900 多栋，大多是 1930 年代建的（[Corcoran](https://inhabit.corcoran.com/pastel-perfection-miami-beach-art-deco/)）。
  - 立面：方正体块、圆角转角、对称的横向窗带、窗上一道道「眉毛」遮阳檐、三段式立面（中间一块风格化的竖向主体）、玻璃砖。
  - 招牌：金属或霓虹的无衬线字母，做在雨篷上方的招牌上。
  - 颜色：很多是米白底配一种亮色点缀（蓝色檐、蓝色雨篷、绿条纹配橙字）。粉彩是后来才刷的，取材于海、沙和日出日落。
- **霓虹怎么亮**：天黑后（大约 6 到 8 点）粉彩楼面上的霓虹字亮起来（[Treksplorer 游览指南](https://www.treksplorer.com/art-deco-historic-district-miami-beach-fl/)）。
  - 招牌最常见的是倒 T 形：一块竖招牌立在横雨篷上，发亮蓝光。
  - 窗眉下面打紫色霓虹。
  - 圆角转角上一圈霓虹字，中间竖柱用蓝灯照亮。
- **救生员小屋**：建筑师重新设计了 6 种原型、36 座，从南端公园一直排到 86 街（[designboom](https://www.designboom.com/architecture/william-lane-architect-miami-beach-eye-catching-lifeguard-towers-04-26-2022/)）。
  - 形状不规则、几何感强，屋顶线条各不相同。
  - 骨架底座把小屋抬高大约 2 米，屋檐往外挑。
  - 40 多种配色：粉、黄、绿、橙、紫，配木头。
- **海滨公园**：在海滨大道东侧，草地、棕榈、排球场；一条波浪形步道把草地和沙滩隔开（[Wikipedia](https://en.wikipedia.org/wiki/Lummus_Park,_Miami_Beach)）。
- **棕榈**：以椰子类棕榈为主，树干弯、往一边斜（论坛说法，未核实；[Miami New Times](https://www.miaminewtimes.com/news/decades-old-ocean-drive-palm-trees-removed-and-relocated-8996748/)）。
- **长堤**：全长 5.6 公里，主跨净空 21 米，双向六车道，连着市中心和南海滩，中途经过几个小岛（[Wikipedia](https://en.wikipedia.org/wiki/MacArthur_Causeway)）。
  - 夜里几乎一直灯火通明，是拍车灯光轨的经典机位（[Locationscout](https://www.locationscout.net/usa/4694-venetian-causeway-skyline)）。
  - 从这里能同时看到天际线和港口的起重机。
- **市中心和金融区天际线**：好几栋楼有彩色灯光（[Condo Blackbook](https://www.condoblackbook.com/blog/miami-nightlife-show-stopping-condos-by-night)、[Color Kinetics](https://www.colorkinetics.com/global/showcase/miami-tower)）。
  - 有的楼整栋会变色。
  - 有的金字塔顶在日落后亮蓝绿色。
  - 有的楼沿整栋高度一条暖色灯带。
  - 有的帆形楼顶亮红色。
- **天色**：气象学家说日落颜色主要看空气里的尘和烟（[Miami New Times](https://www.miaminewtimes.com/arts-culture/why-are-miami-winter-sunsets-so-beautiful-40510046/)）。
  - 湿气有时是柔和的光晕，有时是一条吞掉太阳的海雾低云带。
  - 零散的中层云最能接住暖光。
  - 蓝调时刻大约持续 25 分钟（[Alpenglow](https://alpenglowapp.com/forecasts/sunset/miami-fl-us)）。
  - 南端公园能同时看到海岸线、市中心天际线和港口的邮轮。

## 三、怎么让人一眼认出「黄昏的迈阿密」

1. 粉彩加霓虹：白天是粉彩和米白底，天黑霓虹勾边亮起来，主色是青和品红，其次蓝、紫。
2. 装饰艺术的轮廓：窗眉、中间竖鳍、圆角转角、阶梯形女儿墙、倒 T 招牌。
3. 椰子棕榈的剪影，被地灯从下往上打亮。
4. 白沙滩，加上一座座彩色的救生员小屋。
5. 天空紫 → 粉 → 橙，中层云被染成粉色；湿雾让远景发粉、发软。
6. 湿漉漉的街，映着霓虹。
7. 海湾对岸的天际线有彩色楼顶和整条的灯带；长堤上车灯流动；港口有起重机和亮灯的邮轮。

## 四、色板（落到代码里的值）

| 时段 | 天顶 | 半空 | 地平线 | 背阳侧天边 | 雾 | 云亮面 / 暗面 | 水 |
|---|---|---|---|---|---|---|---|
| 白天 | `#2a7fe0` | `#69b4f0` | `#d6eef4` | `#bfe0ee` | `#b8d8ea` | `#ffffff` / `#a6c4dc` | `#127c8a` |
| 日落（太阳 4°） | `#3B1C6E` | `#8a4ac0` | `#FF8A3D` | `#FC94AF` | `#f09aa8` | `#ff8a7a` / `#7a4aa0` | `#3a3a7a` |
| 黄昏（-1°） | `#2a1a6e` | `#7a3aa8` | `#FC94AF` | `#e060b0` | `#c85a98` | `#FC94AF` / `#4a2a7a` | `#2a2a6a` |
| 蓝调（-5°） | `#1e1260` | `#4a2a8e` | `#d0508a` | `#7a3a9a` | `#7a3a7a` | `#d05a90` / `#2e1e5a` | `#12405a`（偏青） |
| 夜（-11° 以下） | `#1A0B2E` | `#24164e` | `#7a2e6a` | `#4a2260` | `#4a2650` | `#a04a7a` / `#1e1234` | `#0a1a2a` |

- 霓虹：品红 `#FF1493`、粉 `#FF6EC7`、青 `#12E0F0`、蓝 `#3A7BFF`、紫 `#A040FF`、偶尔绿 `#6AFF60` 和橙 `#FF8A3D`。
- 墙：米白 `#F6F0E6`、`#FBF6EE`，粉彩粉 `#F7B4C8`、薄荷 `#A6E8D4`、淡紫 `#C9B6F2`、桃 `#FFD2A2`、天蓝 `#A8D2F6`、柠檬 `#FFF0A4`。
- 救生员小屋：粉 `#FF9EC8`、黄 `#FFE066`、绿 `#7EE08A`、橙 `#FFB070`、紫 `#B49CFF`，配木色 `#B98A5E`。

## 五、布局（已经搭好的版本加上这次的改动）

- **视角**：十二层楼顶（街面 -38 米），朝南看。+x 是西，太阳在那边落下。
- **左前方**：大西洋和白沙滩。往南一个往东伸进海里的海角，北岸是沙滩、公园、一排门脸朝北（正对天台）的霓虹酒店，后面几座白色高楼。这是美术上的改动，真实海岸是直的。
- **脚下**：海滨大道一排装饰艺术小酒店，东侧是公园和沙滩。
- **右手边**：隔着海湾是市中心和金融区，有海边摩天轮、两条长堤、港口的邮轮和起重机。

这次要改的：
- 酒店墙面一半米白配亮色点缀，一半粉彩。
- 招牌改成倒 T（竖招牌立在雨篷上，多半是青或蓝光）。
- 有的酒店窗眉下面打紫色霓虹，一层层亮起来。
- 救生员小屋抬高约 2 米，木头平台，三种原型（方屋、圆屋、斜屋顶），屋身一色、屋顶另一色。
- 海滨大道和海角大道夜里像刚下过雨：路面反光，映着粉色霓虹。
- 长堤改成双向六车道；港口加几台起重机。
- 天际线加几条沿整栋楼高的暖色竖灯带，几个楼顶亮红色、蓝绿色。
- 配色按上表调；黄昏和夜里雾更浓、偏粉，远景更软。
- 蓝调时刻的水偏青。
