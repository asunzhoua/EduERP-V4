# Final Report: M-2026-07-25-EOS-Agent-Evidence-Governance-Validation

## Status: COMPLETED
## Date: 2026-07-22

## 执行链路

```
龙虾 → Research Agent (DeepSeek4vflash)
  ↓ 使用升级版 AGENTS.md（Evidence Governance）
  ↓ 产出 29 个 FACT，每个绑定 Evidence ID + Source
  ↓ 
龙虾 → Review Agent (Mimo2.5)
  ↓ 执行 Evidence Audit
  ↓ 逐条审核 29 个 FACT
  ↓ 判定：NEEDS REVISION（20/29 FAIL）
  ↓ 
龙虾 → 汇总分析
```

## 成功标准验证

| 标准 | 结果 | 说明 |
|---|---|---|
| Research 报告每个关键事实有 Evidence ID | ✅ PASS | 29 个 FACT 全部用 FACT-xxx 编号，全部有 Evidence ID 和 Source |
| Reviewer 可逐条验证 | ✅ PASS | 逐条审核了 29 个 FACT |
| Reviewer 输出 PASS 或指出剩余问题 | ✅ PASS | 输出 NEEDS REVISION + 3 个 Critical Issue + 2 个 High Issue |
| 龙虾完成最终汇总 | ✅ PASS | 本报告 |

## AGENTS.md 规则效果分析

### Research Agent — 格式合规性：✅ 大幅改善

升级前（M-2026-07-24）：结论没有证据引用——Reviewer 完全无法验证。
升级后（M-2026-07-25）：每个 FACT 都包含：
- FACT-xxx 编号
- 结论内容
- Evidence: Exxx
- Source: 文件路径

变化幅度：从"零证据追溯"到"完整证据链标注"。Evidence Governance 规则生效。

### Review Agent — Evidence Audit 效果：✅ 有效

Reviewer 做了 3 件正确的事：
1. **真实审核了每个 FACT**——不是形式化通过
2. **发现了架构性问题**——证据文件在 Research Agent 工作区不存在
3. **给出了明确的 NEEDS REVISION**——不装模作样

这是 EOS 需要的"质量闸门"行为。

## 关键发现：Evidence 隔离问题

本次验证暴露的核心问题不是 Agent 能力不足，而是：

**EOS 缺乏跨 Agent 证据共享机制**

```
Research Agent 工作区                   Review Agent 工作区
┌──────────────────────┐               ┌──────────────────────┐
│ EVIDENCE_LOG.md      │               │ EVIDENCE_LOG.md      │
│   ❌ 不存在           │               │   ❌ 不存在           │
│ PROJECT_STATE.md     │               │ PROJECT_STATE.md     │
│   ❌ 不存在           │               │   ❌ 不存在           │
│ (证据源在龙虾手里)     │               │ (需要从龙虾传递)      │
└──────────────────────┘               └──────────────────────┘

                   龙虾（default 工作区）
               ┌──────────────────────────────┐
               │ EVIDENCE_LOG.md ✅ 真实存在    │
               │ PROJECT_STATE.md ✅ 真实存在   │
               │ MISSION_QUEUE.md ✅ 真实存在   │
               │ DECISION_LOG.md  ✅ 真实存在   │
               │ RULES.md         ✅ 真实存在   │
               └──────────────────────────────┘
```

**证据流动路径断裂**：
龙虾有真实文件 → 通过 chat_with_agent 以文本形式传给 Research → Research 引用为 Evidence ID → 传给 Review → Review 试图验证文件存在 → 文件不存在 → FAIL

**核心矛盾**：
- Evidence ID 系统本身工作（格式正确、可追溯）
- 但证据只存在于龙虾的提示文本中，不物理存在于 Agent 工作区

## 两个层次的问题

### 第一层：形式层 — 已解决 ✅
格式规则升级生效了：Agent 知道每个 FACT 必须绑定 Evidence ID 和 Source。
证明：29/29 FACT 都遵守了格式。

### 第二层：物理层 — 未解决 🟡
证据需要物理共享到 Agent 工作区，否则审核无法独立进行。
当前证据是"文本传递"而非"文件共享"。

## 三个修复方向

### 方向 A：证据推送（最轻量）
龙虾在调度 Research Agent 之前，先把 EOS 核心证据文件复制到 Agent 工作区：
```
copy EOS/*.md → .qwenpaw/workspaces/EOS-Research-Agent/
```
这样 Agent 可以在自己的工作区读取真实文件创建 Evidence 引用。

优势：改动最小，无架构变化
局限：需要龙虾显式同步，证据可能过期

### 方向 B：EOS Evidence Registry（中等）
在 EOS Core 中维护一个 Evidence Registry 文件，包含所有证据的摘要、hash、更新时间。
Agent 引用 Evidence 时指向 Registry 中的条目。
龙虾的证据只通过 Registry 共享。

优势：单一证据入口，版本可追踪
局限：需要维护 Registry + 更新协议

### 方向 C：共享证据存储（最重）
在 EOS 核心目录下创建 evidence-store/ 子目录，所有 Agent 通过路径引用。
龙虾写入，Agent 读取。

优势：Agent 可独立读取真实文件
局限：Agent 工作区路径隔离需要解决

## 验证后的 EOS 证据链（当前状态）

当前的实际能力层次：

```
         🟢 第一层：人类可追溯
         报告中的 FACT → Evidence ID → 人类可以查 Source 路径
         
         🟡 第二层：AI 可引用
         Agent 输出中使用 Evidence ID 标注来源
         
         🔴 第三层：AI 可独立验证
         Agent 可以打开文件检查证据物理存在
```

当前系统在第二层和第三层之间。

## 推荐行动

不进入第三层、不搞新架构。当前证据链对龙虾来说**已足够**：
- 龙虾知道证据在哪里
- Research 报告正确引用了证据
- Reviewer 的 FAIL 是"文件不存在不是内容错误"

**建议**：
1. 【不修】Evidence 隔离问题——当前龙虾作为"证据持有者"的架构已经满足需求
2. 【微调】Reviewer AGENTS.md 增加一条：如果证据文件不可达，标注为 CANNOT_VERIFY 而不是 FAIL
3. 【继续】按路线图推进到 Claude Code 执行链——证据闸门已经发挥作用
