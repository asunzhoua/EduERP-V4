import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../modules/identity/entities/user.entity';
import { Role } from '../../modules/identity/entities/role.entity';
import { Permission } from '../../modules/identity/entities/permission.entity';
import { UserRole } from '../../modules/identity/entities/user-role.entity';
import { RolePermission } from '../../modules/identity/entities/role-permission.entity';
import { AppLogger } from '@utils/logger';
import { ClassEntity } from '../../modules/teaching/class/class.entity';
import { ClassStatus } from '../../modules/teaching/class/enums/class-status.enum';
import { Student } from '../../modules/student/entities/student.entity';
import { Gender } from '../../modules/student/enums/gender.enum';
import { StudentStatus } from '../../modules/student/enums/student-status.enum';
import { CreatedSource } from '../../common/enums/created-source.enum';
import { ContractEntity } from '../../modules/teaching/contract/contract.entity';
import { ContractStatus } from '../../modules/teaching/contract/enums/contract-status.enum';
import { Subject } from '../../common/enums/subject.enum';
import { EnrollmentEntity } from '../../modules/teaching/enrollment/enrollment.entity';
import { EnrollmentStatus } from '../../common/enums/enrollment-status.enum';
import { TeacherAssignmentEntity } from '../../modules/teaching/teacher-assignment/teacher-assignment.entity';
import { TeacherRole } from '../../common/enums/teacher-role.enum';
import { CourseEntity } from '../../modules/teaching/course/course.entity';
import { CourseStatus } from '../../modules/teaching/course/enums/course-status.enum';
import { CourseType } from '../../modules/teaching/course/enums/course-type.enum';
import { LessonEntity } from '../../modules/teaching/lesson/lesson.entity';
import { LessonStatus } from '../../modules/teaching/lesson/enums/lesson-status.enum';
import { LessonAttendanceEntity } from '../../modules/teaching/lesson-attendance/lesson-attendance.entity';
import { AttendanceStatus } from '../../modules/teaching/lesson-attendance/enums/attendance-status.enum';
import { AttendanceWorkflowState } from '../../modules/teaching/lesson-attendance/enums/attendance-workflow-state.enum';
import { AttendanceSource } from '../../modules/teaching/lesson-attendance/enums/attendance-source.enum';


@Injectable()
export class SeedService {
  private logger = new AppLogger();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(ClassEntity)
    private classEntityRepository: Repository<ClassEntity>,
    @InjectRepository(Student)
    private studentEntityRepository: Repository<Student>,
    @InjectRepository(ContractEntity)
    private contractEntityRepository: Repository<ContractEntity>,
    @InjectRepository(EnrollmentEntity)
    private enrollmentEntityRepository: Repository<EnrollmentEntity>,
    @InjectRepository(TeacherAssignmentEntity)
    private teacherAssignmentEntityRepository: Repository<TeacherAssignmentEntity>,
    @InjectRepository(CourseEntity)
    private courseEntityRepository: Repository<CourseEntity>,
    @InjectRepository(LessonEntity)
    private lessonEntityRepository: Repository<LessonEntity>,
    @InjectRepository(LessonAttendanceEntity)
    private lessonAttendanceEntityRepository: Repository<LessonAttendanceEntity>,

  ) {}

  async seed() {
    await this.seedRoles();
    await this.seedPermissions();
    await this.seedAdminUser();
    await this.seedTestUsers();
    await this.seedTestClasses();
    await this.seedTestStudents();
    await this.seedTestContracts();
    await this.seedTestCourses();
    await this.seedTestEnrollments();
    await this.seedTestLessons();
    await this.seedTestAttendance();
    await this.seedTestTeacherAssignments();
    this.logger.log('Seed data initialization complete', 'Seed');
  }

  private async seedRoles() {
    const roles = ['SuperAdmin', 'Admin', 'Teacher', 'Parent', 'Student'];
    for (const name of roles) {
      const exists = await this.roleRepository.findOne({ where: { name } });
      if (!exists) {
        await this.roleRepository.save({ name, description: `${name} role` });
        this.logger.log(`Role created: ${name}`, 'Seed');
      }
    }
  }

  private async seedPermissions() {
    const permissions = [
      { code: 'user:read', name: '查看用户', module: 'user', action: 'read' },
      { code: 'user:create', name: '创建用户', module: 'user', action: 'create' },
      { code: 'user:update', name: '修改用户', module: 'user', action: 'update' },
      { code: 'student:read', name: '查看学生', module: 'student', action: 'read' },
      { code: 'student:create', name: '创建学生', module: 'student', action: 'create' },
      { code: 'student:update', name: '修改学生', module: 'student', action: 'update' },
      { code: 'lesson:read', name: '查看课程', module: 'lesson', action: 'read' },
      { code: 'lesson:checkin', name: '签到', module: 'lesson', action: 'checkin' },
      { code: 'salary:read', name: '查看工资', module: 'salary', action: 'read' },
      { code: 'finance:read', name: '查看财务', module: 'finance', action: 'read' },
      { code: 'dashboard:read', name: '查看仪表盘', module: 'dashboard', action: 'read' },
      { code: 'system:config', name: '系统配置', module: 'system', action: 'config' },
    ];

    for (const perm of permissions) {
      const exists = await this.permissionRepository.findOne({ where: { code: perm.code } });
      if (!exists) {
        await this.permissionRepository.save(perm);
        this.logger.log(`Permission created: ${perm.code}`, 'Seed');
      }
    }
  }

  private async seedAdminUser() {
    const adminUsername = 'admin';
    const exists = await this.userRepository.findOne({ where: { username: adminUsername } });
    if (exists) {
      this.logger.log('Admin user already exists, skipping', 'Seed');
      return;
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      this.logger.error('ADMIN_PASSWORD environment variable is required for seeding');
      throw new Error('ADMIN_PASSWORD must be set in environment variables');
    }
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = this.userRepository.create({
      username: adminUsername,
      password: hashedPassword,
      name: '系统管理员',
      mobile: '13800000000',
      role: 'SuperAdmin',
      status: 1,
      campusId: 1,
    });
    const savedAdmin = await this.userRepository.save(admin);

    const superAdminRole = await this.roleRepository.findOne({ where: { name: 'SuperAdmin' } });
    if (superAdminRole) {
      await this.userRoleRepository.save({
        userId: savedAdmin.id,
        roleId: superAdminRole.id,
      });
    }

    this.logger.log('Admin user created (username: admin)', 'Seed');
  }

  private async seedTestUsers() {
    let savedTeacher: User | null = null;
    let savedStudent: User | null = null;
    let savedParent: User | null = null;

    // 1. Teacher 用户 — 用于测试课时录入流程
    const existingTeacher = await this.userRepository.findOne({ where: { username: 'teacher1' } });
    if (existingTeacher) {
      this.logger.log('Teacher user already exists, skipping', 'Seed');
      savedTeacher = existingTeacher;
    } else {
      const teacherPassword = await bcrypt.hash('teacher123', 10);
      const teacher = this.userRepository.create({
        username: 'teacher1',
        password: teacherPassword,
        name: '张老师',
        mobile: '13900000001',
        role: 'Teacher',
        status: 1,
        campusId: 1,
      });
      savedTeacher = await this.userRepository.save(teacher);
      const teacherRole = await this.roleRepository.findOne({ where: { name: 'Teacher' } });
      if (teacherRole) {
        await this.userRoleRepository.save({ userId: savedTeacher.id, roleId: teacherRole.id });
      }
      this.logger.log('Teacher user created: teacher1', 'Seed');
    }

    // 2. Student 用户 — 用于测试课时查询
    const existingStudent = await this.userRepository.findOne({ where: { username: 'student1' } });
    if (existingStudent) {
      this.logger.log('Student user already exists, skipping', 'Seed');
      savedStudent = existingStudent;
    } else {
      const studentPassword = await bcrypt.hash('student123', 10);
      const student = this.userRepository.create({
        username: 'student1',
        password: studentPassword,
        name: '李小华',
        mobile: '13900000002',
        role: 'Student',
        status: 1,
        campusId: 1,
      });
      savedStudent = await this.userRepository.save(student);
      const studentRole = await this.roleRepository.findOne({ where: { name: 'Student' } });
      if (studentRole) {
        await this.userRoleRepository.save({ userId: savedStudent.id, roleId: studentRole.id });
      }
      this.logger.log('Student user created: student1', 'Seed');
    }

    // 3. Parent 用户 — 用于测试家长查询
    const existingParent = await this.userRepository.findOne({ where: { username: 'parent1' } });
    if (existingParent) {
      this.logger.log('Parent user already exists, skipping', 'Seed');
      savedParent = existingParent;
    } else {
      const parentPassword = await bcrypt.hash('parent123', 10);
      const parent = this.userRepository.create({
        username: 'parent1',
        password: parentPassword,
        name: '李建国',
        mobile: '13900000003',
        role: 'Parent',
        status: 1,
        campusId: 1,
      });
      savedParent = await this.userRepository.save(parent);
      const parentRole = await this.roleRepository.findOne({ where: { name: 'Parent' } });
      if (parentRole) {
        await this.userRoleRepository.save({ userId: savedParent.id, roleId: parentRole.id });
      }
      this.logger.log('Parent user created: parent1', 'Seed');
    }

    this.logger.log('Test users ready (teacher1/teacher123, student1/student123, parent1/parent123)', 'Seed');
  }

  /** 创建测试班级 — 2 个 ACTIVE 班级 */
  private async seedTestClasses() {
    const admin = await this.userRepository.findOne({ where: { username: 'admin' } });
    const adminId = admin ? Number(admin.id) : 0;

    // 班级1：周六上午班 — 数学思维
    const class1Exists = await this.classEntityRepository.findOne({
      where: { classCode: 'CL2026070001' },
    });
    if (!class1Exists) {
      const class1 = this.classEntityRepository.create({
        classCode: 'CL2026070001',
        courseCode: 'MATH001',
        name: '周六上午班',
        status: ClassStatus.ACTIVE,
        startDate: '2026-07-01',
        totalLessons: 20,
        defaultDuration: 90,
        dayOfWeek: [6],
        startTime: '09:00',
        endTime: '10:30',
        maxStudents: 20,
        createdBy: adminId,
      });
      await this.classEntityRepository.save(class1);
      this.logger.log('Test class created: 周六上午班 (CL2026070001)', 'Seed');
    }

    // 班级2：周日下午班 — 英语口语
    const class2Exists = await this.classEntityRepository.findOne({
      where: { classCode: 'CL2026070002' },
    });
    if (!class2Exists) {
      const class2 = this.classEntityRepository.create({
        classCode: 'CL2026070002',
        courseCode: 'ENG001',
        name: '周日下午班',
        status: ClassStatus.ACTIVE,
        startDate: '2026-07-01',
        totalLessons: 20,
        defaultDuration: 90,
        dayOfWeek: [0],
        startTime: '14:00',
        endTime: '15:30',
        maxStudents: 20,
        createdBy: adminId,
      });
      await this.classEntityRepository.save(class2);
      this.logger.log('Test class created: 周日下午班 (CL2026070002)', 'Seed');
    }
  }

  /** 创建测试学生 — 3 个学生记录 */
  private async seedTestStudents() {
    const admin = await this.userRepository.findOne({ where: { username: 'admin' } });
    const adminId = admin ? Number(admin.id) : 0;

    const students = [
      {
        studentCode: 'STU001',
        name: '李小华',  // Must match user "student1" name
        gender: Gender.MALE,
        birthDate: '2014-05-10',
        phone: '13800000001',
        userId: 3,  // student1 user
      },
      {
        studentCode: 'STU002',
        name: '李四',
        gender: Gender.MALE,
        birthDate: '2015-08-15',
        phone: '13800000002',
      },
      {
        studentCode: 'STU003',
        name: '王五',
        gender: Gender.FEMALE,
        birthDate: '2016-01-20',
        phone: '13800000003',
      },
    ];

    for (const data of students) {
      const exists = await this.studentEntityRepository.findOne({
        where: { studentCode: data.studentCode },
      });
      if (!exists) {
        const student = this.studentEntityRepository.create({
          ...data,
          status: StudentStatus.ACTIVE,
          createdBy: adminId,
          createdSource: CreatedSource.ADMIN,
        });
        await this.studentEntityRepository.save(student);
        this.logger.log(`Test student created: ${data.name} (${data.studentCode})`, 'Seed');
      }
    }
  }

  /** 创建测试合同 — 3 个 ACTIVE 合同，每学生一个 */
  private async seedTestContracts() {
    const admin = await this.userRepository.findOne({ where: { username: 'admin' } });
    const adminId = admin ? Number(admin.id) : 0;
    const today = '2026-07-01';

    const contracts = [
      {
        contractCode: 'CT2026070001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        totalLessons: 50,
        remainingLessons: 50,
        unitPrice: 150.00,
        totalAmount: 7500.00,
      },
      {
        contractCode: 'CT2026070002',
        studentCode: 'STU002',
        subject: Subject.MATH,
        totalLessons: 50,
        remainingLessons: 50,
        unitPrice: 150.00,
        totalAmount: 7500.00,
      },
      {
        contractCode: 'CT2026070003',
        studentCode: 'STU003',
        subject: Subject.ENGLISH,
        totalLessons: 50,
        remainingLessons: 50,
        unitPrice: 180.00,
        totalAmount: 9000.00,
      },
    ];

    for (const data of contracts) {
      const exists = await this.contractEntityRepository.findOne({
        where: { contractCode: data.contractCode },
      });
      if (!exists) {
        const contract = this.contractEntityRepository.create({
          ...data,
          status: ContractStatus.ACTIVE,
          validFrom: today,
          validTo: null,
          createdBy: adminId,
        });
        await this.contractEntityRepository.save(contract);
        this.logger.log(`Test contract created: ${data.contractCode} (${data.studentCode})`, 'Seed');
      }
    }
  }

  /** 创建测试课程 — 2 个 PUBLISHED 课程 */
  private async seedTestCourses() {
    const admin = await this.userRepository.findOne({ where: { username: 'admin' } });
    const adminId = admin ? Number(admin.id) : 0;

    const courses = [
      {
        courseCode: 'MATH001',
        name: '数学基础班',
        subject: Subject.MATH,
        type: CourseType.GROUP,
        totalHours: 40.0,
        totalLessons: 20,
        defaultDuration: 45,
        status: CourseStatus.PUBLISHED,
        createdBy: adminId,
        description: '小学数学基础课程',
        tags: null,
        coverImage: null,
        note: null,
      },
      {
        courseCode: 'ENG001',
        name: '英语启蒙班',
        subject: Subject.ENGLISH,
        type: CourseType.GROUP,
        totalHours: 40.0,
        totalLessons: 20,
        defaultDuration: 45,
        status: CourseStatus.PUBLISHED,
        createdBy: adminId,
        description: '少儿英语启蒙课程',
        tags: null,
        coverImage: null,
        note: null,
      },
    ];

    for (const data of courses) {
      const exists = await this.courseEntityRepository.findOne({
        where: { courseCode: data.courseCode },
      });
      if (!exists) {
        const course = this.courseEntityRepository.create(data);
        await this.courseEntityRepository.save(course);
        this.logger.log('Test course created: ' + data.name + ' (' + data.courseCode + ')', 'Seed');
      }
    }
  }

  /** 创建测试课时 — 周六班 4 课时, 周日班 4 课时 */
  private async seedTestLessons() {
    const admin = await this.userRepository.findOne({ where: { username: 'admin' } });
    const adminId = admin ? Number(admin.id) : 0;

    // CL2026070001 — 周六上午班 (dayOfWeek=6, startTime=09:00, endTime=10:30)
    const class1Lessons = [
      { scheduledDate: '2026-07-04', status: LessonStatus.FINISHED },
      { scheduledDate: '2026-07-11', status: LessonStatus.FINISHED },
      { scheduledDate: '2026-07-18', status: LessonStatus.FINISHED },
      { scheduledDate: '2026-07-25', status: LessonStatus.SCHEDULED },
    ];

    for (const [index, lesson] of class1Lessons.entries()) {
      const lessonNumber = index + 1;
      const exists = await this.lessonEntityRepository.findOne({
        where: { classCode: 'CL2026070001', lessonNumber },
      });
      if (!exists) {
        const entity = this.lessonEntityRepository.create({
          classCode: 'CL2026070001',
          courseCode: 'MATH001',
          lessonNumber,
          scheduledDate: lesson.scheduledDate,
          startTime: '09:00',
          endTime: '10:30',
          status: lesson.status,
          teacherId: 2,
          createdBy: adminId,
        });
        await this.lessonEntityRepository.save(entity);
        this.logger.log('Test lesson created: CL2026070001 ' + lesson.scheduledDate, 'Seed');
      }
    }

    // CL2026070002 — 周日下午班 (dayOfWeek=0, startTime=14:00, endTime=15:30)
    const class2Lessons = [
      { scheduledDate: '2026-07-05', status: LessonStatus.FINISHED },
      { scheduledDate: '2026-07-12', status: LessonStatus.FINISHED },
      { scheduledDate: '2026-07-19', status: LessonStatus.FINISHED },
      { scheduledDate: '2026-07-26', status: LessonStatus.SCHEDULED },
    ];

    for (const [index, lesson] of class2Lessons.entries()) {
      const lessonNumber = index + 1;
      const exists = await this.lessonEntityRepository.findOne({
        where: { classCode: 'CL2026070002', lessonNumber },
      });
      if (!exists) {
        const entity = this.lessonEntityRepository.create({
          classCode: 'CL2026070002',
          courseCode: 'ENG001',
          lessonNumber,
          scheduledDate: lesson.scheduledDate,
          startTime: '14:00',
          endTime: '15:30',
          status: lesson.status,
          teacherId: 2,
          createdBy: adminId,
        });
        await this.lessonEntityRepository.save(entity);
        this.logger.log('Test lesson created: CL2026070002 ' + lesson.scheduledDate, 'Seed');
      }
    }
  }

  /** 创建测试出勤记录 — 为已结束课时创建出勤 */
  private async seedTestAttendance() {
    const admin = await this.userRepository.findOne({ where: { username: 'admin' } });
    const adminId = admin ? Number(admin.id) : 0;

    // date → lessonNumber mapping (based on seedTestLessons)
    const dateToLesson: Record<string, number> = {
      '2026-07-04': 1, '2026-07-11': 2, '2026-07-18': 3,
      '2026-07-05': 1, '2026-07-12': 2, '2026-07-19': 3,
    };

    // CL2026070001 班级: STU001 + STU002
    // Lesson 1 (Sat Jul 4): STU001=PRESENT, STU002=PRESENT
    // Lesson 2 (Sat Jul 11): STU001=PRESENT, STU002=LATE
    // Lesson 3 (Sat Jul 18): STU001=ABSENT, STU002=PRESENT
    const class1Attendance = [
      { scheduledDate: '2026-07-04', studentCode: 'STU001', status: AttendanceStatus.PRESENT },
      { scheduledDate: '2026-07-04', studentCode: 'STU002', status: AttendanceStatus.PRESENT },
      { scheduledDate: '2026-07-11', studentCode: 'STU001', status: AttendanceStatus.PRESENT },
      { scheduledDate: '2026-07-11', studentCode: 'STU002', status: AttendanceStatus.LATE },
      { scheduledDate: '2026-07-18', studentCode: 'STU001', status: AttendanceStatus.ABSENT },
      { scheduledDate: '2026-07-18', studentCode: 'STU002', status: AttendanceStatus.PRESENT },
    ];

    for (const data of class1Attendance) {
      const lessonNumber = dateToLesson[data.scheduledDate];
      if (!lessonNumber) {
        this.logger.warn(`No lessonNumber mapping for date ${data.scheduledDate}, skipping attendance`, 'Seed');
        continue;
      }
      const lesson = await this.lessonEntityRepository.findOne({
        where: { classCode: 'CL2026070001', lessonNumber },
      });
      if (!lesson) {
        this.logger.warn(`Lesson not found for CL2026070001 lessonNumber=${lessonNumber}, skipping attendance`, 'Seed');
        continue;
      }
      const lessonId = Number(lesson.id);
      const exists = await this.lessonAttendanceEntityRepository.findOne({
        where: { lessonId, studentCode: data.studentCode },
      });
      if (!exists) {
        const entity = this.lessonAttendanceEntityRepository.create({
          lessonId,
          classCode: 'CL2026070001',
          studentCode: data.studentCode,
          status: data.status,
          teacherId: 2,
          operator: adminId,
          createdBy: adminId,
          source: AttendanceSource.API,
          workflowState: AttendanceWorkflowState.CONFIRMED,
        });
        await this.lessonAttendanceEntityRepository.save(entity);
        this.logger.log('Test attendance created: CL2026070001 lesson=' + lessonNumber + ' ' + data.studentCode + '=' + data.status, 'Seed');
      }
    }

    // CL2026070002 班级: STU003
    // Lesson 1 (Sun Jul 5): STU003=PRESENT
    // Lesson 2 (Sun Jul 12): STU003=PRESENT
    // Lesson 3 (Sun Jul 19): STU003=LEAVE
    const class2Attendance = [
      { scheduledDate: '2026-07-05', studentCode: 'STU003', status: AttendanceStatus.PRESENT },
      { scheduledDate: '2026-07-12', studentCode: 'STU003', status: AttendanceStatus.PRESENT },
      { scheduledDate: '2026-07-19', studentCode: 'STU003', status: AttendanceStatus.LEAVE },
    ];

    for (const data of class2Attendance) {
      const lessonNumber = dateToLesson[data.scheduledDate];
      if (!lessonNumber) {
        this.logger.warn(`No lessonNumber mapping for date ${data.scheduledDate}, skipping attendance`, 'Seed');
        continue;
      }
      const lesson = await this.lessonEntityRepository.findOne({
        where: { classCode: 'CL2026070002', lessonNumber },
      });
      if (!lesson) {
        this.logger.warn(`Lesson not found for CL2026070002 lessonNumber=${lessonNumber}, skipping attendance`, 'Seed');
        continue;
      }
      const lessonId = Number(lesson.id);
      const exists = await this.lessonAttendanceEntityRepository.findOne({
        where: { lessonId, studentCode: data.studentCode },
      });
      if (!exists) {
        const entity = this.lessonAttendanceEntityRepository.create({
          lessonId,
          classCode: 'CL2026070002',
          studentCode: data.studentCode,
          status: data.status,
          teacherId: 2,
          operator: adminId,
          createdBy: adminId,
          source: AttendanceSource.API,
          workflowState: AttendanceWorkflowState.CONFIRMED,
        });
        await this.lessonAttendanceEntityRepository.save(entity);
        this.logger.log('Test attendance created: CL2026070002 lesson=' + lessonNumber + ' ' + data.studentCode + '=' + data.status, 'Seed');
      }
    }
  }

  /** 创建测试选班记录 — 将学生选入班级 */
  private async seedTestEnrollments() {
    const admin = await this.userRepository.findOne({ where: { username: 'admin' } });
    const adminId = admin ? Number(admin.id) : 0;

    const enrollments = [
      { classCode: 'CL2026070001', studentCode: 'STU001', contractCode: 'CT2026070001' },
      { classCode: 'CL2026070001', studentCode: 'STU002', contractCode: 'CT2026070002' },
      { classCode: 'CL2026070002', studentCode: 'STU003', contractCode: 'CT2026070003' },
    ];

    for (const data of enrollments) {
      const exists = await this.enrollmentEntityRepository.findOne({
        where: { classCode: data.classCode, studentCode: data.studentCode },
      });
      if (!exists) {
        const enrollment = this.enrollmentEntityRepository.create({
          ...data,
          status: EnrollmentStatus.ACTIVE,
          enrolledBy: adminId,
        });
        await this.enrollmentEntityRepository.save(enrollment);
        this.logger.log(
          `Test enrollment created: ${data.studentCode} → ${data.classCode}`,
          'Seed',
        );
      }
    }
  }

  /** 创建测试教师分配 — 将张老师(teacher1)分配为两个班级的 PRIMARY 老师 */
  private async seedTestTeacherAssignments() {
    const admin = await this.userRepository.findOne({ where: { username: 'admin' } });
    const adminId = admin ? Number(admin.id) : 0;

    const teacher = await this.userRepository.findOne({ where: { username: 'teacher1' } });
    if (!teacher) {
      this.logger.warn('teacher1 not found, skipping teacher assignments', 'Seed');
      return;
    }
    const teacherId = Number(teacher.id);
    const today = '2026-07-01';

    const assignments = [
      { classCode: 'CL2026070001', teacherId },
      { classCode: 'CL2026070002', teacherId },
    ];

    for (const data of assignments) {
      const exists = await this.teacherAssignmentEntityRepository.findOne({
        where: { classCode: data.classCode, teacherId: data.teacherId, role: TeacherRole.PRIMARY },
      });
      if (!exists) {
        const assignment = this.teacherAssignmentEntityRepository.create({
          classCode: data.classCode,
          teacherId: data.teacherId,
          role: TeacherRole.PRIMARY,
          effectiveFrom: today,
          effectiveTo: null,
          assignedBy: adminId,
        });
        await this.teacherAssignmentEntityRepository.save(assignment);
        this.logger.log(
          `Test teacher assignment created: teacherId=${data.teacherId} → ${data.classCode}`,
          'Seed',
        );
      }
    }
  }
}
