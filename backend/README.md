# EduERP-V4 Backend

教培机构 ERP 系统后端 — NestJS + TypeScript + MySQL

## Tech Stack

- **Runtime:** Node.js
- **Framework:** NestJS
- **Language:** TypeScript
- **Database:** MySQL 8.0 (TypeORM)
- **Auth:** JWT + Passport + RBAC
- **EventBus:** @nestjs/event-emitter
- **API Docs:** Swagger (auto-generated)

## Project Structure

```
src/
├── common/               # 共享层 (DTO, Guards, Decorators, Filters, Interceptors)
├── config/               # 配置中心
├── modules/              # 业务模块
│   ├── identity/         # 用户认证 (注册/登录/JWT)
│   ├── student/          # 学生管理
│   └── teaching/         # 教学核心
│       ├── course/       # 课程
│       ├── class/        # 班级
│       ├── contract/     # 合同
│       ├── enrollment/   # 报名
│       ├── lesson/       # 课时
│       ├── lesson-attendance/   # 考勤
│       ├── teacher-assignment/  # 教师分配
│       ├── teacher-dashboard/   # 教师仪表盘
│       └── lesson-change-request/ # 调课申请
└── app.module.ts         # 根模块
```

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run start:dev

# Build
npm run build

# Production
npm run start:prod
```

## Testing

```bash
# Run all tests
npx jest --no-coverage

# Run specific module tests
npx jest teaching

# Run with coverage
npx jest --coverage
```

**Current status:** 940+ tests, 75+ suites — ALL PASS

## Path Aliases

| Alias | Path |
|-------|------|
| `@common` | `src/common/` |
| `@modules` | `src/modules/` |

## Architecture

- **Controller** — 接收请求、返回响应，不含业务逻辑
- **Service** — 业务逻辑核心
- **Repository** — 数据库访问层
- **Entity** — TypeORM 实体，映射数据库表

## Related

- Frontend: 微信小程序 (miniapp/)
- Database: MySQL (EduOS schema, 19 tables)
- GitHub: https://github.com/asunzhoua/EduERP-V4
