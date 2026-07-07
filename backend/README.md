# EduOS Backend

## Tech Stack

- **Runtime:** Node.js 24+
- **Framework:** NestJS 11
- **Language:** TypeScript 5
- **Database:** MySQL 8.0 (TypeORM)
- **Auth:** JWT + Passport
- **EventBus:** @nestjs/event-emitter

## Project Structure

```
src/
├── common/               # 共享层
│   ├── constants/        # 常量定义
│   ├── dto/              # 通用 DTO
│   ├── decorators/       # 自定义装饰器
│   ├── enums/            # 枚举定义
│   ├── exceptions/       # 自定义异常
│   ├── filters/          # 全局异常过滤器
│   ├── guards/           # RBAC 权限守卫
│   ├── interceptors/     # 统一响应拦截器
│   └── interfaces/       # TypeScript 接口
├── config/               # 配置中心
│   ├── configuration.ts  # 应用配置
│   └── database.config.ts# 数据库配置
├── database/             # 数据库
│   ├── entities/         # TypeORM 实体
│   ├── migrations/       # 数据库迁移
│   ├── seeds/            # 种子数据
│   └── repository/       # 自定义仓库
├── events/               # EventBus 事件
│   ├── lesson/           # 课程事件
│   ├── leave/            # 请假事件
│   ├── finance/          # 财务事件
│   ├── notification/     # 通知事件
│   ├── event-bus.module.ts
│   ├── event-bus.service.ts
│   └── index.ts
├── modules/              # 业务模块（11 个一级模块）
│   ├── student/
│   ├── teacher/
│   ├── parent/
│   ├── lesson/
│   ├── course/
│   ├── attendance/
│   ├── leave/
│   ├── finance/
│   ├── points/
│   ├── dashboard/
│   └── system/
├── utils/                # 工具
│   ├── logger/           # 日志系统
│   ├── helper/           # 辅助函数
│   └── validator/        # 自定义校验
├── middleware/            # 中间件
│── app.module.ts         # 根模块
└── main.ts               # 入口
```

## Path Aliases

| Alias | Path |
|-------|------|
| `@common` | `src/common/` |
| `@modules` | `src/modules/` |
| `@events` | `src/events/` |
| `@database` | `src/database/` |
| `@config` | `src/config/` |
| `@utils` | `src/utils/` |

## Getting Started

```bash
# Install
npm install

# Start dev
npm run start:dev

# Build
npm run build

# Production
npm run start:prod
```

## Architecture Rules

1. **Controller** — 只接收请求和返回响应，不写业务逻辑
2. **Service** — 业务逻辑，通过 EventBus 发布事件
3. **EventBus** — 模块间唯一通信方式
4. **Repository** — 数据库访问
5. **严禁**：Controller 调用其他模块 Service、模块间直接调用、硬编码业务规则

## Related Docs

- [Constitution](../../docs/00-Constitution/Constitution-v4.0.md)
- [PRD](../../docs/01-PRD/PRD-v4.0.md)
- [SAD](../../docs/02-SAD/SAD-v4.0.md)
- [API Specification](../../docs/04-API/API-Specification.md)
- [Event Bus](../../docs/05-EventBus/EventBusSpecification.md)
- [Coding Convention](../../docs/11-AI-Development/CodingConvention.md)
