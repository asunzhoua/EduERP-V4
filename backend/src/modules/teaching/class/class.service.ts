import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClassRepository } from './class.repository';
import { ClassCodeGeneratorService } from './class-code-generator.service';
import { ClassEntity } from './class.entity';
import { ClassStatus } from './enums/class-status.enum';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { QueryClassDto } from './dto/query-class.dto';
import { TeacherAssignmentService } from '../teacher-assignment/teacher-assignment.service';
import { TeacherAssignmentEntity } from '../teacher-assignment/teacher-assignment.entity';
import { ClassroomService } from '../classroom/classroom.service';
import { TeacherRole } from '@common/enums/teacher-role.enum';
import { CourseRepository } from '../course/course.repository';
import { EnrollmentRepository } from '../enrollment/enrollment.repository';
import { LessonRepository } from '../lesson/lesson.repository';
import { LessonStatus } from '../lesson/enums/lesson-status.enum';
import { User } from '../../identity/entities/user.entity';
import { hasScheduleConflict } from './schedule-conflict.util';

/** Allowed status transitions per ClassStateMachine */
const VALID_TRANSITIONS: Record<ClassStatus, ClassStatus[]> = {
  [ClassStatus.DRAFT]: [ClassStatus.ACTIVE, ClassStatus.CANCELLED],
  [ClassStatus.ACTIVE]: [ClassStatus.COMPLETED, ClassStatus.CANCELLED],
  [ClassStatus.COMPLETED]: [], // Terminal
  [ClassStatus.CANCELLED]: [ClassStatus.ACTIVE],
};

@Injectable()
export class ClassService {
  private readonly logger = new Logger(ClassService.name);

  constructor(
    private readonly classRepo: ClassRepository,
    private readonly codeGenerator: ClassCodeGeneratorService,
    private readonly teacherAssignmentService: TeacherAssignmentService,
    private readonly classroomService: ClassroomService,
    private readonly courseRepo: CourseRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly lessonRepo: LessonRepository,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ─── Create ───

  async create(dto: CreateClassDto, operatedBy: number): Promise<ClassEntity> {
    const classCode = await this.codeGenerator.generateClassCode();

    // 若指定教室，校验存在性并冗余同步 room（写教室名）
    let room: string | null = dto.room ?? null;
    if (dto.classroomId !== undefined && dto.classroomId !== null) {
      const classroom = await this.classroomService.findById(dto.classroomId);
      room = classroom.name;
    }

    const cls = this.classRepo.raw.create({
      classCode,
      courseCode: dto.courseCode,
      name: dto.name,
      status: ClassStatus.DRAFT,
      startDate: dto.startDate,
      totalLessons: dto.totalLessons ?? null,
      defaultDuration: dto.defaultDuration ?? 60,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      maxStudents: dto.maxStudents ?? 20,
      classroomId: dto.classroomId ?? null,
      room,
      tags: dto.tags ?? null,
      note: dto.note ?? null,
      createdBy: operatedBy,
    });

    const saved = await this.classRepo.save(cls);
    this.logger.log(`Class created: ${saved.classCode}`);
    return saved;
  }

  // ─── Read ───

  async findByCode(classCode: string): Promise<ClassEntity> {
    const cls = await this.classRepo.findOneByCode(classCode);
    if (!cls) {
      throw new NotFoundException(`Class not found: ${classCode}`);
    }
    return cls;
  }

  async findAll(
    query: QueryClassDto,
    teacherId?: number,
  ): Promise<{ items: ClassEntity[]; total: number }> {
    return this.classRepo.findMany({
      name: query.name,
      courseCode: query.courseCode,
      status: query.status,
      teacherId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  // ─── Update ───

  async update(
    classCode: string,
    dto: UpdateClassDto,
    operatedBy: number,
  ): Promise<ClassEntity> {
    const cls = await this.findByCode(classCode);

    if (cls.status !== ClassStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT classes can be edited. Current status: ${cls.status}`,
      );
    }

    const updatableFields: Array<keyof UpdateClassDto> = [
      'name',
      'startDate',
      'totalLessons',
      'defaultDuration',
      'dayOfWeek',
      'startTime',
      'endTime',
      'maxStudents',
      'classroomId',
      'room',
      'tags',
      'note',
    ];

    for (const field of updatableFields) {
      const newValue = dto[field];
      if (newValue !== undefined) {
        (cls[field as keyof ClassEntity] as typeof newValue) = newValue;
      }
    }

    // 若改 classroomId，同步 room（冗余写教室名）
    if (dto.classroomId !== undefined) {
      if (dto.classroomId === null) {
        cls.room = null;
      } else {
        const classroom = await this.classroomService.findById(dto.classroomId);
        cls.room = classroom.name;
      }
    }

    cls.updatedBy = operatedBy;
    const saved = await this.classRepo.save(cls);
    this.logger.log(`Class updated: ${classCode}`);
    return saved;
  }

  // ─── Status Change ───

  async updateStatus(
    classCode: string,
    targetStatus: ClassStatus,
    operatedBy: number,
    cancelledReason?: string,
  ): Promise<ClassEntity> {
    const cls = await this.findByCode(classCode);

    if (cls.status === targetStatus) {
      throw new BadRequestException(
        `Class is already in status: ${targetStatus}`,
      );
    }

    const allowed = VALID_TRANSITIONS[cls.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${cls.status} -> ${targetStatus}. ` +
          `Allowed transitions from ${cls.status}: ${allowed.join(', ') || 'none (terminal)'}`,
      );
    }

    // ─── Transition Guards ───

    if (
      cls.status === ClassStatus.DRAFT &&
      targetStatus === ClassStatus.ACTIVE
    ) {
      await this.guardActivation(cls);
    }

    if (targetStatus === ClassStatus.CANCELLED) {
      if (!cancelledReason || cancelledReason.trim().length === 0) {
        throw new BadRequestException(
          'cancelledReason is required for CANCELLED status',
        );
      }
      cls.cancelledReason = cancelledReason;
    }

    const oldStatus = cls.status;
    cls.status = targetStatus;
    cls.updatedBy = operatedBy;

    const saved = await this.classRepo.save(cls);

    // ─── Lesson Generation Placeholder (Plan A) ───
    // Domain Intent: When Class transitions DRAFT → ACTIVE, all Lessons should be
    // auto-generated in batch. This will be implemented when the Lesson module
    // is developed (Sprint 4.1.4). For now, activation completes without generating
    // lessons. See TeachingDomainModel.md Section 4.1 for the generation algorithm.
    if (
      oldStatus === ClassStatus.DRAFT &&
      targetStatus === ClassStatus.ACTIVE
    ) {
      this.logger.log(
        `Class ${classCode} activated — Lesson generation pending Lesson module implementation`,
      );
    }

    this.logger.log(
      `Class status changed: ${classCode} ${oldStatus} -> ${targetStatus}`,
    );
    return saved;
  }

  // ─── Soft Delete ───

  async remove(classCode: string, operatedBy: number): Promise<void> {
    const cls = await this.findByCode(classCode);

    if (cls.status !== ClassStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT classes can be deleted. Current status: ${cls.status}`,
      );
    }

    cls.deleted = true;
    cls.updatedBy = operatedBy;
    await this.classRepo.save(cls);

    this.logger.log(`Class soft-deleted: ${classCode}`);
  }

  // ─── Data Enrichment ───

  private formatSchedule(
    dayOfWeek: number[],
    startTime: string,
    endTime: string,
  ): string {
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const sortedDays = [...dayOfWeek].sort((a, b) => a - b);
    const dayStr = sortedDays.map((d) => dayNames[d]).join(',');
    return `${dayStr} ${startTime}-${endTime}`;
  }

  private async enrichClassroomNames(
    classes: ClassEntity[],
  ): Promise<Map<number, string>> {
    const classroomIds = [
      ...new Set(
        classes
          .map((c) => c.classroomId)
          .filter((id): id is number => id !== null && id !== undefined),
      ),
    ];
    if (classroomIds.length === 0) return new Map();
    const classrooms = await this.classroomService.findByIds(classroomIds);
    const map = new Map<number, string>();
    classrooms.forEach((cr) => map.set(Number(cr.id), cr.name));
    return map;
  }

  async enrichClasses(classes: ClassEntity[]): Promise<any[]> {
    if (!classes.length) return [];

    const classCodes = classes.map((c) => c.classCode);
    const courseCodes = [...new Set(classes.map((c) => c.courseCode))];

    const [
      courses,
      enrollmentCounts,
      lessonCounts,
      endDateMap,
      classroomNames,
    ] = await Promise.all([
      this.courseRepo.findByCodes(courseCodes),
      this.enrollmentRepo.countActiveByClassCodes(classCodes),
      this.lessonRepo.countFinishedByClassCodes(classCodes),
      this.lessonRepo.findMaxScheduledDateByClassCodes(classCodes),
      this.enrichClassroomNames(classes),
    ]);

    const courseNameMap = new Map<string, string>();
    courses.forEach((c) => courseNameMap.set(c.courseCode, c.name));

    // Batch resolve teacher names (eliminates N+1: 2N queries → 2 queries)
    const primaryAssignments =
      await this.teacherAssignmentService.findActivePrimaryByClassCodes(
        classCodes,
      );
    const teacherIds = [...new Set(primaryAssignments.map((a) => a.teacherId))];
    const teachers =
      teacherIds.length > 0
        ? await this.userRepo.find({ where: { id: In(teacherIds) } })
        : [];
    const teacherNameById = new Map(teachers.map((t) => [t.id, t.name]));
    const teacherNameMap = new Map(
      primaryAssignments.map((a) => [
        a.classCode,
        teacherNameById.get(a.teacherId) ?? '',
      ]),
    );

    return classes.map((cls) => ({
      ...cls,
      courseName: courseNameMap.get(cls.courseCode) ?? '',
      teacherName: teacherNameMap.get(cls.classCode) ?? '',
      currentStudents: enrollmentCounts.get(cls.classCode) ?? 0,
      completedLessons: lessonCounts.get(cls.classCode) ?? 0,
      schedule: this.formatSchedule(cls.dayOfWeek, cls.startTime, cls.endTime),
      endDate: endDateMap.get(cls.classCode) ?? null,
      classroomName:
        cls.classroomId !== null && cls.classroomId !== undefined
          ? (classroomNames.get(Number(cls.classroomId)) ?? cls.room ?? '')
          : (cls.room ?? ''),
    }));
  }

  async enrichClass(cls: ClassEntity): Promise<any> {
    const [
      course,
      currentStudents,
      completedLessons,
      endDate,
      primaryTeacher,
      classroomNames,
    ] = await Promise.all([
      this.courseRepo.findOneByCode(cls.courseCode),
      this.enrollmentRepo.countActiveByClassCode(cls.classCode),
      this.lessonRepo.countByClassCodeAndStatus(
        cls.classCode,
        LessonStatus.FINISHED,
      ),
      this.lessonRepo.findMaxScheduledDateByClassCode(cls.classCode),
      this.teacherAssignmentService.findActivePrimary(cls.classCode),
      this.enrichClassroomNames([cls]),
    ]);

    let teacherName = '';
    if (primaryTeacher) {
      const teacher = await this.userRepo.findOne({
        where: { id: primaryTeacher.teacherId },
      });
      teacherName = teacher?.name ?? '';
    }

    return {
      ...cls,
      courseName: course?.name ?? '',
      teacherName,
      currentStudents,
      completedLessons,
      schedule: this.formatSchedule(cls.dayOfWeek, cls.startTime, cls.endTime),
      endDate: endDate ?? null,
      classroomName:
        cls.classroomId !== null && cls.classroomId !== undefined
          ? (classroomNames.get(Number(cls.classroomId)) ?? cls.room ?? '')
          : (cls.room ?? ''),
    };
  }

  // ─── Teacher Management (delegates to TeacherAssignmentService) ───

  async assignTeacher(params: {
    classCode: string;
    teacherId: number;
    role: TeacherRole;
    assignedBy: number;
    reason?: string;
  }) {
    // Verify class exists
    await this.findByCode(params.classCode);

    return this.teacherAssignmentService.assign(params);
  }

  async removeTeacher(assignmentId: number): Promise<void> {
    return this.teacherAssignmentService.unassign(assignmentId);
  }

  async getTeachers(classCode: string) {
    // Verify class exists
    await this.findByCode(classCode);

    return this.teacherAssignmentService.findActiveByClass(classCode);
  }

  /** 当前 PRIMARY 教师（用于 Teacher 归属校验）。 */
  async findPrimaryTeacher(
    classCode: string,
  ): Promise<TeacherAssignmentEntity | null> {
    return this.teacherAssignmentService.findActivePrimary(classCode);
  }

  /**
   * 校验某 Teacher 是否为该班级的 PRIMARY 老师，不是则抛 ForbiddenException。
   * 供 Enrollment 等模块在 Teacher 操作班级学生时做归属校验。
   */
  async assertPrimaryTeacher(
    classCode: string,
    teacherId: number,
  ): Promise<void> {
    const primary =
      await this.teacherAssignmentService.findActivePrimary(classCode);
    if (!primary || Number(primary.teacherId) !== Number(teacherId)) {
      throw new ForbiddenException('您不是该班级的主讲老师，无法管理班级学生');
    }
  }

  // ─── Activation Guard (private) ───

  private async guardActivation(cls: ClassEntity): Promise<void> {
    const errors: string[] = [];

    // Guard 1: At least one PRIMARY TeacherAssignment
    const primaryCount = await this.teacherAssignmentService.countActivePrimary(
      cls.classCode,
    );
    if (primaryCount === 0) {
      errors.push('At least one PRIMARY teacher must be assigned');
    }

    // Guard 2: Schedule defined
    if (!cls.dayOfWeek || cls.dayOfWeek.length === 0) {
      errors.push('dayOfWeek must be defined (at least one day)');
    }
    if (!cls.startTime || !cls.endTime) {
      errors.push('startTime and endTime must be defined');
    }
    // Guard 2.1: endTime must be after startTime
    if (cls.startTime && cls.endTime && cls.endTime <= cls.startTime) {
      errors.push('endTime must be after startTime');
    }
    if (!cls.startDate) {
      errors.push('startDate must be defined');
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Class activation failed — guards not met:\n  ${errors.join('\n  ')}`,
      );
    }

    // 排班冲突检测（同教室 / 同 PRIMARY 老师，时段重叠）
    const conflictErrors = await this.checkScheduleConflict(cls);
    if (conflictErrors.length > 0) {
      throw new BadRequestException(
        `Class activation failed — schedule conflicts:\n  ${conflictErrors.join('\n  ')}`,
      );
    }
  }

  // ─── Schedule Conflict Detection ───

  /**
   * 排班冲突检测：
   *   1. 同教室：另一未删除 DRAFT/ACTIVE 班级使用同一 classroomId，且「星期几有交集 + 时段重叠」。
   *   2. 同 PRIMARY 老师：该老师的另一未删除 DRAFT/ACTIVE 班级，且「星期几有交集 + 时段重叠」。
   * 时间比较基于 "HH:MM" 字典序：a.startTime < b.endTime && b.startTime < a.endTime 即重叠。
   * 返回人类可读的冲突描述列表（空数组 = 无冲突）。
   */
  private async checkScheduleConflict(cls: ClassEntity): Promise<string[]> {
    const conflicts: string[] = [];

    // 1. 同教室冲突
    if (cls.classroomId !== null && cls.classroomId !== undefined) {
      const rows = await this.classRepo.raw
        .createQueryBuilder('c')
        .select('c.classCode', 'classCode')
        .addSelect('c.name', 'name')
        .addSelect('c.dayOfWeek', 'dayOfWeek')
        .addSelect('c.startTime', 'startTime')
        .addSelect('c.endTime', 'endTime')
        .where('c.deleted = :deleted', { deleted: false })
        .andWhere('c.status IN (:...statuses)', {
          statuses: [ClassStatus.DRAFT, ClassStatus.ACTIVE],
        })
        .andWhere('c.classroomId = :classroomId', {
          classroomId: cls.classroomId,
        })
        .andWhere('c.id != :id', { id: cls.id })
        .getRawMany<{
          classCode: string;
          name: string;
          dayOfWeek: string;
          startTime: string;
          endTime: string;
        }>();

      for (const row of rows) {
        let rowDays: number[] = [];
        try {
          rowDays = JSON.parse(row.dayOfWeek) as number[];
        } catch {
          rowDays = [];
        }
        if (
          hasScheduleConflict(
            {
              dayOfWeek: rowDays,
              startTime: row.startTime,
              endTime: row.endTime,
            },
            {
              dayOfWeek: cls.dayOfWeek,
              startTime: cls.startTime,
              endTime: cls.endTime,
            },
          )
        ) {
          conflicts.push(
            `教室冲突：与班级 ${row.classCode}（${row.name}）共用教室，时段重叠`,
          );
        }
      }
    }

    // 2. 同 PRIMARY 老师冲突（子查询与 class.repository findMany 一致）
    const primary = await this.teacherAssignmentService.findActivePrimary(
      cls.classCode,
    );
    if (primary) {
      const rows = await this.classRepo.raw
        .createQueryBuilder('c')
        .select('c.classCode', 'classCode')
        .addSelect('c.name', 'name')
        .addSelect('c.dayOfWeek', 'dayOfWeek')
        .addSelect('c.startTime', 'startTime')
        .addSelect('c.endTime', 'endTime')
        .where('c.deleted = :deleted', { deleted: false })
        .andWhere('c.status IN (:...statuses)', {
          statuses: [ClassStatus.DRAFT, ClassStatus.ACTIVE],
        })
        .andWhere('c.id != :id', { id: cls.id })
        .andWhere(
          `c.classCode IN (SELECT ta.classCode FROM teacher_assignment ta WHERE ta.teacherId = :teacherId AND ta.effectiveTo IS NULL)`,
          { teacherId: primary.teacherId },
        )
        .getRawMany<{
          classCode: string;
          name: string;
          dayOfWeek: string;
          startTime: string;
          endTime: string;
        }>();

      for (const row of rows) {
        let rowDays: number[] = [];
        try {
          rowDays = JSON.parse(row.dayOfWeek) as number[];
        } catch {
          rowDays = [];
        }
        if (
          hasScheduleConflict(
            {
              dayOfWeek: rowDays,
              startTime: row.startTime,
              endTime: row.endTime,
            },
            {
              dayOfWeek: cls.dayOfWeek,
              startTime: cls.startTime,
              endTime: cls.endTime,
            },
          )
        ) {
          conflicts.push(
            `老师排班冲突：与班级 ${row.classCode}（${row.name}）上课时段重叠`,
          );
        }
      }
    }

    return conflicts;
  }
}
