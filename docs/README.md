# EduERP V4 — 文档体系

## 阅读顺序

```
00 Constitution（宪法）
       ↓
01 PRD（产品需求文档）
       ↓
02 SAD（系统架构文档）
       ↓
03 Database（数据库设计）
       ↓
04 API（接口规范）
       ↓
05 EventBus（事件总线）
       ↓
06 Permission（权限设计）
       ↓
07 WeChat（微信小程序）
       ↓
08 Web（Web后台）
       ↓
09 Test（测试）
       ↓
10 Deploy（部署）
       ↓
11 AI Development（AI开发规范）
       ↓
12 Evolution（演进规划）
```

## 重要说明

**任何 AI 开始开发前必须先阅读以上文档。** 各文档必须按照上述顺序阅读，下层文档依赖上层文档的定义。跳读可能导致上下文缺失和实现偏差。

## 文档状态

当前阶段：架构冻结（Architecture Freeze）
所有文档模板已建立，内容待填充。

## 目录结构

```
docs/
├── 00-Constitution/    — 架构宪法
├── 01-PRD/             — 产品需求
├── 02-SAD/             — 系统架构
├── 03-Database/        — 数据库
├── 04-API/             — 接口规范
├── 05-EventBus/        — 事件总线
├── 06-Permission/      — 权限设计
├── 07-WeChat/          — 微信小程序
├── 08-Web/             — Web后台
├── 09-Test/            — 测试
├── 10-Deploy/          — 部署
├── 11-AI-Development/  — AI开发规范
├── 12-Evolution/       — 演进规划
└── 99-Archive/         — 归档
```
