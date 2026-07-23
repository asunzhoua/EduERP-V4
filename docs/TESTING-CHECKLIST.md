# EduOS 小程序真机联调测试清单

> Phase 2 Batch B — 真机联调准备
> 创建日期：2026-07-23
> 基于代码扫描生成，所有路径和端点已与源码核对

---

## 前置条件

- [ ] 后端服务运行中（http://localhost:3000）
  验证：curl http://localhost:3000/api/v1/health
- [ ] 数据库已初始化种子数据（npm run seed）
  验证：数据库中有 2 个班级、3 个学生、2 个课程、8 个课时
- [ ] 微信开发者工具已登录
- [ ] 小程序项目已导入到开发者工具
- [ ] 开发者工具已勾选"不校验合法域名、web-view（业务域名）"
- [ ] miniapp/config.js 中 ENV 设为 'development'

---

## 测试账号（来自 seed.service.ts）

学生账号：
- student1 / student123（李小华，角色 Student，关联 STU001）

家长账号：
- parent1 / parent123（李建国，角色 Parent）

教师账号：
- teacher1 / teacher123（张老师，角色 Teacher）

管理员账号：
- admin / (ADMIN_PASSWORD 环境变量，通常 admin123)（系统管理员，角色 SuperAdmin）

---

## 种子数据概览（用于验证预期结果）

课程：
- MATH001 — 数学基础班（40课时/20次课）
- ENG001 — 英语启蒙班（40课时/20次课）

班级：
- CL2026070001 — 周六上午班（数学，09:00-10:30，学生：张三、李四）
- CL2026070002 — 周日下午班（英语，14:00-15:30，学生：王五）

合同：
- CT2026070001 — 张三，数学，50次课
- CT2026070002 — 李四，数学，50次课
- CT2026070003 — 王五，英语，50次课

已有课时：
- 周六班：7/4(已完成)、7/11(已完成)、7/18(已完成)、7/25(已排课)
- 周日班：7/5(已完成)、7/12(已完成)、7/19(已完成)、7/26(已排课)

已有出勤：
- 周六班 7/4：张三=到课，李四=到课
- 周六班 7/11：张三=到课，李四=迟到
- 周六班 7/18：张三=缺勤，李四=到课
- 周日班 7/5：王五=到课
- 周日班 7/12：王五=到课
- 周日班 7/19：王五=请假

---

## 学生端测试流程（student1 / student123）

### 1. 登录
- [ ] 打开小程序，进入登录页
- [ ] 输入用户名：student1
- [ ] 输入密码：student123
- [ ] 点击"登录"按钮
- [ ] 预期：登录成功，跳转到首页（/pages/index/index）
- [ ] 预期：页面显示角色"学生"
- API 验证：POST /api/v1/auth/login → 返回 accessToken + user 对象

### 2. 首页（学生视图）
- [ ] 查看页面是否正常渲染（无空白、无报错）
- [ ] 查看合同信息区域（调用 GET /students/self/contracts）
- [ ] 查看最近课时区域（调用 GET /students/self/lessons，最多显示5条）
- [ ] 下拉刷新
- [ ] 预期：数据正常加载，刷新动画正常
- [ ] 预期：合同列表显示张三的数学合同（CT2026070001，50次课）

### 3. 课时列表（查看全部）
- [ ] 从首页点击"查看全部"或相关课时入口
- [ ] 预期：跳转到 /pages/student/lessons
- [ ] 查看课时列表数据（调用 GET /students/self/lessons）
- [ ] 下拉刷新
- [ ] 预期：显示张三的课时记录（周六班的已完成课时）
- [ ] 预期：每条课时显示日期、课程、班级、状态

### 4. 出勤记录
- [ ] 从首页点击"出勤记录"按钮
- [ ] 预期：跳转到 /pages/student/attendance
- [ ] 查看出勤列表（调用 GET /students/self/attendance）
- [ ] 下拉刷新
- [ ] 预期：显示出勤历史
- [ ] 预期数据：
  - 7/4 周六上午班 — 到课
  - 7/11 周六上午班 — 到课
  - 7/18 周六上午班 — 缺勤

### 5. 班级列表（学生端）
- [ ] 导航到 /pages/student/classes（通过首页"我的班级"入口）
- [ ] 预期：显示张三 enrolled 的班级列表
- [ ] 预期：显示周六上午班（数学），含课时进度
- [ ] 点击某个班级
- [ ] 预期：跳转到 /pages/student/class-detail?code=CL2026070001

### 6. 班级详情（学生端）
- [ ] 查看班级基本信息（调用 GET /classes/CL2026070001）
- [ ] 预期：显示班级名称"周六上午班"、科目"数学"、教师"张老师"
- [ ] 预期：显示课时进度（已完成/总课时）
- [ ] 点击"返回"
- [ ] 预期：返回班级列表

---

## 教师端测试流程（teacher1 / teacher123）

### 1. 登录
- [ ] 退出学生账号（清除 Storage 或重新打开小程序）
- [ ] 输入用户名：teacher1
- [ ] 输入密码：teacher123
- [ ] 点击"登录"按钮
- [ ] 预期：登录成功，跳转到首页（/pages/index/index）
- [ ] 预期：页面显示角色"教师"

### 2. 首页（教师 Dashboard）
- [ ] 查看今日课程数（调用 GET /teacher/dashboard → todayLessons）
- [ ] 查看待处理考勤数（调用 GET /teacher/dashboard → pendingAttendance）
- [ ] 查看学生总数（调用 GET /teacher/dashboard → totalStudents）
- [ ] 下拉刷新
- [ ] 预期：三个数据卡片正常显示数字
- [ ] 预期：数据与种子数据一致

### 3. 课程列表（Tab "课程"）
- [ ] 点击底部 Tab"课程"
- [ ] 预期：跳转到 /pages/teacher/courses
- [ ] 查看课程列表（调用 GET /courses?page=1&pageSize=20）
- [ ] 预期：显示"数学基础班"和"英语启蒙班"
- [ ] 测试搜索功能：输入"数学"
- [ ] 预期：过滤后只显示"数学基础班"
- [ ] 清空搜索
- [ ] 预期：恢复显示全部课程
- [ ] 下拉刷新
- [ ] 预期：数据重新加载
- [ ] 点击"数学基础班"
- [ ] 预期：跳转到 /pages/teacher/course-detail?code=MATH001

### 4. 课程详情
- [ ] 查看课程信息（调用 GET /courses/MATH001）
- [ ] 预期：显示课程名称、科目、课时数、类型等
- [ ] 点击"查看班级"
- [ ] 预期：跳转到 /pages/teacher/classes?courseCode=MATH001

### 5. 班级列表（Tab "班级"）
- [ ] 点击底部 Tab"班级"
- [ ] 预期：跳转到 /pages/teacher/classes
- [ ] 查看班级列表（调用 GET /classes）
- [ ] 预期：显示"周六上午班"和"周日下午班"
- [ ] 下拉刷新
- [ ] 点击"周六上午班"
- [ ] 预期：跳转到 /pages/teacher/class-detail?code=CL2026070001

### 6. 班级详情（教师端）
- [ ] 查看班级基本信息（调用 GET /classes/CL2026070001）
- [ ] 切换到"学生"Tab（调用 GET /classes/CL2026070001/students）
- [ ] 预期：显示张三、李四
- [ ] 切换到"课时记录"Tab（调用 GET /classes/CL2026070001/lessons）
- [ ] 预期：显示4条课时记录（3次已完成 + 1次已排课）
- [ ] 点击"记录课时"
- [ ] 预期：跳转到 /pages/teacher/lesson-record?classCode=CL2026070001

### 7. 课时录入（核心流程）
- [ ] 从班级详情点击"记录课时"进入（已预选班级）
- [ ] 预期：步骤2 — 显示学生选择（张三、李四）
- [ ] 确认学生列表已预填，默认出勤状态为"到课"
- [ ] 修改某个学生的出勤状态为"迟到"或"缺勤"
- [ ] 点击"下一步"
- [ ] 预期：步骤3 — 输入课时信息
- [ ] 确认日期已预填为今天
- [ ] 确认开始时间已预填为当前时间
- [ ] 输入结束时间（如 10:30）
- [ ] 输入课题（如"分数加减法"）
- [ ] 点击"提交"
- [ ] 预期：步骤4 — 确认页面，显示汇总信息
- [ ] 确认提交
- [ ] 预期：提交成功，返回班级详情页
- API 验证：POST /api/v1/lessons → 返回创建的课时 + 出勤记录

### 8. 学生列表
- [ ] 从班级详情切换到"学生"Tab
- [ ] 点击"查看全部学生"（如有）
- [ ] 预期：跳转到 /pages/teacher/students?classCode=CL2026070001
- [ ] 查看学生列表
- [ ] 预期：显示张三、李四
- [ ] 测试搜索：输入"张"
- [ ] 预期：过滤显示张三
- [ ] 点击"张三"
- [ ] 预期：跳转到 /pages/teacher/student-detail?code=STU001

### 9. 学生详情
- [ ] 查看学生基本信息（调用 GET /students?studentCode=STU001）
- [ ] 预期：显示姓名"张三"、学号"STU001"、性别"男"等
- [ ] 查看 enrolled 班级列表（调用 GET /enrollments/students/STU001/enrollments）
- [ ] 预期：显示周六上午班，含课时进度
- [ ] 点击某个班级
- [ ] 预期：跳转到 /pages/teacher/class-detail?code=CL2026070001

---

## 家长端测试流程（parent1 / parent123）

### 1. 登录
- [ ] 退出教师账号
- [ ] 输入用户名：parent1
- [ ] 输入密码：parent123
- [ ] 点击"登录"按钮
- [ ] 预期：登录成功，跳转到首页
- [ ] 预期：页面显示角色"家长"

### 2. 首页（家长视图）
- [ ] 家长视图与学生视图共用同一套逻辑
- [ ] 查看合同和课时数据是否正常加载
- [ ] 注意：家长角色可能没有关联的学生记录（seed 中 parent1 未绑定 student）
- [ ] 预期：如果无关联学生，页面应显示空状态或提示信息

---

## 通用测试项

### Loading / Error / Empty 状态
- [ ] 断网后打开小程序 → 预期：显示"网络错误"提示
- [ ] Token 过期 → 预期：自动跳转到登录页（code === 2002）
- [ ] 数据为空 → 预期：显示空状态（非空白页面）
- [ ] 加载过程中 → 预期：显示 Loading 状态

### 页面导航
- [ ] Tab 切换：首页 ↔ 课程 ↔ 班级
- [ ] 非 Tab 页面返回按钮 → 预期：返回上一页
- [ ] 深层页面跳转（首页 → 班级 → 学生 → 详情）→ 预期：无错误

### 下拉刷新
- [ ] 首页下拉刷新 → 预期：数据重新加载
- [ ] 课时列表下拉刷新 → 预期：数据重新加载
- [ ] 出勤记录下拉刷新 → 预期：数据重新加载

---

## 常见问题排查

### 问题 1：无法连接到服务器
排查步骤：
1. 检查后端是否运行：curl http://localhost:3000/api/v1/health
2. 检查 miniapp/config.js 中 baseUrl 是否为 http://localhost:3000/api/v1
3. 检查微信开发者工具 → 详情 → 本地设置 → 已勾选"不校验合法域名"
4. 检查电脑防火墙是否拦截了 3000 端口

### 问题 2：登录失败
排查步骤：
1. 确认数据库已执行 seed：npm run seed
2. 确认用户名密码正确（见上方"测试账号"）
3. 查看后端控制台日志，是否有错误输出
4. 直接用 curl 测试 API：
   curl -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"username\":\"student1\",\"password\":\"student123\"}"
5. 如果 curl 成功但小程序失败 → 前端问题
6. 如果 curl 也失败 → 后端问题

### 问题 3：数据为空 / 页面空白
排查步骤：
1. 确认种子数据已导入：npm run seed
2. 检查 Token 是否有效（登录后 Storage 中是否有 token）
3. 查看微信开发者工具 Console 面板，是否有红色错误
4. 检查 API 返回格式：response.data.code 应为 0
5. 如果 code === 2002 → Token 过期，需重新登录

### 问题 4：页面跳转失败
排查步骤：
1. 检查 app.json 中 pages 数组是否包含目标页面
2. 检查跳转路径是否正确（注意 /pages/ 前缀）
3. 查看 Console 中 navigateTo 的 fail 回调错误信息
4. Tab 页面必须用 wx.switchTab，非 Tab 页面用 wx.navigateTo

### 问题 5：课时录入提交失败
排查步骤：
1. 确认当前用户角色为 Teacher
2. 确认选择了至少一个学生
3. 确认日期、时间、课题已填写
4. 查看后端日志，检查 POST /api/v1/lessons 的请求体和响应
5. 确认班级有 enrolled 学生（GET /classes/:code/students 不为空）

### 问题 6：学生端看不到数据
排查步骤：
1. 确认 student1 用户关联了 student 记录（userId 字段）
2. 确认有 enrollment 记录将学生选入班级
3. 确认有 contract 记录
4. GET /students/self 需要后端能根据 userId 找到对应的 studentCode

---

## 测试通过标准

全部满足即为通过：
- [ ] 学生端：登录 → 首页 → 课时列表 → 出勤记录 → 班级列表 → 班级详情，全部正常
- [ ] 教师端：登录 → Dashboard → 课程列表 → 课程详情 → 班级列表 → 班级详情 → 课时录入 → 学生列表 → 学生详情，全部正常
- [ ] 家长端：登录 → 首页正常渲染
- [ ] 所有数据正常加载（无空白页面、无 undefined）
- [ ] 课时录入完整流程可提交成功
- [ ] Tab 切换无错误
- [ ] 非 Tab 页面返回正常
- [ ] Loading / Error / Empty 状态正常显示
- [ ] 下拉刷新功能正常
- [ ] 搜索过滤功能正常（课程列表、学生列表）

---

## API 端点速查表

认证：
- POST /auth/login — 登录

学生端：
- GET /students/self — 获取当前学生信息
- GET /students/self/contracts — 获取合同列表
- GET /students/self/lessons — 获取课时列表
- GET /students/self/attendance — 获取出勤记录

教师端：
- GET /teacher/dashboard — 仪表盘数据
- GET /courses — 课程列表（分页）
- GET /courses/:code — 课程详情
- GET /classes — 班级列表
- GET /classes/:code — 班级详情
- GET /classes/:code/students — 班级学生列表
- GET /classes/:code/lessons — 班级课时列表
- GET /students — 学生列表
- GET /students?studentCode=xxx — 按学号查学生
- GET /enrollments/students/:code/enrollments — 学生选班记录
- POST /lessons — 创建课时（含出勤）
