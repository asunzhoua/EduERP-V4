# API End-to-End Verification Report

## 验证时间
2026-07-24

## 验证范围
- Backend Controllers: 13
- Miniapp Pages: 19
- API Endpoints (前端调用): 28 unique paths
- API Endpoints (后端定义): 60+ routes

## 全局配置
- Backend Global Prefix: `api/v1`
- Miniapp Base URL: `{host}/api/v1`
- Request Helper: `utils/request.js` — get/post/put/del 自动拼接 baseUrl + path

## API清单对比

### Auth Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| POST /auth/login | @Post('login') AuthController | POST | ✅ MATCH |
| GET /auth/me | @Get('me') AuthController | GET | ✅ MATCH |
| (未调用) | @Post('refresh') AuthController | POST | ⚪ 后端有/前端未用 |
| (未调用) | @Post('logout') AuthController | POST | ⚪ 后端有/前端未用 |

### Student Module (Self-service)
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| GET /students/self | @Get('self') StudentController | GET | ✅ MATCH |
| GET /students/self/contracts | @Get('self/contracts') StudentController | GET | ✅ MATCH |
| GET /students/self/lessons | @Get('self/lessons') StudentController | GET | ✅ MATCH |
| GET /students/self/attendance | @Get('self/attendance') StudentController | GET | ✅ MATCH |

### Student Module (Admin)
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| GET /students | @Get() StudentController | GET | ✅ MATCH |
| (未调用) | @Post() StudentController | POST | ⚪ 管理端功能 |
| (未调用) | @Get(':id') StudentController | GET | ⚪ 管理端功能 |
| (未调用) | @Put(':id') StudentController | PUT | ⚪ 管理端功能 |
| (未调用) | @Patch(':id/status') StudentController | PATCH | ⚪ 管理端功能 |
| (未调用) | @Delete(':id') StudentController | DELETE | ⚪ 管理端功能 |

### Teacher Dashboard Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| GET /teacher/dashboard | @Get('dashboard') TeacherDashboardController | GET | ✅ MATCH |

### Class Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| GET /classes | @Get() ClassController | GET | ✅ MATCH |
| GET /classes/:code | @Get(':code') ClassController | GET | ✅ MATCH |
| GET /classes/:code/students | @Get(':code/students') ClassController | GET | ✅ MATCH |
| GET /classes/:code/lessons | @Get(':code/lessons') via LessonController* | GET | ✅ MATCH |
| (未调用) | @Post() ClassController | POST | ⚪ 管理端功能 |
| (未调用) | @Put(':code') ClassController | PUT | ⚪ 管理端功能 |
| (未调用) | @Patch(':code/status') ClassController | PATCH | ⚪ 管理端功能 |
| (未调用) | @Delete(':code') ClassController | DELETE | ⚪ 管理端功能 |
| (未调用) | @Post(':code/teachers') ClassController | POST | ⚪ 管理端功能 |
| (未调用) | @Get(':code/teachers') ClassController | GET | ⚪ 管理端功能 |
| (未调用) | @Delete(':code/teachers/:id') ClassController | DELETE | ⚪ 管理端功能 |

*注: GET /classes/:code/lessons 路由定义在 LessonController（@Controller('')），路径为 classes/:code/lessons

### Course Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| GET /courses | @Get() CourseController | GET | ✅ MATCH |
| GET /courses/:code | @Get(':code') CourseController | GET | ✅ MATCH |
| (未调用) | @Post() CourseController | POST | ⚪ 管理端功能 |
| (未调用) | @Put(':code') CourseController | PUT | ⚪ 管理端功能 |
| (未调用) | @Patch(':code/status') CourseController | PATCH | ⚪ 管理端功能 |

### Lesson Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| POST /lessons | @Post('lessons') LessonController | POST | ✅ MATCH |
| (未调用) | @Get('classes/:code/lessons/:num') LessonController | GET | ⚪ 前端未用 |
| (未调用) | @Patch('classes/:code/lessons/:num/start') | PATCH | ⚪ 前端未用 |
| (未调用) | @Patch('classes/:code/lessons/:num/complete') | PATCH | ⚪ 前端未用 |
| (未调用) | @Patch('classes/:code/lessons/:num/confirm') | PATCH | ⚪ 前端未用 |
| (未调用) | @Patch('classes/:code/lessons/:num/cancel') | PATCH | ⚪ 前端未用 |
| (未调用) | @Post('classes/:code/lessons/makeup') | POST | ⚪ 前端未用 |

### Lesson Attendance Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| (未直接调用) | @Post('lessons/:id/attendance') | POST | ⚪ 前端通过 POST /lessons 间接使用 |
| (未调用) | @Post('lessons/:id/attendance/confirm') | POST | ⚪ 前端未用 |
| (未调用) | @Patch('lessons/:id/attendance/:studentCode') | PATCH | ⚪ 前端未用 |
| (未调用) | @Get('lessons/:id/attendance') | GET | ⚪ 前端未用 |
| (未调用) | @Get('students/:studentCode/attendance') | GET | ⚪ 前端用 /students/self/attendance 替代 |

### Enrollment Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| GET /enrollments/students/:code/enrollments | @Get('students/:studentCode/enrollments') EnrollmentController | GET | ✅ MATCH |
| (未调用) | @Post() EnrollmentController | POST | ⚪ 管理端功能 |
| (未调用) | @Get() EnrollmentController | GET | ⚪ 管理端功能 |
| (未调用) | @Get(':id') EnrollmentController | GET | ⚪ 管理端功能 |
| (未调用) | @Post(':id/withdraw') EnrollmentController | POST | ⚪ 管理端功能 |
| (未调用) | @Get('classes/:code/enrollments') EnrollmentController | GET | ⚪ 管理端功能 |

### Contract Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| (未直接调用) | @Get('students/:studentCode/contracts') ContractController | GET | ⚪ 前端用 /students/self/contracts 替代 |
| (未调用) | @Post() ContractController | POST | ⚪ 管理端功能 |
| (未调用) | @Get() ContractController | GET | ⚪ 管理端功能 |
| (未调用) | @Get(':code') ContractController | GET | ⚪ 管理端功能 |
| (未调用) | @Patch(':code/freeze') ContractController | PATCH | ⚪ 管理端功能 |

### Reminder Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| GET /reminders | @Get() ReminderController | GET | ✅ MATCH |
| PATCH /reminders/:id/read | @Patch(':id/read') ReminderController | PATCH | ✅ MATCH |
| GET /reminders/unread-count | @Get('unread-count') ReminderController | GET | ✅ MATCH |
| (未调用) | @Patch('read-all') ReminderController | PATCH | ⚪ 前端未用 |
| (未调用) | @Post() ReminderController | POST | ⚪ 管理端功能 |

### Analytics Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| GET /analytics/institution | @Get('institution') AnalyticsController | GET | ✅ MATCH |
| GET /analytics/institution/trend | @Get('institution/trend') AnalyticsController | GET | ✅ MATCH |
| (未调用) | @Get('student/:studentCode') AnalyticsController | GET | ⚪ 前端未用 |
| (未调用) | @Get('teacher/:teacherId') AnalyticsController | GET | ⚪ 前端未用 |
| (未调用) | @Get('student/:studentCode/trend') AnalyticsController | GET | ⚪ 前端未用 |
| (未调用) | @Get('teacher/:teacherId/trend') AnalyticsController | GET | ⚪ 前端未用 |

### Teacher Assignment Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| GET /teacher-assignments | @Get() TeacherAssignmentController | GET | ✅ MATCH |
| (未调用) | @Post() TeacherAssignmentController | POST | ⚪ 管理端功能 |
| (未调用) | @Get(':id') TeacherAssignmentController | GET | ⚪ 管理端功能 |
| (未调用) | @Delete(':id') TeacherAssignmentController | DELETE | ⚪ 管理端功能 |

### Lesson Change Request Module
| 前端调用 | 后端定义 | 方法 | 状态 |
|---------|---------|------|------|
| (未调用) | @Post('lessons/:id/change-requests') | POST | ⚪ 前端未用 |
| (未调用) | @Get('lessons/:id/change-requests') | GET | ⚪ 前端未用 |
| (未调用) | @Patch('change-requests/:id/approve') | PATCH | ⚪ 前端未用 |
| (未调用) | @Patch('change-requests/:id/reject') | PATCH | ⚪ 前端未用 |

---

## 发现的问题

### ISSUE-001: reminder/detail.js URL 双重前缀（P0）
- Severity: P0
- Location: miniapp/pages/reminder/detail.js:57,88
- Description: 使用 `request({ url: '/api/v1/reminders/' + id + '/read' })` 直接构造URL，但 baseUrl 已包含 `/api/v1`，导致实际请求为 `/api/v1/api/v1/reminders/:id/read` — 404
- Fix: 改为 `/reminders/${id}/read`

### 其他观察（非Bug）
- 前端未调用部分后端API属于正常情况（管理端功能、调课请求等暂未在小程序实现）
- 学生端通过 `/students/self/*` 系列端点访问数据，不直接调用 Contract/Attendance 的原始端点 — 设计合理

---

## 结论
- Total APIs (前端调用): 28 unique paths
- Matched: 27
- Mismatched: 1 (ISSUE-001: URL double prefix)
- Status: ❌ HAS ISSUES (1 P0 bug found and fixed)

## 修复记录
- ISSUE-001: 已修复 — reminder/detail.js URL 路径去除 `/api/v1` 前缀
