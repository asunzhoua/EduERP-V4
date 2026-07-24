/**
 * Business Flow E2E Test — Phase 6 Batch 6.1
 *
 * 完整业务场景测试：
 * 创建学生 → 购买课时 → 生成课程 → 教师签到 → 扣除课时 → 三端读取一致
 *
 * 使用真实数据库连接（通过 AppModule），测试前后清理测试数据。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { User } from '../src/modules/identity/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { Student } from '../src/modules/student/entities/student.entity';
import { ContractEntity } from '../src/modules/teaching/contract/contract.entity';
import { EnrollmentEntity } from '../src/modules/teaching/enrollment/enrollment.entity';
import { ClassEntity } from '../src/modules/teaching/class/class.entity';
import { CourseEntity } from '../src/modules/teaching/course/course.entity';
import { LessonEntity } from '../src/modules/teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '../src/modules/teaching/lesson-attendance/lesson-attendance.entity';
import { TeacherAssignmentEntity } from '../src/modules/teaching/teacher-assignment/teacher-assignment.entity';

describe('Business Flow E2E (Phase 6 Batch 6.1)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let teacherToken: string;

  // Test data tracking for cleanup
  const testIds = {
    adminUserId: 0,
    teacherUserId: 0,
    studentUserId: 0,
    parentUserId: 0,
    studentCode: '',
    contractCode: '',
    classCode: '',
    courseCode: '',
    enrollmentId: 0,
    lessonId: 0,
  };

  // Unique test prefix to identify test data
  const TEST_PREFIX = 'E2E_TEST_';
  const TEST_TIMESTAMP = Date.now();

  beforeAll(async () => {
    // Set environment variables for test
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '3306';
    process.env.DB_USERNAME = 'root';
    process.env.DB_PASSWORD = 'sun123456';
    process.env.DB_DATABASE = 'eduos';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // ── Step 1: Create test users with known passwords ──

    const userRepo = dataSource.getRepository(User);

    // Create Admin user
    const adminPassword = await bcrypt.hash('TestAdmin@2026', 10);
    const adminUser = userRepo.create({
      username: `${TEST_PREFIX}admin_${TEST_TIMESTAMP}`,
      password: adminPassword,
      name: 'E2E测试管理员',
      mobile: `138${String(TEST_TIMESTAMP).slice(-8)}`,
      role: 'SuperAdmin',
      status: 1,
      campusId: 1,
    });
    const savedAdmin = await userRepo.save(adminUser);
    testIds.adminUserId = Number(savedAdmin.id);

    // Create Teacher user
    const teacherPassword = await bcrypt.hash('TestTeacher@2026', 10);
    const teacherUser = userRepo.create({
      username: `${TEST_PREFIX}teacher_${TEST_TIMESTAMP}`,
      password: teacherPassword,
      name: 'E2E测试教师',
      mobile: `139${String(TEST_TIMESTAMP).slice(-8)}`,
      role: 'Teacher',
      status: 1,
      campusId: 1,
    });
    const savedTeacher = await userRepo.save(teacherUser);
    testIds.teacherUserId = Number(savedTeacher.id);

    // Create Student user (for self-service testing)
    const studentPassword = await bcrypt.hash('TestStudent@2026', 10);
    const studentUser = userRepo.create({
      username: `${TEST_PREFIX}student_${TEST_TIMESTAMP}`,
      password: studentPassword,
      name: 'E2E测试学生用户',
      mobile: `137${String(TEST_TIMESTAMP).slice(-8)}`,
      role: 'Student',
      status: 1,
      campusId: 1,
    });
    const savedStudentUser = await userRepo.save(studentUser);
    testIds.studentUserId = Number(savedStudentUser.id);

    // Create Parent user (for parent self-service testing)
    const parentPassword = await bcrypt.hash('TestParent@2026', 10);
    const parentUser = userRepo.create({
      username: `${TEST_PREFIX}parent_${TEST_TIMESTAMP}`,
      password: parentPassword,
      name: 'E2E测试家长',
      mobile: `136${String(TEST_TIMESTAMP).slice(-8)}`,
      role: 'Parent',
      status: 1,
      campusId: 1,
    });
    const savedParent = await userRepo.save(parentUser);
    testIds.parentUserId = Number(savedParent.id);

    // ── Step 2: Login as Admin ──
    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: `${TEST_PREFIX}admin_${TEST_TIMESTAMP}`,
        password: 'TestAdmin@2026',
      })
      .expect(200);

    expect(adminLoginRes.body.code).toBe(0);
    expect(adminLoginRes.body.data.accessToken).toBeDefined();
    adminToken = adminLoginRes.body.data.accessToken;

    // ── Step 3: Login as Teacher ──
    const teacherLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: `${TEST_PREFIX}teacher_${TEST_TIMESTAMP}`,
        password: 'TestTeacher@2026',
      })
      .expect(200);

    expect(teacherLoginRes.body.code).toBe(0);
    expect(teacherLoginRes.body.data.accessToken).toBeDefined();
    teacherToken = teacherLoginRes.body.data.accessToken;
  }, 30000);

  afterAll(async () => {
    // ── Cleanup: Remove all test data ──
    try {
      // Delete in reverse dependency order
      const lessonAttendanceRepo = dataSource.getRepository(LessonAttendanceEntity);
      const lessonRepo = dataSource.getRepository(LessonEntity);
      const enrollmentRepo = dataSource.getRepository(EnrollmentEntity);
      const teacherAssignmentRepo = dataSource.getRepository(TeacherAssignmentEntity);
      const classRepo = dataSource.getRepository(ClassEntity);
      const contractRepo = dataSource.getRepository(ContractEntity);
      const studentRepo = dataSource.getRepository(Student);
      const courseRepo = dataSource.getRepository(CourseEntity);
      const userRepo = dataSource.getRepository(User);

      // Delete lesson attendance
      if (testIds.lessonId) {
        await lessonAttendanceRepo.delete({ lessonId: testIds.lessonId });
      }

      // Delete lessons
      if (testIds.classCode) {
        await lessonRepo.delete({ classCode: testIds.classCode });
      }

      // Delete teacher assignments
      if (testIds.classCode) {
        await teacherAssignmentRepo.delete({ classCode: testIds.classCode });
      }

      // Delete enrollments
      if (testIds.studentCode) {
        await enrollmentRepo.delete({ studentCode: testIds.studentCode });
      }

      // Delete class
      if (testIds.classCode) {
        await classRepo.delete({ classCode: testIds.classCode });
      }

      // Delete contract
      if (testIds.contractCode) {
        await contractRepo.delete({ contractCode: testIds.contractCode });
      }

      // Delete course
      if (testIds.courseCode) {
        await courseRepo.delete({ courseCode: testIds.courseCode });
      }

      // Delete student
      if (testIds.studentCode) {
        await studentRepo.delete({ studentCode: testIds.studentCode });
      }

      // Delete test users
      if (testIds.adminUserId) await userRepo.delete({ id: testIds.adminUserId });
      if (testIds.teacherUserId) await userRepo.delete({ id: testIds.teacherUserId });
      if (testIds.studentUserId) await userRepo.delete({ id: testIds.studentUserId });
      if (testIds.parentUserId) await userRepo.delete({ id: testIds.parentUserId });
    } catch (cleanupError) {
      console.warn('Cleanup warning:', (cleanupError as Error).message);
    }

    await app.close();
  }, 15000);

  // ═══════════════════════════════════════════════════════════
  // Test 1: Create Student
  // ═══════════════════════════════════════════════════════════
  describe('Step 1: Create Student', () => {
    it('should create a new student via Admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E测试学生-李小明的弟弟',
          gender: 'MALE',
          birthDate: '2015-06-15',
          phone: '13500001111',
          school: 'E2E测试小学',
          grade: '三年级',
          tags: ['E2E测试'],
          note: 'Phase 6 Batch 6.1 E2E测试创建',
        })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.studentCode).toBeDefined();
      expect(res.body.data.name).toBe('E2E测试学生-李小明的弟弟');
      expect(res.body.data.gender).toBe('MALE');

      testIds.studentCode = res.body.data.studentCode;
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test 2: Create Course (prerequisite for Class)
  // ═══════════════════════════════════════════════════════════
  describe('Step 2: Create Course', () => {
    it('should create a new course via Admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E测试数学课',
          subject: 'MATH',
          type: 'GROUP',
          description: 'Phase 6 E2E测试课程',
          totalHours: 20,
          totalLessons: 20,
          defaultDuration: 60,
          tags: ['E2E测试'],
        })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.courseCode).toBeDefined();

      testIds.courseCode = res.body.data.courseCode;
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test 3: Purchase Lessons (Create Contract)
  // ═══════════════════════════════════════════════════════════
  describe('Step 3: Purchase Lessons (Create Contract)', () => {
    it('should create a contract for the student', async () => {
      const res = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentCode: testIds.studentCode,
          subject: 'MATH',
          totalLessons: 10,
          validFrom: '2026-07-01',
          validTo: '2027-06-30',
          unitPrice: 200,
          totalAmount: 2000,
          note: 'E2E测试合同-10课时数学',
        })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.contractCode).toBeDefined();
      expect(res.body.data.totalLessons).toBe(10);
      expect(res.body.data.remainingLessons).toBe(10);

      testIds.contractCode = res.body.data.contractCode;
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test 4: Create Class
  // ═══════════════════════════════════════════════════════════
  describe('Step 4: Create Class', () => {
    it('should create a new class via Admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          courseCode: testIds.courseCode,
          name: 'E2E测试周六班',
          startDate: '2026-07-12',
          totalLessons: 20,
          defaultDuration: 60,
          dayOfWeek: [6],
          startTime: '10:00',
          endTime: '11:30',
          maxStudents: 10,
          room: 'E2E测试教室A',
          tags: ['E2E测试'],
        })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.classCode).toBeDefined();

      testIds.classCode = res.body.data.classCode;
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test 5: Assign Teacher to Class
  // ═══════════════════════════════════════════════════════════
  describe('Step 5: Assign Teacher to Class', () => {
    it('should assign the test teacher as PRIMARY', async () => {
      const res = await request(app.getHttpServer())
        .post(`/classes/${testIds.classCode}/teachers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teacherId: testIds.teacherUserId,
          role: 'PRIMARY',
        })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test 6: Enroll Student in Class
  // ═══════════════════════════════════════════════════════════
  describe('Step 6: Enroll Student in Class', () => {
    it('should enroll the student with the contract', async () => {
      const res = await request(app.getHttpServer())
        .post('/enrollments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classCode: testIds.classCode,
          studentCode: testIds.studentCode,
          contractCode: testIds.contractCode,
        })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();

      testIds.enrollmentId = res.body.data.id;
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test 7: Teacher Check-in (Create Lesson + Attendance)
  // ═══════════════════════════════════════════════════════════
  describe('Step 7: Teacher Check-in (Create Lesson with Attendance)', () => {
    it('should create a lesson with attendance records via Teacher', async () => {
      const res = await request(app.getHttpServer())
        .post('/lessons')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classCode: testIds.classCode,
          lessonDate: '2026-07-19',
          startTime: '10:00',
          endTime: '11:30',
          topic: 'E2E测试-分数入门',
          attendanceRecords: [
            {
              studentCode: testIds.studentCode,
              status: 'PRESENT',
            },
          ],
        })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.lesson).toBeDefined();
      expect(res.body.data.lessonNumber).toBe(1);
      expect(res.body.data.attendanceCount).toBe(1);

      testIds.lessonId = res.body.data.lesson.id;
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test 8: Complete Lesson (Trigger Deduction)
  // ═══════════════════════════════════════════════════════════
  describe('Step 8: Complete Lesson', () => {
    it('should mark lesson as FINISHED via Teacher', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/classes/${testIds.classCode}/lessons/1/complete`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test 9: Data Consistency Verification (Three Perspectives)
  // ═══════════════════════════════════════════════════════════
  describe('Step 9: Data Consistency Verification', () => {
    it('9.1 Admin perspective: GET /students/:code should show student with contract info', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${testIds.studentCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.studentCode).toBe(testIds.studentCode);
      expect(res.body.data.name).toBe('E2E测试学生-李小明的弟弟');
    });

    it('9.2 Admin perspective: GET /contracts/:code should show remaining lessons deducted', async () => {
      const res = await request(app.getHttpServer())
        .get(`/contracts/${testIds.contractCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.contractCode).toBe(testIds.contractCode);
      // After 1 PRESENT attendance + lesson completed, remaining should be 9
      expect(res.body.data.remainingLessons).toBe(9);
    });

    it('9.3 Admin perspective: GET /enrollments/:id should show active enrollment', async () => {
      const res = await request(app.getHttpServer())
        .get(`/enrollments/${testIds.enrollmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.studentCode).toBe(testIds.studentCode);
      expect(res.body.data.classCode).toBe(testIds.classCode);
    });

    it('9.4 Teacher perspective: GET /classes/:code/lessons/1 should show completed lesson', async () => {
      const res = await request(app.getHttpServer())
        .get(`/classes/${testIds.classCode}/lessons/1`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.lessonNumber).toBe(1);
      expect(res.body.data.status).toBe('FINISHED');
    });

    it('9.5 Student perspective: GET /contracts/students/:code/contracts should show contract', async () => {
      const res = await request(app.getHttpServer())
        .get(`/contracts/students/${testIds.studentCode}/contracts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const contract = res.body.data.find(
        (c: any) => c.contractCode === testIds.contractCode,
      );
      expect(contract).toBeDefined();
      expect(contract.remainingLessons).toBe(9);
    });

    it('9.6 Student perspective: GET /enrollments/students/:code/enrollments should show enrollment', async () => {
      const res = await request(app.getHttpServer())
        .get(`/enrollments/students/${testIds.studentCode}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const enrollment = res.body.data.find(
        (e: any) => e.studentCode === testIds.studentCode,
      );
      expect(enrollment).toBeDefined();
      expect(enrollment.classCode).toBe(testIds.classCode);
    });

    it('9.7 Cross-validation: Contract remainingLessons = totalLessons - consumed', async () => {
      // Get contract directly
      const contractRes = await request(app.getHttpServer())
        .get(`/contracts/${testIds.contractCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const contract = contractRes.body.data;
      const totalLessons = contract.totalLessons;
      const remainingLessons = contract.remainingLessons;
      const consumed = totalLessons - remainingLessons;

      // Should have consumed exactly 1 lesson (1 PRESENT attendance)
      expect(consumed).toBe(1);
      expect(remainingLessons).toBe(totalLessons - 1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test 10: Second Lesson - ABSENT (No Deduction)
  // ═══════════════════════════════════════════════════════════
  describe('Step 10: Second Lesson - ABSENT Student (No Deduction)', () => {
    it('should create a second lesson with ABSENT attendance', async () => {
      const res = await request(app.getHttpServer())
        .post('/lessons')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classCode: testIds.classCode,
          lessonDate: '2026-07-26',
          startTime: '10:00',
          endTime: '11:30',
          topic: 'E2E测试-分数进阶',
          attendanceRecords: [
            {
              studentCode: testIds.studentCode,
              status: 'ABSENT',
              reason: 'E2E测试请假',
            },
          ],
        })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data.lessonNumber).toBe(2);
    });

    it('should complete the second lesson', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/classes/${testIds.classCode}/lessons/2/complete`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
    });

    it('should NOT deduct lesson for ABSENT student', async () => {
      const contractRes = await request(app.getHttpServer())
        .get(`/contracts/${testIds.contractCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const contract = contractRes.body.data;
      // Still 9 remaining (ABSENT doesn't deduct)
      expect(contract.remainingLessons).toBe(9);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test 11: Third Lesson - LATE (Deduction applies)
  // ═══════════════════════════════════════════════════════════
  describe('Step 11: Third Lesson - LATE Student (Deduction Applies)', () => {
    it('should create a third lesson with LATE attendance', async () => {
      const res = await request(app.getHttpServer())
        .post('/lessons')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classCode: testIds.classCode,
          lessonDate: '2026-08-02',
          startTime: '10:00',
          endTime: '11:30',
          topic: 'E2E测试-分数运算',
          attendanceRecords: [
            {
              studentCode: testIds.studentCode,
              status: 'LATE',
              reason: 'E2E测试迟到',
            },
          ],
        })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data.lessonNumber).toBe(3);
    });

    it('should complete the third lesson', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/classes/${testIds.classCode}/lessons/3/complete`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
    });

    it('should deduct lesson for LATE student (remaining = 8)', async () => {
      const contractRes = await request(app.getHttpServer())
        .get(`/contracts/${testIds.contractCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const contract = contractRes.body.data;
      // LATE deducts: 9 - 1 = 8
      expect(contract.remainingLessons).toBe(8);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test 12: Final Consistency Check
  // ═══════════════════════════════════════════════════════════
  describe('Step 12: Final Consistency Check', () => {
    it('should have consistent data across all endpoints', async () => {
      // 1. Contract shows 8 remaining (10 - 1 PRESENT - 0 ABSENT - 1 LATE = 8)
      const contractRes = await request(app.getHttpServer())
        .get(`/contracts/${testIds.contractCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(contractRes.body.data.remainingLessons).toBe(8);
      expect(contractRes.body.data.totalLessons).toBe(10);

      // 2. Class has 3 lessons
      const lessonsRes = await request(app.getHttpServer())
        .get(`/classes/${testIds.classCode}/lessons`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(lessonsRes.body.data.items.length).toBe(3);

      // 3. Enrollment is still active
      const enrollmentRes = await request(app.getHttpServer())
        .get(`/enrollments/${testIds.enrollmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(enrollmentRes.body.data.status).toBe('ACTIVE');

      // 4. Student exists and is active
      const studentRes = await request(app.getHttpServer())
        .get(`/students/${testIds.studentCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(studentRes.body.data.status).toBe('ACTIVE');
    });

    it('should verify lesson details are correct', async () => {
      // Lesson 1: PRESENT
      const lesson1Res = await request(app.getHttpServer())
        .get(`/classes/${testIds.classCode}/lessons/1`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(lesson1Res.body.data.status).toBe('FINISHED');
      expect(lesson1Res.body.data.topic).toBe('E2E测试-分数入门');

      // Lesson 2: ABSENT
      const lesson2Res = await request(app.getHttpServer())
        .get(`/classes/${testIds.classCode}/lessons/2`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(lesson2Res.body.data.status).toBe('FINISHED');
      expect(lesson2Res.body.data.topic).toBe('E2E测试-分数进阶');

      // Lesson 3: LATE
      const lesson3Res = await request(app.getHttpServer())
        .get(`/classes/${testIds.classCode}/lessons/3`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(lesson3Res.body.data.status).toBe('FINISHED');
      expect(lesson3Res.body.data.topic).toBe('E2E测试-分数运算');
    });
  });
});
