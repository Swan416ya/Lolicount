# Live2D 动态立绘（计数器）设计文档

> 状态：代码已落地（与 PSB/E-mote、Spine 挂件并列的独立 web 特性）
> 关联资源：`web/public/live2d-player.html`（JS 交互页）、`web/public/live2d/`
> （PixiJS v8 + Cubism core + Cubism 2 legacy + untitled-pixi-live2d-engine 四个 vendor 脚本）、
> `scripts/gen-live2d-model3.mjs`（为裸 Cubism 3 模型目录生成 `model3.json` 清单）
> 支持格式：Cubism 3（`model3.json` + `.moc3`）与 **Cubism 2 / BanG Dream**
> （`model.json` + `.moc`），引擎按清单自动选择运行时。
> **仅交互路径（`<iframe>`）**：Live2D 需要 WebGL + JS 实时渲染，故本特性只有
> `<iframe>` 嵌入一条路，没有免 JS 的 `<img>` 路径（见第 1 节说明）。

## 1. 背景与目标

Lolicount 的输出契约是**静态 SVG 图片**（`<img src="https://lolicount.top/@name">`），
浏览器在 `<img>` 中禁用脚本，无法承载需要 WebGL 实时渲染的内容。

Live2D 是 LIVE2D 公司出品、看板娘/VTuber/动态立绘广泛使用的 2.5D 骨骼动画格式
（Cubism 标准）。一个 Cubism 模型是**一组文件**（不是单文件），入口是模型清单。
本特性支持两种清单 / 运行时：

- **Cubism 3**：入口 `model3.json`（或 `<name>.model3.json`），配标准 `.moc3`；
- **Cubism 2（legacy）**：入口 `model.json`（或 `<name>.model.json`），配标准 `.moc`
  —— **BanG Dream!** 等游戏提取物走这条路径，由随附的 `live2d-legacy.min.js`
  （官方 Cubism 2 Web 运行时）渲染。

Cubism 3 模型清单结构示例：

```
model3.json          模型设置(必需;引用下列文件;也可命名 <name>.model3.json)
<name>.moc3          编译后的网格/顶点/变形数据,二进制(必需)
texture_00.png       贴图(必需,可多张 texture_00/01/….png)
physics3.json        物理(可选)
pose3.json           部件可见性(可选)
<group>/<motion>.mtn 动作(可选,若干)
expression/…exp3.json 表情(可选,若干)
```

Cubism 2 / BanG Dream 模型清单更简洁（`version:2`，直接引用 moc + 纹理 + 动作）：

```
model.json           {"version":2,"name":"…","model":"….moc",
                      "textures":["….png"],"motions":{…},"expressions":[…]}
<name>.moc           Cubism 2 二进制(魔数 "moc",版本字节 8–11)
texture.png          贴图
<motion>.mtn         动作(可选)
```

本功能与 Spine/PSB 挂件目标一致，但 **只有交互路径（JS）**：

1. **交互路径（JS / iframe）**：第三方网页用 `<iframe>` 引
   `live2d-player.html?model=<模型>&name=<计数名>`，页面用
   untitled-pixi-live2d-engine（基于 PixiJS v8）+ Cubism core 实时渲染角色
   + 拉取 `/api/count/@name` 显示计数。

> **为什么没有免 JS（`<img>`）路径**：Live2D 模型必须 WebGL + JS 实时渲染，
> `<img>` 里既不能跑脚本也不能开 WebGL。唯一省事的替代是构建期把某个动作预渲染成
> 动画 GIF 随二进制一起 embed（`<img>` 直接播放），但每个模型约 1MB 常驻二进制、
> 又只覆盖单个动作；而请求时再实时离屏渲染 + 编码又太慢，撑不住一个访客计数器。
> 两害相权，本特性**放弃免 JS 路径**，只提供 `<iframe>` 交互嵌入。

## 2. 整体架构

```
交互路径（JS,需 HTML+WebGL 环境）:
  第三方网页
    │ <iframe src="https://host/live2d-player.html?model=archchan&name=me&text=第 {n} 位访客">
    ▼
  live2d-player.html
    ├─ 依序加载四个同源 vendor 脚本（/live2d/）:
    │     pixi.min.js            → window.PIXI（PixiJS v8 UMD）
    │     live2dcubismcore.min.js→ window.Live2DCubismCore（Cubism 5.1 emscripten core）
    │     live2d-legacy.min.js   → window.Live2D（Cubism 2 legacy runtime,BanG Dream 用）
    │     live2d-engine.js       → PIXI.live2d（untitled-pixi-live2d-engine）
    ├─ 探测清单(GET 依次试 model.json / model3.json / <name>.model.json / <name>.model3.json)
    ├─ PIXI.live2d.Live2DModel.from(<dir>/<清单>) 载入模型
    │   （引擎自动识别 Cubism 2/3 运行时,按清单相对路径拉 moc + texture）
    ├─ 两遍拟合构图:先小比例渲染读回不透明像素框,再 contain-fit 整框填满画布(居中留边距)
    ├─ 关闭 Automator autoFocus/autoHitTest(不做鼠标/眼动跟踪)
    ├─ app.stage.addChild(model);点击画布按序 internalModel.motionManager.startMotion 切换
    └─ fetch GET /api/count/@name ──► Go 后端:自增计数,返回 JSON(no-store,CORS)
         └─ 渲染计数文字({n} 模板),画布下方居中 DOM overlay
```

与现有系统的关系：

- **不触碰 imgcore 渲染管线**。Live2D 模型不是 `imgcore` 主题，而是与 `assets/theme/`
  、`assets/psb/`、`assets/spine/` 平行的资产类别（`assets/live2d/`），后端只负责列出
  与流式下发字节，渲染全在客户端。
- **计数语义完全复用** `counter.Buffer`：交互路径的 `/api/count/@name` 与 SVG/PSB/Spine
  路径走同一套 `incrementOrDegrade`（name 级限流降级只读）与 `demo`/`number` 特例。
- **缓存铁律不变**：真实计数一律 `no-store`；模型文件是构建期固定的
  不可变字节，`max-age=31536000, immutable`。

## 3. 后端接口（Go / Fiber v3）

### 3.1 `GET /api/live2d/models`

列出 `assets/live2d/` 下含 Cubism 模型清单的模型目录名：Cubism 3 的
`model3.json` / `*.model3.json` 或 Cubism 2 / BanG Dream 的 `model.json` /
`*.model.json` 任一存在即算。返回 `{"models":["archchan",...]}`。
`Cache-Control: public, max-age=60`。目录为空或缺失时返回空列表，不报错。

### 3.2 `GET /live2d/models/:name/:file`

返回 `assets/live2d/<name>/<file>` 的字节（manifest / moc / texture / motion /
expression / physics / pose）。白名单校验：模型名 `^[a-zA-Z0-9-]+$`，文件名须匹配
`^(model3|.*\.model3)\.json$`（manifest）、`.*\.(moc3|moc)$`（moc 二进制）、
`.*\.(png|jpg|jpeg)$`（贴图）、`.*\.(mtn|motion3\.json|exp3\.json|physics3\.json|
physics\.json|pose3\.json)$`（动作/表情/物理/部件）之一，防路径穿越；不存在返回 404。

- `Content-Type` 按扩展名映射（`.json`→application/json、`.moc3`/`.moc`/`.mtn`→
  octet-stream、`.png`→image/png、`.jpg`→image/jpeg）
- `Cache-Control: public, max-age=31536000, immutable`
- `Access-Control-Allow-Origin: *`（字节公开，计数器页跨域加载）

### 3.3 `GET /api/count/@:name`

与 SVG/PSB/Spine 路径完全一致的计数接口（`no-store`，demo→固定串，number>0→直接
返回，否则 `incrementOrDegrade`），交互页用它取计数值。

### 3.4 `/api/themes` 集成

`listThemes`（`internal/server/api.go`）在 PSB 之后追加 Spine 与 Live2D 模型，
均带 `animated:true` 与 `kind`（`"psb"` / `"spine"` / `"live2d"`），供前端主题下拉
区分渲染器。`kind` 字段为向后兼容新增，老客户端忽略即可。

### 3.5 路由注册顺序

`/api/live2d/models`、`/live2d/models/:name/:file`
两条路由都在 `registerRoutes()` 中、`registerFrontend()` 之前注册（Fiber 按注册
顺序匹配，显式 `Get` 路由优先于 frontend catch-all 的 `Use("*")`）。

> **vendor 脚本（`/live2d/*.js`）不走上述 Go 路由**：它们是纯前端静态资源，随
> Nuxt `web/public/live2d/` 进入 `assets/dist/live2d/`，由 frontend catch-all 的
> `SendFile` 直接 serve（`.js`→application/javascript）。这与 `spine-3.8.js` 的处理
> 一致。

## 4. 模型资产

### 4.1 目录约定

```
assets/live2d/
  README.md            # 放置说明(入库)
  .gitkeep
  <model-name>/
    model3.json        # Cubism 3 清单(或 <name>.model3.json),与下面 model.json 二选一
    model.json         # Cubism 2 / BanG Dream 清单(或 <name>.model.json)
    <name>.moc3        # Cubism 3 二进制(被 model3.json 引用)
    <name>.moc         # Cubism 2 二进制(被 model.json 引用)
    texture_00.png [texture_01.png …]
    [physics3.json] [pose3.json]
    [<group>/<motion>.mtn …]
    [expression/…exp3.json …]
```

`assets/embed.go` 已含 `//go:embed all:live2d`。新增模型放入对应目录后重启即被
`embed.FS` 打包；没放则模型列表为空。**仓库只提交放置流程，不提交模型二进制**
（与 PSB/Spine 一致，见 `assets/live2d/README.md`）。

### 4.2 只接受标准 Cubism `.moc3` / `.moc`（**关键约束**）

官方运行时只解析**标准格式**，非标准容器无法载入：

- **Cubism 3**：`live2dcubismcore.min.js` 只解析标准 Cubism Editor 产出的 `.moc3`
  （魔数 `MOC3`（`4d 4f 43 33`）、小端 section table）；
- **Cubism 2 / BanG Dream**：`live2d-legacy.min.js` 只解析**标准 moc**（魔数 `moc`、
  版本字节 8–11）。**BanG Dream 提取物正是标准 Cubism 2 moc，可直接渲染**——这正是
  本特性支持 BD 的依据。

以下**非标准容器**两种运行时都无法解析（`fromArrayBuffer` 返回 null / `Invalid moc
data`）：某些游戏提取工具产出的自定义打包格式（如魔数为 `moc\x0b`（`6d 6f 63 0b`）、
带 LEB128 头部与内嵌 zlib 流的那一类）。这类文件放进 `assets/live2d/` 后引擎在载入
阶段报错。

因此：**模型必须是标准 `.moc3`（Cubism 3）或标准 `.moc`（Cubism 2）**。若为上述非
标准容器，需先用相应工具重新编码为标准格式才能使用，否则只能本地验证结构、不能渲染。

### 4.3 模型清单的关键字段（引擎校验）

untitled-pixi-live2d-engine 的 `CubismModelSettings.isValidJSON` 要求（Cubism 3）：

- `FileReferences.Moc` 必须是**字符串**；
- `FileReferences.Textures` 必须是**非空字符串数组**（空 `[]` 会判失败）；
- `Version` 必须为 **4**（引擎注册的 runtime 版本只有 `"4"`[Cubism] 与 `"2"`[Cubism 2
  legacy]，`Version:3` 两者都不匹配，报 `no matching runtime found`）。

Cubism 2 / BanG Dream 清单更简单（`version:2`，直接 `model` 字符串 + `textures` 数组
+ `motions`/`expressions`），引擎的 legacy runtime 直接读取。

`scripts/gen-live2d-model3.mjs` 可为一个裸 Cubism 3 模型目录生成符合上述约束的
`model3.json`（扫描 `.moc3`/`.png`/`.mtn` 等填充 `FileReferences`）。

### 4.4 模型从哪来

Live2D 模型多为游戏/商业素材（版权敏感），获取途径：

1. 自制或有权分发的模型；
2. 游戏内 Cubism 资源提取（工具如 Live2D Model Extractor 等，**只能本地测试**，
   且须为标准 moc3，见 4.2）；
3. 社区再导出 / 官方示例（如 BanG Dream 等企划的角色模型——注意其版权与格式）。

无论来源，**公开部署前运营者需自行确保模型授权**。仓库不收录任何模型文件。

## 5. 前端交互页（`web/public/live2d-player.html`）

自包含单页（原生 JS，无构建依赖），随 Nuxt `web/public/` 进入 dist，由 frontend
catch-all 直接 serve，后端零改动（仅新增的 `/live2d/models/` 资产路由 +
`/api/live2d/models`）。

| 查询参数 | 说明 | 默认 |
|---|---|---|
| `model` | 模型目录名（`assets/live2d/<model>/`） | 无（缺则报错） |
| `name` | 计数名 | `demo` |
| `text` | `{n}` 计数文字模板 | `第 {n} 位访客` |
| `scale` | 模型显式缩放倍数 | `1` |

职责：

1. 解析参数，从 `location.pathname` 推导站点根 `base`（兼容 Nuxt basePath；按尾段
   匹配 `live2d-player`，而非 `.html` 后缀，避免产出 `/live2d-player.html/` 这种坏路径）；
2. 依序加载四个 vendor 脚本（`pixi.min.js` → `live2dcubismcore.min.js` →
   `live2d-legacy.min.js` → `live2d-engine.js`）；
3. `new PIXI.Application({backgroundAlpha:0, antialias:true, autoStart:true})`
   + `await app.init({...})`（**不传 `canvas`**：本 Pixi v8.20.1 构建里
   `new PIXI.Application({canvas})` 不会绑定传入的 canvas，Pixi 会自建一张游离
   canvas 渲染进去，导致 `#c` 全空；所以让 Pixi 拥有自己的 canvas，最后用
   `canvas.replaceWith(app.canvas)` 把 `#c` 换掉）；
4. 探测清单：依序 GET 试 `model.json` / `model3.json` / `<model>.model.json` /
   `<model>.model3.json`（Cubism 2 / BanG Dream 用 `model.json`，Cubism 3 用
   `model3.json`），校验响应为 JSON manifest 后 `PIXI.live2d.Live2DModel.from(dir +
   manifest)` 载入，引擎按 manifest 自动选 Cubism 3 核心或 Cubism 2 legacy
   运行时；`app.stage.addChild(model)`。用 GET 而非 HEAD：后端 `/live2d/models/`
   路由只注册了 GET，HEAD 会落到 SPA catch-all 误报存在；
5. 两遍式构图（`fitModelToCanvas`）：先小比例渲染并读回不透明像素框，再据此
   contain-fit 把**整个**不透明框放进画布（居中 + 四周 `MARGIN=0.04` 留边距），
   全身体 / 半身模型都能完整显示，不做半身裁剪、也不上移偏移；
6. 关闭引擎 `Automator` 的 `autoFocus` / `autoHitTest`，角色眼睛与头部**不**跟随
   鼠标（去掉眼动跟踪）；
7. 点击画布切换动作：MotionManager 挂在 `model.internalModel.motionManager`
   （公开 `Live2DModel` 是 Pixi Container 包装，本身无 `motionManager` 属性）；
   遍历其 `definitions` 把每个 `[group, index]` 收进列表（跳过 `-` 分隔行与
   「初期化 / 視線追従」），每次点击按序 `mm.startMotion(group, index)` 换下一个
   动作（MotionManager 的 API 是 `startMotion`，不是 `playMotion`）。加载时先放
   一个 idle（或首个）动作让角色动起来。模型未带 `.mtn` 动作文件时点击无效果、
   保持静态 idle；
8. `fetch(base + 'api/count/@' + name)` 取计数，`{n}` 替换后渲染在画布下方 DOM
   overlay 上；
9. 运行库缺失 / 模型缺失 / 解析失败时，在页面内显示文字错误提示，不白屏。

> **加载顺序是硬约束**：引擎 `live2d-engine.js` 的 UMD 工厂在求值时检查
> `"Live2D" in window`（Cubism 2 legacy runtime），缺失即抛 `Could not find Cubism 2
> runtime`，于是 `PIXI.live2d` 未挂上、`Live2DModel` 为 undefined。四个脚本**必须**
> 按上表顺序加载。`pixi.min.js` 提供 `window.PIXI`（引擎工厂签名为
> `factory((global.PIXI.live2d = …), global.PIXI)`）。

## 6. 嵌入方式（第三方，`<iframe>`）

本特性只有交互嵌入一条路（见第 1 节：无免 JS 路径）：

```html
<iframe
  src="https://lolicount.top/live2d-player.html?model=kasumi&name=me&text=第 {n} 位访客"
  width="360" height="450" style="border:0; background:transparent;"
  title="我的访客计数器"></iframe>
```

- `model`：`assets/live2d/` 下的模型目录名（需先放入模型，见 4.1/4.4）；
- `name`：计数名（`demo` 为固定演示串，真实计数走 `/api/count/@name`，`no-store`）；
- `text`：`{n}` 计数文字模板。

需一个能跑 WebGL 的 `<iframe>` 环境（即任何正常浏览器网页；**不适用于** GitHub
README、Markdown 预览等 `<img>`-only 场景——那些场景没有 WebGL，Live2D 无法渲染，
这正是本特性不提供免 JS 路径的原因）。

## 7. 缓存与限流对照（对齐 AGENTS.md 铁律）

| 资源 | Cache-Control | 理由 |
|---|---|---|
| `/api/count/@name`（真实计数） | `no-store` | 铁律 1：真实计数绝不缓存 |
| `/api/live2d/models` | `public, max-age=60` | 短缓存，对齐其他 `/api` 列表 |
| `/live2d/models/:name/:file` | `public, max-age=31536000, immutable` | 构建期嵌入，字节不可变 |

限流：计数路径复用 `ipRateLimit` + name 级 `incrementOrDegrade`，语义与
SVG/PSB/Spine 完全一致；资产路径为公开只读，无限流。

## 8. 许可与风险

- **vendor SDK**（`web/public/live2d/` 四个脚本）：
  - `pixi.min.js`（PixiJS v8）——MIT。
  - `live2dcubismcore.min.js`（Cubism core，emscripten 构建）——LIVE2D 的
    Cubism Web SDK core；按 Cubism 许可**可随应用分发**（core 本身免费），但受
    LIVE2D 的展示/署名条款约束。
  - `live2d-legacy.min.js`（Cubism 2 legacy runtime）——随引擎分发的兼容层。
  - `live2d-engine.js`（untitled-pixi-live2d-engine）——MIT（github.com
    /jaggyleee/untitled-pixi-live2d-display 系）。
  - **模型素材**版权归各自作者——游戏提取物只能本地测试，不可公开分发。公开部署
    时运营者需自行确保模型授权，并在页面注明出处。
- **引擎对 moc 格式的兼容**：vendor 的 `live2d-engine.js` 在标准 `isValidMoc`
  （魔数 `MOC3`）基础上**额外接受** `moc\x0b`（`6d6f63 0b`）魔数，以兼容部分游戏
  提取物的自定义容器在**结构校验**阶段通过；但即便如此，core 仍无法真正解析
  非标准容器的字节，**只有标准 moc3 能实际渲染**（见 4.2）。该放宽仅为让加载诊断
  更清晰，不改变「必须标准 moc3」的结论。

## 9. 前端主题列表集成（已落地）

Live2D（与 Spine 一起）已并入 `/api/themes`：`listThemes` 追加
`live2dModelNames()`，带 `animated:true, kind:"live2d"`。`themeMeta.ts` 的
`ThemeKind` 增加 `"spine"` 与 `"live2d"`，`useApi.ts` 的 `ThemeInfo` 增加
`kind?: 'psb'|'spine'|'live2d'`。

后续（可选）：`themes.vue` / `LinkOutput.vue` 对 `kind==='live2d'` 的主题给出
`<iframe src=…/live2d-player.html?model=…>` 的嵌入代码（交互页）；这是唯一的嵌入
方式（无免 JS 路径），嵌入文案生成为收尾项。

## 附录：链路验证记录（2026-09-15）

- 四个 SDK 脚本依序加载后：`window.PIXI`、`window.Live2DCubismCore`、`window.Live2D`
  均就绪，`PIXI.live2d.Live2DModel` 可用（缺 legacy runtime 时引擎抛
  `Could not find Cubism 2 runtime`，`PIXI.live2d` 不挂）。
- 标准 moc3（`MOC3` 魔数）模型经 `Live2DModel.from(model3.json)` 载入：Cubism 5.1
  core 打印 `CubismFramework.startUp() is complete` / `initialize() is complete`，
  模型挂上 stage（`stage.children.length===1`），`internalModel.update(dt)` +
  `app.render()` 无错，计数 overlay 正常显示。**管线全链路验证通过。**
- `model3.json` 必须满足：`Version:4`、`FileReferences.Moc` 为字符串、
  `FileReferences.Textures` 非空数组；缺一即 `no matching runtime found` /
  `isValidJSON` 失败。
- 交互页 base 路径：按尾段匹配 `live2d-player`（而非 `.html` 后缀），站点根下产出
  `base="/"`，basePath 部署下产出 `/base/`，避免 `/live2d-player.html/` 坏路径
  （该坏路径会让引擎去抓 `/live2d-player.html/live2d/…/model3.json`，命中 SPA
  fallback 返回 HTML，报 `Failed to load resource as json`）。
- 后端 `extOf(file)` 曾对 `model3.json` 这类名返回 `..json`（双点），导致
  Content-Type 映射 miss、统一回退 `octet-stream`；已修为返回无点扩展名、调用点补
  点（同时修复了 Spine 路径的同名 bug）。
- **BanG Dream 卡点**：KitsuneX07 仓库的 `.moc` 为**非标准自定义容器**
  （魔数 `moc\x0b`、LEB128 头部、内嵌 zlib），官方 core `fromArrayBuffer` 返回
  null、`hasMocConsistency` 为 0，无法渲染；需重编码为标准 moc3 或自写 `moc\x0b`
  解码器，且涉及版权风险，需用户决策路线。
- 验证用标准 moc3：`archchan`（wader/fq 测试数据，结构合法但**无配套真实贴图**，
  故角色像素不可见——属测试资产限制，非管线缺陷）。
