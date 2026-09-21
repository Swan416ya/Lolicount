# assets/spine/ — Spine 动态立绘模型目录

此目录存放 Spine 计数器使用的角色模型。设计文档见
[docs/spine-widget.md](../../docs/spine-widget.md)。

## 放置约定

```
assets/spine/
  <model-name>/          # 仅字母/数字/连字符(见 spineModelPattern)
    dyn.atlas            # 纹理图集(必需)
    dyn.skel             # 骨骼数据,二进制(与 dyn.json 二选一)
    dyn.json             # 骨骼数据,JSON(与 dyn.skel 二选一)
    page0.png            # 纹理页(必需;多页时 page0.png page1.png …)
    anim/                # 免 JS 嵌入用的预渲染动画图(可选,构建期生成)
      loop.webp          # 主循环动画,裸 <img> 即可播放
```

- **骨骼数据二选一**:二进制 `.skel`(Spine 3.8)或 JSON `.json`,运行时自动识别
  (`spine-player.html` 用 `?json=1` 切换);
- 纹理页文件名以 `dyn.atlas` 中声明为准,本服务约定为 `page0.png` / `page1.png` …
  (见 `spineFileNameRe` 白名单);
- `anim/loop.webp` 由 `scripts/render-spine-anim.mjs` 离线渲染生成(见设计文档
  第 6 节),**无需手动放置**,构建期跑一次脚本即可。

## 模型资产不入库

Spine 模型(尤其是游戏提取物)体积大、多为受版权保护的素材,与本仓库对 PSB 模型
的一致约定相同:**仓库只提交放置流程与代码,不提交模型二进制**。

- `assets/spine/` 下默认只有 `.gitkeep`(以及本 README);
- 本地测试时把模型放入 `assets/spine/<name>/`,重启即被 `embed.FS` 打包;
- 公开部署时,运营者自行把**有权分发/展示**的模型放入该目录再构建;
- 生成 `anim/*.webp` 前先跑 `scripts/render-spine-anim.mjs`(需要 Chrome + ffmpeg,
  见设计文档)。
