# M-EDUOS-MINIAPP-PRODUCTION-READINESS-V1 Evidence

**Mission**: 小程序生产准备收口  
**Status**: COMPLETED  
**Date**: 2026-08-02  
**Overall Assessment**: ⚠️ 有条件通过 — 核心功能就绪，存在需关注的权限风险

---

## 一、完成事项汇总

### Task 1: 配置收口 ✅
- `config.example.js` 模板存在，使用占位符域名
- `config.js` 已脱离 Git 跟踪（.gitignore 屏蔽）
- 无 localhost/内网 IP 残留（除 config 设计用途）
- 无敏感公网信息泄露
- **评级**: 🟢 通过

### Task 2: 页面完整性检查 ✅
- 29 个页面全部四件套完整（.js/.json/.wxml/.wxss）
- app.json 注册与文件系统完全一致
- 无空页面/占位页面
- 生命周期覆盖率 96.6%
- **评级**: 🟢 通过

### Task 3: API 稳定性检查 ⚠️
- 21 个 Controller、97 个路由已审计
- 全局 JwtAuthGuard 正确注册
- **发现并修复 Critical BUG**: SalaryController 角色命名错误（admin → Admin）
- **发现并修复 Critical BUG**: req.user.id → req.user.sub
- **发现并修复**: my-records/my-statistics 缺少 @Roles('Teacher')
- **评级**: 🟡 有条件通过（P0 已修复）

### Task 4: 权限隔离复核 ⚠️
- 完整权限矩阵已生成
- **HIGH 风险**: 8 项（出勤/报名/合同/请假/休学接口缺少归属校验）
- **MEDIUM 风险**: 8 项（Teacher 可见范围过大）
- **评级**: 🟡 有条件通过（存在数据泄露风险）

### Task 5: 异常场景补强 ✅
- request.js 统一错误处理机制完善（9/10）
- Token 过期处理优秀（10/10）
- Loading 状态 100% 覆盖
- Error 状态 93% 覆盖
- Empty 状态 38% 覆盖（需补齐）
- **评级**: 🟢 通过（8.5/10）

---

## 二、已修复问题

| # | 问题 | 文件 | 修复内容 |
|---|------|------|----------|
| F-01 | SalaryController 角色命名错误 | salary.controller.ts | 'admin'/'super_admin' → 'Admin'/'SuperAdmin'（6处） |
| F-02 | JWT 字段名错误 | salary.controller.ts | req.user.id → req.user.sub（2处） |
| F-03 | 工资接口缺少角色限制 | salary.controller.ts | my-records/my-statistics 添加 @Roles('Teacher') |

---

## 三、剩余风险

### 🔴 HIGH — 需尽快修复

| # | 风险 | 接口 | 影响 |
|---|------|------|------|
| V-01 | 出勤记录无 Student/Parent 隔离 | GET /lessons/:id/attendance | 学生可查看全校出勤 |
| V-02 | 学生出勤历史无归属校验 | GET /students/:code/attendance | 枚举 code 可查看全校 |
| V-03 | 报名记录无归属校验 | GET /enrollments/students/:code | 学生可查看全校报名 |
| V-04 | 合同记录无归属校验 | GET /contracts/students/:code | 学生可查看全校合同 |
| V-05 | 请假申请未验证学生归属 | POST /students/self/leave-requests | 可为任意学生提交请假 |
| V-06 | 休学申请未验证学生归属 | POST /students/self/suspend-requests | 可为任意学生提交休学 |

### 🟡 MEDIUM — 建议修复

| # | 风险 | 说明 |
|---|------|------|
| M-01 | Teacher 可见全校课程 | GET /courses 无 DataScope 过滤 |
| M-02 | Teacher 可见全部教师分配 | GET /teacher-assignments 无过滤 |
| M-03 | Teacher 考勤写入未验证归属 | 可为非自己班级的课程签到 |

### 🟢 LOW — 后续优化

| # | 风险 | 说明 |
|---|------|------|
| L-01 | Empty 状态覆盖不全 | 列表页 38% 覆盖率 |
| L-02 | 部分页面缺少重试按钮 | profile 类页面 |
| L-03 | 防重复加载未全覆盖 | 部分列表页 |

---

## 四、生产就绪评估

### 可以上线的条件

| 维度 | 状态 | 说明 |
|------|:----:|------|
| 配置安全 | ✅ | 无敏感信息泄露 |
| 页面完整 | ✅ | 29 页面全部就绪 |
| 核心 API 稳定 | ✅ | P0 BUG 已修复 |
| 异常处理 | ✅ | 8.5/10 |
| 权限隔离 | ⚠️ | 存在数据泄露风险 |

### 建议

**如果面向内部使用（教师/管理员已知可信）**：
- ✅ 可以上线
- 记录 HIGH 风险项，后续迭代修复

**如果面向外部用户（学生/家长自助使用）**：
- ⚠️ 建议先修复 V-05/V-06（请假/休学申请归属验证）
- 这两个接口可能被恶意利用

---

## 五、下一步建议

### P0 — 上线前修复

1. **V-05**: leave-requests 创建前验证 studentCode → parent 关系
2. **V-06**: suspend-requests 创建前验证 studentCode → parent 关系

### P1 — 上线后尽快修复

3. **V-01/02**: 出勤查看接口增加 ownership 校验
4. **V-03/04**: enrollment/contract 查看接口增加 ownership 校验

### P2 — 中期优化

5. Teacher 相关接口添加 DataScope 过滤
6. Empty 状态组件统一
7. 重试机制补全

---

## 六、结论

**M-EDUOS-MINIAPP-PRODUCTION-READINESS-V1: COMPLETED**

小程序主线功能完整，核心 API 稳定，异常处理健全。存在权限隔离风险，但可通过访问控制（内部使用）或后续迭代（外部使用）缓解。

**建议**: 根据使用场景决定是否立即修复 V-05/V-06，其他风险项可纳入后续迭代计划。
