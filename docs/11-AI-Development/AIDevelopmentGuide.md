# EduERP V4 — AI Development Guide

> 版本：v4.0
> 状态：架构冻结
> 最后更新：2026-07-06

---

## 适用范围

本规范适用于所有参与 EduERP V4 开发的 AI 辅助编程工具，包括但不限于：

- Claude（Anthropic）
- Qwen（阿里通义）
- 元宝（腾讯）
- 小龙虾
- 其他任何 AI 编程助手

## 核心原则

### 1. 文档先行

任何 AI 在开发前**必须**按照以下顺序阅读相关文档：

```
00 Constitution → 01 PRD → 02 SAD → 03 Database → 04 API
→ 05 EventBus → 06 Permission → 07 WeChat → 08 Web
→ 09 Test → 10 Deploy → 11 AI Development → 12 Evolution
```

### 2. 禁止绕过

AI 开发者不得：

- **不得绕过 Constitution** — 宪法是最高架构决策，任何代码不得违反
- **不得直接修改数据库** — 所有数据库变更必须通过 Migration + API，禁止直连修改
- **不得新增业务规则** — 业务规则必须先在 PRD 中定义，再编码实现
- **不得新增权限** — 所有权限点必须在 PermissionDesign 中预先定义
- **不得新增事件** — 所有事件类型必须在 EventBusSpecification 中预先定义

### 3. 引用文档

AI 在生成代码时，必须在关键决策处注释引用依据的文档位置，例如：

```python
# ref: 03-Database/ER.md §2.3 — User 表 role 字段枚举值
```

### 4. 保持一致性

- 遵循 [CodingConvention.md](./CodingConvention.md) 的所有命名规则
- 遵循 [API-Specification.md](../04-API/API-Specification.md) 的接口风格
- 遵循 [EventBusSpecification.md](../05-EventBus/EventBusSpecification.md) 的事件格式
- 遵循 [PermissionDesign.md](../06-Permission/PermissionDesign.md) 的权限管控

### 5. 修改即更新

AI 在修改任何代码或文档后，必须同步更新：

- 对应的文档文件
- CHANGELOG.md
- 受影响的测试用例

### 6. 测试验证

- 所有代码变更必须有对应的测试覆盖
- 必须通过 Acceptance.md 中定义的验收标准
- 不得提交未通过测试的代码

## 违规处理

任何 AI 若违反上述规范，其生成的代码将被标记为「未审核」并退回重做。多次违规将禁止该 AI 继续参与项目开发。
