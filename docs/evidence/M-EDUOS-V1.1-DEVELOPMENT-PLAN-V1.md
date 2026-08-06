# EduOS V1.1 Development Plan

**Mission**: M-EDUOS-V1.1-DEVELOPMENT-PLAN-V1  
**Date**: 2026-07-27  
**Planner**: 龙虾 (Orchestrator)

---

## 1. Development Overview

### V1.1 Goals
- 增强生产环境监控能力
- 提升教师端使用体验
- 保持 V1.0 生产稳定性
- 增量开发，不影响现有功能

### Development Timeline
- **Total Duration**: 3 周（15 个工作日）
- **Phase 1**: Week 1 - Core Improvements
- **Phase 2**: Week 2 - Monitoring Integration
- **Phase 3**: Week 3 - Optimization & Documentation

---

## 2. Development Tasks

### Phase 1: Core Improvements (Week 1)

#### Task 1.1: Health Check Endpoint (IMP-001)
**Priority**: P1  
**Duration**: 0.5 天  
**Status**: Ready

**Implementation**:
```typescript
// src/modules/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '@common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.1.0',
    };
  }
}
```

**Files to Create/Modify**:
- Create: `src/modules/health/health.controller.ts`
- Create: `src/modules/health/health.module.ts`
- Modify: `src/app.module.ts` (import HealthModule)

**Testing**:
```bash
curl http://localhost:3000/api/v1/health
# Expected: { status: 'ok', timestamp: '...', uptime: ... }
```

**Verification**:
- ✅ 端点可访问
- ✅ 返回正确格式
- ✅ 无需认证

---

#### Task 1.2: Login Failure Logging (IMP-004)
**Priority**: P2  
**Duration**: 0.5 天  
**Status**: Ready

**Implementation**:
```typescript
// src/modules/identity/auth/auth.service.ts
async login(dto: LoginDto, ipAddress?: string) {
  const user = await this.userService.findByUsername(dto.username);
  
  if (!user) {
    // 记录失败日志
    await this.loginLogService.logFailure({
      username: dto.username,
      reason: 'USER_NOT_FOUND',
      ipAddress,
      timestamp: new Date(),
    });
    throw new UnauthorizedException('用户名或密码错误');
  }
  
  const isValid = await bcrypt.compare(dto.password, user.password);
  if (!isValid) {
    // 记录失败日志
    await this.loginLogService.logFailure({
      username: dto.username,
      reason: 'INVALID_PASSWORD',
      ipAddress,
      timestamp: new Date(),
    });
    throw new UnauthorizedException('用户名或密码错误');
  }
  
  // 记录成功日志
  await this.loginLogService.logSuccess({
    userId: user.id,
    username: user.username,
    ipAddress,
    timestamp: new Date(),
  });
  
  return this.generateToken(user);
}
```

**Files to Create/Modify**:
- Create: `src/modules/identity/login-log/login-log.entity.ts`
- Create: `src/modules/identity/login-log/login-log.service.ts`
- Create: `src/modules/identity/login-log/login-log.module.ts`
- Modify: `src/modules/identity/auth/auth.service.ts`
- Modify: `src/modules/identity/identity.module.ts`

**Database Schema**:
```sql
CREATE TABLE login_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  userId BIGINT NULL,
  status ENUM('SUCCESS', 'FAILURE') NOT NULL,
  reason VARCHAR(50) NULL,
  ipAddress VARCHAR(45) NULL,
  userAgent TEXT NULL,
  timestamp DATETIME NOT NULL,
  INDEX idx_username (username),
  INDEX idx_timestamp (timestamp),
  INDEX idx_status (status)
);
```

**Testing**:
```bash
# 测试失败登录
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"invalid","password":"wrong"}'

# 验证日志记录
SELECT * FROM login_log WHERE username = 'invalid';
```

**Verification**:
- ✅ 失败登录被记录
- ✅ 成功登录被记录
- ✅ 日志包含必要信息

---

#### Task 1.3: Teacher-Specific Endpoints (IMP-003)
**Priority**: P2  
**Duration**: 1 天  
**Status**: Ready

**Implementation**:
```typescript
// src/modules/teaching/teacher/teacher.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@modules/identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { TeacherService } from './teacher.service';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Teacher')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get('me/courses')
  async getMyCourses(@CurrentUser() user: any) {
    return this.teacherService.getCoursesByTeacherId(user.id);
  }

  @Get('me/classes')
  async getMyClasses(@CurrentUser() user: any) {
    return this.teacherService.getClassesByTeacherId(user.id);
  }

  @Get('me/students')
  async getMyStudents(@CurrentUser() user: any) {
    return this.teacherService.getStudentsByTeacherId(user.id);
  }
}
```

**Files to Create/Modify**:
- Create: `src/modules/teaching/teacher/teacher.controller.ts`
- Create: `src/modules/teaching/teacher/teacher.service.ts`
- Create: `src/modules/teaching/teacher/teacher.module.ts`
- Modify: `src/modules/teaching/teaching.module.ts`

**Testing**:
```bash
# 使用教师 token
curl -X GET http://localhost:3000/api/v1/teachers/me/courses \
  -H "Authorization: Bearer {teacher_token}"

curl -X GET http://localhost:3000/api/v1/teachers/me/classes \
  -H "Authorization: Bearer {teacher_token}"

curl -X GET http://localhost:3000/api/v1/teachers/me/students \
  -H "Authorization: Bearer {teacher_token}"
```

**Verification**:
- ✅ 教师只能查看自己的数据
- ✅ 非教师角色返回 403
- ✅ 数据正确关联

---

### Phase 2: Monitoring Integration (Week 2)

#### Task 2.1: APM Integration (IMP-002)
**Priority**: P2  
**Duration**: 2 天  
**Status**: Planned

**Options**:
1. **Sentry** (推荐)
   - 错误追踪
   - 性能监控
   - 免费额度：5K events/月
   
2. **New Relic**
   - 全面 APM
   - 价格：$50-200/月
   
3. **Datadog**
   - 企业级监控
   - 价格：$15/主机/月

**Implementation (Sentry)**:
```bash
npm install @sentry/node @sentry/tracing
```

```typescript
// src/main.ts
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app }),
  ],
});
```

**Files to Modify**:
- Modify: `package.json` (add dependencies)
- Modify: `src/main.ts` (initialize Sentry)
- Modify: `.env.example` (add SENTRY_DSN)

**Testing**:
- 故意抛出错误，验证 Sentry 捕获
- 检查 Sentry Dashboard

**Verification**:
- ✅ 错误自动上报
- ✅ 性能数据收集
- ✅ 告警配置完成

---

#### Task 2.2: API Response Time Monitoring (IMP-005)
**Priority**: P3  
**Duration**: 1 天  
**Status**: Planned

**Implementation**:
```typescript
// src/common/interceptors/performance.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest();
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        if (duration > 1000) {
          console.warn(`[SLOW API] ${request.method} ${request.url} - ${duration}ms`);
        }
      }),
    );
  }
}
```

**Files to Create/Modify**:
- Create: `src/common/interceptors/performance.interceptor.ts`
- Modify: `src/main.ts` (register interceptor)

**Testing**:
- 调用慢接口，验证日志记录
- 检查性能报告

**Verification**:
- ✅ 慢请求被记录
- ✅ 性能数据统计
- ✅ 告警阈值配置

---

#### Task 2.3: Database Connection Pool Monitoring (IMP-006)
**Priority**: P3  
**Duration**: 1 天  
**Status**: Planned

**Implementation**:
```typescript
// src/modules/database/pool-monitor.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class PoolMonitorService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async monitorPool() {
    const pool = this.connection.driver as any;
    if (pool.pool) {
      const stats = {
        total: pool.pool.size,
        active: pool.pool.active,
        idle: pool.pool.idle,
        waiting: pool.pool.waiting,
      };
      
      console.log('[DB Pool]', stats);
      
      // 告警：活跃连接 > 80%
      if (stats.active / stats.total > 0.8) {
        console.warn('[DB Pool Warning] High connection usage', stats);
      }
    }
  }
}
```

**Files to Create/Modify**:
- Create: `src/modules/database/pool-monitor.service.ts`
- Modify: `src/modules/database/database.module.ts`

**Testing**:
- 验证定时任务执行
- 检查日志输出

**Verification**:
- ✅ 连接池状态监控
- ✅ 异常告警
- ✅ 日志记录

---

### Phase 3: Optimization & Documentation (Week 3)

#### Task 3.1: Error Message Enhancement
**Priority**: P2  
**Duration**: 1 天  
**Status**: Planned

**Implementation**:
```typescript
// src/common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const message = exception.message;

    // 友好的错误信息
    const friendlyMessage = this.getFriendlyMessage(status, message);

    response.status(status).json({
      code: status,
      message: friendlyMessage,
      timestamp: new Date().toISOString(),
    });
  }

  private getFriendlyMessage(status: number, message: string): string {
    const messages = {
      400: '请求参数错误，请检查输入',
      401: '未授权，请先登录',
      403: '权限不足，无法访问',
      404: '资源不存在',
      500: '服务器内部错误，请稍后重试',
    };
    return messages[status] || message;
  }
}
```

**Files to Modify**:
- Modify: `src/common/filters/http-exception.filter.ts`

**Verification**:
- ✅ 错误信息友好
- ✅ 统一格式
- ✅ 多语言支持（可选）

---

#### Task 3.2: API Documentation Update
**Priority**: P2  
**Duration**: 1 天  
**Status**: Planned

**Implementation**:
- 更新 Swagger 文档
- 添加新端点文档
- 补充示例代码

**Files to Modify**:
- Modify: `src/modules/health/health.controller.ts` (add Swagger decorators)
- Modify: `src/modules/teaching/teacher/teacher.controller.ts` (add Swagger decorators)

**Verification**:
- ✅ Swagger 文档完整
- ✅ 示例代码正确
- ✅ 在线测试可用

---

#### Task 3.3: Performance Optimization
**Priority**: P3  
**Duration**: 2 天  
**Status**: Planned

**Implementation**:
- 优化慢查询
- 添加数据库索引
- 优化 N+1 查询

**Files to Modify**:
- 根据性能监控结果确定

**Verification**:
- ✅ 慢查询优化
- ✅ 性能提升
- ✅ 监控数据改善

---

#### Task 3.4: User Guide Documentation
**Priority**: P3  
**Duration**: 1 天  
**Status**: Planned

**Implementation**:
- 编写用户指南
- API 使用文档
- 常见问题解答

**Files to Create**:
- Create: `docs/user-guide.md`
- Create: `docs/api-usage.md`
- Create: `docs/faq.md`

**Verification**:
- ✅ 文档完整
- ✅ 示例清晰
- ✅ 易于理解

---

## 3. Testing Strategy

### Unit Testing
- 每个新功能必须有单元测试
- 覆盖率目标：> 80%
- 使用 Jest 测试框架

### Integration Testing
- API 端点集成测试
- 数据库操作测试
- 权限验证测试

### Performance Testing
- 负载测试
- 压力测试
- 响应时间测试

### Security Testing
- 权限测试
- SQL 注入测试
- XSS 测试

---

## 4. Deployment Strategy

### Staging Environment
- 先在 Staging 环境部署
- 完整测试验证
- 性能测试

### Production Deployment
- 灰度发布
- 监控关键指标
- 快速回滚准备

### Rollback Plan
- 保留上一个版本
- 数据库回滚脚本
- 快速回滚流程

---

## 5. Monitoring & Alerting

### Key Metrics
- API 响应时间
- 错误率
- 数据库连接数
- CPU/内存使用率

### Alert Thresholds
- API 响应时间 > 1s
- 错误率 > 5%
- 数据库连接 > 80%
- CPU > 80%

### Alert Channels
- Email
- Slack/钉钉
- SMS（关键告警）

---

## 6. Risk Management

### Technical Risks
- **Risk**: 新功能影响现有功能
- **Mitigation**: 完整测试，灰度发布

- **Risk**: 性能下降
- **Mitigation**: 性能测试，优化准备

### Schedule Risks
- **Risk**: 开发延期
- **Mitigation**: 每周检查，及时调整

### Operational Risks
- **Risk**: 生产环境故障
- **Mitigation**: 快速回滚，监控告警

---

## 7. Success Criteria

### Phase 1 Success
- ✅ Health Check 端点可用
- ✅ 登录失败日志记录
- ✅ 教师专属 API 可用
- ✅ 集成测试通过
- ✅ Staging 部署成功

### Phase 2 Success
- ✅ APM 监控数据正常
- ✅ API 性能监控可用
- ✅ 数据库连接监控可用
- ✅ 告警配置完成

### Phase 3 Success
- ✅ 错误信息优化完成
- ✅ API 文档更新完成
- ✅ 性能优化完成
- ✅ 用户指南完成
- ✅ Production 部署成功

---

## 8. Deliverables

### Code Deliverables
- Health Check 模块
- Login Log 模块
- Teacher API 模块
- APM 集成
- 性能监控中间件
- 数据库监控服务

### Documentation Deliverables
- API 文档更新
- 用户指南
- 部署文档
- 监控配置文档

### Testing Deliverables
- 单元测试
- 集成测试
- 性能测试报告
- 安全测试报告

---

## 9. Conclusion

**V1.1 Development Plan**: READY ✅

**Planning Status**:
- ✅ 开发任务确认
- ✅ 优先级确认
- ✅ 验证标准确认
- ✅ 发布计划确认

**Next Mission**: M-EDUOS-V1.1-IMPLEMENTATION-V1

---

**Plan Generated**: 2026-07-27 13:00:00  
**Planned By**: 龙虾 (Orchestrator)  
**Approved By**: 龙虾 (Orchestrator)
