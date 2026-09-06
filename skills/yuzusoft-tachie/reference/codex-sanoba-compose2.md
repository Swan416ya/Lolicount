# 任务：合成《魔女的夜宴》完整立绘（当前缺脸部）—— 续

## 铁律（最重要）
**绝对不要用任何方式读取/查看图片文件**（当前模型不是多模态，读图会直接让 API 报 400 崩溃，上次任务就是这么死的）。验证合成结果只能用 PIL 像素统计：
- 判断"脸是否存在"：统计头部区域的**深色像素数量**（亮度 < 100 的像素）——有眼睛/眉毛/嘴 = 大量深色像素集群；空白脸 = 几乎没有
- 判断图层叠加成功：alpha 通道非零像素数量变化
- 可以保存调试 PNG 但**永远不打开查看它**

## 背景
上一轮工作已把游戏资源全部解密：
- `E:\tmp\sanoba-final\` — 解密+还原文件名的原始文件（11 个角色文件夹，含 .pbd / .sinfo / .tlg / .csv / .tjs）
- `E:\tmp\sanoba-png\` — TLG 转 PNG（1493 张，按角色分文件夹）
- `E:\tmp\sanoba-work\` — 前两轮会话的全部工作脚本和发现（cx_engine.py、hx_decrypt.py、probe_*.py、garbro-src\ 是 GARbro 源码）

## 已知发现（上次会话的成果，脚本都在 sanoba-work）
- 大图（如 寧々a_0_1875.png, 640x1717）是身体立绘但**脸部空白**（眼睛/嘴/眉是运行时叠加的独立小图层）
- 图层分组：按 `角色a_`/`角色b_`/`角色a_0_`（1x）/`角色b_0_` 前缀分组，如 寧々a 有 96 个图层 [1284, 1291, 1292, 1312, 1314, 1315, 1316, 1317, 1742, 1743...]，寧々b 有 57 个
- `寧々a.pbd` / `寧々a.sinfo` 是二进制的图层定义文件；.sinfo 头部是 `fe fe 01 ff fe ...` 的小型 tag 格式（probe_sinfo.py 有初步 dump）
- 游戏引擎的立绘合成逻辑在 tjs 脚本里：`standimage.tjs`、`standinformation.tjs`、`affinesource*.tjs`（在 sanoba-final 的 data 相关目录或 hash 文件里，上轮已dump过清单）——**读这些 tjs 源码是搞懂图层坐标/组合规则的最快路径**
- GARbro 源码在 `E:\tmp\sanoba-work\garbro-src\`（搜 psb/pbd/立绘/PsDiagram 相关代码，GARbro2 GUI 有内置立绘合成器，算法可参考）

## 目标
按图层定义把身体 + 脸部器官正确合成，输出**带脸的完整立绘**：
- 输出到 `E:\tmp\sanoba-composed\`，按角色分文件夹，PNG 保留透明
- 至少覆盖 7 名女主角：寧々、めぐる、紬、憧子、和奏、七緒、佳苗（其余角色有更好）
- 每角色至少 1 张默认表情立绘，多套服装更好
- 五官位置必须正确（用像素统计验证：头部区域深色像素集群在合理位置）

## 建议
1. 先读 tjs（standimage.tjs / standinformation.tjs）和 .sinfo/.pbd 的解析，搞懂"哪个 layer_id 组合 = 一套完整立绘、坐标怎么定"
2. 先合成寧々 1 张，用像素统计验证有脸，再批量
3. 注意 1x（_0_ 前缀）和 2x 图层不要混用

## 注意
- 只读 sanoba-final / sanoba-png，不改它们；中间产物放 sanoba-work
- 别动游戏目录
