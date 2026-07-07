# EduERP V4 — Coding Convention

> 版本：v4.0
> 状态：架构冻结
> 最后更新：2026-07-06

---

## 1. 目录命名

| 规则 | 示例 |
|------|------|
| 全部小写字母 | `src`, `docs`, `database` |
| 多词使用连字符 | `11-AI-Development`, `99-Archive` |
| 不包含空格 | — |

## 2. 文件命名

| 规则 | 示例 |
|------|------|
| Markdown 文件 — 大驼峰（PascalCase） | `Constitution-v4.0.md`, `ER.md` |
| 源代码文件 — 小驼峰（camelCase） | `userService.ts`, `dbConnect.js` |
| 配置文件 — 小写+连字符 | `docker-compose.yml`, `nginx.conf` |
| 测试文件 — 与被测文件同名 + `.test.` | `userService.test.ts` |

## 3. 数据库命名

| 对象 | 规则 | 示例 |
|------|------|------|
| 表名 | 小写+下划线（snake_case） | `sys_user`, `edu_course` |
| 字段名 | 小写+下划线（snake_case） | `user_name`, `created_at` |
| 主键 | `id`（统一） | `id` |
| 外键 | 关联表名单数 + `_id` | `user_id`, `course_id` |
| 索引 | `idx_` + 表名 + `_` + 字段 | `idx_sys_user_email` |
| 唯一约束 | `uk_` + 表名 + `_` + 字段 | `uk_sys_user_phone` |

## 4. API 命名

| 规则 | 示例 |
|------|------|
| RESTful 风格，全部小写 | `/api/v1/users` |
| 多词使用连字符 | `/api/v1/course-enrollments` |
| 资源名使用复数 | `/users`, `/courses` |
| 版本号前缀 | `/api/v1/...`, `/api/v2/...` |

## 5. Event 命名

| 规则 | 示例 |
|------|------|
| 命名空间 + 点号 + 事件名 | `user.created`, `course.enrolled` |
| 过去时态 | `order.paid`, `student.admitted` |
| 全部小写 | — |

## 6. 变量命名

| 语言 | 规则 | 示例 |
|------|------|------|
| JavaScript / TypeScript | 小驼峰（camelCase） | `userName`, `courseList` |
| Python | 小写+下划线（snake_case） | `user_name`, `course_list` |
| SQL | 小写+下划线（snake_case） | `user_name`, `created_at` |
| 常量 | 全大写+下划线 | `MAX_RETRY_COUNT`, `API_VERSION` |
| 类名（JS/TS/Python） | 大驼峰（PascalCase） | `UserService`, `CourseModel` |

## 7. Markdown 命名

| 规则 | 示例 |
|------|------|
| 文档标题 — 大驼峰（PascalCase） | `Constitution-v4.0.md` |
| 目录 README — 全大写 | `README.md` |
| 版本号后缀 — `-v` + 数字 | `-v4.0.md` |

## 8. 版本命名

| 规则 | 示例 |
|------|------|
| 语义化版本（SemVer） | `v4.0.0` |
| 主版本.次版本.补丁 | `v4.1.0`, `v4.0.1` |
| 文档版本与代码版本同步 | `v4.0` |

## 9. 禁止事项

- 禁止使用拼音命名（`user_biao`, `ke_cheng`）
- 禁止单字母命名（除循环计数器 `i`, `j` 外）
- 禁止缩写不明（`usr_mgmt` → 必须 `user_management` 或 `userMgmt`）
- 禁止中英文混写
- 禁止自由发挥 — 所有命名必须遵循以上规则
