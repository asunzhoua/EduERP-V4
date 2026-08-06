# Bug Detection Part 1: Functional Test Report

**Generated**: 2026-08-02 08:04:27
**Backend**: http://localhost:3000
**Tester**: Automated Script (bug-detection-part1.js)

---

## Executive Summary

| Role | Total Tests | Passed (2xx) | Failed | Anomalies |
|------|------------|--------------|--------|-----------|
| Student | 5 | 5 | 0 | 0 |
| Teacher | 4 | 4 | 0 | 0 |
| Parent | 4 | 4 | 0 | 0 |
| **Total** | **13** | **13** | **0** | **0** |

---

## Student Flow (student1 / Student@Dev2026)

| # | Endpoint | Status | Time | Anomaly |
|---|----------|--------|------|---------|
| S-1 | `Login` | 200 | 0.581s | ✅ None |
| S-2 | `GET /students/self` | 200 | 0.009s | ✅ None |
| S-3 | `GET /students/self/contracts` | 200 | 0.022s | ✅ None |
| S-4 | `GET /students/self/lessons` | 200 | 0.025s | ✅ None |
| S-5 | `GET /students/self/attendance` | 200 | 0.019s | ✅ None |

### Student Response Details

#### S-1: Login

- **Status**: 200
- **Time**: 0.581s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzIiwidXNlcm5hbWUiOiJzdHVkZW50MSIsInJvbGUiOiJTdHVkZW50IiwibmFtZSI6IuadjuWwj-WNjiIsImlhdCI6MTc4NTY1Nzg1OSwiZXhwIjoxNzg1NjY1MDU5fQ.sjZn9c5ymkx6Q8IKvJR9SllczzYNKJhkvMagqMswiUQ",
    "refreshToken": "a1992805-762e-4b12-b37e-cc176b71e25c",
    "expiresIn": 7200,
    "user": {
      "id": "3",
      "username": "student1",
      "mobile": "13900000002",
      "openid": null,
      "unionid": null,
      "name": "李小华",
      "role": "Student",
      "status": 1,
      "campusId": "1",
      "avatar": null,
      "lastLoginAt": "2026-08-02T08:03:20.000Z",
      "createTime": "2026-07-19T22:55:54.796Z",
      "updateTime": "2026-08-02T08:03:19.000Z",
      "version": 18,
      "deleted": 0
    }
  }
}
```

#### S-2: GET /students/self

- **Status**: 200
- **Time**: 0.009s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "studentCode": "STU001",
    "name": "李小华",
    "gender": "MALE",
    "phone": "13800000001"
  }
}
```

#### S-3: GET /students/self/contracts

- **Status**: 200
- **Time**: 0.022s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "contractCode": "CT2026070001",
      "classCode": "CL2026070001",
      "teacherName": "张老师",
      "subject": "MATH",
      "totalLessons": 50,
      "remainingLessons": 49,
      "status": "ACTIVE",
      "validFrom": "2026-07-01",
      "validTo": null
    }
  ]
}
```

#### S-4: GET /students/self/lessons

- **Status**: 200
- **Time**: 0.025s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "lessonId": "13",
      "lessonDate": "2026-07-27",
      "startTime": "09:00",
      "endTime": "10:30",
      "status": "PRESENT",
      "lessonStatus": "DRAFT",
      "className": "周六上午班",
      "courseName": "数学基础班"
    },
    {
      "lessonId": "12",
      "lessonDate": "2026-07-18",
      "startTime": "09:00",
      "endTime": "10:30",
      "status": "ABSENT",
      "lessonStatus": "FINISHED",
      "className": "周六上午班",
      "courseName": "数学基础班"
    },
    {
      "lessonId": "11",
      "lessonDate": "2026-07-11",
      "startTime": "09:00",
      "endTime": "10:30",
      "status": "PRESENT",
      "lessonStatus": "FINISHED",
      "className": "周六上午班",
      "courseName": "数学基础班"
    },
    {
      "lessonId": "10",
      "lessonDate": "2026-07-04",
      "startTime": "09:00",
      "endTime": "10:30",
      "status": "PRESENT",
      "lessonStatus": "FINISHED",
      "className": "周六上午班",
      "courseName": 
```

#### S-5: GET /students/self/attendance

- **Status**: 200
- **Time**: 0.019s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "16",
      "lessonDate": "2026-07-27",
      "startTime": "09:00",
      "endTime": "10:30",
      "courseName": "数学基础班",
      "className": "周六上午班",
      "status": "PRESENT"
    },
    {
      "id": "14",
      "lessonDate": "2026-07-18",
      "startTime": "09:00",
      "endTime": "10:30",
      "courseName": "数学基础班",
      "className": "周六上午班",
      "status": "ABSENT"
    },
    {
      "id": "12",
      "lessonDate": "2026-07-11",
      "startTime": "09:00",
      "endTime": "10:30",
      "courseName": "数学基础班",
      "className": "周六上午班",
      "status": "PRESENT"
    },
    {
      "id": "10",
      "lessonDate": "2026-07-04",
      "startTime": "09:00",
      "endTime": "10:30",
      "courseName": "数学基础班",
      "className": "周六上午班",
      "status": "PRESENT"
    }
  ]
}
```

---

## Teacher Flow (teacher1 / Teacher@Dev2026)

| # | Endpoint | Status | Time | Anomaly |
|---|----------|--------|------|---------|
| T-1 | `Login` | 200 | 0.633s | ✅ None |
| T-2 | `GET /teacher/dashboard` | 200 | 0.018s | ✅ None |
| T-3 | `GET /courses` | 200 | 0.020s | ✅ None |
| T-4 | `GET /teacher-assignments` | 200 | 0.009s | ✅ None |

### Teacher Response Details

#### T-1: Login

- **Status**: 200
- **Time**: 0.633s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwidXNlcm5hbWUiOiJ0ZWFjaGVyMSIsInJvbGUiOiJUZWFjaGVyIiwibmFtZSI6IuW8oOiAgeW4iCIsImlhdCI6MTc4NTY1Nzg2MiwiZXhwIjoxNzg1NjY1MDYyfQ.cEgzA14PQ4Skzaah0UXqcdmtV3QVNQI0bhd3nzwxCMY",
    "refreshToken": "b9229510-d645-4a49-972c-9adb9ee12205",
    "expiresIn": 7200,
    "user": {
      "id": "2",
      "username": "teacher1",
      "mobile": "13900000001",
      "openid": null,
      "unionid": null,
      "name": "张老师",
      "role": "Teacher",
      "status": 1,
      "campusId": "1",
      "avatar": null,
      "lastLoginAt": "2026-08-02T08:02:51.000Z",
      "createTime": "2026-07-19T22:55:54.200Z",
      "updateTime": "2026-08-02T08:02:50.000Z",
      "version": 18,
      "deleted": 0
    }
  }
}
```

#### T-2: GET /teacher/dashboard

- **Status**: 200
- **Time**: 0.018s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "todayLessons": 0,
    "pendingAttendance": 0,
    "totalStudents": 0,
    "totalClasses": 2
  }
}
```

#### T-3: GET /courses

- **Status**: 200
- **Time**: 0.020s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "8",
        "courseCode": "CS2026070006",
        "name": "?????????",
        "subject": "MATH",
        "type": "GROUP",
        "description": null,
        "totalHours": "30.0",
        "totalLessons": 15,
        "defaultDuration": 45,
        "status": "DRAFT",
        "tags": null,
        "coverImage": null,
        "note": null,
        "createdBy": "8",
        "createTime": "2026-07-30T04:34:18.990Z",
        "updatedBy": null,
        "updateTime": "2026-07-30T04:34:18.990Z",
        "version": 1,
        "deleted": false,
        "lessonCount": 15,
        "enrolledClasses": 0
      },
      {
        "id": "7",
        "courseCode": "CS2026070005",
        "name": "?????????",
        "subject": "MATH",
        "type": "GROUP",
        "description": null,
        "totalHours": "30.0",
        "totalLessons": 15,
        "defaultDuration": 45,
        "status": "DRAFT",
        "tags"
```

#### T-4: GET /teacher-assignments

- **Status**: 200
- **Time**: 0.009s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "3",
      "classCode": "CL2026070004",
      "teacherId": "1",
      "role": "PRIMARY",
      "effectiveFrom": "2026-07-26",
      "effectiveTo": null,
      "assignedBy": "8",
      "reason": null,
      "createTime": "2026-07-26T23:36:34.795Z"
    },
    {
      "id": "2",
      "classCode": "CL2026070002",
      "teacherId": "2",
      "role": "PRIMARY",
      "effectiveFrom": "2026-07-01",
      "effectiveTo": null,
      "assignedBy": "1",
      "reason": null,
      "createTime": "2026-07-19T22:55:59.441Z"
    },
    {
      "id": "1",
      "classCode": "CL2026070001",
      "teacherId": "2",
      "role": "PRIMARY",
      "effectiveFrom": "2026-07-01",
      "effectiveTo": null,
      "assignedBy": "1",
      "reason": null,
      "createTime": "2026-07-19T22:55:59.230Z"
    }
  ]
}
```

---

## Parent Flow (parent1 / Parent@Dev2026)

| # | Endpoint | Status | Time | Anomaly |
|---|----------|--------|------|---------|
| P-1 | `Login` | 200 | 1.068s | ✅ None |
| P-2 | `GET /students/my-children` | 200 | 0.013s | ✅ None |
| P-3 | `GET /students/:childId/contracts` | 200 | 0.014s | ✅ None |
| P-4 | `GET /students/:childId/attendance` | 200 | 0.019s | ✅ None |

### Parent Response Details

#### P-1: Login

- **Status**: 200
- **Time**: 1.068s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0IiwidXNlcm5hbWUiOiJwYXJlbnQxIiwicm9sZSI6IlBhcmVudCIsIm5hbWUiOiLmnY7lu7rlm70iLCJpYXQiOjE3ODU2NTc4NjYsImV4cCI6MTc4NTY2NTA2Nn0.rOSFUN_s6zfJzXIKqxFvtl3O1e9frbcKZNKITHZy5Bc",
    "refreshToken": "baf0fb25-6b38-493f-9905-ce40131de9f0",
    "expiresIn": 7200,
    "user": {
      "id": "4",
      "username": "parent1",
      "mobile": "13900000003",
      "openid": null,
      "unionid": null,
      "name": "李建国",
      "role": "Parent",
      "status": 1,
      "campusId": "1",
      "avatar": null,
      "lastLoginAt": "2026-08-02T08:02:52.000Z",
      "createTime": "2026-07-19T22:55:55.397Z",
      "updateTime": "2026-08-02T08:02:51.000Z",
      "version": 15,
      "deleted": 0
    }
  }
}
```

#### P-2: GET /students/my-children

- **Status**: 200
- **Time**: 0.013s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "8",
      "studentCode": "ST2026070003",
      "name": "V2验证学生",
      "gender": "MALE",
      "birthDate": "2015-06-15",
      "phone": null,
      "userId": null,
      "email": null,
      "school": "验证小学",
      "grade": "四年级",
      "tags": null,
      "status": "ACTIVE",
      "note": null,
      "mergedToStudentId": null,
      "createdBy": "8",
      "createdSource": "API",
      "createTime": "2026-07-27T00:37:24.587Z",
      "updatedBy": "8",
      "updateTime": "2026-07-27T00:37:24.587Z",
      "version": 1,
      "deleted": false
    }
  ]
}
```

#### P-3: GET /students/:childId/contracts

- **Status**: 200
- **Time**: 0.014s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "5",
      "contractCode": "CT2026070008",
      "studentCode": "ST2026070003",
      "subject": "CHINESE",
      "totalLessons": 50,
      "remainingLessons": 48,
      "status": "ACTIVE",
      "validFrom": "2026-07-01",
      "validTo": null,
      "unitPrice": null,
      "totalAmount": null,
      "note": null,
      "tags": null,
      "createdBy": "8",
      "createdAt": "2026-07-27T08:23:12.778Z"
    }
  ]
}
```

#### P-4: GET /students/:childId/attendance

- **Status**: 200
- **Time**: 0.019s
- **Response Body**:

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "18",
      "lessonId": "14",
      "lessonDate": "2026-07-27",
      "startTime": "09:00",
      "endTime": "10:30",
      "status": "PRESENT"
    }
  ]
}
```

---

## Anomalies Detected

No anomalies detected. All tests passed as expected.


---

## Data Structure Analysis

### Expected vs Actual Response Structures

**Login Response** (all roles):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accessToken": "jwt_token_string",
    "refreshToken": "uuid",
    "expiresIn": 7200,
    "user": { "id", "username", "mobile", "name", "role", ... }
  }
}
```

**Student Self** (`GET /students/self`):
```json
{
  "statusCode": 200,
  "data": { "id", "studentId", "name", "phone", ... }
}
```

**Students/Children List**:
```json
{
  "statusCode": 200,
  "data": [{ "id", "studentId", "name", ... }]
}
```

---

*Report generated by Bug Detection Part 1 automated test script*
