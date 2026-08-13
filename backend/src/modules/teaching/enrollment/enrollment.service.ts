import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Brackets, Repository } from 'typeorm';
import { EnrollmentRepository } from './enrollment.repository';
import { ContractRepository } from '../contract/contract.repository';
import { ContractEntity } from '../contract/contract.entity';
import { EnrollmentEntity } from './enrollment.entity';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { ContractStatus } from '../contract/enums/contract-status.enum';
import { StudentRepository } from '../../student/student.repository';
import { ClassEntity } from '../class/class.entity';
import { ClassStatus } from '../class/enums/class-status.enum';
import { CourseEntity } from '../course/course.entity';
import { LessonEntity } from '../lesson/lesson.entity';
import { LessonStatus } from '../lesson/enums/lesson-status.enum';
import { hasScheduleConflict } from '../class/schedule-conflict.util';

/**
 * Formal state transition table.
 * COMPLETED exists per Blueprint but is NOT activated (no transition target).
 * ENROLL-004: COMPLETED is terminal (when activated in future).
 */
export const VALID_ENROLLMENT_TRANSITIONS: Record<
  EnrollmentStatus,
  EnrollmentStatus[]
> = {
  [EnrollmentStatus.ACTIVE]: [
    EnrollmentStatus.WITHDRAWN,
    EnrollmentStatus.SUSPEND,
  ],
  [EnrollmentStatus.WITHDRAWN]: [], // ENROLL-005: terminal
  [EnrollmentStatus.SUSPEND]: [EnrollmentStatus.ACTIVE], // ENROLL-006: can resume
  [EnrollmentStatus.COMPLETED]: [], // ENROLL-004: terminal (not activated)
};

/** Input for enrolling a student. */
export interface EnrollInput {
  classCode: string;
  studentCode: string;
  contractCode?: string | null;
  /** 操作人 id（教师/管理员），写入 enrolledBy */
  operatedBy: number;
}

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly contractRepo: ContractRepository,
    private readonly studentRepo: StudentRepository,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
  ) {}

  // ─── Enroll ───

  async enroll(input: EnrollInput): Promise<EnrollmentEntity> {
    const contractCode = input.contractCode || null;

    // Guard: Contract must exist and be ACTIVE（合同可选，为空跳过校验）
    if (contractCode) {
      const contract = await this.contractRepo.findOneByCode(contractCode);
      if (!contract) {
        throw new BadRequestException(`Contract not found: ${contractCode}`);
      }
      if (contract.status !== ContractStatus.ACTIVE) {
        throw new BadRequestException(
          `Contract ${contractCode} is not ACTIVE (current: ${contract.status})`,
        );
      }

      // ENROLL-NEW: Contract must belong to the same student
      if (contract.studentCode !== input.studentCode) {
        throw new BadRequestException(
          `Contract ${contractCode} does not belong to student ${input.studentCode}`,
        );
      }
    }

    // Guard: Cannot enroll same student in same class twice
    const existing = await this.enrollmentRepo.findByClassAndStudent(
      input.classCode,
      input.studentCode,
    );
    if (existing) {
      if (existing.status === EnrollmentStatus.ACTIVE) {
        throw new BadRequestException(
          `Student ${input.studentCode} is already actively enrolled in class ${input.classCode}`,
        );
      }
      // If previous enrollment was WITHDRAWN, update existing record instead of INSERT
      // This avoids unique constraint violation on (classCode, studentCode)
      existing.status = EnrollmentStatus.ACTIVE;
      existing.contractCode = contractCode;
      existing.withdrawReason = null;
      existing.enrolledBy = input.operatedBy;

      const saved = await this.enrollmentRepo.save(existing);
      this.logger.log(
        `Enrollment re-activated: class=${saved.classCode}, student=${saved.studentCode}, contract=${saved.contractCode}`,
      );
      return saved;
    }

    // Guard: 班级容量
    const targetClass = await this.classRepo.findOne({
      where: { classCode: input.classCode, deleted: false },
    });
    if (!targetClass) {
      throw new BadRequestException(`班级 ${input.classCode} 不存在`);
    }
    if (targetClass.status !== ClassStatus.ACTIVE) {
      throw new BadRequestException(
        `班级 ${input.classCode} 非进行中状态（${targetClass.status}），无法添加学生`,
      );
    }
    const activeCount = await this.enrollmentRepo.countActiveByClassCode(
      input.classCode,
    );
    if (activeCount >= targetClass.maxStudents) {
      throw new BadRequestException(
        `班级 ${input.classCode} 已满（${activeCount}/${targetClass.maxStudents}）`,
      );
    }

    // Guard: 学生维度排班冲突检测
    await this.assertNoScheduleConflict(input.classCode, input.studentCode);

    const enrollment = new EnrollmentEntity();
    enrollment.classCode = input.classCode;
    enrollment.studentCode = input.studentCode;
    enrollment.contractCode = contractCode;
    enrollment.status = EnrollmentStatus.ACTIVE;
    enrollment.withdrawReason = null;
    enrollment.enrolledBy = input.operatedBy;

    const saved = await this.enrollmentRepo.save(enrollment);
    this.logger.log(
      `Enrollment created: class=${saved.classCode}, student=${saved.studentCode}, contract=${saved.contractCode}`,
    );
    return saved;
  }

  /**
   * 学生维度排班冲突检测：
   * 该学生已有 ACTIVE 报名的班级，若与目标班级「星期几有交集 + 时段重叠」，则抛 BadRequest。
   * 时间基于 "HH:MM" 字典序比较（与 class.service 一致）。
   */
  private async assertNoScheduleConflict(
    classCode: string,
    studentCode: string,
  ): Promise<void> {
    const target = await this.classRepo.findOne({
      where: { classCode, deleted: false },
    });
    if (
      !target ||
      !target.dayOfWeek?.length ||
      !target.startTime ||
      !target.endTime
    ) {
      return;
    }

    // 该学生所有 ACTIVE 报名
    const activeEnrollments =
      await this.enrollmentRepo.findActiveByStudentCode(studentCode);
    const otherClassCodes = activeEnrollments
      .map((e) => e.classCode)
      .filter((c) => c !== classCode);
    if (otherClassCodes.length === 0) return;

    const classes = await this.classRepo.find({
      where: { classCode: In(otherClassCodes), deleted: false },
    });

    for (const cls of classes) {
      if (!cls.dayOfWeek?.length || !cls.startTime || !cls.endTime) continue;
      if (
        hasScheduleConflict(
          {
            dayOfWeek: cls.dayOfWeek,
            startTime: cls.startTime,
            endTime: cls.endTime,
          },
          {
            dayOfWeek: target.dayOfWeek,
            startTime: target.startTime,
            endTime: target.endTime,
          },
        )
      ) {
        throw new BadRequestException(
          `学生排班冲突：该学生已在班级 ${cls.classCode}（${cls.name || ''}）${cls.dayOfWeek.join('/')} ${cls.startTime}-${cls.endTime} 上课，与目标班级时间重叠`,
        );
      }
    }
  }

  // ─── Read ───

  async findOne(id: number): Promise<EnrollmentEntity> {
    const enrollment = await this.enrollmentRepo.findOneById(id);
    if (!enrollment) {
      throw new NotFoundException(`Enrollment not found: id=${id}`);
    }
    return enrollment;
  }

  async findByClassCode(classCode: string): Promise<EnrollmentEntity[]> {
    return this.enrollmentRepo.findByClassCode(classCode);
  }

  async findByStudentCode(studentCode: string): Promise<any[]> {
    const enrollments =
      await this.enrollmentRepo.findByStudentCode(studentCode);
    if (!enrollments.length) return [];

    // Collect class codes
    const classCodes = enrollments.map((e) => e.classCode);

    // Batch get classes (needed first to derive courseCodes)
    const classes = await this.classRepo.find({
      where: { classCode: In(classCodes) },
    });
    const classMap = new Map(classes.map((c) => [c.classCode, c]));

    // Optimization: parallelize 2 independent enrichment queries (was sequential)
    const courseCodes = [...new Set(classes.map((c) => c.courseCode))];
    const [courses, completedLessonCounts] = await Promise.all([
      this.courseRepo.find({ where: { courseCode: In(courseCodes) } }),
      this.lessonRepo
        .createQueryBuilder('l')
        .select('l.classCode', 'classCode')
        .addSelect('COUNT(*)', 'count')
        .where('l.classCode IN (:...classCodes)', { classCodes })
        .andWhere('l.status = :status', { status: LessonStatus.FINISHED })
        .groupBy('l.classCode')
        .getRawMany<{ classCode: string; count: string }>(),
    ]);
    const courseNameMap = new Map(courses.map((c) => [c.courseCode, c.name]));
    const completedMap = new Map<string, number>();
    completedLessonCounts.forEach((r) =>
      completedMap.set(r.classCode, parseInt(r.count, 10)),
    );

    // Assemble enriched response
    return enrollments.map((enrollment) => {
      const cls = classMap.get(enrollment.classCode);
      return {
        classCode: enrollment.classCode,
        className: cls?.name ?? '',
        courseName: cls ? (courseNameMap.get(cls.courseCode) ?? '') : '',
        completedLessons: completedMap.get(enrollment.classCode) ?? 0,
        totalLessons: cls?.totalLessons ?? 0,
        contractCode: enrollment.contractCode,
        status: enrollment.status,
      };
    });
  }

  async findAll(query: {
    classCode?: string;
    studentCode?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: EnrollmentEntity[]; total: number }> {
    return this.enrollmentRepo.findMany({
      classCode: query.classCode,
      studentCode: query.studentCode,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  /**
   * Find actively enrolled students with personal info for a class.
   * Reads ACTIVE enrollments → resolves student names via StudentRepository.
   */
  async findStudentsByClassCode(classCode: string) {
    const enrollments = await this.enrollmentRepo.findByClassCode(classCode);
    const activeEnrollments = enrollments.filter(
      (e) => e.status === EnrollmentStatus.ACTIVE,
    );
    const studentCodes = activeEnrollments.map((e) => e.studentCode);

    if (studentCodes.length === 0) {
      return [];
    }

    const students = await this.studentRepo.raw.find({
      where: { studentCode: In(studentCodes), deleted: false },
    });
    const studentMap = new Map(students.map((s) => [s.studentCode, s]));

    return activeEnrollments.map((e) => {
      const student = studentMap.get(e.studentCode);
      return {
        enrollmentId: e.id,
        studentCode: e.studentCode,
        name: student?.name ?? null,
        gender: student?.gender ?? null,
        phone: student?.phone ?? null,
        school: student?.school ?? null,
        grade: student?.grade ?? null,
        status: e.status,
        enrolledAt: e.enrolledAt,
      };
    });
  }

  /**
   * 教师可添加学生的候选池：
   * - Teacher：归属学生 = 该老师负责（teacher_assignment effectiveTo IS NULL）的班级里 ACTIVE 报名的学生
   * - Admin/SuperAdmin：同机构全部学生
   * 均排除已在本班（classCode）的学生，并附带每生 ACTIVE 合同（供选合同/无需合同）。
   */
  async findCandidates(params: {
    teacherId?: number;
    classCode?: string;
    keyword?: string;
  }) {
    const { teacherId, classCode, keyword } = params;

    const qb = this.studentRepo.raw
      .createQueryBuilder('student')
      .where('student.deleted = :deleted', { deleted: false });

    if (teacherId) {
      qb.andWhere(
        `student.studentCode IN (
          SELECT e.studentCode FROM enrollment e
          WHERE e.classCode IN (
            SELECT ta.classCode FROM teacher_assignment ta
            WHERE ta.teacherId = :teacherId AND ta.effectiveTo IS NULL
          ) AND e.status = :activeStatus
        )`,
        { teacherId, activeStatus: EnrollmentStatus.ACTIVE },
      );
    }

    // 排除已在本班的学生
    if (classCode) {
      qb.andWhere(
        `student.studentCode NOT IN (
          SELECT e.studentCode FROM enrollment e
          WHERE e.classCode = :classCode AND e.status = :activeStatus
        )`,
        { classCode, activeStatus: EnrollmentStatus.ACTIVE },
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

    qb.orderBy('student.createTime', 'DESC');
    qb.take(100);

    const students = await qb.getMany();

    // 附带每生 ACTIVE 合同
    const studentCodes = students.map((s) => s.studentCode);
    const contracts =
      studentCodes.length > 0
        ? await this.contractRepo.findActiveByStudentCodeIn(studentCodes)
        : [];

    const contractMap = new Map<string, ContractEntity[]>();
    contracts.forEach((c) => {
      const list = contractMap.get(c.studentCode) ?? [];
      list.push(c);
      contractMap.set(c.studentCode, list);
    });

    return students.map((s) => ({
      studentCode: s.studentCode,
      name: s.name,
      gender: s.gender,
      phone: s.phone,
      school: s.school,
      grade: s.grade,
      contracts: (contractMap.get(s.studentCode) ?? []).map((c) => ({
        contractCode: c.contractCode,
        subject: c.subject,
        totalLessons: c.totalLessons,
        remainingLessons: c.remainingLessons,
        status: c.status,
      })),
    }));
  }

  // ─── State transition guard ───

  private assertTransition(from: EnrollmentStatus, to: EnrollmentStatus): void {
    const allowed = VALID_ENROLLMENT_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid state transition: ${from} -> ${to}`,
      );
    }
  }

  // ─── Suspend ───

  async suspend(
    id: number,
    reason: string,
    _operatedBy: number,
  ): Promise<EnrollmentEntity> {
    const enrollment = await this.findOne(id);

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Reason required to suspend enrollment');
    }

    this.assertTransition(enrollment.status, EnrollmentStatus.SUSPEND);

    enrollment.status = EnrollmentStatus.SUSPEND;
    enrollment.withdrawReason = reason;

    const saved = await this.enrollmentRepo.save(enrollment);

    this.logger.log(
      `Enrollment suspended: id=${id}, class=${enrollment.classCode}, student=${enrollment.studentCode}`,
    );
    return saved;
  }

  // ─── Resume ───

  async resume(id: number, _operatedBy: number): Promise<EnrollmentEntity> {
    const enrollment = await this.findOne(id);

    this.assertTransition(enrollment.status, EnrollmentStatus.ACTIVE);

    enrollment.status = EnrollmentStatus.ACTIVE;
    enrollment.withdrawReason = null;

    const saved = await this.enrollmentRepo.save(enrollment);

    this.logger.log(
      `Enrollment resumed: id=${id}, class=${enrollment.classCode}, student=${enrollment.studentCode}`,
    );
    return saved;
  }

  // ─── Withdraw ───

  async withdraw(
    id: number,
    reason: string,
    _operatedBy: number,
  ): Promise<EnrollmentEntity> {
    const enrollment = await this.findOne(id);

    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new BadRequestException(
        `Only ACTIVE enrollments can be withdrawn (current: ${enrollment.status})`,
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Reason required to withdraw enrollment');
    }

    enrollment.status = EnrollmentStatus.WITHDRAWN;
    enrollment.withdrawReason = reason;

    const saved = await this.enrollmentRepo.save(enrollment);

    this.logger.log(
      `Enrollment withdrawn: id=${id}, class=${enrollment.classCode}, student=${enrollment.studentCode}`,
    );
    return saved;
  }

  // ─── Transfer (调班) ───

  async transfer(
    id: number,
    targetClassCode: string,
    reason: string | undefined,
    operatedBy: number,
  ): Promise<{ source: EnrollmentEntity; target: EnrollmentEntity }> {
    const source = await this.enrollmentRepo.findOneById(id);
    if (!source) {
      throw new NotFoundException(`报名记录不存在：id=${id}`);
    }
    if (source.status !== EnrollmentStatus.ACTIVE) {
      throw new BadRequestException(
        `仅 ACTIVE 状态可调班（当前：${source.status}）`,
      );
    }
    if (source.classCode === targetClassCode) {
      throw new BadRequestException('目标班级不能与当前班级相同');
    }

    const targetClass = await this.classRepo.findOne({
      where: { classCode: targetClassCode, deleted: false },
    });
    if (!targetClass) {
      throw new NotFoundException(`目标班级 ${targetClassCode} 不存在`);
    }
    if (targetClass.status !== ClassStatus.ACTIVE) {
      throw new BadRequestException(
        `目标班级 ${targetClassCode} 不是进行中状态（${targetClass.status}）`,
      );
    }

    const existingTarget = await this.enrollmentRepo.findByClassAndStudent(
      targetClassCode,
      source.studentCode,
    );
    if (existingTarget && existingTarget.status === EnrollmentStatus.ACTIVE) {
      throw new BadRequestException(`该学生已在目标班级 ${targetClassCode} 中`);
    }

    return this.enrollmentRepo.inTransaction(async (em) => {
      const emRepo = em.getRepository(EnrollmentEntity);

      // Capacity check INSIDE the transaction to shrink the TOCTOU window
      const activeCount = await emRepo.count({
        where: { classCode: targetClassCode, status: EnrollmentStatus.ACTIVE },
      });
      if (activeCount >= targetClass.maxStudents) {
        throw new BadRequestException(
          `目标班级 ${targetClassCode} 已满（${activeCount}/${targetClass.maxStudents}）`,
        );
      }

      // Mark source withdrawn
      source.status = EnrollmentStatus.WITHDRAWN;
      source.withdrawReason = reason || `调班至 ${targetClassCode}`;
      await emRepo.save(source);

      // Create or reuse target (contract is subject-based, not class-bound)
      const target = existingTarget ?? new EnrollmentEntity();
      target.classCode = targetClassCode;
      target.studentCode = source.studentCode;
      target.contractCode = source.contractCode;
      target.status = EnrollmentStatus.ACTIVE;
      target.withdrawReason = null;
      target.enrolledBy = operatedBy;
      const savedTarget = await emRepo.save(target);

      return { source, target: savedTarget };
    });
  }
}
