# Feishu Current Capability Audit

> **版本**: 1.0  
> **日期**: 2026-07-18  
> **审计方法**: 只读事实验证  
> **数据来源**: 见每项标注

---

## 1. 当前飞书已验证能力

### 1.1 基础设施

| 能力 | 状态 | 文件:行号证据 |
|:-----|:-----|:--------------|
| 飞书自建应用 | ✅ 已创建 | `FEISHU-BOOTSTRAP-IMPLEMENTATION.md:1-10` |
| 知识库空间 [EOS-BOOTSTRAP] EOS AI Workspace | ✅ 已创建 | `FEISHU-BOOTSTRAP-IMPLEMENTATION.md:4-6` |
| 空间文件夹结构（Governance/Missions/Architecture/Evidence/Operations/EduOS/Archive） | ✅ 已创建 | `FEISHU-ARCHITECTURE-DESIGN.md:28-56` |
| Mission Board 多维表格 | ✅ 已创建并配置 | `FEISHU-CONTROL-PLANE-REPORT.md:60-73` |
| PlanetScale 集成 | ❌ N/A | 未在架构设计中 |
| EOS AI Team 群 | ✅ 已创建 | chat_id: `7663726635614473190` |

### 1.2 控制面能力

| 能力 | 状态 | 文件:行号证据 |
|:-----|:-----|:--------------|
| Mission Board Schema（12列：A-L） | ✅ 已部署 | `FEISHU-CONTROL-PLANE-REPORT.md:60-73` |
| Status 验证值（CREATED/RUNNING/PAUSED/FAILED/COMPLETED/ABORTED） | ✅ 已配置 | `FEISHU-CONTROL-PLANE-REPORT.md:91-92` |
| 飞书 → mission.json 导出 | ✅ 已验证闭环 | `FEISHU-CONTROL-PLANE-VALIDATION-REPORT.md:16-27` |
| mission.json → Pump Runner 执行 | ✅ 已验证闭环 | `FEISHU-CONTROL-PLANE-VALIDATION-REPORT.md:28-45` |
| Mission 状态回写飞书（5列） | ✅ 已验证 | `FEISHU-CONTROL-PLANE-VALIDATION-REPORT.md:47-58` |
| 只读字段保护（ID/Description/Owner/Executor/Priority） | ✅ 已验证 | `FEISHU-CONTROL-PLANE-VALIDATION-REPORT.md:60-67` |
| 智能 diff 只写变化值 | ✅ 已验证 | `FEISHU-CONTROL-PLANE-VALIDATION-REPORT.md:42-44` |
| Webhook 单向通知 | ✅ 已部署并验证 | `FEISHU-CONTROL-PLANE-VALIDATION-REPORT.md:68-75` |
| 通知3级 Severity（INFO/WARNING/ERROR） | ✅ 已部署 | `feishu-notify.py:17-19` |
| 通知编码修复（ensure_ascii=False） | ✅ 已部署 | `feishu-notify.py:54` |
| 通知结果验证（飞书返回 success） | ✅ 已验证 | `FEISHU-NOTIFICATION-IMPLEMENT-001` |

### 1.3 工具链

| 工具 | 路径 | 行数 | 语言 | 输入 | 输出 |
|:-----|:-----|:-----|:-----|:-----|:------|
| `feishu_bootstrap.py` | `backend/tools/` | ~1044行 | Python | 环境变量 APP_ID/APP_SECRET | 飞书资源创建 |
| `feishu-to-mission.py` | `backend/tools/` | ~289行 | Python | Board Token + Sheet ID + Row | mission.json |
| `mission-to-feishu.py` | `backend/tools/` | ~指令?行 | Python | mission.state | 飞书行更新 |
| `feishu-notify.py` | `backend/tools/` | 142行 | Python | Webhook URL（环境变量） | 群消息 |
| `heartbeat_check.py` | `backend/tools/` | ~指令?行 | Python | 环境变量 + .missions/ | 日志 + 通知 |

---

## 2. 当前飞书不能做什么

| 缺失能力 | 影响 | 阻塞原因 |
|:---------|:-----|:---------|
| ❌ `im:message` 未开通 | 飞书群不能主动接收消息 | 权限未配置 + 应用版本未重新发布 |
| ❌ Event Subscription 未配置 | 飞书不能主动触发 Lobster | 需要事件服务器（ngrok/公网） |
| ❌ 双向通信 | 飞书群@机器人无响应 | `im:message` + Event 均缺失 |
| ❌ GPT API 未接入 | 不能自然语言理解群消息 | 设计完成，未实施 |
| ❌ Mission Board Created Time 列缺失 | 无法追踪创建时间 | 列需新增 |
| ❌ 列名命名不规范（Start/End Time → Started/Finished Time） | 命名不一致 | 需重命名 |
| ❌ 状态变更自动通知（Phase C） | RUNNING→COMPLETED 无推送 | 未实施 |

---

## 3. 成为控制入口的差距分析

### 3.1 当前能力 vs Event Gateway 要求

| Event Gateway 要求 | 当前状态 | 差距 |
|:-------------------|:---------|:-----|
| 接收飞书事件 | ❌ 缺失 | 无 Event Subscription, 无公网接收端点 |
| 解析消息内容 | ❌ 缺失 | 无 Event 服务器，无消息处理 |
| 自然语言→Mission Draft | ❌ 缺失 | GPT API 设计完成未部署 |
| Draft 审核确认 | ❌ 缺失 | Lobster 可审核但无入口 |
| Draft → Pump Runner | ✅ 已具备 | 现有控制链，无需修改 |
| 进度通知 Owner | ✅ 已具备 | Webhook 通知已部署 |

### 3.2 所需实施步骤

按依赖关系排序：

```
Step 1: 开通 im:message + im:chat 权限
   └─ 重新发布应用版本
   └─ 权限经管理员审批
   ↓
Step 2: 开发 Event 接收服务器
   └─ ngrok + Flask/FastAPI
   └─ 配置 Event Subscription（消息接收事件）
   ↓
Step 3: GPT API 集成
   └─ 解析群消息 → Mission Draft
   └─ 状态查询 → 群回复
   ↓
Step 4: 审核确认机制
   └─ Draft → Lobster 审核 → 执行/拒绝
```

### 3.3 架构不变部分

| 组件 | 是否修改 | 说明 |
|:-----|:---------|:------|
| Pump Runner | ❌ 不变 | 保持独立执行 |
| Claude Code CLI | ❌ 不变 | 保持唯一执行者 |
| .missions/ | ❌ 不变 | Runtime SOT |
| mission-to-feishu.py | ❌ 不变 | 回写机制 |
| feishu_bootstrap.py | ❌ 不变 | 初始化工具 |

---

## 4. 能力矩阵汇总

| 类别 | 能力 | 状态 | 证据 |
|:-----|:-----|:-----|:------|
| 🏗️ 基础设施 | 应用注册 | ✅ | `FEISHU-BOOTSTRAP-IMPLEMENTATION.md:14-20` |
| 🏗️ 基础设施 | 知识库空间 | ✅ | 验证记录 |
| 🏗️ 基础设施 | 文件夹结构 | ✅ | 验证记录 |
| 🏗️ 基础设施 | Mission Board | ✅ | `FEISHU-CONTROL-PLANE-REPORT.md:60-73` |
| 🏗️ 基础设施 | AI Team 群 | ✅ | chat_id: 7663726635614473190 |
| 🎮 控制面 | 创建 Mission | ✅ | `FEISHU-CONTROL-PLANE-VALIDATION-REPORT.md:16-27` |
| 🎮 控制面 | 导出 mission.json | ✅ | `feishu-to-mission.py` |
| 🎮 控制面 | 执行调度 | ✅ | `PUMP-RUNNER-STABILITY-REPORT.md:6-10` |
| 🎮 控制面 | 状态回写 | ✅ | `mission-to-feishu.py` 已验证 |
| 🎮 控制面 | 只读字段保护 | ✅ | `FEISHU-CONTROL-PLANE-VALIDATION-REPORT.md:60-67` |
| 🔔 通知 | Webhook 群消息 | ✅ | `feishu-notify.py:142行` |
| 🔔 通知 | 3级 Severity | ✅ | `feishu-notify.py:17-19` |
| 🔔 通知 | 异常自动告警 | ✅ | `heartbeat_check.py` 已部署 |
| 📡 入口 | 飞书接收消息 | ❌ 缺失 | `im:message` 未开通 |
| 📡 入口 | Event Subscription | ❌ 缺失 | 需事件服务器 |
| 📡 入口 | GPT 自然语言 | ❌ 缺失 | 设计完成未实施 |
| 📡 入口 | 双向通信 | ❌ 缺失 | 以上全部缺失 |
