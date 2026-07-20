# Mimo 2.5 视觉审核流程

> **版本**: 1.0
> **日期**: 2026-07-19
> **状态**: 已发布
> **作者**: Lobster (Orchestrator)
> **相关文档**:
> - EOS AI Assistant 架构: `EOS-AI-ASSISTANT-ARCHITECTURE.md`
> - 飞书通知脚本: `backend/tools/feishu-notify.py`
> - 审核模板: `backend/tools/mimo-review-template.json`

---

## 1. 概述

当 Claude Code 产出视觉内容（截图/UI/PDF/图表等）时，Lobster 通过 spawn_subagent 调用 Mimo 2.5 进行视觉审核，审核结果通过飞书 Webhook 发回 EOS AI Team 群。

### 1.1 审核链路

```
CC 产出视觉文件
    ↓
Lobster 检测 → 准备审核任务
    ↓
spawn_subagent → Mimo 2.5（OpenCode Go API）
    ↓
结构化审核结果
    ↓
feishu-notify.py → 飞书群通知
```

### 1.2 角色职责

| 角色 | 职责 |
|:-----|:------|
| **Claude Code (CC)** | 产出视觉文件（截图/UI/图表/PDF），提供文件路径 |
| **Lobster (Orchestrator)** | 检测视觉产出、调度 Mimo 审核、接收结果、推送飞书 |
| **Mimo 2.5** | 视觉分析审核，返回结构化结果 |
| **飞书 Webhook** | 通知通道，将审核结果发到 EOS AI Team 群 |

---

## 2. 触发条件

Lobster 在以下情况必须触发 Mimo 视觉审核：

### 2.1 CC 产出的截图
- 程序运行截图（UI 界面、报表页面）
- 错误弹窗/异常界面截图
- 浏览器操作结果截图
- 桌面操作结果截图

### 2.2 CC 生成的 UI 页面
- 前端页面渲染结果
- 用户界面布局/样式
- 响应式设计表现

### 2.3 图表与图形
- 数据可视化图表（折线图/柱状图/饼图等）
- 架构图/流程图截图
- SVG 或 Canvas 生成的图形

### 2.4 PDF 及文档
- CC 生成的 PDF 文件（页面布局、内容展示）
- 报告/文档的预览截图

### 2.5 其他视觉产出
- 图片生成结果
- 截图对比
- 任何需要"看一眼"确认的交付物

---

## 3. 调用方式

### 3.1 Lobster 调用流程

```
Step 1: Lobster 获得 CC 产出的视觉文件路径
Step 2: Lobster 组装审核 prompt（使用模板）
Step 3: Lobster 执行 spawn_subagent，背景任务调 Mimo 2.5
Step 4: Mimo 2.5 分析图片并返回结构化审核结果
Step 5: Lobster 接收结果 → 判断 severity → 调用 feishu-notify.py
```

### 3.2 spawn_subagent 调用命令

Lobster 使用以下方式调用：

```
spawn_subagent(
    task="执行视觉审核任务：\n"
         "1. 分析图片路径：{image_path}\n"
         "2. 使用 Mimo 2.5 进行视觉分析\n"
         "3. 按审核模板返回结构化结果\n"
         "4. 审核模板见 backend/tools/mimo-review-template.json",
    background=True,
    timeout=120
)
```

### 3.3 审核 Prompt 模板

完整的 prompt 模板存储在 `backend/tools/mimo-review-template.json` 中，包含以下核心要素：

1. **角色设定**：Mimo 2.5 作为视觉审核专家
2. **图片路径**：需要分析的视觉文件路径
3. **审核维度**：视觉质量、内容正确性、问题标注
4. **输出格式**：JSON 结构化输出
5. **边界约束**：不审代码逻辑、不审治理合规

---

## 4. 审核模板

Mimo 2.5 返回的结构化审核格式：

### 4.1 审核维度

| 维度 | 评分范围 | 说明 |
|:-----|:---------|:------|
| **视觉质量** | 0-10 | 清晰度、布局、配色、字体等视觉呈现 |
| **内容正确性** | 0-10 | 显示的信息是否准确、无错别字/乱码 |
| **功能正确性** | 0-10 | 界面元素是否可交互、状态是否正确 |

### 4.2 返回值结构

```json
{
  "review": {
    "visual_quality": {
      "score": 8,
      "issues": ["对比度偏低", "文本过小"]
    },
    "content_correctness": {
      "score": 9,
      "issues": []
    },
    "function_correctness": {
      "score": 7,
      "issues": ["按钮状态与预期不符"]
    }
  },
  "annotations": [
    {"type": "error", "description": "按钮文字被截断", "severity": "high"},
    {"type": "warning", "description": "配色对比度偏低", "severity": "medium"}
  ],
  "summary": "整体质量良好，存在2处需修复问题",
  "overall_score": 8.0
}
```

### 4.3 Score 区间映射

| Score | 评级 | 飞书 Severity |
|:------|:-----|:--------------|
| 9-10 | 优秀 🏆 | INFO |
| 7-8  | 良好 ✅ | INFO |
| 5-6  | 一般 ⚠️ | WARNING |
| 0-4  | 差 🚨 | ERROR |

---

## 5. 响应流程

### 5.1 审核结果推送飞书

Lobster 收到 Mimo 审核结果后，调用 feishu-notify.py 发送到飞书群：

```bash
cd C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4
python backend/tools/feishu-notify.py send \\
    --title "Mimo 视觉审核报告" \\
    --message "审核文件: {file_name}\n综合评分: {overall_score}/10\n评级: {rating}\n问题数: {issue_count}\n摘要: {summary}" \\
    --severity {severity}
```

### 5.2 卡片消息格式（推荐）

使用飞书卡片消息 Rich Text 格式展示：

```
┌─────────────────────────────────┐
│ 🎨 Mimo 视觉审核报告            │
│ ─────────────────────────────── │
│ 文件: screenshot_001.png        │
│ 综合评分: 8.0/10 ✅ 良好        │
│ ─────────────────────────────── │
│ 视觉质量:      8/10             │
│ 内容正确性:    9/10             │
│ 功能正确性:    7/10             │
│ ─────────────────────────────── │
│ ⚠️ 按钮文字被截断 (high)        │
│ ℹ️ 配色对比度偏低 (medium)      │
│ └─────────────────────────────────┘
```

### 5.3 异常处理

| 场景 | 处理方式 |
|:-----|:---------|
| Mimo 超时（>120s） | 记录超时，发 WARNING 通知到飞书 |
| 图片路径不存在 | 记录错误，发 ERROR 通知 |
| Mimo 返回格式异常 | 尝试解析，失败则发 WARNING |
| 飞书 Webhook 失败 | 记录日志，不阻塞后续流程 |

---

## 6. 边界说明

### 6.1 Mimo 2.5 的审核范围

Mimo 2.5 **负责**审核：
- ✅ 视觉呈现质量（清晰度、布局、配色）
- ✅ 内容显示正确性（文字、数据、状态）
- ✅ UI 元素完整性（按钮、输入框、图标）
- ✅ 截图/图片中的明显错误
- ✅ PDF 文档的页面布局和内容展示

### 6.2 Mimo 2.5 不审核

Mimo 2.5 **不负责**审核：
- ❌ 代码逻辑正确性（→ DeepSeek V4-Flash 或 CC）
- ❌ 治理合规性（→ Lobster）
- ❌ 架构设计合理性（→ DeepSeek V4-Flash）
- ❌ 测试覆盖率（→ CC 测试执行）
- ❌ 安全性审计（→ 专门安全工具）
- ❌ 性能基准测试（→ 专门性能工具）

### 6.3 审核局限性

1. Mimo 2.5 对复杂 PDF 多页内容的分析有限
2. 对于动态交互效果（动画/过渡），仅能从截图判断
3. 评分较为主观，不应作为唯一通过标准
4. 连续截图审核可能产生上下文干扰，建议独立审核

---

## 7. 集成方式

### 7.1 自动集成（推荐）

在 CC Mission 的 Evidence 收集环节，Lobster 自动检测视觉产出文件，触发 Mimo 审核：

```
CC Mission Complete
    ↓
Lobster: 检查产出文件列表
    ↓
发现 .png/.jpg/.pdf/.svg 等视觉文件
    ↓
Lobster: 触发 Mimo 审核 (spawn_subagent)
    ↓
Mimo: 返回审核结果
    ↓
Lobster: 推送到飞书群 + 记录到 Evidence
```

### 7.2 手动触发

主人（龙虾）可在飞书群中手动发起审核：

```
@EOS AI Assistant 审核图片 <文件路径>
```

---

## 8. 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|:-----|:-----|:---------|:-----|
| 1.0 | 2026-07-19 | 初始版本 | Lobster |
