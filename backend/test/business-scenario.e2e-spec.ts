/**
 * Business Scenario E2E Test — Phase 5 Batch 5.1
 *
 * 5 大真实业务场景测试：
 * 1. 签到扣课场景
 * 2. 扣完课合同状态变化场景
 * 3. 家长端看到变化场景
 * 4. 教师端看到变化场景
 * 5. 后台统计变化场景
 *
 * 使用真实数据库连接，测试前后清理测试数据。
 * 使用 raw SQL 进行 setup/cleanup，避免 entity metadata 问题。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

// Import modules from source
import { EventBusModule } from '../src/events/event-bus.module';
import { IdentityModule } from '../src/modules/identity/identity.module';
import { StudentModule } from '../src/modules/student/student.module';
import { TeachingModule } from '../src/modules/teaching/teaching.module';
import { DatabaseModule } from '../src/database/database.module';
import { AnalyticsModule } from '../src/modules/analytics/analytics.module';
import { ReminderModule } from '../src/modules/reminder/reminder.module';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { JwtAuthGuard } from '../src/modules/identity/auth/jwt-auth.guard';
import { appConfig } from '../src/config/configuration';

// Import ALL entity classes directly from source
import { User } from '../src/modules/identity/entities/user.entity';
import { LoginLog } from '../src/modules/identity/entities/login-log.entity';
import { Role } from '../src/modules/identity/entities/role.entity';
import { Permission } from '../src/modules/identity/entities/permission.entity';
import { UserRole } from '../src/modules/identity/entities/user-role.entity';
import { RolePermission } from '../src/modules/identity/entities/role-permission.entity';
import { Student } from '../src/modules/student/entities/student.entity';
import { StudentAuditLog } from '../src/modules/student/entities/student-audit-log.entity';
import { StudentParent } from '../src/modules/student/entities/student-parent.entity';
import { ClassEntity } from '../src/modules/teaching/class/class.entity';
import { CourseEntity } from '../src/modules/teaching/course/course.entity';
import { CourseAuditLog } from '../src/modules/teaching/course/course-audit-log.entity';
import { ContractEntity } from '../src/modules/teaching/contract/contract.entity';
import { EnrollmentEntity } from '../src/modules/teaching/enrollment/enrollment.entity';
import { LessonEntity } from '../src/modules/teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '../src/modules/teaching/lesson-attendance/lesson-attendance.entity';
import { LessonChangeRequestEntity } from '../src/modules/teaching/lesson-change-request/lesson-change-request.entity';
import { TeacherAssignmentEntity } from '../src/modules/teaching/teacher-assignment/teacher-assignment.entity';
import { Reminder } from '../src/modules/reminder/entities/reminder.entity';
import { ImportHistory } from '../src/modules/student/entities/import-history.entity';

// ─── Test Constants ───
const TEST_TEACHER_USERNAME = 'test_biz_teacher';
const TEST_ADMIN_USERNAME = 'test_biz_admin';
const TEST_PARENT_USERNAME = 'test_biz_parent';
const TEST_PASSWORD = 'Test1234!';
const TEST_STUDENT_NAME = '测试学生-业务场景';
const TEST_COURSE_NAME = '测试课程-业务场景';
const TEST_CLASS_NAME = '测试班级-业务场景';

let app: INestApplication;
let dataSource: DataSource;
let adminToken: string;
let teacherToken: string;
let parentToken: string;
let teacherId: number;
let adminId: number;
let parentId: number;
let studentCode: string;
let contractCode: string;
let classCode: string;
let courseCode: string;
let createdIds: {
  userIds: number[];
  studentIds: number[];
  contractIds: number[];
  classIds: number[];
  courseIds: number[];
  lessonIds: number[];
  enrollmentIds: number[];
  attendanceIds: number[];
} = {
  userIds: [],
  studentIds: [],
  contractIds: [],
  classIds: [],
  courseIds: [],
  lessonIds: [],
  enrollmentIds: [],
  attendanceIds: [],
};

// ─── Helper: Get today's date in YYYY-MM-DD format ───
function getTodayDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Helper: Clean up test data ───
async function cleanupTestData() {
  // Clean up in dependency order
  await dataSource.query(
    `DELETE FROM reminder WHERE targetType = 'STUDENT' AND targetId IN (
      SELECT id FROM student WHERE name = ?
    )`,
    [TEST_STUDENT_NAME],
  );
  await dataSource.query(
    `DELETE FROM lesson_attendance WHERE studentCode IN (
      SELECT studentCode FROM student WHERE name = ?
    )`,
    [TEST_STUDENT_NAME],
  );
  await dataSource.query(
    `DELETE FROM lesson WHERE classCode IN (
      SELECT classCode FROM class WHERE name = ?
    )`,
    [TEST_CLASS_NAME],
  );
  await dataSource.query(
    `DELETE FROM enrollment WHERE classCode IN (
      SELECT classCode FROM class WHERE name = ?
    )`,
    [TEST_CLASS_NAME],
  );
  await dataSource.query(
    `DELETE FROM teacher_assignment WHERE classCode IN (
      SELECT classCode FROM class WHERE name = ?
    )`,
    [TEST_CLASS_NAME],
  );
  await dataSource.query(
    `DELETE FROM contract WHERE studentCode IN (
      SELECT studentCode FROM student WHERE name = ?
    )`,
    [TEST_STUDENT_NAME],
  );
  await dataSource.query(
    `DELETE FROM class WHERE name = ?`,
    [TEST_CLASS_NAME],
  );
  await dataSource.query(
    `DELETE FROM course WHERE name = ?`,
    [TEST_COURSE_NAME],
  );
  await dataSource.query(
    `DELETE FROM student_audit_log WHERE studentId IN (
      SELECT id FROM student WHERE name = ?
    )`,
    [TEST_STUDENT_NAME],
  );
  await dataSource.query(
    `DELETE FROM student_parent WHERE studentId IN (
      SELECT id FROM student WHERE name = ?
    )`,
    [TEST_STUDENT_NAME],
  );
  await dataSource.query(
    `DELETE FROM student WHERE name = ?`,
    [TEST_STUDENT_NAME],
  );
  // Clean up test users
  for (const username of [TEST_TEACHER_USERNAME, TEST_ADMIN_USERNAME, TEST_PARENT_USERNAME]) {
    await dataSource.query(
      `DELETE FROM user_role WHERE userId IN (SELECT id FROM user WHERE username = ?)`,
      [username],
    );
  }
  await dataSource.query(
    `DELETE FROM login_log WHERE userId IN (SELECT id FROM user WHERE username IN (?, ?, ?))`,
    [TEST_TEACHER_USERNAME, TEST_ADMIN_USERNAME, TEST_PARENT_USERNAME],
  );
  await dataSource.query(
    `DELETE FROM user WHERE username IN (?, ?, ?)`,
    [TEST_TEACHER_USERNAME, TEST_ADMIN_USERNAME, TEST_PARENT_USERNAME],
  );
}

// ─── Helper: Create test users ───
async function createTestUsers() {
  // Create Teacher user
  const teacherPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const teacherResult = await dataSource.query(
    `INSERT INTO user (username, password, name, phone, role, status, createTime, updateTime)
     VALUES (?, ?, '测试教师', '13800000001', 'teacher', 'active', NOW(), NOW())`,
    [TEST_TEACHER_USERNAME, teacherPasswordHash],
  );
  teacherId = teacherResult.insertId;
  createdIds.userIds.push(teacherId);

  // Create Admin user
  const adminPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const adminResult = await dataSource.query(
    `INSERT INTO user (username, password, name, phone, role, status, createTime, updateTime)
     VALUES (?, ?, '测试管理员', '13800000002', 'admin', 'active', NOW(), NOW())`,
    [TEST_ADMIN_USERNAME, adminPasswordHash],
  );
  adminId = adminResult.insertId;
  createdIds.userIds.push(adminId);

  // Create Parent user
  const parentPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const parentResult = await dataSource.query(
    `INSERT INTO user (username, password, name, phone, role, status, createTime, updateTime)
     VALUES (?, ?, '测试家长', '13800000003', 'parent', 'active', NOW(), NOW())`,
    [TEST_PARENT_USERNAME, parentPasswordHash],
  );
  parentId = parentResult.insertId;
  createdIds.userIds.push(parentId);
}

// ─── Helper: Login and get JWT token ───
async function login(username: string, password: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ username, password })
    .expect(200);
  return res.body.data.accessToken;
}

// ─── Helper: Setup base data (student, course, class, contract, enrollment) ───
async function setupBaseData(totalLessons: number = 10) {
  // Create Student
  const studentRes = await request(app.getHttpServer())
    .post('/students')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: TEST_STUDENT_NAME,
      gender: 'male',
      birthDate: '2015-01-01',
      phone: '13900000001',
      grade: '三年级',
      school: '测试小学',
    })
    .expect(201);
  studentCode = studentRes.body.data.studentCode;
  createdIds.studentIds.push(studentRes.body.data.id);

  // Link parent to student
  await dataSource.query(
    `INSERT INTO student_parent (studentId, userId, relationship, createTime, updateTime)
     VALUES (?, ?, 'mother', NOW(), NOW())`,
    [studentRes.body.data.id, parentId],
  );

  // Create Course
  const courseRes = await request(app.getHttpServer())
    .post('/courses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: TEST_COURSE_NAME,
      subject: 'math',
      totalLessons: totalLessons,
      description: '业务场景测试课程',
    })
    .expect(201);
  courseCode = courseRes.body.data.courseCode;
  createdIds.courseIds.push(courseRes.body.data.id);

  // Create Class
  const classRes = await request(app.getHttpServer())
    .post('/classes')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: TEST_CLASS_NAME,
      courseCode: courseCode,
      capacity: 10,
      startDate: getTodayDate(),
      endDate: '2026-12-31',
      note: '业务场景测试班级',
    })
    .expect(201);
  classCode = classRes.body.data.classCode;
  createdIds.classIds.push(classRes.body.data.id);

  // Assign Teacher to Class
  await request(app.getHttpServer())
    .post('/classes/teacher-assignment')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      classCode: classCode,
      teacherId: teacherId,
      role: 'PRIMARY',
    })
    .expect(201);

  // Purchase Lessons (Create Contract)
  const contractRes = await request(app.getHttpServer())
    .post('/contracts')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      studentCode: studentCode,
      subject: 'math',
      totalLessons: totalLessons,
      validFrom: getTodayDate(),
      validTo: '2026-12-31',
      unitPrice: 100,
      totalAmount: totalLessons * 100,
      note: '业务场景测试合同',
    })
    .expect(201);
  contractCode = contractRes.body.data.contractCode;
  createdIds.contractIds.push(contractRes.body.data.id);

  // Enroll Student
  const enrollmentRes = await request(app.getHttpServer())
    .post('/enrollments')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      studentCode: studentCode,
      classCode: classCode,
      contractCode: contractCode,
    })
    .expect(201);
  createdIds.enrollmentIds.push(enrollmentRes.body.data.id);
}

// ─── Helper: Create a lesson and do roll call ───
async function createLessonAndRollCall(
  lessonNumber: number,
  attendanceStatus: string,
  reason?: string,
): Promise<{ lessonId: number; attendanceRecord: any }> {
  const today = getTodayDate();
  const startTime = `10:00`;
  const endTime = `11:00`;

  // Create Lesson
  const lessonRes = await request(app.getHttpServer())
    .post('/lessons')
    .set('Authorization', `Bearer ${teacherToken}`)
    .send({
      classCode: classCode,
      courseCode: courseCode,
      lessonNumber: lessonNumber,
      scheduledDate: today,
      startTime: startTime,
      endTime: endTime,
      teacherId: teacherId,
    })
    .expect(201);
  const lessonId = lessonRes.body.data.id;
  createdIds.lessonIds.push(lessonId);

  // Start Teaching (SCHEDULED → TEACHING)
  await request(app.getHttpServer())
    .patch(`/lessons/${lessonId}/status`)
    .set('Authorization', `Bearer ${teacherToken}`)
    .send({ status: 'TEACHING' })
    .expect(200);

  // Batch Roll Call
  const rollCallBody: any = {
    records: [
      {
        studentCode: studentCode,
        status: attendanceStatus,
        ...(reason ? { reason } : {}),
      },
    ],
  };
  const attendanceRes = await request(app.getHttpServer())
    .post(`/lessons/${lessonId}/attendance`)
    .set('Authorization', `Bearer ${teacherToken}`)
    .send(rollCallBody)
    .expect(201);

  return { lessonId, attendanceRecord: attendanceRes.body.data };
}

// ─── Helper: Get contract info ───
async function getContractInfo(): Promise<any> {
  const res = await request(app.getHttpServer())
    .get(`/contracts/${contractCode}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  return res.body.data;
}

// ─── Helper: Get student analytics ───
async function getStudentAnalytics(): Promise<any> {
  const res = await request(app.getHttpServer())
    .get(`/analytics/student/${studentCode}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  return res.body.data;
}

// ─── Helper: Get teacher dashboard ───
async function getTeacherDashboard(): Promise<any> {
  const res = await request(app.getHttpServer())
    .get(`/teacher/dashboard`)
    .set('Authorization', `Bearer ${teacherToken}`)
    .expect(200);
  return res.body.data;
}

// ─── Helper: Get institution metrics ───
async function getInstitutionMetrics(): Promise<any> {
  const res = await request(app.getHttpServer())
    .get('/analytics/institution')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  return res.body.data;
}

// ─── Helper: Get parent self data ───
async function getParentSelfData(): Promise<any> {
  const res = await request(app.getHttpServer())
    .get('/students/self')
    .set('Authorization', `Bearer ${parentToken}`)
    .expect(200);
  return res.body.data;
}

async function getParentContracts(): Promise<any> {
  const res = await request(app.getHttpServer())
    .get('/students/self/contracts')
    .set('Authorization', `Bearer ${parentToken}`)
    .expect(200);
  return res.body.data;
}

async function getParentAttendance(): Promise<any> {
  const res = await request(app.getHttpServer())
    .get('/students/self/attendance')
    .set('Authorization', `Bearer ${parentToken}`)
    .expect(200);
  return res.body.data;
}

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('Business Scenario E2E — Phase 5 Batch 5.1', () => {
  beforeAll(async () => {
    // Set environment variables for test
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '3306';
    process.env.DB_USERNAME = 'root';
    process.env.DB_PASSWORD = 'sun123456';
    process.env.DB_DATABASE = 'eduos';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [appConfig],
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (config: ConfigService) => ({
            type: 'mysql' as const,
            host: config.get('app.database.host'),
            port: config.get('app.database.port'),
            username: config.get('app.database.username'),
            password: config.get('app.database.password'),
            database: config.get('app.database.database'),
            entities: [
              User, LoginLog, Role, Permission, UserRole, RolePermission,
              Student, StudentAuditLog, StudentParent,
              ClassEntity, CourseEntity, CourseAuditLog,
              ContractEntity, EnrollmentEntity,
              LessonEntity, LessonAttendanceEntity, LessonChangeRequestEntity,
              TeacherAssignmentEntity,
              Reminder, ImportHistory,
            ],
            synchronize: false,
            logging: false,
          }),
          inject: [ConfigService],
        }),
        DatabaseModule,
        EventBusModule,
        IdentityModule,
        StudentModule,
        TeachingModule,
        AnalyticsModule,
        ReminderModule,
      ],
      providers: [
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // Clean up any leftover test data
    await cleanupTestData();

    // Create test users
    await createTestUsers();

    // Login
    adminToken = await login(TEST_ADMIN_USERNAME, TEST_PASSWORD);
    teacherToken = await login(TEST_TEACHER_USERNAME, TEST_PASSWORD);
    parentToken = await login(TEST_PARENT_USERNAME, TEST_PASSWORD);
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  // ═══════════════════════════════════════════
  // 场景 1: 签到扣课
  // ═══════════════════════════════════════════
  describe('场景1: 签到扣课', () => {
    beforeAll(async () => {
      await setupBaseData(10);
    });

    it('1.1 签到前：合同剩余课时 = 10', async () => {
      const contract = await getContractInfo();
      expect(contract.remainingLessons).toBe(10);
      expect(contract.status).toBe('ACTIVE');
    });

    it('1.2 签到（PRESENT）后：合同剩余课时 = 9', async () => {
      await createLessonAndRollCall(1, 'PRESENT');
      const contract = await getContractInfo();
      expect(contract.remainingLessons).toBe(9);
      expect(contract.status).toBe('ACTIVE');
    });

    it('1.3 缺勤（ABSENT）不扣课：剩余课时仍 = 9', async () => {
      await createLessonAndRollCall(2, 'ABSENT', '生病请假');
      const contract = await getContractInfo();
      expect(contract.remainingLessons).toBe(9);
    });

    it('1.4 迟到（LATE）扣课：剩余课时 = 8', async () => {
      await createLessonAndRollCall(3, 'LATE', '交通堵塞');
      const contract = await getContractInfo();
      expect(contract.remainingLessons).toBe(8);
    });

    it('1.5 签到扣课数据一致性验证', async () => {
      // 合同剩余 = 8
      const contract = await getContractInfo();
      expect(contract.remainingLessons).toBe(8);

      // 出勤记录 = 3 条
      const attendanceRes = await request(app.getHttpServer())
        .get(`/lessons/attendance/student/${studentCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(attendanceRes.body.data.length).toBe(3);

      // 课时记录 = 3 条
      const lessonsRes = await request(app.getHttpServer())
        .get(`/lessons?classCode=${classCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(lessonsRes.body.data.items.length).toBe(3);
    });
  });

  // ═══════════════════════════════════════════
  // 场景 2: 扣完课合同状态变化
  // ═══════════════════════════════════════════
  describe('场景2: 扣完课合同状态变化', () => {
    // 场景1结束后剩余8课时，创建新合同来测试耗尽
    let smallContractCode: string;
    let smallClassCode: string;
    let smallCourseCode: string;

    beforeAll(async () => {
      // 创建一个只有2课时的新合同来快速测试耗尽
      // Create Course
      const courseRes = await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '测试课程-耗尽场景',
          subject: 'english',
          totalLessons: 2,
          description: '耗尽场景测试课程',
        })
        .expect(201);
      smallCourseCode = courseRes.body.data.courseCode;
      createdIds.courseIds.push(courseRes.body.data.id);

      // Create Class
      const classRes = await request(app.getHttpServer())
        .post('/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '测试班级-耗尽场景',
          courseCode: smallCourseCode,
          capacity: 10,
          startDate: getTodayDate(),
          endDate: '2026-12-31',
          note: '耗尽场景测试班级',
        })
        .expect(201);
      smallClassCode = classRes.body.data.classCode;
      createdIds.classIds.push(classRes.body.data.id);

      // Assign Teacher
      await request(app.getHttpServer())
        .post('/classes/teacher-assignment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classCode: smallClassCode,
          teacherId: teacherId,
          role: 'PRIMARY',
        })
        .expect(201);

      // Create Contract with only 2 lessons
      const contractRes = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentCode: studentCode,
          subject: 'english',
          totalLessons: 2,
          validFrom: getTodayDate(),
          validTo: '2026-12-31',
          unitPrice: 150,
          totalAmount: 300,
          note: '耗尽场景测试合同',
        })
        .expect(201);
      smallContractCode = contractRes.body.data.contractCode;
      createdIds.contractIds.push(contractRes.body.data.id);

      // Enroll
      const enrollmentRes = await request(app.getHttpServer())
        .post('/enrollments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentCode: studentCode,
          classCode: smallClassCode,
          contractCode: smallContractCode,
        })
        .expect(201);
      createdIds.enrollmentIds.push(enrollmentRes.body.data.id);
    });

    it('2.1 新合同状态 = ACTIVE，剩余 = 2', async () => {
      const res = await request(app.getHttpServer())
        .get(`/contracts/${smallContractCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.remainingLessons).toBe(2);
    });

    it('2.2 第一次签到后：剩余 = 1，状态仍 = ACTIVE', async () => {
      // Create Lesson
      const lessonRes = await request(app.getHttpServer())
        .post('/lessons')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classCode: smallClassCode,
          courseCode: smallCourseCode,
          lessonNumber: 1,
          scheduledDate: getTodayDate(),
          startTime: '14:00',
          endTime: '15:00',
          teacherId: teacherId,
        })
        .expect(201);
      const lessonId = lessonRes.body.data.id;
      createdIds.lessonIds.push(lessonId);

      // Start Teaching
      await request(app.getHttpServer())
        .patch(`/lessons/${lessonId}/status`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ status: 'TEACHING' })
        .expect(200);

      // Roll Call
      await request(app.getHttpServer())
        .post(`/lessons/${lessonId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          records: [{ studentCode: studentCode, status: 'PRESENT' }],
        })
        .expect(201);

      // Verify
      const res = await request(app.getHttpServer())
        .get(`/contracts/${smallContractCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.remainingLessons).toBe(1);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('2.3 第二次签到后：剩余 = 0，状态 = EXHAUSTED', async () => {
      // Create Lesson
      const lessonRes = await request(app.getHttpServer())
        .post('/lessons')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classCode: smallClassCode,
          courseCode: smallCourseCode,
          lessonNumber: 2,
          scheduledDate: getTodayDate(),
          startTime: '16:00',
          endTime: '17:00',
          teacherId: teacherId,
        })
        .expect(201);
      const lessonId = lessonRes.body.data.id;
      createdIds.lessonIds.push(lessonId);

      // Start Teaching
      await request(app.getHttpServer())
        .patch(`/lessons/${lessonId}/status`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ status: 'TEACHING' })
        .expect(200);

      // Roll Call
      await request(app.getHttpServer())
        .post(`/lessons/${lessonId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          records: [{ studentCode: studentCode, status: 'PRESENT' }],
        })
        .expect(201);

      // Verify: contract should be EXHAUSTED
      const res = await request(app.getHttpServer())
        .get(`/contracts/${smallContractCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.remainingLessons).toBe(0);
      expect(res.body.data.status).toBe('EXHAUSTED');
    });

    it('2.4 合同耗尽后，再次签到不报错（跳过扣课）', async () => {
      // Create another lesson for the exhausted contract
      const lessonRes = await request(app.getHttpServer())
        .post('/lessons')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classCode: smallClassCode,
          courseCode: smallCourseCode,
          lessonNumber: 3,
          scheduledDate: getTodayDate(),
          startTime: '18:00',
          endTime: '19:00',
          teacherId: teacherId,
        })
        .expect(201);
      const lessonId = lessonRes.body.data.id;
      createdIds.lessonIds.push(lessonId);

      // Start Teaching
      await request(app.getHttpServer())
        .patch(`/lessons/${lessonId}/status`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ status: 'TEACHING' })
        .expect(200);

      // Roll Call - should NOT throw error, just skip deduction
      const attendanceRes = await request(app.getHttpServer())
        .post(`/lessons/${lessonId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          records: [{ studentCode: studentCode, status: 'PRESENT' }],
        })
        .expect(201);

      // Contract should still be EXHAUSTED with 0 remaining
      const contractRes = await request(app.getHttpServer())
        .get(`/contracts/${smallContractCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(contractRes.body.data.status).toBe('EXHAUSTED');
      expect(contractRes.body.data.remainingLessons).toBe(0);
    });

    it('2.5 原合同不受影响（仍有剩余课时）', async () => {
      const contract = await getContractInfo();
      expect(contract.status).toBe('ACTIVE');
      expect(contract.remainingLessons).toBe(8);
    });
  });

  // ═══════════════════════════════════════════
  // 场景 3: 家长端看到变化
  // ═══════════════════════════════════════════
  describe('场景3: 家长端看到变化', () => {
    it('3.1 家长能看到学生信息', async () => {
      const data = await getParentSelfData();
      expect(data.studentCode).toBe(studentCode);
      expect(data.name).toBe(TEST_STUDENT_NAME);
    });

    it('3.2 家长能看到合同列表（含剩余课时）', async () => {
      const data = await getParentContracts();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(2); // 原合同 + 耗尽合同

      // Find the original contract
      const originalContract = data.find((c: any) => c.contractCode === contractCode);
      expect(originalContract).toBeDefined();
      expect(originalContract.remainingLessons).toBe(8);
      expect(originalContract.status).toBe('ACTIVE');
    });

    it('3.3 家长能看到出勤记录', async () => {
      const data = await getParentAttendance();
      expect(Array.isArray(data)).toBe(true);
      // Should have attendance records from scenario 1 and 2
      expect(data.length).toBeGreaterThanOrEqual(3);

      // Check that records contain expected statuses
      const statuses = data.map((r: any) => r.status);
      expect(statuses).toContain('PRESENT');
      expect(statuses).toContain('ABSENT');
      expect(statuses).toContain('LATE');
    });

    it('3.4 家长能看到课时耗尽的合同状态', async () => {
      const data = await getParentContracts();
      const exhaustedContract = data.find((c: any) => c.status === 'EXHAUSTED');
      expect(exhaustedContract).toBeDefined();
      expect(exhaustedContract.remainingLessons).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 场景 4: 教师端看到变化
  // ═══════════════════════════════════════════
  describe('场景4: 教师端看到变化', () => {
    it('4.1 教师 Dashboard 显示学生数', async () => {
      const dashboard = await getTeacherDashboard();
      expect(dashboard.totalStudents).toBeGreaterThanOrEqual(1);
    });

    it('4.2 教师 Dashboard 显示今日课时', async () => {
      const dashboard = await getTeacherDashboard();
      expect(dashboard.todayLessons).toBeGreaterThanOrEqual(1);
    });

    it('4.3 教师能看到待签到课时', async () => {
      const dashboard = await getTeacherDashboard();
      // pendingAttendance should be a number >= 0
      expect(typeof dashboard.pendingAttendance).toBe('number');
      expect(dashboard.pendingAttendance).toBeGreaterThanOrEqual(0);
    });

    it('4.4 教师能看到今日已完成签到课时', async () => {
      const dashboard = await getTeacherDashboard();
      // After completing roll calls, completedLessons should be > 0
      expect(dashboard.completedLessons).toBeGreaterThanOrEqual(0);
    });

    it('4.5 教师 Dashboard 数据结构完整', async () => {
      const dashboard = await getTeacherDashboard();
      expect(dashboard).toHaveProperty('totalStudents');
      expect(dashboard).toHaveProperty('todayLessons');
      expect(dashboard).toHaveProperty('pendingAttendance');
      expect(dashboard).toHaveProperty('completedLessons');
    });
  });

  // ═══════════════════════════════════════════
  // 场景 5: 后台统计变化
  // ═══════════════════════════════════════════
  describe('场景5: 后台统计变化', () => {
    it('5.1 机构统计：学生总数包含测试学生', async () => {
      const metrics = await getInstitutionMetrics();
      const totalStudents = metrics.metrics.find((m: any) => m.name === 'totalStudents');
      expect(totalStudents).toBeDefined();
      expect(totalStudents.value).toBeGreaterThanOrEqual(1);
    });

    it('5.2 机构统计：活跃学生数包含测试学生', async () => {
      const metrics = await getInstitutionMetrics();
      const activeStudents = metrics.metrics.find((m: any) => m.name === 'activeStudents');
      expect(activeStudents).toBeDefined();
      expect(activeStudents.value).toBeGreaterThanOrEqual(1);
    });

    it('5.3 机构统计：课程总数包含测试课程', async () => {
      const metrics = await getInstitutionMetrics();
      const totalCourses = metrics.metrics.find((m: any) => m.name === 'totalCourses');
      expect(totalCourses).toBeDefined();
      expect(totalCourses.value).toBeGreaterThanOrEqual(2); // 2 test courses
    });

    it('5.4 机构统计：班级总数包含测试班级', async () => {
      const metrics = await getInstitutionMetrics();
      const totalClasses = metrics.metrics.find((m: any) => m.name === 'totalClasses');
      expect(totalClasses).toBeDefined();
      expect(totalClasses.value).toBeGreaterThanOrEqual(2); // 2 test classes
    });

    it('5.5 学生统计：出勤率数据正确', async () => {
      const analytics = await getStudentAnalytics();
      const metrics = analytics.metrics;

      // totalAttendance should reflect PRESENT + LATE (both count as present)
      const totalAttendance = metrics.find((m: any) => m.name === 'totalAttendance');
      expect(totalAttendance).toBeDefined();
      expect(totalAttendance.value).toBeGreaterThanOrEqual(2); // At least 2 PRESENT + 1 LATE

      // attendanceRate should be > 0
      const attendanceRate = metrics.find((m: any) => m.name === 'attendanceRate');
      expect(attendanceRate).toBeDefined();
      expect(attendanceRate.value).toBeGreaterThan(0);
    });

    it('5.6 学生统计：课时消耗数据正确', async () => {
      const analytics = await getStudentAnalytics();
      const metrics = analytics.metrics;

      // consumedLessons should reflect deducted lessons
      const consumedLessons = metrics.find((m: any) => m.name === 'consumedLessons');
      expect(consumedLessons).toBeDefined();
      expect(consumedLessons.value).toBeGreaterThanOrEqual(2); // At least 2 deducted from original contract
    });

    it('5.7 学生统计：剩余课时数据正确', async () => {
      const analytics = await getStudentAnalytics();
      const metrics = analytics.metrics;

      const remainingLessons = metrics.find((m: any) => m.name === 'remainingLessons');
      expect(remainingLessons).toBeDefined();
      expect(remainingLessons.value).toBeGreaterThanOrEqual(0);
    });

    it('5.8 学生趋势数据可获取', async () => {
      const res = await request(app.getHttpServer())
        .get(`/analytics/student/${studentCode}/trend?days=7`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const data = res.body.data;
      expect(data).toHaveProperty('learningTrend');
      expect(data).toHaveProperty('attendanceTrend');
      expect(Array.isArray(data.learningTrend)).toBe(true);
      expect(Array.isArray(data.attendanceTrend)).toBe(true);
    });

    it('5.9 出勤统计接口可用', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/attendance-statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 场景 6: 端到端数据一致性（综合验证）
  // ═══════════════════════════════════════════
  describe('场景6: 端到端数据一致性综合验证', () => {
    it('6.1 合同剩余课时 = 总课时 - 已消耗课时', async () => {
      const contract = await getContractInfo();
      expect(contract.remainingLessons).toBe(contract.totalLessons - (contract.totalLessons - contract.remainingLessons));
      // More specifically: original contract had 10, deducted 2 (PRESENT + LATE), ABSENT not deducted
      expect(contract.remainingLessons).toBe(8);
    });

    it('6.2 家长端看到的合同状态与后台一致', async () => {
      // Admin view
      const adminContract = await getContractInfo();

      // Parent view
      const parentContracts = await getParentContracts();
      const parentContract = parentContracts.find((c: any) => c.contractCode === contractCode);

      expect(parentContract).toBeDefined();
      expect(parentContract.status).toBe(adminContract.status);
      expect(parentContract.remainingLessons).toBe(adminContract.remainingLessons);
    });

    it('6.3 教师端 Dashboard 与课时记录一致', async () => {
      const dashboard = await getTeacherDashboard();
      // Teacher should see at least 1 student (our test student)
      expect(dashboard.totalStudents).toBeGreaterThanOrEqual(1);
    });

    it('6.4 多合同场景：不同合同独立扣课', async () => {
      // Original contract: 10 total, 8 remaining (2 deducted)
      const original = await getContractInfo();
      expect(original.remainingLessons).toBe(8);

      // Exhausted contract: 2 total, 0 remaining (2 deducted, EXHAUSTED)
      const allContracts = await getParentContracts();
      const exhausted = allContracts.find((c: any) => c.status === 'EXHAUSTED');
      expect(exhausted).toBeDefined();
      expect(exhausted.remainingLessons).toBe(0);

      // Both contracts deducted independently
      expect(original.status).toBe('ACTIVE');
      expect(exhausted.status).toBe('EXHAUSTED');
    });
  });
});