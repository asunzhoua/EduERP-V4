# 权限问题评估报告

## 评估时间
2026-07-24

## 评估方法
1. 读取 PERMISSION-ISOLATION-REPORT.md 获取问题描述
2. 逐一检查小程序前端代码，确认实际调用了哪些 API 端点
3. 查询数据库，确认当前用户/教师/学生的实际数量
4. 交叉比对：前端调用 × 后端漏洞 × 实际数据 → 判断是否可复现

---

## 问题 1：Teacher 数据隔离（ISSUE-PERM-001/002）

### 问题描述
Teacher 角色可访问所有班级、合同、课时、报名记录，等同于 Admin 权限范围。
仅 Dashboard 有 teacherId 过滤，其余 9 个端点全部缺失 teacherId 过滤。

### 实际影响分析
- 当前 Teacher 数量: 1（张老师，userId=2）
- 当前班级数量: 2（CL2026070001, CL2026070002）
- 两个班级均分配给 teacherId=2（张老师）
- 多 Teacher 场景: 否
- 数据混乱风险: 低（单教师场景下无其他教师数据可混淆）
- 单 Teacher 场景影响: 否

### 前端实际调用分析
教师前端调用的端点：
1. teacher/classes.js → GET /classes → 返回所有班级（无 teacherId 过滤）
2. teacher/class-detail.js → GET /classes/:code + GET /classes/:code/students
3. teacher/lesson-record.js → GET /classes（选择班级）
4. teacher/students.js → GET /students 或 GET /classes/:classCode/students
5. teacher/student-detail.js → GET /students + GET /enrollments/students/:code/enrollments
6. teacher/courses.js → GET /courses
7. teacher/course-detail.js → GET /courses/:code
8. teacher/dashboard → GET /teacher/dashboard（有 teacherId 过滤 ✅）

确认：教师前端确实调用了无过滤的共享端点。

### 实际复现分析
- 问题是否可复现: 否（当前数据条件下无法复现）
- 复现条件: 需要存在 2 个以上 Teacher，且各自负责不同班级
- 复现步骤: 无法执行（系统中仅有 1 个 Teacher）
- 当前表现: Teacher 调用 GET /classes → 返回 2 个班级 → 这 2 个班级恰好都是他的 → 用户体验正确

### 判断
- 是否影响 MVP 使用: 否
- 是否影响实际流程: 否
- 建议: 记录进入后续安全 Mission

### 理由
1. 当前系统仅有 1 个 Teacher，所有班级均分配给他
2. 即使 GET /classes 返回全部数据，也全部属于该 Teacher
3. 不存在"看到其他教师数据"的可能性（因为没有其他教师）
4. 写操作（记录课时/出勤）同样不受影响（所有班级都是他的）
5. 这是代码层面的设计缺陷，但在单教师 MVP 场景下无实际影响

---

## 问题 2：Student 所有权验证（ISSUE-PERM-003/004）

### 问题描述
共享端点接受 URL 参数 studentCode 但不验证是否属于当前登录用户。
Student 可通过修改 studentCode 访问其他学生的合同、报名、出勤数据。

### 实际影响分析
- 当前 Student 数量: 3（STU001 李小华, STU002 李四, STU003 王五）
- 有 userId 的 Student: 1（仅 STU001 李小华，userId=3）
- 可登录小程序的 Student: 1（仅李小华）
- Student 隔离需求: 是（理论上需要）
- 数据泄露风险: 低（无法通过小程序触发）

### 前端实际调用分析
学生前端调用的端点：
1. student/index.js → GET /students/self + GET /students/self/contracts + GET /students/self/lessons ✅
2. student/attendance.js → GET /students/self/attendance ✅
3. student/lessons.js → GET /students/self/lessons ✅
4. student/profile.js → GET /students/self + GET /students/self/contracts + GET /students/self/attendance ✅
5. student/classes.js → GET /students/self/contracts ✅
6. student/class-detail.js → GET /classes/:code（仅班级基本信息，ACCEPTABLE）

确认：学生前端 100% 使用 /students/self/* 自服务端点，不调用任何有漏洞的共享端点。

### 共享端点的实际调用者
有漏洞的共享端点（如 /contracts/students/:studentCode/contracts）的调用者：
- teacher/student-detail.js → GET /enrollments/students/:code/enrollments（Teacher 角色调用）
- Admin 管理页面（SuperAdmin/Admin 角色调用）
- 学生前端：不调用

### 实际复现分析
- 问题是否可复现: 否（前端代码层面无法触发）
- 复现条件: 需要学生手动构造 API 请求（绕过小程序前端）
- 复现步骤: 无法通过小程序 UI 操作触发
- 当前表现: 李小华登录 → 所有请求走 /students/self/* → 只看到自己的数据 → 体验正确

### 判断
- 是否影响 MVP 使用: 否
- 是否影响实际流程: 否
- 建议: 记录进入后续安全 Mission

### 理由
1. 小程序学生前端完全使用 self-service 端点，隔离正确
2. 有漏洞的共享端点不被学生前端调用
3. 仅 1 个 Student 有账号可登录，不存在"切换到另一个学生"的可能
4. 要触发漏洞需要手动构造 HTTP 请求（属于 API 安全范畴，不属于 MVP 功能范畴）
5. 这是 API 层面的设计缺陷，但 MVP 前端未暴露攻击面

---

## 结论

### 需要修复的问题
无。

### 记录进入后续安全 Mission 的问题
1. ISSUE-PERM-001/002: Teacher 数据隔离缺失（代码缺陷，单教师场景无实际影响）
2. ISSUE-PERM-003: Student 共享端点缺少所有权验证（API 缺陷，前端未暴露攻击面）
3. ISSUE-PERM-004: Student 可查看课时全部出勤记录（P2 优先级，隐私风险低）

### 理由
1. 两个问题在代码层面确实存在设计缺陷
2. 但在当前 MVP 实际使用场景下（1 Teacher + 1 可登录 Student），均无法复现
3. 小程序前端代码正确使用了 self-service 端点和角色守卫
4. 修复需要修改多个 Controller/Service 的数据过滤逻辑，属于安全加固范畴
5. 建议归入后续安全专项 Mission（如 SECURITY-HARDENING-V1），不影响当前 MVP 闭环

### 触发修复的条件
当以下任一条件满足时，应立即修复：
- 系统引入第 2 个 Teacher（Teacher 数据隔离变为必须）
- 系统引入第 2 个可登录 Student（Student 所有权验证变为必须）
- 系统对外开放 API（需防止手动构造请求的攻击）
