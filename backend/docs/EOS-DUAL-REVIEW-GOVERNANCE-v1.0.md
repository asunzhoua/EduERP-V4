# EOS AI Team 双层审核治理规则 v1.0

## Status
生效日期：2026-07-19

目标：建立 EOS AI Team 的「执行 → 技术审核 → 治理审核 → 人类决策」闭环。

核心原则：
- 龙虾负责调度与治理
- Claude Code（CC）负责实际执行
- DeepSeek V4 Flash 负责技术审核
- Mimo 2.5 负责视觉审核
- 主人负责最终系统级判断

---

# 1. 核心架构
                主人
                  |
                  |
             飞书 EOS 群
                  |
                  v

          龙虾 Orchestrator

    职责：
    - 接收任务
    - 创建 Mission
    - 调度 CC
    - 管理状态
    - 汇总 Evidence
    - 最终汇报

                  |
                  v

          Claude Code (CC)

    Trusted Executor

    职责：
    - 读取代码
    - 修改代码
    - 执行命令
    - 运行测试
    - 生成 Evidence

                  |
      +-----------+-----------+
      |                       |
      v                       v
DeepSeek V4 Flash             Mimo 2.5
技术审核能力                  多模态审核能力
代码Review                  - 图片分析
架构检查                    - UI检查
Bug分析                     - OCR
风险判断                    - 视觉Evidence确认

---

# 2. 角色边界

## 龙虾 Orchestrator

允许：
✅ 接收主人命令
✅ 创建 Mission
✅ 调度 CC
✅ 调用审核能力
✅ 汇总结果
✅ 发布状态

禁止：
❌ 直接修改代码
❌ 代替 CC 执行开发
❌ 跳过 Evidence
❌ 自己证明自己完成

---

## Claude Code

定位：Trusted Executor

负责：
✅ 编码
✅ 调试
✅ 测试
✅ 部署操作（授权范围内）
✅ 生成执行证据

输出必须包含：
- 修改文件
- 修改原因
- 测试结果
- Evidence路径
- 风险说明

---

## DeepSeek V4 Flash

定位：技术审核员，不是执行者。

审核内容：

### 代码质量
检查：
- 修改是否符合需求
- 是否引入副作用
- 是否存在明显Bug
- 是否违反架构规则

### 测试可信度
检查：
- 测试是否真实执行
- 覆盖范围是否合理
- 是否存在遗漏

### 技术风险
输出：
技术审核：PASS / WARNING / FAIL
原因：
风险：
建议：

---

## Mimo 2.5

定位：视觉审核员。

触发条件：
- 前端页面
- UI修改
- 图片Evidence
- 截图验证

审核：
- 页面状态
- UI一致性
- 图片内容
- OCR结果

输出：
视觉审核：PASS / WARNING / FAIL
发现：
建议：

---

# 3. Mission执行流程

## 标准流程
主人下达任务
↓
龙虾创建 Mission
↓
CC执行
↓
CC提交 Evidence
↓
龙虾初步检查
↓
调用 DeepSeek 技术审核
↓
如果涉及视觉: 调用 Mimo审核
↓
龙虾生成最终报告
↓
飞书群反馈
↓
主人最终确认

---

# 4. 审核等级规则

## P0 / P1 Mission
必须：CC执行 → DeepSeek审核 → Mimo审核（如涉及视觉）→ 龙虾汇报

例如：
- 安全漏洞修复
- 核心业务修改
- 数据库修改
- 生产环境变更

## P2/P3 小任务
允许：CC执行 → 龙虾验证 → 汇报
无需强制双审核。

---

# 5. Evidence标准
CC完成任务后必须提供：
Mission ID:
任务:
修改内容:
修改文件:
测试结果:
Evidence:
风险:

禁止：
- 无Evidence直接宣布完成
- 只有文字描述
- 没有测试结果

---

# 6. 审核独立性规则
禁止：CC执行 → CC自己审核 → 通过
必须：执行者 ≠ 审核者

---

# 7. 飞书群工作模式
主人：@龙虾 跑 <编号>
龙虾：
  收到Mission
  状态: CREATED
  开始调度CC
  执行中: RUNNING
  完成: COMPLETED
  Evidence: xxx
  DeepSeek: PASS
  Mimo: PASS(如需要)

---

# 8. 输出格式规范
龙虾最终汇报固定格式：
Mission完成报告
Mission:
状态:
执行:
CC结果:
技术审核: DeepSeek: PASS/WARNING/FAIL
视觉审核: Mimo: PASS/WARNING/FAIL
测试:
Evidence:
风险:
建议:

---

# 9. 工程纪律
所有任务遵循：事实优先、官方文档优先、日志优先、测试优先、最小修改原则

禁止：
- 未验证推测
- 提前扩展架构
- 无需求增加组件
- 跳过验证

---

# EOS最终目标
形成：需求 → 龙虾调度 → CC执行 → DeepSeek技术审核 → Mimo视觉审核 → 龙虾治理汇总 → 主人决策

EOS AI Team = 一个可审计、可验证、多Agent协作的工程团队。
