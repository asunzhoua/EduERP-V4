# Miniapp API Contract

> **Purpose**: Backend API → Miniapp 需求映射
> **Date**: 2026-07-17
> **Status**: v1.0

---

## 1. 认证接口

### 1.1 登录
```
POST /auth/login

Request:
{
  "username": "teacher001",
  "password": "******"
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": 1,
      "username": "teacher001",
      "name": "张老师",
      "role": "Teacher"
    }
  }
}
```

### 1.2 刷新 Token
```
POST /auth/refresh

Request:
{
  "refreshToken": "eyJ..."
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

---

## 2. 教师端接口

### 2.1 获取我的课程
```
GET /courses
Headers: Authorization: Bearer <token>

Query:
- page: number (default: 1)
- pageSize: number (default: 20)
- status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

Response:
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "courseCode": "CS2026070001",
        "name": "数学思维训练",
        "subject": "数学",
        "status": "PUBLISHED",
        "createdAt": "2026-07-01"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20
  }
}
```

### 2.2 获取我的班级
```
GET /classes
Headers: Authorization: Bearer <token>

Query:
- page: number
- pageSize: number
- status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
- courseCode: string (optional)

Response:
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "classCode": "CL2026070001",
        "courseCode": "CS2026070001",
        "name": "周六上午班",
        "status": "ACTIVE",
        "startDate": "2026-07-15",
        "totalLessons": 20,
        "maxStudents": 15,
        "currentStudents": 12
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20
  }
}
```

### 2.3 获取班级学生
```
GET /classes/:code/students
Headers: Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "studentCode": "STU2026070001",
      "name": "张三",
      "status": "ACTIVE",
      "enrolledAt": "2026-07-01"
    }
  ]
}
```

### 2.4 创建课次
```
POST /lessons
Headers: Authorization: Bearer <token>

Request:
{
  "classCode": "CL2026070001",
  "lessonDate": "2026-07-15",
  "startTime": "10:00",
  "endTime": "11:30",
  "topic": "第一讲"
}

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "lessonCode": "LN2026070001",
    "classCode": "CL2026070001",
    "status": "SCHEDULED"
  }
}
```

### 2.5 记录考勤
```
POST /lessons/:id/attendance
Headers: Authorization: Bearer <token>

Request:
{
  "records": [
    { "studentCode": "STU2026070001", "status": "PRESENT" },
    { "studentCode": "STU2026070002", "status": "ABSENT", "reason": "请假" }
  ]
}

Response:
{
  "success": true,
  "data": {
    "processedCount": 2,
    "successCount": 2
  }
}
```

---

## 3. 学生端接口

### 3.1 获取学生信息
```
GET /students/:id
Headers: Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "studentCode": "STU2026070001",
    "name": "张三",
    "gender": "MALE",
    "birthDate": "2015-01-01",
    "school": "XX小学",
    "grade": "四年级",
    "status": "ACTIVE"
  }
}
```

### 3.2 获取我的课程
```
GET /students/:id/classes
Headers: Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "classCode": "CL2026070001",
      "courseName": "数学思维训练",
      "teacherName": "张老师",
      "schedule": "周六 10:00-11:30",
      "remainLessons": 18
    }
  ]
}
```

---

## 4. 响应格式规范

### 成功响应
```json
{
  "success": true,
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

### 错误响应
```json
{
  "success": false,
  "code": 4001,
  "message": "课时不足",
  "data": null
}
```

---

## 5. 错误码定义

| Code | Message |
|:-----|:--------|
| 0 | 成功 |
| 1001 | 参数错误 |
| 2001 | 未授权 |
| 2002 | Token 过期 |
| 3001 | 资源不存在 |
| 4001 | 业务错误 |
| 5001 | 服务器错误 |

---

## 6. Miniapp 请求封装示例

```javascript
// utils/request.js
const BASE_URL = 'https://your-domain.com/api';

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        if (res.data.success) {
          resolve(res.data.data);
        } else {
          reject(res.data);
        }
      },
      fail: reject
    });
  });
}
```

---

*API Contract v1.0*