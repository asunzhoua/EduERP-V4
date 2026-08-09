# 微信小程序 AI 全程逆向工作流（WMPFDebugger + CDP）

> 适用：AI 辅助逆向任意微信小程序（仅 Windows），**借鉴设计 → 重写实现 → 优化自有产品**。
> 本文是「小程序逆向」skill 的方法论正文；配套脚本见 skill 的 `scripts/`，安装见 §2.4，新电脑移植见 §7。
> 首次实践：2026-08-09 逆向「禾满满校讯通」（AppID `wxe15fd3ece9d66c03`），WMPF 版本 20089，产出 `REVERSE-ANALYSIS-2026-08-09.md`。

---

## 1. 合规边界（必读，全程适用）

- 只**借鉴设计 / 交互 / 信息架构 / 业务逻辑**，重写实现接入自有后端；**不照搬代码、素材、商标**。
- WMPFDebugger 为 **GPL-2.0** 开源（evi0s），`src/third-party` 含腾讯开发者工具提取代码，**仅供学习**，不商用分发。
- 目标小程序为第三方私有资产：仅在你**有权访问（已登录/已授权）**的账号视角下做只读分析，不做越权、不改数据、不抓取他人隐私。
- 产出优化建议映射到自有产品时，避免复制对方独有表达。

---

## 2. 前置条件与软件清单

### 2.1 环境要求

| 项 | 要求 |
|---|---|
| 操作系统 | **仅 Windows**（依赖 PC 微信 + WeChatAppEx.exe，frida 预编译为 win32-x64） |
| PC 微信 | 4.x（本工作流实测 4.1.11.55）；目标小程序已安装且能登录 |
| Node.js | ≥ LTS v22（WMPFDebugger 需要）+ `yarn` 包管理器 |
| Python | ≥ 3.10（MCP 服务器 + 自研脚本） |
| 浏览器 | Chrome / Edge（如需人工 DevTools 观察） |

### 2.2 三个软件

| # | 组件 | 来源 / 许可 | 安装后体量 | 职责 |
|---|---|---|---|---|
| 1 | **WMPFDebugger** | GitHub `evi0s/WMPFDebugger`，GPL-2.0 | ~281M（含 node_modules，frida 预编译 ~41.6M） | Frida 注入 WeChatAppEx → 按 WMPF 版本加载 hook → 起 debug-server `9421`（收小程序）+ CDP-proxy `62000`（供 AI/DevTools 连） |
| 2 | **wmpf-reverse-mcp** | GitHub（MIT） | ~512K | Python MCP 服务器，7 个工具：`cdp_get_status / cdp_send_command / cdp_evaluate / get_server_log / get_captured_scripts / find_script_by_url / get_script_source`；可自动拉起 WMPFDebugger |
| 3 | **自研脚本组** | 本 skill `scripts/`（含本文档工作流配套） | ~50K | `setup.py / check_env.py / capture_pages.py / analyze.py / fetch_all.py / extract_modules.py / analyze_pages.py` |

依赖关系：`wmpf-reverse-mcp`（mcp、websockets）→ CDPClient → `ws://127.0.0.1:62000`；WMPFDebugger（frida、protobufjs、ws + devDeps ts-node/typescript）。

### 2.3 WMPF 版本核查（最关键的适配前提）

WMPFDebugger 只支持 `frida/config/addresses.<版本>.json` 存在的版本（本机 20089）。核查方法：

1. 打开任务管理器 → 找到 `WeChatAppEx` 进程 → 右键「打开文件所在的位置」。
2. 路径里 `RadiumWMPF` 与 `extracted` 之间的数字即 WMPF 版本号。
3. 到 `WMPFDebugger/frida/config/` 确认存在 `addresses.<版本号>.json`；没有则参考仓库 `ADAPTATION.md` 适配，或升级微信到新版 WMPF。

### 2.4 一键安装（目标机首次）

```bash
python scripts/setup.py --work-dir C:/Users/<你>/wmpf-analyze --target-appid <AppID>
```

`setup.py` 会：核查 git/node/yarn/python → 克隆 WMPFDebugger 并 `yarn`（frida 预编译下载慢时可设镜像重试）→ 克隆 wmpf-reverse-mcp 并 `pip install -e .` → 生成 `config/config.json`。详见 skill `references/` 或 `python scripts/setup.py --help`。

---

## 3. 端到端操作流程（10 步）

> 启动顺序是铁律：**先起 WMPFDebugger（9421+62000）→ 再冷启动小程序（连 9421）→ 最后连 CDP（62000）**。若先连 CDP 再开小程序，`Runtime.enable`/`Debugger.enable` 会广播给空客户端集而丢失捕获。

### 步骤 0 · 环境自检

```bash
python scripts/check_env.py
```
预期：报告 Node/Python 版本、WMPF 版本是否受支持、9421/62000 是否空闲、WeChatAppEx.exe 是否在运行。

### 步骤 1 · 启动 WMPFDebugger

```bash
cd <wmpf_dir>      # 默认 C:/Users/<你>/WMPFDebugger
npx ts-node src/index.ts   # 后台运行
```
预期：日志出现 frida 注入成功、debug-server 9421 监听、CDP proxy 62000 监听。验证：`netstat -ano | findstr :9421` 与 `:62000`。

### 步骤 2 · 冷启动目标小程序

在 PC 微信里**完全关闭**目标小程序（点 × 退出，含后台），再重新打开。预期：WMPFDebugger 日志出现 `[miniapp] miniapp client connected`。

> 为什么必须冷启动：`scriptParsed` 事件**不重放历史**，只有活跃连接期内新解析的脚本才能被捕获；启动片（app.js、utils/*、首页 chunk）只在冷启动时加载。

### 步骤 3 · 开始捕获

```bash
python scripts/capture_pages.py 1200 cap
```
- 子类化 CDPClient，单连接、一次性 `Runtime.enable` + `Debugger.enable`。
- 对 `Debugger.scriptParsed` 中 appservice 相关 URL（含 `appservice` / `chunk_` / `usr/`）立即 `getScriptSource` 落盘。
- 同时记录 `executionContextCreated` 到 `cap/_contexts.json`（深挖用）。
- 日志 `cap.log`；验证 `cap.log` 出现 `[ok] enabled`。

### 步骤 4 · 逐页导航触发懒加载

请用户在微信里**依次点开关键页面**（首页 / 招生 / 潜客 / 试听 / 报名缴费 / 订单 / 教务 / 我的 …）。每开一页，该页 chunk 懒加载 → 被捕获。预期 `capture_pages.py` 持续输出 `[saved] ...`。

### 步骤 5 · 全量拉取剩余脚本

```bash
python scripts/fetch_all.py --ids <逗号分隔 scriptId> --outdir cap   # 或 --events <events.json>
```

### 步骤 6 · 识别业务模块与 API 层

```bash
python scripts/extract_modules.py cap/app.js --list            # 列出全部 define() 模块名
python scripts/extract_modules.py cap/app.js utils/api.js out_api.js   # 提取指定模块
```
关键目标：`utils/api.js`（业务 API 层，实测 208 端点）、`utils/api-teacher.js`（60 端点）、`utils/request.js`（网络层）、`utils/permission.js`（权限模型）、`utils/session.js`、`utils/baseURL.js`。

### 步骤 7 · 页面 chunk 分析

```bash
python scripts/analyze_pages.py          # 扫描 cap/chunk_*.appservice.js → page_chunks_analysis.json
```
输出每 chunk：引用的 `pages/` 路径、调用的 API 函数名、`data:` 顶层字段 → 按业务域归类页面。

### 步骤 8 · appservice 深挖（contextId）

从 `cap/_contexts.json` 找 appservice 上下文 id（注意：默认上下文是渲染层 `page-frame.html`，**没有** require/getApp/wx；appservice 在隔离 world）：

```bash
python scripts/analyze.py --eval 'getApp().globalData'      # 默认渲染层，通常拿不到
python scripts/analyze.py --eval 'require("utils/api").toString()'   # 需注入 appservice contextId
```

### 步骤 9 · 产出报告 + 优化方案 → 确认门

按 `REPORT-TEMPLATE.md` 写逆向分析报告（架构/页面/组件/API/权限/借鉴表），再映射到自有产品的优化方案，走「先分析后写代码」确认门后才进入编码。

---

## 4. 关键技术结论与踩坑（CDP）

| # | 结论 | 应对 |
|---|---|---|
| 1 | `scriptParsed` 不重放历史 | 必须在活跃连接期**冷启动**小程序抓启动片 |
| 2 | `executionContextCreated` 不重放 | 连接后只收新上下文；默认上下文是渲染层 `page-frame.html`，无 require/getApp/wx |
| 3 | appservice 在隔离 world | 冷启动时记录 appservice `contextId`，`Runtime.evaluate({contextId, expression})` 才能读模块注册表 / getApp() |
| 4 | Target 域可用，Worker 域不可用 | `Worker.enable` 报 `-32601 wasn't found`；`Target.attachToTarget({flatten:true})` 可行但需注入 `sessionId`（CDPClient 需 monkeypatch `_send_command_async`，注意 `self._loop.create_future()`） |
| 5 | 62000 多客户端争用 | 多个客户端同时连会产生「未匹配响应」与超时；**尽量单客户端** |
| 6 | `listen_robust.py` 不可靠 | 周期 re-enable 洪水 + monkeypatch 歧义导致漏事件；**改用 `capture_pages.py`**（子类化 CDPClient 内部处理事件） |

---

## 5. 逆向分析方法论

- **页面地图**：渲染层注册表（`unknown_*.js`）能列出 ~40 页 / ~50 组件，是架构地图；再用捕获的 chunk 逐页验证。
- **API 层**：`utils/api.js` 一个文件就是全量端点字典，`extract_modules.py` 直接提出，无需逐个页读。
- **权限模型**：`utils/permission.js` 的 auth-key 三段式（`<模块>-<子模块>-<动作>` + `mini-tab-*`）是「角色 RBAC 之上的机构可配菜单/按钮」范式，比自有产品更细。
- **组件体系**：base-ui 组件族（x-input / x-select / x-date-picker / x-student-selector…）+ 业务组件族 + 通用选择器（jumpSelect + 9 子选择器），是可复用的 UI 分层范式。
- **网络层约定**：状态码归一化（`status=1→200`）、token 过期重放队列（挂起请求 re-login 后重放）、登录态 storage key 集合。
- **数据源定位**：目标包 `.wxapkg` 若为 WMPF DRM 加密（头 `V1MMWX`），静态解包锁死 → 必须走本动态调试路线；未加密的可用 unveilr / wxappUnpacker 静态解包对比。

---

## 6. 产出物模板（REVERSE-ANALYSIS 报告）

1. 总体架构（技术栈 / 网络层 / 权限模型 / 导航 tab）
2. 页面清单（注册表 + 捕获验证，标注业务域与 chunk）
3. 组件体系（base-ui / 列表加载 / 数字步进 / 业务组件）
4. 业务 API 清单（按业务域分组，标注端点名）
5. 值得借鉴的设计模式（逐条映射到自有产品：现状 / 借鉴价值 高-中-低）
6. 本次会话新增证据 / 未捕获项
7. 合规边界声明

---

## 7. 新电脑移植与恢复

1. 把「小程序逆向」skill 目录整体拷到目标机 `C:/Users/<用户名>/.claude/skills/小程序逆向/`。
2. `python scripts/setup.py` 一键装工具链（§2.4），填好 `config/config.json`（工作目录 / WMPFDebugger 路径 / AppID / 端口）。
3. 重启 Claude Code，按 §3 走流程。
4. 断点恢复：WMPFDebugger 被关 / CDP 62000 断了 → 重新执行步骤 1（起 WMPFDebugger）→ 步骤 2（冷启动）→ 步骤 3（捕获）。已捕获的 `cap/` 与报告不丢失，支持增量。

---

## 附录 A · 2026-08-09 实测数据（worked example）

- 目标：禾满满校讯通，AppID `wxe15fd3ece9d66c03`，老师端已登录。
- 包位置（微信 4.x 新路径）：`AppData/Roaming/Tencent/xwechat/radium/users/<uid>/applet/packages/<appid>/`（46/ 旧版 + 61/ 今日版）；`.wxapkg` 头为 `V1MMWX`（WMPF DRM）→ 静态解包锁死。
- 子包名暴露业务模块：`_educationalAdministration_(教务) / _educationalSystem_(教育系统) / _financialManagement_(财务) / _homework_(作业) / _salesManagement_(销售) / _statisticalChart_(统计图表)`。
- 捕获：`cap/` 得 app.js 455K + 62 chunk（含 21 页面 chunk）；业务 API 层 208 端点 + `api-teacher.js` 60 端点。
- 环境：Node v24.14.1 / 微信 4.1.11.55 / WMPF 20089。

## 附录 B · 脚本速查表

| 脚本 | 用法 | 作用 |
|---|---|---|
| `setup.py` | `python setup.py --work-dir <d> --target-appid <a>` | 装工具链 + 写 config |
| `check_env.py` | `python check_env.py` | 环境自检（版本/端口/进程） |
| `capture_pages.py` | `python capture_pages.py <秒数> <outdir>` | 可靠捕获（冷启动期） |
| `analyze.py` | `--list / --source <id> / --eval "<expr>" / --url <pat> / --monitor <sec> / --out <f>` | CDP 通用工具 |
| `fetch_all.py` | `--ids <a,b,c> / --events <f> --outdir <d>` | 批量拉源码 |
| `extract_modules.py` | `<bundle.js> --list / <bundle.js> <模块名> [out]` | 从打包文件提取 define() 模块 |
| `analyze_pages.py` | `python analyze_pages.py` | 页面/API/data 识别 → JSON |
