# Evidence Summary — M-2026-07-25-EOS-MINIAPP-SCALE-READINESS-LONG-RUNNING-V1

## Phase 1 Batch 1.1 — 微信环境兼容扫描

| Evidence ID | Type | Description | File | Status |
|:------------|:-----|:------------|:-----|:-------|
| B1.1-001 | Fix | student/index.js: 移除 onShow 守卫，每次返回刷新数据 | miniapp/pages/student/index.js | ✅ PASS |
| B1.1-002 | Fix | student/attendance.js: .then → .finally，防止下拉刷新卡死 | miniapp/pages/student/attendance.js | ✅ PASS |
| B1.1-003 | Fix | student/lessons.js: .then → .finally，防止下拉刷新卡死 | miniapp/pages/student/lessons.js | ✅ PASS |
| B1.1-004 | Fix | teacher/courses.js: loadMore 失败时重置 hasMore，允许重试 | miniapp/pages/teacher/courses.js | ✅ PASS |
| B1.1-005 | Report | 完整扫描报告（15 页面 × 7 检查项） | docs/REAL-DEVICE-COMPATIBILITY-REPORT.md | ✅ PASS |

## 扫描结果摘要

- 扫描页面：15 个
- 检查项：7 项
- 发现问题：3 个低风险
- 已修复：3 个
- 测试状态：987 tests, 80 suites ALL PASS
- Commit SHA：38f4b09

## 7 项检查结果

1. **页面加载** — 15/15 页面均有 onLoad/loading/error 管理 ✅
2. **登录保持** — 三层防御（Storage + globalData + /auth/me 验证）✅
3. **Token失效** — 全局单例 handleTokenExpired + isLoggingOut 锁 ✅
4. **网络异常** — 预检 + 监听 + 重试 + 超时分类 ✅
5. **空数据** — 15/15 页面均有空状态 UI ✅
6. **长列表** — 修复 courses.js loadMore 失败后永久阻塞 ✅
7. **页面返回** — 修复 student/index.js 数据不刷新 + 下拉刷新卡死 ✅

---

## Phase 1 Batch 1.2 — 学生端稳定性检查

| Evidence ID | Type | Description | File | Status |
|:------------|:-----|:------------|:-----|:-------|
| B1.2-001 | Fix(P0) | index.js: loadData guard bug — 初始 loading=true 导致首次调用被拦截，页面永远卡在 loading。改用 _dataLoading 私有锁 | miniapp/pages/student/index.js | ✅ PASS |
| B1.2-002 | Fix(P0) | classes.js: 同 B1.2-001 相同 guard bug，同样修复 | miniapp/pages/student/classes.js | ✅ PASS |
| B1.2-003 | Fix(P1) | index.json + classes.json: 添加 enablePullDownRefresh:true（JS handler 存在但 JSON 配置缺失，下拉刷新不生效） | miniapp/pages/student/index.json, classes.json | ✅ PASS |
| B1.2-004 | Fix(P1) | index.wxml: wx:key='lessonDate' → wx:key='index'（lessonDate 不唯一导致渲染异常） | miniapp/pages/student/index.wxml | ✅ PASS |
| B1.2-005 | Fix(P2) | class-detail: 添加下拉刷新支持（onPullDownRefresh handler + enablePullDownRefresh config） | miniapp/pages/student/class-detail.js, class-detail.json | ✅ PASS |

### 扫描结果摘要

- 扫描页面：5 个（index / attendance / lessons / classes / class-detail）
- 检查项：5 大类（异常状态 / Loading / 错误恢复 / 数据一致性 / 用户体验）
- 发现问题：5 个（2×P0 + 2×P1 + 1×P2）
- 已修复：5 个
- 测试状态：987 tests, 80 suites ALL PASS
- Commit SHA：0fb2943

### 5 项检查结果

1. **异常状态** — 5/5 页面均有 error UI + retry 按钮 ✅（修复 index/classes guard bug 后 retry 可正常工作）
2. **Loading 状态** — 5/5 页面均有 loading spinner + 文案 ✅
3. **错误恢复** — request.js 三层防御（网络预检 + 自动重试 + 超时分类）+ 页面级 retry 按钮 ✅
4. **数据一致性** — index/classes 有 onShow 刷新；attendance/lessons 为叶子页面，onLoad 加载 ✅
5. **用户体验** — 修复下拉刷新配置缺失 + wx:key 不唯一问题 ✅

---

## Phase 2 Batch 2.1 — Backend Analytics Review

| Evidence ID | Type | Description | File | Status |
|:------------|:-----|:------------|:-----|:-------|
| B2.1-001 | Fix(P1) | getTeacherTrend: 合并 2 次 lessonRepository 查询为 1 次（消除重复 DB 查询） | analytics.service.ts | ✅ PASS |
| B2.1-002 | Fix(P1) | getStudentTrend: 合并 2 次 lessonAttendanceRepository 查询为 1 次（消除重复 DB 查询） | analytics.service.ts | ✅ PASS |
| B2.1-003 | Fix(P2) | Controller: 添加 days 参数验证（NaN 防护 + 范围限制 1-365） | analytics.controller.ts | ✅ PASS |
| B2.1-004 | Fix(P2) | 导出 MetricItem 接口修复 TS4053 编译错误 | analytics.service.ts | ✅ PASS |
| B2.1-005 | Fix(P2) | 测试 mock 泄漏修复（clearAllMocks → resetAllMocks + 重新初始化） | analytics.service.spec.ts | ✅ PASS |

### 扫描结果摘要

- 扫描文件：5 个（controller / service / module / controller.spec / service.spec）
- 检查项：5 大类（数据完整性 / 权限 / 查询性能 / 返回格式 / 错误处理）
- 发现问题：5 个（2×P1 + 3×P2）
- 已修复：5 个
- 测试状态：987 tests, 80 suites ALL PASS
- Build 状态：analytics 模块 0 errors（identity.module.ts 预存错误不在范围内）
- Commit SHA：fe81cdd

### 5 项检查结果

1. **数据完整性** — 学生 8 指标 + 教师 3 指标 + 机构 4 指标 + 3 个趋势端点 ✅ 完整
2. **权限** — 全局 JwtAuthGuard + RolesGuard，角色分配合理（学生/家长只能看自己，教师看自己，管理员看全部）✅
3. **查询性能** — 修复 getTeacherTrend 和 getStudentTrend 的重复查询（各减少 1 次 DB 查询）✅
4. **返回格式** — 统一 ApiResponse.success() 包装，MetricItem 结构一致 ✅
5. **错误处理** — 添加 days 参数 NaN 防护 + 范围限制，导出 MetricItem 修复编译错误 ✅
