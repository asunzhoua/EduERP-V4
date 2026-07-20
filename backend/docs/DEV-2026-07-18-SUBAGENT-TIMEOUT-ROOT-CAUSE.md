# DEV-2026-07-18-001: spawn_subagent Timeout Root Cause

## 现象

| 触发 | 参数 | 结果 |
|:-----|:------|:------|
| 完整任务(5项) | fork=true, timeout=300s | TIMEOUT |
| 简化任务(2项) | fork=true, timeout=300s | TIMEOUT |
| 读MEMORY.md前50行 | fork=true, timeout=30s | TIMEOUT |
| 读MEMORY.md前50行 | fork=false, timeout=30s | TIMEOUT |
| 环境审计(shell命令) | fork=false, timeout=60s | ✅ PASS |
| 审计批次1(读+写.md) | fork=false, timeout=180s | ✅ PASS |
| 审计批次2(读+写.md) | fork=false, timeout=300s | ✅ PASS |
| 实施任务(bot代码) | fork=true, timeout=300s | TIMEOUT |

## 根因分析

### 根因1（主要）: GBK Encoding Mismatch

**系统默认编码**: `gbk`（Windows 中文系统默认）
**文件实际编码**: `utf-8`（含 emoji: ✅ ❌ 🚀 ⚠️ 等）

```
UnicodeDecodeError: 'gbk' codec can't decode byte 0xbf in position 39
```

**影响面**: 所有包含 emoji 的 `.md` 文件
- AGENTS.md → 含 🚀 ✅ ❌ → L39 开始就有问题
- MEMORY.md → 含大量 emoji → 文件中间就有
- HEARTBEAT.md → 含 emoji
- 审计文档 → 含 emoji

**时序**:
1. spawn_subagent 启动（作为新的 LLM 进程）
2. 子进程收到任务 → 尝试用 `read_file` 工具读取文件
3. 如 `read_file` 工具内部使用 `open()` 不指定 encoding → 立即 UnicodeDecodeError
4. 工具调用失败 → 子进程尝试修复/重试 → 占用时间 → 超时

**已确认**: 直接 `open('AGENTS.md')` 在 Python 中报 GBK 错误。
**已确认**: 指定 `encoding='utf-8'` 后正常读取。

### 根因2（次要）: fork=true 继承上下文

fork=true 继承父进程完整对话上下文，子进程需处理更多 token，首次响应更慢。

## 修复方案

有3个可能的修复点：

### 方案A: 修复 QwenPaw read_file 工具（推荐）
让 `read_file` 工具内部使用 `encoding='utf-8'` 或自动检测编码。
这是最根本的修复——所有文件读取都走工具，不依赖 Python 默认编码。

### 方案B: 设置 PYTHONIOENCODING 环境变量
```cmd
setx PYTHONIOENCODING utf-8
```
这会影响 Python 的 stdin/stdout 编码，但不影响 `open()` 默认编码。

### 方案C: 设置 Python UTF-8 Mode
```cmd
setx PYTHONUTF8 1
```
这会启用 Python UTF-8 Mode，使 `open()` 默认使用 UTF-8。
**注意**: 可能影响其他依赖 GBK 编码的 Windows 程序。

## 推荐

**方案C** (`setx PYTHONUTF8 1`) 最直接：
- 全局影响所有 `open()` 调用
- 兼容 Unicode 文件
- 与 QwenPaw 工作流完全兼容
- Windows 10 2022+ 支持

## 临时绕过

在根因修复前，spawn_subagent 任务：
1. ✅ 使用 fork=false（干净上下文，避免额外延迟）
2. ✅ 优先用 shell 命令代替文件读取
3. ✅ 子任务保持小粒度（单一目标）
4. ⚠️ 避免需要读取含 emoji 文件的任务

## 龙虾违规记录

本次错误：子进程超时后直接写代码，未按 CCAI-017 调度 CC，也未先排查根因。
