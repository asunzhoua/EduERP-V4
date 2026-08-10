import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Brackets, In } from 'typeorm';
import { Student } from '../entities/student.entity';
import { StudentParent } from '../entities/student-parent.entity';
import { StudentAuditLog } from '../entities/student-audit-log.entity';
import { StudentRepository } from '../student.repository';
import { StudentCodeGeneratorService } from './student-code-generator.service';
import { CreateStudentDto } from '../dto/create-student.dto';
import { UpdateStudentDto } from '../dto/update-student.dto';
import { UpdateStudentStatusDto } from '../dto/update-student-status.dto';
import { QueryStudentDto } from '../dto/query-student.dto';
import { StudentStatus } from '../enums/student-status.enum';
import { CreatedSource } from '@common/enums/created-source.enum';
import { AuditAction } from '@common/enums/audit-action.enum';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { ImportService, ImportReport } from '@utils/services/import.service';
import { Gender } from '../enums/gender.enum';
import { ContractRepository } from '@modules/teaching/contract/contract.repository';
import { LessonAttendanceRepository } from '@modules/teaching/lesson-attendance/lesson-attendance.repository';
import {
  LeaveRequestEntity,
  LeaveRequestStatus,
  LeaveType,
} from '@modules/teaching/leave-request/leave-request.entity';
import { CreateParentLeaveRequestDto } from '../dto/create-parent-leave-request.dto';
import { EnrollmentEntity } from '@modules/teaching/enrollment/enrollment.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { PointsService } from '@modules/points/points.service';
import { FeedbackService } from '@modules/feedback/feedback.service';

@Injectable()
export class StudentService {
  constructor(
    private studentRepository: StudentRepository,
    @InjectRepository(StudentParent)
    private studentParentRepository: Repository<StudentParent>,
    @InjectRepository(StudentAuditLog)
    private studentAuditLogRepository: Repository<StudentAuditLog>,
    private studentCodeGenerator: StudentCodeGeneratorService,
    private importService: ImportService,
    private contractRepository: ContractRepository,
    private lessonAttendanceRepository: LessonAttendanceRepository,
    @InjectRepository(LeaveRequestEntity)
    private leaveRequestRepository: Repository<LeaveRequestEntity>,
    @InjectRepository(EnrollmentEntity)
    private enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(CourseEntity)
    private courseRepository: Repository<CourseEntity>,
    @InjectRepository(LessonEntity)
    private lessonRepository: Repository<LessonEntity>,
    @InjectRepository(ClassEntity)
    private classRepository: Repository<ClassEntity>,
    private pointsService: PointsService,
    private feedbackService: FeedbackService,
  ) {}

  async create(
    dto: CreateStudentDto,
    operatorId: number,
    source: CreatedSource = CreatedSource.API,
  ): Promise<Student> {
    const studentCode = await this.studentCodeGenerator.generateStudentCode();

    const student = new Student();
    student.studentCode = studentCode;
    student.name = dto.name;
    student.gender = dto.gender;
    student.birthDate = dto.birthDate;
    student.phone = dto.phone || null;
    student.email = dto.email || null;
    student.school = dto.school || null;
    student.grade = dto.grade || null;
    student.tags = dto.tags || null;
    student.note = dto.note || null;
    student.status = StudentStatus.ACTIVE;
    student.createdBy = operatorId;
    student.createdSource = source;
    student.updatedBy = operatorId;
    student.deleted = false;

    const saved = await this.studentRepository.save(student);

    // Link parents if provided (batch save, eliminates N+1)
    if (dto.parentIds && dto.parentIds.length > 0) {
      const links = dto.parentIds.map((parentId) => {
        const link = new StudentParent();
        link.studentId = saved.id;
        link.parentId = parentId;
        link.relation = null;
        link.isPrimary = false;
        return link;
      });
      await this.studentParentRepository.save(links);
    }

    // Audit log
    const audit = new StudentAuditLog();
    audit.studentId = saved.id;
    audit.action = AuditAction.CREATE;
    audit.operatedBy = operatorId;
    audit.source = source;
    audit.detail = `创建学生: ${saved.name} (${saved.studentCode})`;
    await this.studentAuditLogRepository.save(audit);

    return saved;
  }

  async findAll(
    query: QueryStudentDto,
    teacherId?: number,
  ): Promise<{
    items: Student[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { deleted: false };

    if (query.name) {
      where.name = Like(`%${query.name}%`);
    }
    if (query.studentCode) {
      where.studentCode = Like(`%${query.studentCode}%`);
    }
    if (query.gender) {
      where.gender = query.gender;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.phone) {
      where.phone = Like(`%${query.phone}%`);
    }
    if (query.school) {
      where.school = Like(`%${query.school}%`);
    }
    if (query.grade) {
      where.grade = Like(`%${query.grade}%`);
    }
    // keyword search: OR logic across multiple fields
    // If both name and keyword are provided, they work together
    const keyword = query.keyword;

    const [items, total] = await this.studentRepository.findAndCount({
      where: ((qb: any) => {
        qb.where(where);
        // Teacher 范围过滤：只返回该教师负责的 class 里的学生
        if (teacherId) {
          qb.andWhere(
            `student.studentCode IN (
              SELECT e."studentCode" FROM enrollment e
              WHERE e."classCode" IN (
                SELECT ta."classCode" FROM teacher_assignment ta
                WHERE ta."teacherId" = :teacherId AND ta."effectiveTo" IS NULL AND ta."deleted" = false
              ) AND e."deleted" = false
            )`,
            { teacherId },
          );
        }
        if (keyword) {
          qb.andWhere(
            new Brackets((subQb) => {
              subQb
                .where('student.name LIKE :kw', { kw: `%${keyword}%` })
                .orWhere('student.studentCode LIKE :kw', { kw: `%${keyword}%` })
                .orWhere('student.phone LIKE :kw', { kw: `%${keyword}%` })
                .orWhere('student.school LIKE :kw', { kw: `%${keyword}%` });
            }),
          );
        }
      }) as any,
      skip,
      take: pageSize,
      order: { createTime: 'DESC' } as any,
    });

    return { items, total, page, pageSize };
  }

  async findByUserId(userId: number): Promise<Student | null> {
    return this.studentRepository.raw.findOne({
      where: { userId, deleted: false },
    });
  }

  async findById(id: number): Promise<Student> {
    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`学生不存在 (ID: ${id})`);
    }
    return student;
  }

  async update(
    id: number,
    dto: UpdateStudentDto,
    operatorId: number,
  ): Promise<Student> {
    const student = await this.findById(id);
    const changes: { fieldName: string; oldValue: string; newValue: string }[] =
      [];

    const updatableFields: (keyof UpdateStudentDto)[] = [
      'name',
      'gender',
      'birthDate',
      'phone',
      'email',
      'school',
      'grade',
      'tags',
      'note',
    ];

    for (const field of updatableFields) {
      if ((dto as any)[field] !== undefined) {
        const oldVal = String((student as any)[field] ?? '');
        const newVal = String((dto as any)[field] ?? '');
        if (oldVal !== newVal) {
          changes.push({
            fieldName: field,
            oldValue: oldVal,
            newValue: newVal,
          });
          (student as any)[field] = (dto as any)[field];
        }
      }
    }

    if (changes.length === 0) {
      return student;
    }

    student.updatedBy = operatorId;
    const saved = await this.studentRepository.save(student);

    // Audit log for each change (batch save to eliminate N+1)
    if (changes.length > 0) {
      const audits = changes.map((change) => {
        const audit = new StudentAuditLog();
        audit.studentId = id;
        audit.action = AuditAction.UPDATE;
        audit.fieldName = change.fieldName;
        audit.oldValue = change.oldValue;
        audit.newValue = change.newValue;
        audit.operatedBy = operatorId;
        audit.source = CreatedSource.API;
        return audit;
      });
      await this.studentAuditLogRepository.save(audits);
    }

    return saved;
  }

  async updateStatus(
    id: number,
    dto: UpdateStudentStatusDto,
    operatorId: number,
  ): Promise<Student> {
    const student = await this.findById(id);
    const oldStatus = student.status;
    const newStatus = dto.status;

    if (oldStatus === newStatus) {
      return student;
    }

    if (oldStatus === StudentStatus.GRADUATED) {
      throw new BadRequestException('已毕业的学生不能变更状态');
    }

    student.status = newStatus;
    student.updatedBy = operatorId;
    const saved = await this.studentRepository.save(student);

    const audit = new StudentAuditLog();
    audit.studentId = id;
    audit.action = AuditAction.STATUS_CHANGE;
    audit.fieldName = 'status';
    audit.oldValue = oldStatus;
    audit.newValue = newStatus;
    audit.operatedBy = operatorId;
    audit.source = CreatedSource.API;
    audit.detail = `状态变更: ${oldStatus} → ${newStatus}`;
    await this.studentAuditLogRepository.save(audit);

    return saved;
  }

  async softDelete(id: number, operatorId: number): Promise<void> {
    const student = await this.findById(id);
    student.deleted = true;
    student.updatedBy = operatorId;
    await this.studentRepository.save(student);

    const audit = new StudentAuditLog();
    audit.studentId = id;
    audit.action = AuditAction.DELETE;
    audit.operatedBy = operatorId;
    audit.source = CreatedSource.API;
    audit.detail = `删除学生: ${student.name} (${student.studentCode})`;
    await this.studentAuditLogRepository.save(audit);
  }

  // --- Parent-Student relations ---

  async linkParent(
    studentId: number,
    parentId: number,
    relation?: string,
    isPrimary?: boolean,
  ): Promise<StudentParent> {
    await this.findById(studentId);

    const existing = await this.studentParentRepository.findOne({
      where: { studentId, parentId },
    });
    if (existing) {
      throw new BadRequestException('该家长已关联此学生');
    }

    const link = new StudentParent();
    link.studentId = studentId;
    link.parentId = parentId;
    link.relation = relation || null;
    link.isPrimary = isPrimary || false;
    return this.studentParentRepository.save(link);
  }

  async unlinkParent(studentId: number, parentId: number): Promise<void> {
    const link = await this.studentParentRepository.findOne({
      where: { studentId, parentId },
    });
    if (!link) {
      throw new NotFoundException('家长关联不存在');
    }
    await this.studentParentRepository.remove(link);
  }

  async getParents(studentId: number): Promise<StudentParent[]> {
    await this.findById(studentId);
    return this.studentParentRepository.find({
      where: { studentId },
      relations: { parent: true },
    });
  }

  async getStudentsByParent(parentId: number): Promise<StudentParent[]> {
    return this.studentParentRepository.find({
      where: { parentId },
      relations: { student: true },
    });
  }

  /**
   * Get children students by parent user ID (via student_parent association table).
   * This is the correct query path: User → student_parent → Student.
   */
  async getChildrenByUserId(userId: number): Promise<Student[]> {
    const studentParents = await this.studentParentRepository.find({
      where: { parentId: userId },
    });
    const studentIds = studentParents.map((sp) => sp.studentId);
    if (studentIds.length === 0) {
      return [];
    }
    return this.studentRepository.raw.find({
      where: { id: In(studentIds), deleted: false },
    });
  }

  // --- Parent-Child Scoped API (GAP-001) ---

  /**
   * Verify a parent-child relationship and resolve the child student.
   * Single shared guard for all child-scoped endpoints.
   */
  private async assertParentChild(
    parentId: number,
    childId: number,
  ): Promise<Student> {
    const relation = await this.studentParentRepository.findOne({
      where: { parentId, studentId: childId },
    });

    if (!relation) {
      throw new ForbiddenException('No parent-child relationship');
    }

    const student = await this.studentRepository.findById(childId);
    if (!student) {
      throw new NotFoundException(`Student not found (ID: ${childId})`);
    }
    return student;
  }

  /**
   * Get courses for a child student, verifying parent-child relationship.
   * Returns contract/course info linked to the child.
   */
  async getChildCourses(parentId: number, childId: number) {
    const student = await this.assertParentChild(parentId, childId);

    // Find contracts for this student (represents their enrolled courses)
    const contracts = await this.contractRepository.findByStudentCode(
      student.studentCode,
    );

    if (contracts.length === 0) {
      return [];
    }

    // Find enrollments to get class info
    const contractCodes = contracts.map((c) => c.contractCode);
    const enrollments = await this.enrollmentRepository.find({
      where: { contractCode: In(contractCodes) },
    });
    const enrollmentMap = new Map(enrollments.map((e) => [e.contractCode, e]));

    return contracts.map((c) => {
      const enrollment = enrollmentMap.get(c.contractCode);
      return {
        contractCode: c.contractCode,
        classCode: enrollment?.classCode || null,
        subject: c.subject,
        totalLessons: c.totalLessons,
        remainingLessons: c.remainingLessons,
        status: c.status,
        validFrom: c.validFrom,
        validTo: c.validTo,
      };
    });
  }

  /**
   * Get attendance records for a child student, verifying parent-child relationship.
   */
  async getChildAttendance(parentId: number, childId: number) {
    const student = await this.assertParentChild(parentId, childId);

    // Find attendance records for this student
    const attendances = await this.lessonAttendanceRepository.findByStudentCode(
      student.studentCode,
    );

    if (attendances.length === 0) {
      return [];
    }

    // Get lesson details
    const lessonIds = [...new Set(attendances.map((a) => a.lessonId))];
    const lessons =
      lessonIds.length > 0
        ? await this.lessonRepository.find({
            where: { id: In(lessonIds) },
          })
        : [];
    const lessonMap = new Map(lessons.map((l) => [l.id, l]));

    return attendances.map((a) => {
      const lesson = lessonMap.get(a.lessonId);
      return {
        id: a.id,
        lessonId: a.lessonId,
        lessonDate: lesson?.scheduledDate || null,
        startTime: lesson?.startTime || null,
        endTime: lesson?.endTime || null,
        status: a.status,
      };
    });
  }

  /**
   * Get contracts for a child student, verifying parent-child relationship.
   */
  async getChildContracts(parentId: number, childId: number) {
    const student = await this.assertParentChild(parentId, childId);

    // Find contracts for this student
    return this.contractRepository.findByStudentCode(student.studentCode);
  }

  // --- Shared lessons/points/feedback assembly (self + child reuse) ---

  /**
   * Assemble attendance-derived lesson history for a studentCode.
   * Shared by self endpoints and child-scoped parent endpoints so both
   * return the identical shape.
   */
  async getStudentLessons(studentCode: string, from?: string, to?: string) {
    // 学员本人考勤记录（含已退班/已结业历史），按 lessonId 建立索引
    const attendanceRecords =
      await this.lessonAttendanceRepository.findByStudentCode(studentCode);
    const attendanceMap = new Map(
      attendanceRecords.map((r) => [r.lessonId, r]),
    );

    // 1) 班级驱动：当前有效报名班级的全部课时（含 SCHEDULED 未来课）
    const activeEnrollments = await this.enrollmentRepository.find({
      where: { studentCode, status: EnrollmentStatus.ACTIVE },
    });
    const activeClassCodes = activeEnrollments.map((e) => e.classCode);
    const classLessons =
      activeClassCodes.length > 0
        ? await this.lessonRepository.find({
            where: { classCode: In(activeClassCodes) },
          })
        : [];

    // 2) 考勤驱动：已退班/已结业班级的历史课时（以考勤记录里的 lesson 为准）
    const attendanceLessonIds = [
      ...new Set(attendanceRecords.map((r) => r.lessonId)),
    ];
    const historyLessons =
      attendanceLessonIds.length > 0
        ? await this.lessonRepository.find({
            where: { id: In(attendanceLessonIds) },
          })
        : [];

    // 合并去重：同一 lesson 保留班级驱动结果
    const merged = new Map<number, LessonEntity>();
    for (const l of historyLessons) merged.set(l.id, l);
    for (const l of classLessons) merged.set(l.id, l);
    const allLessons = [...merged.values()];

    // 班级 / 课程名称映射
    const classCodes = [...new Set(allLessons.map((l) => l.classCode))];
    const classes =
      classCodes.length > 0
        ? await this.classRepository.find({
            where: { classCode: In(classCodes) },
          })
        : [];
    const classMap = new Map(classes.map((c) => [c.classCode, c.name]));

    const courseCodes = [...new Set(allLessons.map((l) => l.courseCode))];
    const courses =
      courseCodes.length > 0
        ? await this.courseRepository.find({
            where: { courseCode: In(courseCodes) },
          })
        : [];
    const courseMap = new Map(courses.map((c) => [c.courseCode, c.name]));

    // 组装：每节课带本人考勤状态（无记录为 null）
    const result = allLessons
      .map((lesson) => {
        const att = attendanceMap.get(lesson.id);
        return {
          lessonId: lesson.id,
          lessonDate: lesson.scheduledDate || null,
          startTime: lesson.startTime || null,
          endTime: lesson.endTime || null,
          status: att?.status ?? null,
          lessonStatus: lesson.status || null,
          className: classMap.get(lesson.classCode) || null,
          courseName: courseMap.get(lesson.courseCode) || null,
        };
      })
      .filter((r) => {
        if (!r.lessonDate) return true; // 无日期记录保留，避免数据丢失
        if (from && r.lessonDate < from) return false;
        if (to && r.lessonDate > to) return false;
        return true;
      });

    // 按日期倒序（历史课时：最近在前），同日期按开始时间倒序
    result.sort((a, b) => {
      const ad = a.lessonDate || '';
      const bd = b.lessonDate || '';
      if (ad !== bd) return bd.localeCompare(ad);
      const as = a.startTime || '';
      const bs = b.startTime || '';
      return bs.localeCompare(as);
    });

    return result;
  }

  async getStudentPoints(studentCode: string) {
    return this.pointsService.getSummary(studentCode);
  }

  async getStudentFeedback(studentCode: string) {
    return this.feedbackService.findByStudentCode(studentCode);
  }

  async getChildLessons(
    parentId: number,
    childId: number,
    from?: string,
    to?: string,
  ) {
    const student = await this.assertParentChild(parentId, childId);
    return this.getStudentLessons(student.studentCode, from, to);
  }

  async getChildPoints(parentId: number, childId: number) {
    const student = await this.assertParentChild(parentId, childId);
    return this.getStudentPoints(student.studentCode);
  }

  async getChildFeedback(parentId: number, childId: number) {
    const student = await this.assertParentChild(parentId, childId);
    return this.getStudentFeedback(student.studentCode);
  }

  // --- Parent Leave Request (GAP-002) ---

  /**
   * Create a leave request for a child, verifying parent-child relationship.
   */
  async createLeaveRequest(parentId: number, dto: CreateParentLeaveRequestDto) {
    // Verify Parent-Child relationship
    const relation = await this.studentParentRepository.findOne({
      where: { parentId, studentId: dto.studentId },
    });

    if (!relation) {
      throw new ForbiddenException('No parent-child relationship');
    }

    // Get child student to resolve studentCode
    const student = await this.studentRepository.findById(dto.studentId);
    if (!student) {
      throw new NotFoundException(`Student not found (ID: ${dto.studentId})`);
    }

    // Resolve classCode from active enrollment
    const enrollment = await this.enrollmentRepository.findOne({
      where: { studentCode: student.studentCode },
      order: { enrolledAt: 'DESC' } as any,
    });

    // Create leave request entity
    const leaveRequest = new LeaveRequestEntity();
    leaveRequest.studentCode = student.studentCode;
    leaveRequest.classCode = enrollment?.classCode || '';
    leaveRequest.leaveType = dto.leaveType;
    leaveRequest.leaveDate = dto.leaveDate;
    leaveRequest.reason = dto.reason;
    leaveRequest.status = LeaveRequestStatus.PENDING;
    leaveRequest.createdBy = parentId;

    return this.leaveRequestRepository.save(leaveRequest);
  }

  // --- Import ---

  async importStudents(
    buffer: Buffer,
    fileName: string,
    operatorId: number,
  ): Promise<ImportReport> {
    const rows = this.importService.parseBuffer(buffer, fileName);

    const columns = [
      {
        header: 'name',
        aliases: ['姓名'],
        required: true,
        validate: (v: string) =>
          v.length > 50 ? '姓名不能超过50个字符' : null,
      },
      {
        header: 'gender',
        aliases: ['性别'],
        required: true,
        validate: (v: string) =>
          !['MALE', 'FEMALE', '男', '女'].includes(v)
            ? '性别格式错误 (MALE/FEMALE/男/女)'
            : null,
      },
      {
        header: 'birthDate',
        aliases: ['出生日期', '生日'],
        required: true,
        validate: (v: string) =>
          isNaN(Date.parse(v)) ? '出生日期格式错误' : null,
      },
      { header: 'phone', aliases: ['联系电话', '手机号'], required: false },
      { header: 'email', aliases: ['邮箱'], required: false },
      { header: 'school', aliases: ['学校'], required: false },
      { header: 'grade', aliases: ['年级'], required: false },
      { header: 'tags', aliases: ['标签'], required: false },
      { header: 'note', aliases: ['备注'], required: false },
    ];

    const { validRows, report } = this.importService.validateRows(
      rows,
      columns,
      fileName,
    );

    for (const row of validRows) {
      try {
        const gender =
          row['gender'] === '男' || row['gender'] === 'MALE'
            ? Gender.MALE
            : Gender.FEMALE;
        const tags = row['tags']
          ? row['tags']
              .split(/[,，、]/)
              .map((t: string) => t.trim())
              .filter(Boolean)
          : null;

        const dto = new CreateStudentDto();
        dto.name = row['name'];
        dto.gender = gender;
        dto.birthDate = row['birthdate'];
        dto.phone = row['phone'] || undefined;
        dto.email = row['email'] || undefined;
        dto.school = row['school'] || undefined;
        dto.grade = row['grade'] || undefined;
        dto.tags = tags || undefined;
        dto.note = row['note'] || undefined;

        await this.create(dto, operatorId, CreatedSource.IMPORT);
      } catch (error) {
        report.failure++;
        report.success--;
        const detail = report.details.find(
          (d) => d.data['name'] === row['name'] && d.success,
        );
        if (detail) {
          detail.success = false;
          detail.errors.push(`导入失败: ${(error as Error).message}`);
        }
      }
    }

    return report;
  }
}
