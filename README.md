# EduERP V4 — Education ERP

> 版本：v4.0
> 状态：架构冻结（Architecture Freeze）

---

## 项目简介

EduERP V4 是新一代教育 ERP 系统。采用模块化、事件驱动架构，支持多端（微信小程序 + Web 后台）协同，统一权限管理，灵活扩展。

## 项目目标

- 构建稳定、可扩展的教育 ERP 系统
- 实现前后端分离、事件驱动的现代化架构
- 支持微信小程序与 Web 双端覆盖
- 统一的权限与数据管理体系

## 项目结构

```
EduERP-V4/
├── README.md
├── CHANGELOG.md
├── LICENSE
├── .gitignore
├── docs/          — 文档体系
├── src/           — 源代码
├── database/      — 数据库脚本
├── api/           — API 定义
├── test/          — 测试
├── deploy/        — 部署配置
├── assets/        — 静态资源
├── scripts/       — 工具脚本
└── config/        — 配置文件
```

## 开发原则

1. **文档驱动** — 所有开发必须严格遵循文档体系定义
2. **架构冻结** — 当前阶段禁止修改架构、新增功能
3. **模块化** — 各模块职责清晰，单向依赖
4. **事件驱动** — 模块间通过 EventBus 通信
5. **统一权限** — 所有接口必须经过权限校验

## 文档入口

文档统一存放于 [docs/](./docs/) 目录，阅读顺序请参照 [docs/README.md](./docs/README.md)。

## 禁止事项

- 禁止绕过 Constitution（宪法）直接开发
- 禁止直接修改数据库（必须通过 Migration + API）
- 禁止新增未经文档定义的业务规则
- 禁止新增未经设计的权限点
- 禁止新增未经定义的事件
- 禁止自由发挥命名（必须遵循 CodingConvention）

## 开发流程

1. 阅读 docs/ 目录下全部相关文档
2. 遵循 AIDevelopmentGuide 中的 AI 行为规范
3. 遵循 CodingConvention 中的命名规范
4. 修改后更新对应文档
5. 通过测试和验收标准方可提交
