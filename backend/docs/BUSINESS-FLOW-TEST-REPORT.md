# Business Flow E2E Test Report
# Phase 6 Batch 6.1

日期: 2026-07-24
测试文件: test/business-flow.e2e-spec.ts
测试类型: 端到端业务场景测试（真实数据库）

---

## 测试目标

验证完整业务闭环：
创建学生 → 购买课时 → 生成课程 → 教师签到 → 扣除课时 → 三端读取一致

---

## 测试结果摘要

总测试数: 24
通过: 1
失败: 23
通过率: 4.2%

关键发现: E2E 测试成功发现了多个 P0 级真实 Bug。
测试本身逻辑正确，失败原因是源代码存在缺陷。

---

## 通过的测试

Step 1: Create Student — PASSED
  - POST /students 成功创建学生
  - 返回正确的 studentCode、name、gender
  - JWT 认证和角色鉴权正常工作

---

## 发现的真实 Bug

### BUG-1: Course Repository 列名不匹配 (P0)

位置: src/modules/teaching/course/course.repository.ts (或 course.service.ts)
现象: POST /courses 返回 500
错误: Unknown column 'course.course_code' in 'where clause'
原因: 代码中使用 snake_case (course_code) 查询，但数据库列名是 camelCase (courseCode)
SQL: WHERE course.course_code LIKE ? — 列 course_code 不存在
实际列名: courseCode

影响: 无法创建课程，阻塞所有后续业务流程

### BUG-2: Contract Repository 列名不匹配 (P0)

位置: src/modules/teaching/contract/contract.repository.ts (或 contract.service.ts)
现象: POST /contracts 返回 500
错误: Unknown column 'c.contract_code' in 'where clause'
原因: 代码中使用 snake_case (contract_code) 查询，但数据库列名是 camelCase (contractCode)
SQL: WHERE c.contract_code LIKE ? — 列 contract_code 不存在
实际列名: contractCode

影响: 无法创建合同，阻塞课时购买流程

### BUG-3: Class Repository 列名不匹配 (P0)

位置: src/modules/teaching/class/class.repository.ts (或 class.service.ts)
现象: POST /classes 返回 500
错误: Unknown column 'cls.class_code' in 'where clause'
原因: 代码中使用 snake_case (class_code) 查询，但数据库列名是 camelCase (classCode)
SQL: WHERE cls.class_code LIKE ? — 列 class_code 不存在
实际列名: classCode

影响: 无法创建班级，阻塞排课流程

### BUG-4: Student GET /:code 参数验证问题 (P1)

位置: src/modules/student/student.controller.ts
现象: GET /students/ST2026070001 返回 400
错误: Validation failed (numeric string is expected)
原因: 路由参数可能被 ParseIntPipe 处理，但 studentCode 是字符串

影响: 管理员无法通过 studentCode 查询学生详情

---

## 级联失败分析

由于 BUG-1/2/3 阻塞了 Course/Contract/Class 的创建，
后续所有依赖这些实体的测试全部级联失败：

- Step 5 (Assign Teacher): classCode 为空 → 404
- Step 6 (Enroll): contractCode 为空 → 400 Contract not found
- Step 7 (Create Lesson): classCode 为空 → 404 Class not found
- Step 8 (Complete Lesson): classCode 为空 → 404
- Step 9 (Data Consistency): 所有数据为空，无法验证
- Step 10-12: 同上

---

## E2E 测试基础设施改进

### 已完成的改进

1. jest-e2e.json 增加 moduleNameMapper
   - 支持 @common/*, @modules/*, @events/* 等路径别名
   - 支持 uuid ESM 模块的 transformIgnorePatterns

2. 测试模块使用显式实体列表
   - 不依赖 AppModule 的 glob 模式 (*.entity.js)
   - 直接导入所有 20 个实体类
   - 解决 ts-jest 编译 .ts 文件与 glob 匹配 .js 的冲突

3. 测试数据管理
   - beforeAll: 通过 raw SQL 创建测试用户（bcrypt 加密密码）
   - afterAll: 按依赖逆序清理所有测试数据
   - 使用唯一前缀 E2ETEST_ + timestamp 避免数据冲突

---

## 测试覆盖的业务场景

1. 认证流程: Admin/Teacher 登录获取 JWT
2. 学生管理: 创建学生（含必填/选填字段）
3. 课程管理: 创建课程（学科、类型、课时）
4. 合同管理: 购买课时（合同创建、初始余额）
5. 班级管理: 创建班级（时间、地点、容量）
6. 教师分配: 分配 PRIMARY 教师到班级
7. 注册入学: 学生 + 合同 + 班级 三方关联
8. 教师签到: 创建课程 + 批量点名（PRESENT/ABSENT/LATE）
9. 课程完成: 状态变更触发课时扣除
10. 课时扣除规则: PRESENT 扣、ABSENT 不扣、LATE 扣
11. 三端数据一致性: 管理员/教师/学生视角交叉验证
12. 最终一致性: 合同余额 = 总课时 - 已消耗

---

## 修复建议

BUG-1/2/3 的根因相同: Repository 中的 raw SQL 使用了 snake_case 列名，
但 TypeORM 实体定义的列名是 camelCase（MySQL 默认）。

修复方案:
方案 A: 将 raw SQL 中的 snake_case 改为 camelCase
方案 B: 在实体 @Column 装饰器中显式指定 name（snake_case）
方案 C: 使用 QueryBuilder 代替 raw SQL（自动处理列名映射）

推荐方案 C: 使用 QueryBuilder，避免手动管理列名。

---

## 结论

E2E 测试框架已建立，测试逻辑正确。
首次运行即发现 3 个 P0 + 1 个 P1 真实 Bug。
修复上述 Bug 后，预期大部分测试将通过。

下一步:
1. 修复 BUG-1/2/3（Repository 列名问题）
2. 修复 BUG-4（Student GET 参数验证）
3. 重新运行 E2E 测试验证修复
4. 补充更多边界场景测试
