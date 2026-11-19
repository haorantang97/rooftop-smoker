# 热门清单（2026-11-17 起以这份为准，旧的「香烟目标清单」作废；下午起改为还原真实包装、不起名字）

给 Gemini 的资产任务。规则很简单：**只做全世界受众最广、最火的那批**，不按国家分，不追求覆盖面。

## 一、已做的怎么处理

- 现在目录里已有的 95 款烟、35 款饮料、45 款零食，**按第二节的新规则逐张重画、原地替换**（`id` 不变，图片文件覆盖，JSON 里那一条同步改）。
- **不要先删**：没重画到的旧图先留着，游戏一直有东西可用；重画到哪条就替换哪条。

## 二、规则（2026-11-17 下午改：直接还原真实包装，不起名字）

- **包装直接还原真实产品**：配色、版式、logo 图形、盒型、烟支、滤嘴、爆珠都照真实的那一款画，越像越好。游戏会把图压成像素画再用，所以细小的字会变成色块，不用担心字写不清。
- **不要起名字**：不再给产品编原创名。JSON 里的 `name` 改成**种类名**——香烟写规格描述（如「红色硬盒」「蓝色爆珠细支」），零食饮料写种类（如「原味薯片」「可乐」「拉格啤酒」「巧克力棒」「能量饮料」）。真实品牌名只写进 `inspiration` 给内部核对，游戏里不显示。
- 另加一个字段 `type_zh`：零食饮料的种类名（两到四个字，如「薯片」「可乐」「啤酒」「巧克力」「软糖」「杯面」），游戏里只显示这个。
- 图片规格、文件夹结构、其他 JSON 字段沿用 `docs/gemini-asset-brief.md` 的第三、四、五节；`country` 填产地即可。
- 每做完一小批就实时写进 JSON，游戏这边随时接入。
- 顺序：清单里已经做过的全部按新规则重画（先烟、再饮料、再零食，每一轮穿插 2 款烟 + 1 款饮料 + 1 款零食），都按下面清单的先后。

## 三、香烟（约 95 款，按受众广度排，越靠前越先做）

1. 万宝路 硬盒红
2. 万宝路 金
3. 万宝路 冰爆（蓝色爆珠）
4. 云斯顿 经典红
5. 云斯顿 蓝
6. L&M 红
7. L&M 蓝
8. 中华 硬红
9. 中华 软红
10. 红塔山 经典 1956
11. 双喜 硬经典
12. 骆驼 蓝
13. 骆驼 原味（黄盒）
14. 七星 Mevius 原味
15. 七星（Seven Stars）
16. ESSE 爱喜 Change（爆珠超细）
17. ESSE 爱喜 金（Special Gold）
18. 箭牌 Chesterfield 红
19. 好彩 Lucky Strike 红
20. 健牌 Kent 蓝
21. 百乐门 Parliament 水蓝
22. 百乐门 Parliament 深蓝
23. 登喜路 Dunhill 国际（红盒）
24. 大卫杜夫 Davidoff 经典
25. 乐富门 Rothmans 蓝
26. 波迈 Pall Mall 红
27. 本森 Benson & Hedges 金
28. 新港 Newport 薄荷
29. 美国精神 Natural American Spirit 绿松石
30. 玉溪 软
31. 云烟 软珍品
32. 芙蓉王 硬
33. 利群 新版
34. 利群 阳光
35. 黄鹤楼 软蓝
36. 南京 炫赫门（细支）
37. 南京 红
38. 白沙 精品
39. 黄山 红方印
40. 苏烟 五星红杉树
41. 娇子 宽窄如意
42. 七匹狼 通仙
43. 泰山 红将军
44. 长白山 777
45. 黄金叶 天叶
46. 贵烟 跨越
47. 真龙 起源
48. 红河 软甲
49. 钻石 荷花
50. 熊猫
51. 中南海 8mg
52. 兰州 硬珍品
53. 云烟 小熊猫
54. Gudang Garam Surya（丁香烟）
55. Sampoerna A Mild
56. Djarum Super（丁香烟）
57. Dji Sam Soe（丁香烟）
58. 三五 555 金
59. Gold Flake（印度）
60. Classic Milds（印度）
61. Wills Navy Cut（印度）
62. Fortune（菲律宾）
63. 和平 Peace
64. Hope（日本短支）
65. Pianissimo Peche（日本女士细支爆珠）
66. 爱喜 ESSE One（超细低焦）
67. This（韩国）
68. Raison French Black（韩国爆珠）
69. 骆驼 Crush（爆珠）
70. 健牌 Kent 炫蓝 HD
71. 箭牌 Chesterfield 蓝
72. 波迈 Pall Mall 蓝
73. 好彩 Lucky Strike 蓝
74. 万宝路 黑薄荷（日版）
75. 万宝路 紫爆（日版双爆珠）
76. Vogue 超细
77. Virginia Slims 超细
78. Sobranie Black Russian（黑盒金嘴）
79. Sobranie Cocktail（彩色烟纸）
80. 高卢 Gauloises Blondes
81. 吉坦 Gitanes Brunes
82. Ducados（西班牙黑烟草）
83. Fortuna（西班牙）
84. Philip Morris 蓝
85. Bond Street 红
86. LD 红（俄罗斯畅销）
87. Ява 金（俄罗斯老牌）
88. Kiss 超细（俄罗斯女士烟）
89. Belomorkanal（白海运河，长纸管卷烟）
90. Peter Stuyvesant（南非）
91. Derby（巴西）
92. Belmont（智利）
93. Djarum Black（黑烟纸丁香烟）
94. 大卫杜夫 Davidoff 金
95. 黑魔鬼 Black Devil（黑烟纸香草味）

## 四、零食（约 45 款，世界公认、受众广）

1. 乐事 原味薯片（黄袋红飘带）
2. 品客 原味（红色长筒）
3. 多力多滋 超浓芝士（黑袋三角片）
4. 奇多 脆条（橙袋）
5. 奥利奥 原味（蓝色长条装）
6. 奇巧 KitKat 四指（红包装白椭圆）
7. 士力架（棕色包装蓝字）
8. M&M's 牛奶巧克力豆（黄袋彩豆）
9. M&M's 花生
10. Twix（金色双条）
11. 玛氏 Mars 巧克力棒
12. 百奇 Pocky 巧克力（红盒细棒）
13. 百奇 Pocky 草莓
14. 瑞士三角 Toblerone（三棱柱）
15. 费列罗 Ferrero Rocher（金箔球，三粒装）
16. 健达缤纷乐 Kinder Bueno
17. 妙卡 Milka 阿尔卑斯牛奶巧克力（淡紫色）
18. 吉百利 Cadbury Dairy Milk（紫色）
19. 瑞士莲 Lindt Lindor（红色球）
20. 好时 Hershey's 牛奶巧克力
21. 里斯 Reese's 花生酱杯
22. 哈瑞宝 Haribo 金熊软糖
23. 彩虹糖 Skittles
24. 曼妥思 Mentos（一卷）
25. 珍宝珠 Chupa Chups 棒棒糖
26. 嘀嗒糖 Tic Tac
27. 益达 / Orbit 口香糖
28. 乐事 洋葱味（绿袋）
29. 品客 酸奶洋葱
30. 多力多滋 酷牧场（蓝袋）
31. 波乐 Ruffles 原味（波浪片）
32. Takis Fuego（紫袋辣卷）
33. 卡乐比 虾条（Kappa Ebisen）
34. 好丽友 巧克力派
35. 合味道 杯面（白杯红带）
36. 辛拉面 杯面（红杯）
37. 旺旺 雪饼
38. 大白兔 奶糖
39. 卫龙 辣条
40. 乐天 Pepero（细长巧克力棒，韩国）
41. 趣多多 Chips Ahoy 曲奇
42. 乐之 Ritz 饼干
43. 绅士 Planters 盐焗花生
44. Nutella & Go（榛子酱配饼干棒）
45. Jack Link's 牛肉干

## 五、饮料（约 35 款，世界公认、受众广）

1. 可口可乐 红罐
2. 零度可乐 黑罐
3. 百事可乐 蓝罐
4. 雪碧 绿罐
5. 芬达 橙味
6. 七喜
7. 激浪 Mountain Dew
8. 胡椒博士 Dr Pepper
9. 红牛（蓝银格子细罐）
10. 魔爪 Monster（黑罐荧光绿爪痕）
11. 喜力 Heineken 绿瓶
12. 科罗娜 Corona 透明瓶（瓶口塞青柠）
13. 百威 Budweiser 红罐
14. 朝日 Super Dry 银罐
15. 青岛啤酒
16. 时代 Stella Artois
17. 健力士 Guinness 黑罐
18. 嘉士伯 Carlsberg 绿罐
19. 麒麟 一番榨
20. 真露 Chamisul 烧酒绿瓶
21. 杰克丹尼 Jack Daniel's 方瓶黑标（小瓶）
22. 尊尼获加 Johnnie Walker 黑方（小瓶）
23. 皇冠 Smirnoff Ice
24. 立顿 柠檬冰红茶
25. 亚利桑那 Arizona 绿茶大罐
26. 宝矿力 Pocari Sweat
27. 佳得乐 Gatorade
28. 依云 Evian
29. 星巴克 星冰乐瓶装
30. 雀巢 罐装咖啡 / Georgia 罐装咖啡
31. 伊藤园 绿茶（Oi Ocha）
32. 王老吉 红罐
33. 农夫山泉
34. 养乐多 Yakult
35. 维他 柠檬茶
