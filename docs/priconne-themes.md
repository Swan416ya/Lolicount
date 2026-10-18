# 公主连结剧情立绘主题

新增 `pcr-<story-model-id>` 静态立绘主题。每个剧情模型单独一个主题，服装与姿势不跨模型混用；同一模型中的身体、眼睛和嘴巴按 `config.json` 独立随机抽取。

主题覆盖两份资源清单中的角色立绘，包含剧情姿势、现实世界服装和 NPC；导出数量与验证结果见本页下方的快照验证记录。

快照验证记录：**1,976 个主题、49,872 张去重分层、362,532 种组合、11,298 个表情参考**。分层 WebP 合计约 **610.8 MiB**，最大回拼通道误差为 **8/255**，52 个模型只有身体类别。逐模型计数与资源清单 SHA-256 见 [验证记录](./priconne-validation.json)。

## 素材范围与来源

- 快照清单：[priconne-manifest.txt](../scripts/priconne-manifest.txt)，合并 `spine2` 与 `storydata2` 中的 `spine_full_<id>` / `storydata_spine_full_<id>` 资源，按模型 ID 去重后保留 2,104 条记录，包括资源路径与内容寻址 hash。相同 ID 优先使用第一份资源包；例如日和莉、佩可莉姆的图集、骨骼与身体/眼嘴配置相同，仅资源包命名不同。
- [priconne-exclusions.json](../scripts/priconne-exclusions.json) 明确列出 128 个非立绘资源（答题面板、标题特效、道具或占位项），其余 1,976 个模型作为角色立绘导出。覆盖本次清单中的目标素材，不代表全部游戏素材或未来版本。
- 公开提取工具：[lskyset/priconne-asset-extractor](https://github.com/lskyset/priconne-asset-extractor) 支持下载游戏资源清单、提取 Unity 图片与文本；[MightyZanark/PriconneUtils](https://github.com/MightyZanark/PriconneUtils) 也提供日服资源下载流程。它们是工具仓库，并非完整美术素材镜像。
- 原始资源来自游戏公开 CDN `https://prd-priconne-redive.akamaized.net/dl/pool/AssetBundles/<hash 前两位>/<hash>`。本 PR 提交处理后的静态分层，不提交 Unity 资源包或游戏数据库。
- 日文名称来自游戏主数据库的单位/角色记录，冻结在 [priconne-names.json](../scripts/priconne-names.json)。中文别名对照 [wthee/pcr-tool-sql-diff](https://github.com/wthee/pcr-tool-sql-diff/tree/708213df9b6fe9aad632801dadc98e0ffc30cbab/cn/data/unit_data.sql)；该项目也提供[公开数据库字段映射](https://github.com/wthee/pcr-tool-sql-diff/tree/708213df9b6fe9aad632801dadc98e0ffc30cbab/jp_hash)。1,354 个模型能对应角色名；622 个没有可靠对应记录的 NPC/剧情模型使用 `Story <id>` 标签，保留准确素材编号。
- 原游戏美术版权归 Cygames 等各权利方所有；工具仓库的代码许可不等同于游戏美术许可。

## 分层格式与处理

每个目录包含 `ren.json`、`config.json`、`display.json`、`meta.json` 和 `ren/*.webp`。画布最长边为 640–800px，默认显示高度 400px。`ren.json[0]` 为占位项，其余层从 1 开始；范围为数组的闭区间索引。同一类别在清单中连续排列，范围内不会混入其他类别。

导出器先将 Unity 图集的预乘 RGB 转换为普通透明度，再使用 Spine 3.6 在固定姿势、同一画布上逐个渲染部件。图集本身已含抗锯齿透明度，因此离线导出关闭额外 MSAA，避免重叠图层分开渲染时产生不同的边缘解析。透明图片按完整像素和坐标去重，以无损 WebP 保存，避免眼嘴接缝被有损压缩放大。缩放、图集旋转和裁切偏移由匹配版本的渲染器处理。

保留源模型图层顺序：通常为身体 → 眼睛 → 嘴巴；莉玛模型使用身体 → 嘴巴 → 眼睛。源素材只有身体的 NPC 或铠甲版纯 `pcr-104711` 不虚构眼嘴差分；少数只有整体变换的身体 skin 保留为身体候选。特殊表情 skin 也参与导出。

`004511`、`004512`、`004513` 三个蒙面 NPC 的源图集引用了没有随资源包提供的第二张脸部纹理页。导出时仅保留实际存在的身体页与身体附件，规则明确记录在 [priconne-source-overrides.json](../scripts/priconne-source-overrides.json)，不生成不存在的眼嘴部件。

Spine 仅用于离线素材处理。计数器运行时使用项目已有的静态 SVG 分层合成，不加载 Spine、Unity 或动画运行时。

## 重新生成

准备 Python 3.12+、Pillow、numpy、Playwright 和 Chromium：

```sh
python -m pip install Pillow numpy playwright
python -m playwright install chromium
```

用上述公开工具按清单获取并提取素材。为每个模型准备 `models/pcr-<id>/dyn.json`（Spine 3.6 JSON）、`dyn.atlas` 和图集 PNG。二进制 `.skel` 需要先通过兼容 3.6 的转换工具转为 JSON；不能用 3.8 读取器直接解释 3.6 二进制。

另行准备与 3.6.39 数据匹配的 Spine 3.6 WebGL runtime（例如 [esterTion 的 3.6 runtime 分支](https://github.com/esterTion/spine-runtimes/tree/3.6/spine-ts)），然后在仓库根目录执行：

```sh
python scripts/gen-priconne-themes.py \
  --models /path/to/models \
  --runtime /path/to/spine-3.6.js \
  --manifest scripts/priconne-manifest.txt \
  --names scripts/priconne-names.json \
  --report /tmp/priconne-report.json
```

支持 `--only 105811 105911 106011` 生成指定模型，`--partition 0 3` 分片处理，`--max-edge 640` 控制素材分辨率，以及 `--resume` 根据同一报告继续。默认读取非立绘排除清单。生成器同时输出主题库 WebP 预览图。角色搜索信息在 [priconne-themes.json](../web/app/data/priconne-themes.json)，包含中文/日文名称、罗马音与素材编号。

每个表达式都把独立分层回拼结果与整图渲染对比。透明渲染的像素舍入允许最大通道误差 8/255、整张图平均误差不超过 0.1/255；超出的模型记录为失败并在批次结束时返回非零退出码，不能算作成功导出。生成时还检查图层触及画布边缘的裁切问题。

## 验证与人工预览

```sh
go run ./cmd/check-theme
node scripts/validate-theme-meta.js
node scripts/gen-themes-json.js
go test ./internal/imgcore/...
pnpm --dir web generate
```

`TestPriconnePortraits` 从资源清单与非立绘排除规则推导期望主题集合，使用真实加载器读取每个 `pcr-` 主题，检查类别区间、所有分层尺寸与坐标，并以不同选择验证生产懒加载合成的 SVG 格式、图层数量和组合变化。测试不固定主题数量。

启动开发服务后，打开 `/themes?theme=pcr-105811`，在“公主连结！Re:Dive”分组选择角色，检查计数器预览；重复请求 `/@demo?theme=pcr-105811` 可以看到不同眼嘴组合。也可检查可可萝 `pcr-105911`、凯露 `pcr-106011`、莉玛 `pcr-105211`、纯 `pcr-104711`。

![角色预览](images/priconne-preview.webp)

相同角色的不同剧情造型独立成主题，避免跨造型随机拼出错位组合：

![剧情造型预览](images/priconne-story-poses.webp)

同一身体的独立眼睛 × 嘴巴组合（行是眼睛，列是嘴巴）：

![眼嘴组合预览](images/priconne-expressions.webp)
