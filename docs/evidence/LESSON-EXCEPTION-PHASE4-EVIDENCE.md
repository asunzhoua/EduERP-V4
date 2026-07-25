# Phase 4 Evidence: API Permission Control & Swagger Documentation

## 修改文件列表

```
M  src/modules/teaching/lesson/lesson-exception/lesson-exception.controller.ts
M  src/modules/teaching/lesson/lesson-exception/lesson-exception.service.ts
M  src/modules/teaching/lesson/lesson-exception/lesson-exception.service.spec.ts
A  src/common/decorators/current-user.decorator.ts
A  src/modules/teaching/lesson/lesson-exception/dto/query-exception.dto.ts
A  src/modules/teaching/lesson/lesson-exception/lesson-exception.controller.spec.ts
```

## Git Commit

- Hash: `319d3d838451e60eb0815eaa13964b7201493614`
- Message: `feat: implement lesson exception API with permission control`

## 测试结果

- Test Suites: 2 passed, 2 total
- Tests: 39 passed, 39 total
  - Service tests: 24 passed
  - Controller tests: 15 passed
- Coverage (lesson-exception module):
  - Statements: 78.13%
  - Branches: 64.96%
  - Functions: 48.78%
  - Lines: 78.05%
- DTO coverage: 100%

## API 列表

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/lesson-exceptions` | 查询异常列表（权限隔离） | SuperAdmin, Admin, Teacher, Parent |
| GET | `/api/lesson-exceptions/:id` | 查询异常详情（含课程、审批记录、补课信息） | SuperAdmin, Admin, Teacher, Parent |
| PUT | `/api/lesson-exceptions/:id/approve` | 审批通过（仅管理员） | SuperAdmin, Admin |
| PUT | `/api/lesson-exceptions/:id/reject` | 审批拒绝 | SuperAdmin, Admin |
| GET | `/api/lesson-exceptions/:id/reschedule` | 查询补课安排 | SuperAdmin, Admin, Teacher, Parent |
| GET | `/api/lessons/:id/exceptions` | 查询课程的异常记录（兼容） | SuperAdmin, Admin, Teacher |
| POST | `/api/lessons/:id/leave` | 申请请假 | SuperAdmin, Admin, Teacher |
| POST | `/api/lessons/suspend` | 申请停课 | SuperAdmin, Admin |
| POST | `/api/lessons/:id/makeup` | 申请补课 | SuperAdmin, Admin |

## 权限验证

- **管理员查看全部**: ✅ 通过 RolesGuard + 数据隔离逻辑
- **教师查看自己的异常**: ✅ Service 层 WHERE lesson.teacherId = user.sub
- **家长查看自己孩子的异常**: ✅ 通过 enrollment → student → student_parent 链式关联过滤
- **教师不能审批自己的课程异常**: ✅ 控制器层二次校验，抛出 ForbiddenException
- **管理员审批**: ✅ 通过 `@Roles('SuperAdmin', 'Admin')` 守卫
- **详情访问控制**: ✅ `canAccessException()` 验证用户是否有权查看

## 数据隔离实现

### Teacher
```typescript
if (role === 'Teacher') {
  qb.andWhere('lesson.teacherId = :teacherId', { teacherId: userId });
}
```

### Parent
```typescript
// 通过 enrollment → student → student_parent 关联查询
const classCodes = await this.entityManager
  .createQueryBuilder()
  .select('DISTINCT enr.classCode', 'classCode')
  .from('enrollment', 'enr')
  .innerJoin('student', 's', 's.studentCode = enr.studentCode')
  .innerJoin('student_parent', 'sp', 'sp.studentId = s.id')
  .where('sp.parentId = :parentId', { parentId: userId })
  .getRawMany();
```

## Swagger 文档

所有接口已添加完整的 Swagger 装饰器：
- `@ApiTags('Lesson Exception')` — 分组标签
- `@ApiBearerAuth()` — JWT 认证指示
- `@ApiOperation({ summary })` — 接口说明
- `@ApiQuery()` — 查询参数文档（status, exceptionType, startDate, endDate）
- `@ApiParam()` — 路径参数文档
- `@SwaggerResponse()` — 响应说明（200, 400, 403, 404）
- `@ApiProperty()` / `@ApiPropertyOptional()` — DTO 字段文档
- 访问 `http://localhost:3000/api` 查看完整 Swagger UI

## 验证结果

```bash
# 编译检查
npm run build         # 通过（仅剩余预存在的 salary 模块 TS 错误）

# 运行测试
npm run test          # 39 passed, 39 total (lesson-exception 模块)
```
