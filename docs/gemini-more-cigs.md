# 香烟扩充清单（2026-11-19 起，接在「热门清单」后面做）

给 Gemini 的资产任务。现有 95 款太少，尤其日本、韩国、中国，其他国家也偏少。这一轮**只加新的，不动已有的**。

## 规则（和热门清单第二节一样）

- **包装直接还原真实产品**：配色、版式、logo 图形、盒型都照真实的那一款画，越像越好（游戏会压成像素画，小字会变成色块）。
- **不起名字**：JSON 里 `name` 写规格描述（如「蓝色硬盒 10mg」「金色细支」），`name_en` 同样写英文规格描述；真实品牌名只写进 `inspiration`。
- `country` 写产地中文名，`country_code` 写两位国家代码（游戏按它分国家、按语言排序）。
- 图片规格、文件夹、其他字段沿用 `docs/gemini-asset-brief.md` 第三、四、五节；`id` 新起，不和已有的重复。
- 下面清单里**已经做过的（同一款同一规格）跳过**。
- **同一系列只要一款原味**：只是焦油 / 尼古丁量不同的（如 Mevius 6mg / 8mg / 1mg）不要重复做；同一系列重点做**不同口味和爆珠款**（蓝莓爆、西瓜爆、葡萄、柑橘、莓果、桃子、薄荷、双爆珠等）。
- 清单里写的口味款如果市面上并没有这一款真实产品，就跳过，别编。
- 每做完一小批就写进 `web/public/catalog/cigarettes.json`（追加），游戏随时接入。
- 顺序：日本 → 韩国 → 中国 → 其他国家，每轮穿插着做，先做每组前面的。

## 日本（JP，约 35 款，口味和爆珠为主）

1. Mevius Option Purple（蓝莓爆珠）
2. Mevius Option Yellow（柑橘爆珠）
3. Mevius Premium Menthol Option Red（莓果薄荷爆珠）
4. Mevius Premium Menthol Option Purple（葡萄薄荷爆珠）
5. Mevius Premium Menthol（冰爽薄荷）
6. Seven Stars 薄荷爆珠款（Revo 系列）
7. Peace Light Box（香草甜香，日本老牌）
8. Hope Menthol（薄荷短支）
9. Hi-lite（ハイライト 原味）
10. Hi-lite Menthol
11. Echo（エコー）
12. Golden Bat（ゴールデンバット）
13. Wakaba（わかば）
14. Cabin（キャビン）
15. Caster（キャスター 香草味）
16. Winston Caster Hold（香草爆珠）
17. Pianissimo Icy Dual（双爆珠女士细支）
18. Pianissimo Aria Menthol（薄荷女士细支）
19. Pianissimo Super Slim Lemon（柠檬薄荷女士细支）
20. Lark Hybrid（双爆珠）
21. Lark Mint Splash（薄荷爆珠）
22. Kent iSwitch（换味爆珠）
23. Camel Crush（日版爆珠）
24. Lucky Strike Click & Roll（日版爆珠）
25. Parliament One 100s（日版长支）
26. Marlboro Menthol（日版绿盒）
27. Marlboro Ice Blast（日版冰爆）
28. Marlboro Purple Mix（紫色混合爆珠）
29. Marlboro Tropical Menthol（热带水果爆珠）
30. Marlboro Crisp Mint（日版）
31. Philip Morris Purple Hybrid（日版葡萄爆珠）
32. Natural American Spirit 金（日版 Gold）
33. Natural American Spirit 黑（Perique）
34. Natural American Spirit 薄荷（Menthol Light）
35. Short Peace（10 支短支）

## 韩国（KR，约 30 款，口味和爆珠为主）

1. ESSE Change Himalaya（雪松薄荷爆珠）
2. ESSE Change Up（柠檬爆珠）
3. ESSE Change Grand（双爆珠）
4. ESSE Change Ring（绿色薄荷爆珠）
5. ESSE Golden Leaf（原味高端款）
6. ESSE Soo 0.5（原味细支）
7. The One Blue（原味）
8. The One Orange（柑橘爆珠）
9. The One Impact（薄荷爆珠）
10. Raison Blue（蓝莓爆珠）
11. Raison Yellow（柠檬爆珠）
12. Raison Sky（冰爽爆珠）
13. Raison Mojito（莫吉托爆珠）
14. Bohem Cigar No.6（小雪茄风原味）
15. Bohem Cigar Mojito（莫吉托爆珠）
16. Bohem Cigar Shot（樱桃爆珠）
17. Bohem Cigar Mini Wine（红酒风味）
18. Simple 1mg（原味）
19. Arirang（아리랑 原味老牌）
20. Pine（솔 原味老牌）
21. Black Jack（威士忌风味长支）
22. Mix Grape（葡萄爆珠）
23. Mix Cherry（樱桃爆珠）
24. Dunhill Frost（韩版薄荷）
25. Dunhill Switch（韩版爆珠）
26. Parliament Hybrid（韩版双爆）
27. Marlboro Vista Forest Mist（韩版森林薄荷爆珠）
28. Marlboro Vista Tropical Breeze（韩版热带水果爆珠）
29. Mevius Sky Blue（韩版冰爽爆珠）
30. Camel Activate Purple（韩版葡萄爆珠）

## 中国（CN，约 70 款，每个牌子一款招牌原味 + 口味 / 爆珠款）

1. 中华 双中支
2. 中华 细支（金细支）
3. 中华 5000
4. 玉溪 硬
5. 玉溪 初心
6. 云烟 紫
7. 云烟 印象
8. 云烟 大重九
9. 芙蓉王 硬蓝
10. 芙蓉王 钻石
11. 利群 富春山居
12. 利群 长嘴
13. 利群 薄荷爆珠（若有）
14. 黄鹤楼 硬奇景
15. 黄鹤楼 1916
16. 黄鹤楼 硬金砂
17. 黄鹤楼 雅韵爆珠（若有）
18. 南京 九五
19. 南京 雨花石
20. 南京 十二钗（薄荷爆珠款）
21. 苏烟 金砂
22. 红塔山 硬经典
23. 白沙 和天下
24. 白沙 硬金世纪
25. 双喜 软经典（广东）
26. 双喜 红玫王
27. 双喜 莲香
28. 红双喜（上海 硬）
29. 牡丹 软
30. 大前门 软
31. 红梅 软黄
32. 阿诗玛
33. 石林
34. 黄金叶 帝豪
35. 黄金叶 乐途
36. 黄金叶 天香（爆珠细支，若有）
37. 娇子 X
38. 娇子 宽窄 薄荷爆珠（若有）
39. 长白山 硬红
40. 长白山 天池
41. 泰山 望岳
42. 泰山 白将军
43. 七匹狼 白
44. 七匹狼 锋芒
45. 贵烟 国酒香
46. 贵烟 跨越 爆珠（若有）
47. 真龙 海韵
48. 红河 硬
49. 钻石 硬蓝
50. 熊猫 时代
51. 中南海 蓝色经典
52. 中南海 爆珠（若有）
53. 兰州 硬吉祥
54. 兰州 黑中支
55. 延安 硬
56. 好猫 金丝猴
57. 好猫 长乐
58. 红金龙 硬神州
59. 黄山 徽商
60. 黄山 天都
61. 金圣 圣地井冈
62. 冬虫夏草
63. 大红鹰 新版
64. 哈德门
65. 人民大会堂
66. 钓鱼台
67. 黄果树
68. 雄狮
69. 红旗渠
70. 椰树（海南）

## 其他国家（约 90 款）

### 德国（DE）
1. West Red
2. Marlboro Red（德版带警示图）
3. Lucky Strike Original Red（德版）
4. HB（德国老牌）
5. JPS Black（德版）
6. Pall Mall Red（德版）
7. Camel Yellow（德版）

### 英国 / 爱尔兰（GB / IE）
8. Silk Cut Purple
9. Lambert & Butler Original Silver
10. Mayfair Original
11. Richmond Superkings
12. Sterling Dual
13. Embassy Number 1
14. Regal King Size
15. John Player Blue（IE）
16. Carroll's Number 1（IE）

### 意大利 / 希腊 / 波兰 / 乌克兰（IT / GR / PL / UA）
17. MS（Marlboro Italia 前身的意大利国烟，蓝白）
18. Merit（意版）
19. Diana Rossa
20. Karelia Slims（GR）
21. Assos International（GR）
22. Viceroy Blue（PL）
23. L&M Red（波兰版）
24. Prima Lux（UA）

### 土耳其 / 埃及 / 伊朗 / 以色列（TR / EG / IR / IL）
25. Samsun（TR）
26. Tekel 2000（TR）
27. Maltepe（TR）
28. Parliament Reserve（TR）
29. Cleopatra（EG）
30. Bahman（IR）
31. Farvardin（IR）
32. Time（IL）

### 俄罗斯（RU，补充）
33. Winston XStyle Blue（俄版）
34. Parliament Aqua（俄版）
35. Troika（Тройка）
36. Pyotr I（Пётр I）
37. Bond Street Blue（俄版）
38. Chesterfield Remix（俄版）

### 东南亚（VN / TH / MY / SG / PH / ID）
39. Vinataba（VN）
40. Thăng Long（VN）
41. Hero（VN）
42. Craven A（VN 红盒）
43. Krong Thip（TH）
44. SMS（TH）
45. Wonder（TH）
46. Dunhill Switch（MY）
47. Pall Mall Menthol（MY）
48. Marlboro Ice Blast（SG 版带警示图）
49. Hope 100s（PH）
50. Champion（PH）
51. Gudang Garam Merah（ID）
52. Djarum 76（ID）
53. Sampoerna Hijau（ID）
54. LA Lights（ID）
55. Clas Mild（ID）

### 台湾 / 香港（TW / HK）
56. 长寿 Long Life（台湾 黄盒）
57. 长寿 白
58. 新乐园 Paradise（台湾）
59. 宝岛（台湾）
60. 万宝路 港版红
61. 三五 555 港版

### 南亚（IN / PK / BD / LK）
62. Navy Cut（IN 蓝盒）
63. Four Square（IN）
64. Red & White（IN）
65. Bristol（IN）
66. Classic Ice Burst（IN）
67. Gold Leaf（PK）
68. Capstan（PK）
69. Morven Gold（PK）
70. Benson & Hedges（BD）
71. Star（BD）
72. Dunhill Switch（LK）

### 美洲（CA / MX / CU / BR / AR / CO / PE / US 补充）
73. du Maurier（CA）
74. Player's（CA）
75. Export A（CA）
76. Canadian Classics（CA）
77. Delicados（MX）
78. Faros（MX）
79. Montana（MX）
80. Popular（CU 无滤嘴）
81. Criollos（CU）
82. H. Upmann 香烟（CU）
83. Hollywood（BR）
84. Free（BR）
85. Jockey Club（AR）
86. Mustang（CO）
87. Pielroja（CO）
88. Hamilton（PE）
89. Newport Menthol Box（US 补充，若已做过跳过）
90. American Spirit Turquoise（US 补充，若已做过跳过）

### 澳洲 / 新西兰 / 非洲（AU / NZ / ZA / NG / MA / KE）
91. Winfield Blue（AU）
92. Horizon（AU）
93. Peter Jackson（AU）
94. Pall Mall（NZ）
95. Rothmans（ZA）
96. Benson & Hedges（NG）
97. Marquise（MA）
98. Sportsman（KE）
