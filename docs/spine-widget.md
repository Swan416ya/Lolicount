# Spine 动态立绘（计数器）设计文档

> 状态：代码已落地（与 PSB/E-mote 挂件并列的独立 web 特性）
> 关联资源：`web/public/spine-player.html`（JS 交互页）、`web/public/spine/spine-3.8.js`
> （Spine 3.8 WebGL 运行时）、`scripts/render-spine-anim.mjs`（免 JS WebP 渲染器）

## 1. 背景与目标

Lolicount 的输出契约是**静态 SVG 图片**（`<img src="https://lolicount.top/@name">`），
浏览器在 `<img>` 中禁用脚本，无法承载需要 WebGL 实时渲染的内容。

Spine 是 Spine 公司出品、游戏/看板娘/动态立绘广泛使用的骨骼动画格式。一个 Spine
模型是**一组文件**（不是单文件）：

```
dyn.atlas   纹理图集(必需,声明纹理页与 region)
dyn.skel    骨骼数据,二进制(与 dyn.json 二选一)
dyn.json    骨骼数据,JSON(与 dyn.skel 二选一)
page0.png   纹理页(必需;多页时 page0.png page1.png …)
```

本功能与 PSB 挂件目标一致但**多一条免 JS 路径**：

1. **交互路径（JS）**：第三方网页用 `<iframe>`/`<script>` 引用
   `spine-player.html?model=<模型>&name=<计数名>`，页面用 Spine WebGL 运行时实时
   渲染角色 + 拉取 `/api/count/@name` 显示计数。
2. **免 JS 路径（无脚本）**：构建期用 `scripts/render-spine-anim.mjs` 把某个模型
   的某个动作**预渲染成 looping 动画 WebP**，第三方用**裸 `<img src>`** 嵌入即可
   播放——**不依赖任何 JS/WebGL**，在 GitHub README 等 `<img>`-only 环境也能动。
   这是与 PSB 挂件的本质差异：PSB 只能走 JS，Spine 可以走纯图片。

## 2. 整体架构

```
交互路径（JS,需 HTML+WebGL 环境）:
  第三方网页
    │ <iframe src="https://host/spine-player.html?model=kalts&name=me&text=第 {n} 位访客">
    ▼
  spine-player.html
    ├─ 加载 /spine/spine-3.8.js（Spine 3.8 WebGL 运行时,同源 vendor）
    ├─ spine.webgl.AssetManager 从 /spine/models/<model>/ 拉 dyn.atlas + dyn.{skel|json}
    │   （纹理页 pageN.png 由图集引用,同目录）
    ├─ 随机选一个动画,SceneRenderer 实时渲染(WebGL canvas)
    └─ fetch GET /api/count/@name  ──► Go 后端:自增计数,返回 JSON(no-store,CORS)
         └─ 渲染计数文字({n} 模板),画布下方居中

免 JS 路径(无脚本,任何 <img> 环境):
  构建期(一次性,离线):
    scripts/render-spine-anim.mjs
      ├─ 本地静态服务 + headless Chrome(CDP)加载 capture 页
      ├─ Spine 运行时播放指定动作,逐帧 Page.captureScreenshot(裁 canvas 框)
      └─ ffmpeg libwebp 编码为 looping 动画 WebP → assets/spine/<model>/anim/loop.webp
  运行时:
    第三方网页
      │ <img src="https://host/spine/anim/<model>/loop.webp" alt="计数器">
      ▼
    Go 后端 /spine/anim/<model>/loop.webp 直接回 WebP 字节(immutable)
      └─ 浏览器原生播放动画 WebP,零 JS
```

与现有系统的关系：

- **不触碰 imgcore 渲染管线**。Spine 模型不是 `imgcore` 主题,而是与 `assets/theme/`
  、`assets/psb/` 平行的资产类别(`assets/spine/`),后端只负责列出与流式下发字节,
  渲染全在客户端。
- **计数语义完全复用** `counter.Buffer`:交互路径的 `/api/count/@name` 与 SVG/PSB
  路径走同一套 `incrementOrDegrade`(name 级限流降级只读)与 `demo`/`number` 特例。
- **缓存铁律不变**:真实计数一律 `no-store`;模型文件与预渲染 WebP 是构建期固定的
  不可变字节,`max-age=31536000, immutable`。

## 3. 后端接口（Go / Fiber v3）

### 3.1 `GET /api/spine/models`

列出 `assets/spine/` 下含骨骼文件(`dyn.skel` 或 `dyn.json`)的模型目录名:
`{"models":["kalts",...]}`。`Cache-Control: public, max-age=60`。目录为空或缺失时
返回空列表,不报错。

### 3.2 `GET /spine/models/:name/:file`

返回 `assets/spine/<name>/<file>` 的字节(`dyn.atlas` / `dyn.skel` / `dyn.json` /
`pageN.png`)。白名单校验:模型名 `^[a-zA-Z0-9-]+$`,文件名 `^dyn\.(skel|json|atlas|png|jpg)$`
或 `^page[0-9]+\.(png|jpg)$`,防路径穿越;不存在返回 404。

- `Content-Type` 按扩展名映射(`.skel`→octet-stream、`.json`→application/json、
  `.atlas`→text/plain、`.png`→image/png)
- `Cache-Control: public, max-age=31536000, immutable`
- `Access-Control-Allow-Origin: *`(字节公开,计数器页跨域加载)

### 3.3 `GET /spine/anim/:name/:file`

返回预渲染的免 JS 动画图(`assets/spine/<name>/anim/<file>`,如 `loop.webp`)。
文件名白名单 `^[a-zA-Z0-9_-]+\.(webp|png|gif)$`。字节由构建期脚本生成,immutable
长缓存,CORS 全开。**这是免 JS 嵌入的实际入口。**

### 3.4 `GET /api/count/@:name`

与 SVG/PSB 路径完全一致的计数接口(`no-store`,demo→固定串,number>0→直接返回,
否则 `incrementOrDegrade`),交互页用它取计数值。

### 3.5 路由注册顺序

四条路由都在 `registerRoutes()` 中、`registerFrontend()` 之前注册(Fiber 按注册
顺序匹配,`/spine/*` 与 `/api/*` 无冲突)。

## 4. 模型资产

### 4.1 目录约定

```
assets/spine/
  README.md            # 放置说明(入库)
  .gitkeep
  <model-name>/
    dyn.atlas
    dyn.skel  |  dyn.json
    page0.png [page1.png …]
    anim/
      loop.webp        # 免 JS 嵌入用,脚本生成
```

`assets/embed.go` 已含 `//go:embed all:spine`。新增模型放入对应目录后重启即被
`embed.FS` 打包;没放则模型列表为空。**仓库只提交放置流程,不提交模型二进制**
(与 PSB 一致,见 `assets/spine/README.md`)。

### 4.2 模型从哪来

Spine 模型多为游戏/商业素材(版权敏感),获取途径:

1. 自制或有权分发的模型;
2. 游戏内 Spine 资源提取(工具如 Spine Extractor / SpineExporter 等,只能本地测试);
3. 社区再导出(如方舟「动态立绘」类资源,二进制 `.skel` 与 JSON `.json` 两种格式
   均支持,运行时按 `?json=1` 切换)。

无论来源,**公开部署前运营者需自行确保模型授权**。仓库不收录任何模型文件。

## 5. 前端交互页（`web/public/spine-player.html`）

自包含单页(原生 JS,无构建依赖),随 Nuxt `web/public/` 进入 dist,由 frontend
catch-all 直接 serve,**后端零改动**(仅新增的 `/spine/models/`、`/spine/anim/` 两条
资产路由 + `/api/spine/models`)。

| 查询参数 | 说明 | 默认 |
|---|---|---|
| `model` | 模型目录名(`assets/spine/<model>/`) | 无(缺则报错) |
| `name` | 计数名 | `demo` |
| `text` | `{n}` 计数文字模板 | `第 {n} 位访客` |
| `json` | `1` 用 JSON 骨骼(`dyn.json`),否则二进制(`dyn.skel`) | 二进制 |

职责:

1. 解析参数,从 `location.pathname` 推导站点根 `base`(兼容 Nuxt basePath);
2. 用 `spine.webgl.AssetManager(gl)` 加载 `dyn.atlas` + `dyn.{skel|json}`
   (两个 loader 共享一个 pending 计数,都完成后初始化);
3. `spine.SkeletonBinary`/`spine.SkeletonJson` 读骨骼 → `spine.Skeleton` +
   `spine.AnimationState(new spine.AnimationStateData(sd))`;
4. **随机选一个动画**循环播放;
5. **自适应取景**:`skeleton.getBounds()` 量取所有 region/mesh/path 附件的世界包围盒
   (不用 `SkeletonBounds`,它只量 hitbox 附件,多数模型没有),设 `renderer.camera`
   的 zoom/position 使角色居中占满约 84% 画布;
6. `spine.webgl.SceneRenderer` 实时 `begin()/drawSkeleton()/end()` 渲染;
7. `fetch(base + 'api/count/@' + name)` 取计数,`{n}` 替换后渲染在画布下方 DOM
   overlay 上;
8. WebGL 不可用 / 模型缺失 / 解析失败时,在页面内显示文字错误提示,不白屏。

> **运行时 API 说明**:vendor 的 `spine-3.8.js` 是 Spine 3.8.99 的 webgl 构建,
> 渲染器在 `spine.webgl.*` 命名空间(`spine.webgl.SceneRenderer`、
> `spine.webgl.AssetManager`、`spine.webgl.SkeletonRenderer`),**不是**
> `spine.SpineWebGL`(那是 4.x 的顶层类)。`AssetManager` 需传入 `gl` 上下文,
> 且 `loadTextureAtlas`/`loadBinary` 是**逐文件回调**(无 `addFile`/`loadAll`)。
> 这些是 3.8 与 4.x API 的关键差异,渲染脚本与交互页都已按 3.8 API 实现。

## 6. 免 JS 路径（`scripts/render-spine-anim.mjs`）

把指定模型的一个动作预渲染成 looping 动画 WebP,供裸 `<img>` 嵌入。

### 6.1 流程(每个模型)

1. 本地起一个静态 HTTP 服务(端口 `HTTP_PORT`),serve 模型文件 + 一个内嵌的
   **capture 页**(该页加载 `spine-3.8.js`,播放最长动画,把 `window.__draw(t)`
   暴露出来——按需绘制而非 `requestAnimationFrame`,因为 headless Chrome 里 rAF
   被节流);
2. 起 headless Chrome(`--headless=new`,devtools 端口 `PORT`,注意 Chrome 可能绑定
   `[::1]` 或 `127.0.0.1`,脚本双端点探测;复用默认 tab,Chrome 136+ 已移除
   `/json/new` HTTP 端点);
3. CDP `Page.navigate` 到 capture 页,等 `Page.loadEventFired` + `window.__ready`;
4. 用 `DOM.getBoxModel` 取 canvas 框,`Page.captureScreenshot(clip)` 逐帧截图
   (每帧先 `window.__draw(t)` 推进动画到 t 秒,再截);
5. `ffmpeg -framerate FPS -c:v libwebp` 把帧编码成 looping 动画 WebP →
   `assets/spine/<model>/anim/loop.webp`。

> **为什么用 `window.__draw(t)` 按需绘制**:headless Chrome 不持续触发
> `requestAnimationFrame`,靠 rAF 跑动画会导致截到全黑帧。改为 CDP 主动调
> `window.__draw(t)` 推进 `AnimationState` track 时间到 t 再截图,帧确定且稳定。
> WebGL canvas 需 `{preserveDrawingBuffer:true}` 才能被 CDP 截到内容。

### 6.2 用法

```bash
node scripts/render-spine-anim.mjs              # 渲染 assets/spine/ 下所有模型
node scripts/render-spine-anim.mjs kalts         # 只渲染 kalts
FRAMES=30 FPS=12 QV=80 node scripts/render-spine-anim.mjs   # 30帧/12fps/质量80
```

依赖:Chrome/Chromium(PATH 或 `CHROME` 环境变量)、`ffmpeg`(PATH)。
`KEEP_FRAMES=1` 可保留中间 PNG 帧便于排查。

### 6.3 嵌入(第三方)

```html
<img src="https://lolicount.top/spine/anim/kalts/loop.webp"
     alt="我的访客计数器" width="360">
```

零 JS、零 WebGL、零依赖。GitHub README 等 `<img>`-only 环境同样可用(动画 WebP
由浏览器原生播放)。

## 7. 缓存与限流对照（对齐 AGENTS.md 铁律）

| 资源 | Cache-Control | 理由 |
|---|---|---|
| `/api/count/@name`(真实计数) | `no-store` | 铁律 1:真实计数绝不缓存 |
| `/api/spine/models` | `public, max-age=60` | 短缓存,对齐其他 `/api` 列表 |
| `/spine/models/:name/:file` | `public, max-age=31536000, immutable` | 构建期嵌入,字节不可变 |
| `/spine/anim/:name/:file` | `public, max-age=31536000, immutable` | 构建期渲染,字节不可变 |

限流:计数路径复用 `ipRateLimit` + name 级 `incrementOrDegrade`,语义与 SVG/PSB
完全一致;资产路径为公开只读,无限流。

## 8. 许可与风险

- **Spine 3.8 运行时**(`spine-3.8.js`):Spine 公司商业 SDK 的 WebGL 构建,
  vendor 自开源再分发渠道。Spine 运行时**允许随应用分发**(运行时本身免费),
  但**模型素材**版权归各自作者——游戏提取物只能本地测试,不可公开分发。
  公开部署时运营者需自行确保模型授权,并在页面注明出处。
- 引擎为 Spine 3.8.99,过新(4.x)的模型可能需换 4.x 运行时(届时 API 为
  顶层 `spine.SpineWebGL` + `spine.AssetManager` 无参构造 + `addFile`/`loadAll`)。
- 免 JS WebP 体积:720×720、30 帧、质量 80 约 0.5~0.8MB/模型,可接受;
  需要更小可调 `MAXW`/`QV`/`FRAMES`。

## 9. 前端主题列表集成（已落地）

Spine（与 Live2D 一起）已并入 `/api/themes`：`listThemes`（`internal/server/api.go`）
在 PSB 之后追加 `spineModelNames()`，带 `animated:true, kind:"spine"`。`themeMeta.ts`
的 `ThemeKind` 增加 `"spine"` 与 `"live2d"`，`useApi.ts` 的 `ThemeInfo` 增加
`kind?: 'psb'|'spine'|'live2d'`。

后续（可选）：`themes.vue` / `LinkOutput.vue` 对 `kind==='spine'` 的主题给出
`<iframe>`（交互）或 `<img src=…/spine/anim/…/loop.webp>`（免 JS）两种嵌入代码；
目前交互页与免 JS WebP 均已可用，嵌入文案生成为收尾项。

## 附录：链路验证记录（2026-09-10）

- 运行时 API 确认:vendor `spine-3.8.js`(422KB)导出 `spine.webgl.{SceneRenderer,
  AssetManager, SkeletonRenderer, OrthoCamera, GLTexture, ...}`,顶层导出
  `spine.{Skeleton, SkeletonBinary, SkeletonJson, AnimationState, AnimationStateData,
  AtlasAttachmentLoader, Vector2, ...}`。`spine.SpineWebGL`/`spine.Atlas`/
  `AssetManager.addFile`/`loadAll` 在 3.8 构建中**不存在**。
- `AnimationState` 构造必须传 `new spine.AnimationStateData(sd)`(它内部读
  `this.data.skeletonData`),直接传 `sd` 会在 `setAnimation` 处
  `Cannot read properties of undefined (reading 'findAnimation')`。
- `skeleton.getBounds(off, sz)` 量取全部附件包围盒;`SkeletonBounds.update` 只量
  hitbox 附件,多数角色为空(返回 0×0),不可用于取景。
- 取景:`renderer.camera.zoom = min(w*0.84/sz.x, h*0.84/sz.y)`,
  `position = (off + sz/2)`,zoom 1 ⇒ 1px==1unit。
- 免 JS 渲染:headless Chrome rAF 被节流 → 改 `window.__draw(t)` 按需绘制;
  WebGL canvas 需 `preserveDrawingBuffer:true`;`Page.captureScreenshot` 用
  `DOM.getBoxModel` 裁 canvas 框;ffmpeg 本机构建的 webp **解码**端有 bug
  ("image data not found"),但**编码**产物经 PIL 校验为合法动画 WebP
  (凯尔希 720×720、30 帧、~626KB,角色清晰可见)。
- 验证模型:凯尔希(时遗 sp_,二进制 `.skel`,11 动作,最长 26s),渲染成功。
