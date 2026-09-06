# 任务：提取《魔女的夜宴》fgimage.xp3 的人物立绘并转成 PNG

## 目标
从游戏 `E:\Downloads\Sanoba Witch\Sanoba Witch\` 的 `fgimage.xp3`（1555 个文件）中提取**解密后**的立绘文件，用文件名映射表还原文件名，若为 TLG 图像则转成 PNG。

- 最终输出：`E:\tmp\sanoba-final\`（解密+还原文件名的文件）和 `E:\tmp\sanoba-png\`（PNG 转换结果）
- 游戏用 `SabbatOfTheWitch_crack.exe` 启动（Steam DRM 已移除），KiriKiriZ 引擎 + **Wamsoft Hxv4 Cxdec 加密**（2021+ 新加密体系，普通 GARbro/KrkrExtract 解不开）

## 参考教程要点（kungal.com/topic/2670，社区实战总结）
- 这类游戏静态解包工具全部失效，因为密钥在运行时由游戏计算
- 推荐：① YeLikesss/KrkrExtractForCxdecV2（运行时注入提取器）② YuriSizuku/GalgameReverse 的 `krkr_hxv4_dumpkey.js`（Frida hook 运行中的游戏 dump 密钥）③ tjs 脚本法（把 `appconfig.tjs` 放游戏目录，用引擎自身 API 导出文件）

## 已有资源（直接用，不用重新找）
- **GARbro2 v2.0.0**：`E:\tmp\garbro2\`（含 `GARbro.Console.exe` 命令行版、`Image.Convert.exe` 图像转换器）
- **HxCrypt 加密源码**（来自 crskycode/GARbro）：`E:\tmp\HxCrypt.cs`、`E:\tmp\HxCryptLite.cs`
- **文件名映射表**：`E:\tmp\garbro2\GameData\HxNames-Sanoba.lst`（格式 `hash:name`，16位hex=路径hash，64位hex=文件名hash）
- **CxdecExtractor V3.1**（KrkrExtractForCxdecV2）：`E:\tmp\cxdec\`（4 个文件，也拷了一份到游戏目录）
- **我写的 xp3 索引解析器**：`E:\psb-tool3\xp3_extract.py`（能解析出 1555 个条目：名字、hash、分段，可作参考）

## 已试过并失败的路线（不要重复）
1. GARbro v1.5.44 选 "Sabbat of the Witch, CxEncryption(0x2BF 0x20E)" → 输出 = 原始数据 XOR 0x01，密钥错误
2. GARbro2 选 "Sabbat of the Witch [Steam], HxCrypt(0x226 0x1C8)" → 输出 = 原始数据 XOR 0xF5，还是错（HxCrypt.Init() 是空实现，不加载运行时索引；HxFileDecryptor 的 key 由 VM 从 hash 算出，静态参数不对）
3. GARbro2 控制台 `GARbro.Console.exe x -y -o <dir> <archive>` → 不应用 scheme，输出原始加密数据
4. CxdecExtractorLoader 带游戏 exe 路径参数启动 → 模块对话框能弹出，点"加载解包模块"后游戏进程卡在 6MB 内存然后静默退出（注入失败，原因未明；可研究它的正确用法/依赖）

## 加密结构（读源码得出，供实现静态解密参考）
每文件内容 = zlib 分段解压后：
- 4 字节循环 XOR（同一个字节重复 4 次，按 offset 轮转）为主体
- 2 个单字节修补位（位置由 key 派生）
- 可选头部解密器（≥8 字节 key，前 N 字节额外处理）
- 分两段：split 在 `m_offset + (hash & m_mask)`，前段用 `hash` 派生 key，后段用 `hash ^ (hash>>16)` 派生 key
- key 经 CxProgram VM（控制块 + RandomType）从 hash 计算——控制块在游戏运行时 DLL 里

## 建议路线（按优先级尝试）
**A. Frida dump 密钥（最可靠）**：`pip install frida-tools`，clone `YuriSizuku/GalgameReverse`，在游戏目录用 `frida -l krkr_hxv4_dumpkey.js SabbatOfTheWitch_crack.exe` 运行游戏 dump 密钥；拿到密钥后或改 GARbro2 的 Formats.dat，或直接用 Python 实现解密
**B. 搞定 CxdecExtractor**：研究它为什么注入失败（看它的 issue/源码/依赖，可能需要特定运行方式）
**C. tjs 脚本法**：写 `appconfig.tjs` 放游戏目录让引擎自己导出

## 验收标准
1. `E:\tmp\sanoba-final\` 里文件头是 **TLG**（TLG5/TLG6）或 **PSB**（游戏有 psbfile.dll 插件，立绘也可能是 PSB）——不再是随机字节
2. 文件名用 HxNames-Sanoba.lst 还原（不再是单汉字混淆名）
3. TLG → PNG 转换成功（`E:\tmp\sanoba-png\`，可用 GARbro2 的 Image.Convert.exe 或自己实现）

## 注意事项
- 所有临时文件放 E 盘；不要修改游戏目录里的原文件（工具文件已拷进去的除外）
- 游戏运行会弹窗口，正常现象，用完记得 taskkill
- 长任务，耐心做；每步验证后再进行下一步
