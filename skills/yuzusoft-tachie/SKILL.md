---
name: yuzusoft-tachie
description: 解包柚子社（Yuzusoft）游戏的 KrKr 资源并合成人物立绘，转成 Lolicount 多图层主题。适用于两代加密：2016 前后的老 Cxdec（如千恋＊万花）和 2021+ 的 Wamsoft Hxv4 Cxdec（如 Steam 版サノバウィッチ）。当用户要求提取某柚子社游戏的立绘/做主题时使用。
---

# 柚子社立绘解包与主题制作

以《魔女的夜宴》（サノバウィッチ，Hxv4 新加密）和《千恋＊万花》（2016 老 Cxdec）
两代实战验证过的完整流程。其他柚子社游戏（同一引擎）按「新游戏适配清单」先判断
加密世代再选路线，只有文件名和角色清单需要换。

## 总流程（五步）

```
游戏目录 (.xp3) → ①静态解密 → ②还原文件名 → ③TLG→PNG
→ ④pbd/sinfo 解析 + 图层合成 → ⑤Lolicount 主题结构
```

**核心认知（最重要的一条）**：柚子社立绘是**运行时图层系统**——大图（640×1717 那种）是
身体，但**脸部是空的**（眼睛/嘴/眉是独立小图层，游戏按 .pbd 里的 layer_id + 坐标动态叠
加）。所以「提取图片」永远不够，必须拿到**坐标定义文件**（.pbd）和**组合规则文件**
（.sinfo）才能拼出带脸的完整立绘。

## ① 解密 xp3（Hxv4 Cxdec，2021+ 新加密）

**不要浪费时间尝试的路线（全部实测失败）**：
- GARbro v1.5.44 选 "CxEncryption" → 输出只是原始数据 XOR 0x01，密钥错误
- GARbro2 选 "HxCrypt" → 输出 XOR 0xF5，同样错（HxCrypt.Init() 是空实现）
- GARbro.Console.exe → 不应用 scheme，输出原始密文
- CxdecExtractorLoader 注入 → 游戏进程卡在 6MB 然后静默退出
- KrKr Extractor 这类需要挂着游戏进程的 GUI 工具 → 弹窗内容看不见，无法操作
- 让多模态 AI 看 GUI 截图操作 → 不可靠，别走这条路

**成功的路线：纯静态解密（无需运行游戏）**。加密结构（读 crskycode/GARbro 的
HxCrypt.cs + 逆向得出）：

1. xp3 索引本身用 **ChaCha** 加密（`expand 32-byte k`，key/nonce/seed 从固定参数派生）
2. 每个文件的内容 = zlib 分段解压后：
   - **4 字节循环 XOR** 为主体（同一个字节重复 4 次，按 offset 轮转）
   - 2 个单字节修补位（位置由 key 派生）
   - 分两段：split 在 `m_offset + (hash & m_mask)`，前段用 `hash` 派生 key，
     后段用 `hash ^ (hash>>16)` 派生 key
   - key 由 **CxProgram VM**（控制块 + RandomType）从文件 hash 算出，控制块在游戏
     运行时 DLL 里——需要用 x86 迷你模拟器执行控制块字节码拿到 key

**现成实现**（都在本 skill 的 `tools/` 和 `keys/`，直接复用）：
- `tools/hx_decrypt.py` — ChaCha 实现
- `tools/cx_engine.py` — CxProgram VM 的 x86 模拟器（含 0xaaaaaaaa/0x55555555 位运算指令）
- `keys/all_xp3_keys.json` — 已 dump 的全部 key 表（`{混淆名: [(xp3名, 段号, key), ...]}`）
- `tools/xp3_extract.py` — xp3 索引解析器（能解析出全部条目）

其他可用资源：
- HxCrypt 源码参考：`tools/HxCrypt.cs`、`tools/HxCryptLite.cs`
- GARbro2（含 Image.Convert.exe，用于 TLG→PNG）：第三方工具，去 GARbro2 发布页下载
  （原先在 `E:\tmp\garbro2\`，tmp 目录不保证留存）
- 社区教程：kungal.com/topic/2670（方法论来源）

## ② 还原文件名

解出来的文件名是单汉字混淆名（倀倁倂…）。用映射表按 hash 还原（格式 `hash:name`）：
魔女的夜宴的表在本 skill 的 `names/HxNames-Sanoba.lst`。其他游戏需要找对应的
HxNames-<游戏>.lst（GARbro2 仓库/社区有收集）。

## ③ TLG → PNG

立绘是 TLG5/TLG6 格式（注意：游戏带 psbfile.dll，部分资源可能是 PSB，先看文件头）。
用 GARbro2 的 `Image.Convert.exe` 批量转 PNG（保留透明通道）。

**倍率陷阱**：文件名 `角色a_0_NNNN.png` 的 `_0_` 是 **1x 版**，不带 `_0_` 的是 2x 版。
图层混合必须用**同一倍率**，混用会错位。

## ④ pbd / sinfo 解析与图层合成（本 skill 的核心）

### .pbd — 图层坐标定义（二进制）

用本 skill 的 `tools/pbd2json.exe`（来自 gal_tachie_ai 工具包）把 .pbd 转成 TSV 文本
（示例产物：`reference/めぐるa_0.txt`）：

```
#layer_type  name        left  top   width  height  type  opacity  visible  layer_id  group_layer_id
             (画布行)                  1875   2656
0            魔女服用補正  926   864   69     53      13    255      0        1742
0            頬           801   954   200    104     16    255      0        1745
0            怒りHL       838   951   128    38      13    255      1        2547      2740
```

- 第一行数据行是画布尺寸（width/height 列）
- 图片文件名规则：`<角色set>_<倍率>_<layer_id>.png`（如 `寧々a_0_2354.png`），
  layer_id 直接对应文件名
- 合成 = 在画布尺寸的透明画布上按 (left, top) `alpha_composite` 各图层

### .sinfo — 组合规则（编码的 TSV）

**编码方式**：文件头 `fe fe 01 ff fe`，UTF-16 文本，每个 16 位字符做**相邻位对交换**：

```python
ch = ((ch & 0xaaaa) >> 1) | ((ch & 0x5555) << 1)
```

解码后是 TSV。现成解码器：`tools/decode_fe.py` / `tools/decrypt_fe.py`。

**规则语义（踩坑后总结）**：

```
dress  x裸     diff  1   裸            ← 服装组合规则
dress  x裸     diff  1   前髪
dress  x裸     diff  2   裸腕差分       ← diff 1/2 是【二选一的替代姿势】！
face   01      base  表情差分/表情ベース  ← 表情 → 图层路径
face   02      base  表情差分/01
```

注意：**HL（高光）配对不来自 sinfo**，而是 pbd 图层命名约定——表情层 `怒り` 与
高光层 `怒りHL` 同名前缀，按名字配对叠加。gal_tachie 脚本还支持 facegroup /
fgname / fgalias 规则类型，魔女的夜宴的 sinfo 里只有 dress 和 face 两种，
其他游戏可能多出分组规则。

### 图层分类启发式（classify，见 gen_sanoba_themes.py）

| 名称特征 | 类别 | 说明 |
|---|---|---|
| `前髪` | 刘海默认层 | 叠加在服装上 |
| `X用前髪` / `X用補正` | 特定服装的刘海修正 | 按 X 关联 |
| `腕差分独立` | **完整独立身体** | 直接作为一个候选 |
| `腕差分`（非独立） | 手臂差分 | **是替代姿势，不是叠加层！** |
| `XHL` | 高光 | 与同名表情 X 叠加 |
| `X用効果` | 表情特效 | 与 X 叠加 |
| `頬*` | 脸颊/腮红 | face 类 |
| 高度 > 800px | 身体/服装 base | 站姿都很高 |
| 宽 120–700px | 表情 | 眼/嘴区域尺寸 |

### 合成规则

- **lass（服装）**：按 sinfo 的 dress 规则取图层列表合成。**diff 1 和 diff 2 是游戏里
  二选一的手臂姿势**——每个 diff 各自成为一个独立候选，绝不能把 base 和 腕差分 叠在一起
  （会得到四只手）
- **eye（表情）**：表情 base + 同名 HL + 同名用効果，三层 alpha_composite
- **face（脸颊）**：頬* 层直接用
- 合成后按内容 bbox 裁剪，记录 (left, top) 偏移用于主题定位

## ⑤ 转 Lolicount 主题结构

每个角色一个主题目录 `assets/theme/<theme-name>/`：

```
config.json   {"canvasW": 画布宽, "canvasH": 画布高, "ranges": {"lass": {first,last}, "eye": {...}, "face": {...}}}
ren.json      图层清单（name/left/top/width/height/visible/layer_id/group_layer_id）
ren/1.webp …  各图层图（WEBP quality=90 method=6，透明背景）
display.json  {"size": 400, "crop": 全图层并集 bbox}
```

生成器：`tools/gen_sanoba_themes.py`（换 CHARS 清单即可用于其他游戏，脚本顶部的
SRC/PNG/OUT 三个路径也要按新游戏改；魔女的夜宴的全部 pbd/sinfo 文本产物在
`reference/`）。新主题是目录扫描自动注册的，不用改 themes.json（只有旧式帧主题才需要注册）。

## 踩过的坑（必读）

1. **四只手**：把 base 服装和 腕差分 当叠加层合到一起了。sinfo 的 diff 1/diff 2 是
   **替代关系**（游戏里二选一），各自独立成候选。
2. **没表情（光滑的脸）**：表情层没叠上去（.pbd 坐标没用）；或叠了**稀疏的混眼
   overlay**——这类层不透明像素只有 ~1000（完整表情是 2900–4700），叠加后看起来还是
   没表情。**过滤规则：合成后 opaque_count（alpha>30）≥ 1500 才保留**。
3. **1x/2x 混用错位**：`_0_` 前缀是 1x，必须同倍率合成。
4. **身体图缺件**：某个服装组合引用的 body 图层 PNG 不存在时（h>800 的层缺失），
   整个候选直接放弃，不要硬拼。
5. **NSFW 内容过滤**：sinfo 里有 裸/発情/乳 等条目，公开仓库必须排除
   （`EXCLUDE = ("裸", "発情", "乳")`）。
6. **别信 GUI 提取器**：需要挂游戏进程的工具（KrKr Extractor 类）在无头/自动化环境
   全部不可靠，纯静态解密才是正路。
7. **验证用像素统计，别用眼睛看**：判断「有没有脸」用头部区域深色像素（亮度<100）
   数量；判断叠加成功用 alpha 非零像素数变化。（如果是多模态模型可以直接看图。）

## 新游戏适配清单

**先判断加密世代**（决定走哪条路线）：

- **2021+ 新加密（Hxv4 Cxdec，如魔女的夜宴 Steam/汉化版）**：索引本身 ChaCha
  加密，文件名是单汉字混淆名。走下面 1–7 步。
- **2016 前后老加密（如千恋＊万花原版）**：索引是**明文 zlib**，文件名是 MD5 样式
  十六进制。走「千恋＊万花路线」一节，工具齐全，比新加密简单得多。

### 魔女的夜宴路线（Hxv4）

1. 找到游戏全部 .xp3，用 `tools/xp3_extract.py` 解析索引，确认是 Hxv4 加密
2. 找/生成 HxNames-<游戏>.lst 映射表（GARbro2 社区通常有）
3. 用 `tools/hx_decrypt.py` + `tools/cx_engine.py` 静态解密（key 表可从游戏 DLL 的
   控制块重新 dump，或参考 `keys/all_xp3_keys.json` 的方法论）
4. GARbro2 的 Image.Convert.exe TLG→PNG，确认 1x/2x 前缀规则一致
5. `tools/pbd2json.exe` 转 .pbd → TSV；`tools/decode_fe.py` 解 .sinfo
6. 检查 sinfo 的 dress/face 规则和图层命名约定是否同构（柚子社内部高度一致，
   一般只换角色名）；调整 `tools/gen_sanoba_themes.py` 的 CHARS 表和 EXCLUDE 表
7. 生成主题 → 肉眼抽查（四只手？没表情？错位？）→ 更新
   `web/app/utils/themeMeta.ts` 元数据（kind: 'character'）→ 构建部署

### 千恋＊万花路线（2016 老加密，已实战验证）

1. **解密器**：老 Cxdec 的控制块不需要从 DLL dump——社区解密补丁
   （`补丁/解密补丁/xp3filter.tjs`）里自带完整实现。把它移植成 Python 即
   `tools/cxdec.py`（语义对照 GARbro 的 KiriKiriCx.cs：全 uint32 运算、逻辑移位；
   **移植时注意 tjs 的 `if (stage-- == 1)` 是先比较再自减**，写错会静默生成错误
   的字节码结构，解出来全是乱码但程序不报错）。
2. **文件名还原**：不要去猜 MD5 规则（小写 UTF-16LE 的 md5 也不对）。xp3 索引里
   有一个 **`sen:` 段**，指向文件内一段 zlib 压缩的名字表（adlr hash → 真名），
   `tools/yuznames.py` 负责提取；`tools/list_entries.py` 解析索引（含 sen: 段定位）。
3. **批量解密**：`tools/extract_xp3.py`（解密 + 按 magic 分类 TLG/sinfo）。
   注意 TLG magic 是 **6 字节** `TLG5.0`/`TLG6.0`，比较前 5 字节会全部分错类。
4. **坐标表**：这代游戏的 `<角色set>_0.txt`（fe 位交换编码）本身就是图层坐标表
   （画布行是**空名字行**，`int('')` 会抛异常把它丢掉——丢掉后千万别用 rows[0]
   当画布），`tools/decode_sinfo.py` 解码。
5. **TLG→PNG**：`tools/convert_tlg.py`——GARbro2 Image.Convert 输出到 CWD 且
   日文文件名会乱码，所以先复制成 md5 名再转换、转完用映射表改回真名。
6. **生成主题**：`tools/gen_senren_themes.py`（这代没有 dress/face 规则段，
   纯靠尺寸 + 命名启发式分类：h>800 为服装、頬* 为脸颊、表情用
   opaque_count ≥ 1500 过滤稀疏混眼层；`髪かぶせ`/`ケモミミ`/`NNN 涙HL` 等
   条件叠加层跳过）。
7. NSFW 过滤在老游戏同样重要：`EXCLUDE = ("裸", "発情", "乳", "下着")`
   （千恋万花的芦花有 下着 差分，容易漏）。

## 关键文件索引

全部随 skill 保管（本目录下）：

| 路径 | 内容 |
|---|---|
| `tools/hx_decrypt.py` | ChaCha 实现（Hxv4 xp3 索引解密） |
| `tools/cx_engine.py` | CxProgram VM x86 模拟器（Hxv4，从文件 hash 算解密 key） |
| `tools/xp3_extract.py` | xp3 索引解析器（Hxv4/YuzuCrypt） |
| `tools/decode_fe.py` / `decrypt_fe.py` | .sinfo 位交换解码器 |
| `tools/pbd2json.exe` | .pbd → TSV 转换器（gal_tachie_ai）。**不入库**（闭源二进制，仓库 .gitignore 排除 *.exe），需自行从 gal_tachie_ai 工具包获取 |
| `tools/krkr立繪_多工.py` | gal_tachie_ai 的立绘合成参考脚本（规则类型更多） |
| `tools/gen_sanoba_themes.py` | 魔女的夜宴主题生成器（sinfo dress/face 规则驱动） |
| `tools/cxdec.py` | 千恋＊万花老 Cxdec 的 Python 移植（xp3filter.tjs 控制块 + VM） |
| `tools/list_entries.py` | 千恋＊万花 xp3 索引解析（明文 zlib 索引 + sen: 段定位） |
| `tools/yuznames.py` | sen: 名字表提取（adlr hash → 真名，解 MD5 混淆名） |
| `tools/extract_xp3.py` | 千恋＊万花批量解密 + 按 magic 分类 |
| `tools/convert_tlg.py` | TLG→PNG 流水线（md5 名中转防日文乱码） |
| `tools/gen_senren_themes.py` | 千恋＊万花主题生成器（尺寸/命名启发式分类） |
| `tools/HxCrypt.cs` / `HxCryptLite.cs` | GARbro 的 HxCrypt 源码（加密结构参考） |
| `keys/all_xp3_keys.json` | 魔女的夜宴全部解密 key 表（1.8M） |
| `names/HxNames-Sanoba.lst` | 魔女的夜宴文件名映射表（3.7M） |
| `reference/*.txt` | 魔女的夜宴全部 11 角色的 pbd/sinfo 文本产物（格式样例） |
| `reference/codex-sanoba-*.md` | 当时给子 agent 的三份任务书（历史记录） |

**不在本 skill 里的大文件**（当时在 `E:\tmp\`，tmp 随时可能清空）：
- `sanoba-final\`（261M，解密+还原文件名的原始资源）、`sanoba-png\`（215M，TLG→PNG）、
  `tachie-work\`（17G，合成输出）、`garbro2\`（79M，GARbro2 程序）
- 这些都是**流水线的中间产物，可以用上面的工具从游戏文件重新生成**；最终主题 webp
  已在 Lolicount 仓库 `assets/theme/sanoba-*/`。需要留存的话自己把它们搬到永久目录。
