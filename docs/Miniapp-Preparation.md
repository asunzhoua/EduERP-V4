# Miniapp Preparation - EduERP-V4

> **Phase**: Phase 3 - Miniapp Preparation
> **Date**: 2026-07-17
> **Status**: Preparation Document

---

## 1. Backend API Status

### Available Modules

| Module | Endpoint Prefix | Status |
|--------|-----------------|--------|
| Auth | `/auth` | ✅ Ready |
| Student | `/students` | ✅ Ready |
| Course | `/courses` | ✅ Ready |
| Class | `/classes` | ✅ Ready |
| Lesson | `/lessons` | ✅ Ready |
| Enrollment | `/enrollments` | ✅ Ready |
| Contract | `/contracts` | ✅ Ready |

### Authentication

- **Type**: JWT Bearer Token
- **Header**: `Authorization: Bearer <token>`
- **User ID**: Extracted from `req.user.sub`

---

## 2. API Endpoints Summary

### Student Module
```
GET    /students           # List students (paginated)
GET    /students/:id       # Get student detail
POST   /students           # Create student
PUT    /students/:id       # Update student
DELETE /students/:id       # Soft delete student
```

### Course Module
```
GET    /courses            # List courses
GET    /courses/:code      # Get course by code
POST   /courses            # Create course
PUT    /courses/:code      # Update course
DELETE /courses/:code      # Soft delete course
```

### Class Module
```
GET    /classes            # List classes
GET    /classes/:code      # Get class by code
POST   /classes            # Create class
PUT    /classes/:code      # Update class
DELETE /classes/:code      # Soft delete class
POST   /classes/:code/teachers    # Assign teacher
GET    /classes/:code/teachers     # Get teachers
```

---

## 3. Miniapp Page Structure (Planned)

### Parent End
- `/pages/parent/index` - 首页（学生信息、课时余额）
- `/pages/parent/schedule` - 课表查看
- `/pages/parent/leave` - 请假申请
- `/pages/parent/feedback` - 反馈查看

### Teacher End
- `/pages/teacher/index` - 首页（今日课程）
- `/pages/teacher/checkin` - 签到/签退
- `/pages/teacher/schedule` - 课表查看
- `/pages/teacher/feedback` - 反馈填写

### Admin End
- `/pages/admin/index` - 经营看板
- `/pages/admin/students` - 学生管理
- `/pages/admin/classes` - 班级管理
- `/pages/admin/schedules` - 排课管理

---

## 4. Data Models (Key Entities)

### Student
```typescript
{
  id: number;
  studentCode: string;
  name: string;
  gender: 'MALE' | 'FEMALE';
  birthDate: string;
  phone?: string;
  school?: string;
  grade?: string;
  status: 'ACTIVE' | 'GRADUATED' | 'TRANSFERRED';
}
```

### Course
```typescript
{
  id: number;
  courseCode: string;
  name: string;
  subject: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}
```

### Class
```typescript
{
  id: number;
  classCode: string;
  courseId: number;
  teacherId: number;
  status: 'DRAFT' | 'ACTIVE' | 'CANCELLED';
}
```

---

## 5. Backend Connection Config

### Development
```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

### Production
```javascript
const API_BASE_URL = 'https://your-domain.com/api';
```

---

## 6. Required Miniapp Setup

### app.json (Planned)
```json
{
  "pages": [
    "pages/login/login",
    "pages/parent/index",
    "pages/teacher/index",
    "pages/admin/index"
  ],
  "window": {
    "navigationBarTitleText": "EduERP",
    "navigationBarBackgroundColor": "#1890ff"
  }
}
```

### Required Skills
- `miniprogram-development` ✅ Installed
- `miniapp-develop` ✅ Installed

---

## 7. Next Steps

1. **Create Miniapp Structure**
   - Initialize miniprogram directory
   - Setup app.json with pages
   - Configure API request utils

2. **Implement Login**
   - WeChat OAuth login
   - JWT token storage
   - Role-based redirect

3. **Implement Core Pages**
   - Parent: index, schedule
   - Teacher: index, checkin
   - Admin: dashboard

---

## 8. Risk Assessment

| Task | Risk Level | Notes |
|------|------------|-------|
| Initialize Miniapp | LOW | Standard setup |
| Login Implementation | MEDIUM | Requires WeChat config |
| API Integration | LOW | Backend ready |
| UI Implementation | LOW | Standard development |

---

## 9. Dependencies

- Backend API: ✅ Ready
- JWT Auth: ✅ Ready
- Database: ✅ Ready
- WeChat AppID: ⏳ Needs configuration

---

*Miniapp Preparation Document - Phase 3 Complete*