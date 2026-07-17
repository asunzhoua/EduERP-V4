# ISS-024 Route Conflict Analysis

> **Issue**: 路由冲突
> **Date**: 2026-07-17
> **Status**: ⏸️ ANALYZED (Pending Approval)

---

## Conflict Detail

### LessonController
```typescript
@Controller()
export class LessonController {
  @Get('lessons/:id/attendance')    // ← 冲突
  @Put('lessons/:id/attendance')
}
```

### LessonAttendanceController
```typescript
@Controller()
export class LessonAttendanceController {
  @Get('lessons/:id/attendance')    // ← 冲突
  @Post('lessons/:id/attendance')
}
```

---

## Impact

- 第一个注册的路由生效
- 第二个路由可能无法访问
- 取决于模块加载顺序（不确定行为）

---

## Solutions

### 方案 A（推荐）: 职责分离
删除 LessonController 中的考勤路由，由 LessonAttendanceController 统一管理。

**优点**：
- 职责清晰
- 低风险

**缺点**：
- 需要验证依赖方

### 方案 B: 添加前缀
给 LessonAttendanceController 添加控制器前缀。

```typescript
@Controller('attendance')  // 路由变为 /attendance/lessons/:id/...
```

**优点**：
- 路由隔离

**缺点**：
- 路由变化，需要更新前端

### 方案 C: 合并 Controller
将考勤逻辑合并到 LessonController。

**优点**：
- 单一入口

**缺点**：
- 高风险
- 违反单一职责

---

## Recommendation

**推荐方案 A**：删除 LessonController 中重复的考勤路由。

**理由**：
- LessonAttendanceController 是专门的考勤模块
- 职责分离更清晰
- 低风险修改

---

## Next Step

等待人工确认后执行修改。

---

*ISS-024 Analysis by Long Mission v2.0*