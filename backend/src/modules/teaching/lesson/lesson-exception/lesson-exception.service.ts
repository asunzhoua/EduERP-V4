import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { Repository, In, LessThan, EntityManager } from 'typeorm';
import { LessonExceptionEntity } from './lesson-exception.entity';
import { LessonExceptionLogEntity } from './lesson-exception-log.entity';
import { LessonRescheduleEntity } from './lesson-reschedule.entity';
import { LessonExceptionAttachmentEntity } from './lesson-exception-attachment.entity';
import { LessonEntity } from '../lesson.entity';
import { LessonStatus } from '../enums/lesson-status.enum';
import { LessonService } from '../lesson.service';
import { EventBusService } from '@events/event-bus.service';
import { QueryExceptionDto } from './dto/query-exception.dto';

/** Valid status transitions for Lesson */
const VALID_TRANSITIONS: Record<LessonStatus, LessonStatus[]> = {
  [LessonStatus.DRAFT]: [LessonStatus.SCHEDULED, LessonStatus.CANCELLED],
  [LessonStatus.SCHEDULED]: [
    LessonStatus.TEACHING,
    LessonStatus.CANCELLED,
    LessonStatus.SUSPENDED,
  ],
  [LessonStatus.TEACHING]: [LessonStatus.FINISHED, LessonStatus.CANCELLED],
  [LessonStatus.FINISHED]: [LessonStatus.ARCHIVED, LessonStatus.SCHEDULED],
  [LessonStatus.ARCHIVED]: [LessonStatus.FINISHED],
  [LessonStatus.CANCELLED]: [
    LessonStatus.SCHEDULED,
    LessonStatus.MAKEUP_PENDING,
    LessonStatus.RESCHEDULED,
  ],
  [LessonStatus.SUSPENDED]: [
    LessonStatus.SCHEDULED,
    LessonStatus.RESCHEDULED,
    LessonStatus.MAKEUP_PENDING,
  ],
  [LessonStatus.RESCHEDULED]: [LessonStatus.TEACHING],
  [LessonStatus.MAKEUP_PENDING]: [LessonStatus.RESCHEDULED],
  [LessonStatus.MAKEUP_COMPLETED]: [],
};

@Injectable()
export class LessonExceptionService {
  private readonly logger = new Logger(LessonExceptionService.name);

  constructor(
    @InjectRepository(LessonExceptionEntity)
    private readonly exceptionRepo: Repository<LessonExceptionEntity>,
    @InjectRepository(LessonExceptionLogEntity)
    private readonly exceptionLogRepo: Repository<LessonExceptionLogEntity>,
    @InjectRepository(LessonRescheduleEntity)
    private readonly rescheduleRepo: Repository<LessonRescheduleEntity>,
    @InjectRepository(LessonExceptionAttachmentEntity)
    private readonly attachmentRepo: Repository<LessonExceptionAttachmentEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly lessonService: LessonService,
    private readonly eventBus: EventBusService,
  ) {}

  // ═══════════════════════════════════════════════════
  // 1.1 请假申请
  // ═══════════════════════════════════════════════════

  async applyLeave(
    lessonId: number,
    exceptionType: 'LEAVE_SICK' | 'LEAVE_PERSONAL' | 'LEAVE_TRAINING',
    reason: string,
    startTime: Date,
    endTime: Date,
    attachments: any[],
    createdBy: number,
  ): Promise<LessonExceptionEntity> {
    // 1. Validate lesson exists
    const lesson = await this.findLessonOrThrow(lessonId);

    // 2. Business rules
    const now = new Date();

    if (exceptionType === 'LEAVE_SICK') {
      // 病假：需要附件（医院证明）
      if (!attachments || attachments.length === 0) {
        throw new BadRequestException(
          '病假必须上传附件（医院证明）',
        );
      }
    } else if (exceptionType === 'LEAVE_PERSONAL') {
      // 事假：至少提前24小时
      const hoursBefore = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursBefore < 24) {
        throw new BadRequestException(
          '事假必须至少提前24小时申请',
        );
      }
    } else if (exceptionType === 'LEAVE_TRAINING') {
      // 培训假：至少提前48小时
      const hoursBefore = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursBefore < 48) {
        throw new BadRequestException(
          '培训假必须至少提前48小时申请',
        );
      }
    }

    // 3. Create exception record
    const exception = new LessonExceptionEntity();
    exception.lessonId = lessonId;
    exception.exceptionType = exceptionType;
    exception.reason = reason;
    exception.startTime = startTime;
    exception.endTime = endTime;
    exception.status = 'PENDING';
    exception.attachments = attachments ?? null;
    exception.createdBy = createdBy;

    const saved = await this.exceptionRepo.save(exception);

    // 4. Log status flow
    await this.logExceptionStatus(
      saved.id,
      null,
      'PENDING',
      createdBy,
      'USER',
      `请假申请（${exceptionType}）`,
    );

    this.logger.log(
      `Leave exception created: id=${saved.id}, type=${exceptionType}, lessonId=${lessonId}`,
    );

    return saved;
  }

  // ═══════════════════════════════════════════════════
  // 1.2 停课申请
  // ═══════════════════════════════════════════════════

  async applySuspend(
    lessonIds: number[],
    exceptionType: 'SUSPEND_SHORT' | 'SUSPEND_LONG',
    reason: string,
    startTime: Date,
    endTime: Date,
    autoRestore: boolean,
    createdBy: number,
  ): Promise<LessonExceptionEntity[]> {
    // 1. Calculate duration in days
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationDays = durationMs / (1000 * 60 * 60 * 24);

    // 2. Business rules
    if (exceptionType === 'SUSPEND_SHORT') {
      // 短期停课：1-7天
      if (durationDays < 1 || durationDays > 7) {
        throw new BadRequestException(
          '短期停课天数必须在1-7天之间',
        );
      }
    } else if (exceptionType === 'SUSPEND_LONG') {
      // 长期停课：7天以上
      if (durationDays <= 7) {
        throw new BadRequestException(
          '长期停课天数必须大于7天',
        );
      }
    }

    // 3. Validate all lessons exist
    const lessons = await this.lessonRepo.find({
      where: { id: In(lessonIds) },
    });
    if (lessons.length !== lessonIds.length) {
      const foundIds = lessons.map((l) => l.id);
      const missingIds = lessonIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `课程不存在: ${missingIds.join(', ')}`,
      );
    }

    // 4. Create exception records
    const exceptions: LessonExceptionEntity[] = [];
    for (const lessonId of lessonIds) {
      const exception = new LessonExceptionEntity();
      exception.lessonId = lessonId;
      exception.exceptionType = exceptionType;
      exception.reason = reason;
      exception.startTime = startTime;
      exception.endTime = endTime;
      exception.status = 'PENDING';
      exception.attachments = null;
      exception.createdBy = createdBy;

      const saved = await this.exceptionRepo.save(exception);

      // Log status flow
      await this.logExceptionStatus(
        saved.id,
        null,
        'PENDING',
        createdBy,
        'USER',
        `停课申请（${exceptionType}）`,
      );

      exceptions.push(saved);
    }

    this.logger.log(
      `Suspend exceptions created: count=${exceptions.length}, type=${exceptionType}, autoRestore=${autoRestore}`,
    );

    return exceptions;
  }

  // ═══════════════════════════════════════════════════
  // 1.3 补课申请
  // ═══════════════════════════════════════════════════

  async applyMakeup(
    originalLessonId: number,
    exceptionId: number,
    rescheduledStart: Date,
    rescheduledEnd: Date,
    teacherId: number,
    roomId: number,
    operatorId: number,
  ): Promise<LessonRescheduleEntity> {
    // 1. Validate original lesson exists
    const originalLesson = await this.findLessonOrThrow(originalLessonId);

    // 2. Only CANCELLED or SUSPENDED lessons can have makeup
    if (
      originalLesson.status !== LessonStatus.CANCELLED &&
      originalLesson.status !== LessonStatus.SUSPENDED
    ) {
      throw new BadRequestException(
        `只有 CANCELLED 或 SUSPENDED 状态的课程可以补课，当前状态: ${originalLesson.status}`,
      );
    }

    // 3. Validate exception exists
    const exception = await this.exceptionRepo.findOne({
      where: { id: exceptionId },
    });
    if (!exception) {
      throw new NotFoundException(`异常记录不存在: id=${exceptionId}`);
    }

    // 4. Create reschedule record
    const reschedule = new LessonRescheduleEntity();
    reschedule.exceptionId = exceptionId;
    reschedule.originalLessonId = originalLessonId;
    reschedule.originalStart = new Date(
      `${originalLesson.scheduledDate}T${originalLesson.startTime}:00`,
    );
    reschedule.originalEnd = new Date(
      `${originalLesson.scheduledDate}T${originalLesson.endTime}:00`,
    );
    reschedule.rescheduledStart = rescheduledStart;
    reschedule.rescheduledEnd = rescheduledEnd;
    reschedule.status = 'PENDING';
    reschedule.operatorId = operatorId;

    const saved = await this.rescheduleRepo.save(reschedule);

    // 5. Change original lesson status to RESCHEDULED
    await this.transitionLessonStatus(
      originalLessonId,
      LessonStatus.RESCHEDULED,
      operatorId,
      'USER',
      '申请补课',
    );

    this.logger.log(
      `Makeup reschedule created: id=${saved.id}, originalLessonId=${originalLessonId}, status=RESCHEDULED`,
    );

    return saved;
  }

  // ═══════════════════════════════════════════════════
  // 1.4 审批流程
  // ═══════════════════════════════════════════════════

  async approve(
    exceptionId: number,
    approvedBy: number,
    remark?: string,
  ): Promise<LessonExceptionEntity> {
    // 1. Find exception
    const exception = await this.exceptionRepo.findOne({
      where: { id: exceptionId },
    });
    if (!exception) {
      throw new NotFoundException(`异常记录不存在: id=${exceptionId}`);
    }

    // 2. Validate status
    if (exception.status !== 'PENDING') {
      throw new BadRequestException(
        `只有 PENDING 状态的异常记录可以审批，当前状态: ${exception.status}`,
      );
    }

    // 3. Update exception status
    const fromStatus = exception.status;
    exception.status = 'APPROVED';
    exception.approvedBy = approvedBy;
    exception.approvedAt = new Date();
    const saved = await this.exceptionRepo.save(exception);

    // 4. Log exception status flow
    await this.logExceptionStatus(
      exceptionId,
      fromStatus,
      'APPROVED',
      approvedBy,
      'USER',
      remark || '审批通过',
    );

    // 5. Change lesson status based on exception type
    const lessonStatusMap: Record<string, LessonStatus> = {
      LEAVE_SICK: LessonStatus.CANCELLED,
      LEAVE_PERSONAL: LessonStatus.SUSPENDED,
      LEAVE_TRAINING: LessonStatus.SUSPENDED,
      SUSPEND_SHORT: LessonStatus.SUSPENDED,
      SUSPEND_LONG: LessonStatus.SUSPENDED,
    };

    const targetLessonStatus = lessonStatusMap[exception.exceptionType];
    if (targetLessonStatus) {
      await this.transitionLessonStatus(
        exception.lessonId,
        targetLessonStatus,
        approvedBy,
        'USER',
        `异常(${exception.exceptionType})审批通过`,
      );
    }

    this.logger.log(
      `Exception approved: id=${exceptionId}, type=${exception.exceptionType}, lessonStatus=${targetLessonStatus}`,
    );

    return saved;
  }

  async reject(
    exceptionId: number,
    approvedBy: number,
    rejectReason: string,
  ): Promise<LessonExceptionEntity> {
    // 1. Find exception
    const exception = await this.exceptionRepo.findOne({
      where: { id: exceptionId },
    });
    if (!exception) {
      throw new NotFoundException(`异常记录不存在: id=${exceptionId}`);
    }

    // 2. Validate status
    if (exception.status !== 'PENDING') {
      throw new BadRequestException(
        `只有 PENDING 状态的异常记录可以拒绝，当前状态: ${exception.status}`,
      );
    }

    // 3. Update exception
    const fromStatus = exception.status;
    exception.status = 'REJECTED';
    exception.approvedBy = approvedBy;
    exception.approvedAt = new Date();
    exception.rejectReason = rejectReason;
    const saved = await this.exceptionRepo.save(exception);

    // 4. Log exception status flow
    await this.logExceptionStatus(
      exceptionId,
      fromStatus,
      'REJECTED',
      approvedBy,
      'USER',
      `拒绝原因: ${rejectReason}`,
    );

    this.logger.log(
      `Exception rejected: id=${exceptionId}, type=${exception.exceptionType}`,
    );

    return saved;
  }

  // ═══════════════════════════════════════════════════
  // 1.5 自动恢复
  // ═══════════════════════════════════════════════════

  async autoRestore(): Promise<void> {
    const now = new Date();

    // Find all APPROVED exceptions with endTime in the past
    // that are of suspend/leave types (any type that causes SUSPENDED status)
    const expiredExceptions = await this.exceptionRepo.find({
      where: {
        status: 'APPROVED',
        endTime: LessThan(now),
      },
    });

    if (expiredExceptions.length === 0) {
      this.logger.log('autoRestore: no expired exceptions found');
      return;
    }

    let restoredCount = 0;
    for (const exception of expiredExceptions) {
      // Only process exceptions that cause SUSPENDED status
      const suspendTypes = [
        'LEAVE_PERSONAL',
        'LEAVE_TRAINING',
        'SUSPEND_SHORT',
        'SUSPEND_LONG',
      ];
      if (!suspendTypes.includes(exception.exceptionType)) {
        continue;
      }

      const lesson = await this.findLessonOrThrow(exception.lessonId);

      // Only restore lessons that are currently SUSPENDED
      if (lesson.status !== LessonStatus.SUSPENDED) {
        continue;
      }

      try {
        await this.transitionLessonStatus(
          lesson.id,
          LessonStatus.SCHEDULED,
          0,
          'SYSTEM',
          `自动恢复（异常到期）`,
        );
        restoredCount++;
        this.logger.log(
          `Lesson auto-restored: lessonId=${lesson.id}, exceptionId=${exception.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `autoRestore failed for lesson ${lesson.id}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `autoRestore completed: ${restoredCount} lessons restored out of ${expiredExceptions.length} expired exceptions`,
    );
  }

  // ═══════════════════════════════════════════════════
  // 2. 状态流转服务
  // ═══════════════════════════════════════════════════

  private async transitionLessonStatus(
    lessonId: number,
    newStatus: LessonStatus,
    operatorId: number,
    operatorType: 'USER' | 'SYSTEM',
    remark?: string,
  ): Promise<void> {
    const lesson = await this.findLessonOrThrow(lessonId);

    // Validate transition
    const allowed = VALID_TRANSITIONS[lesson.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `非法状态转换: ${lesson.status} -> ${newStatus}`,
      );
    }

    // Update lesson status
    const oldStatus = lesson.status;
    lesson.status = newStatus;

    // Handle cancellation reason
    if (newStatus === LessonStatus.CANCELLED && !lesson.cancelledReason) {
      lesson.cancelledReason = remark || '异常流程取消';
    }

    await this.lessonRepo.save(lesson);

    this.logger.log(
      `Lesson status transition: id=${lessonId} ${oldStatus} -> ${newStatus} (operatorType=${operatorType})`,
    );
  }

  // ═══════════════════════════════════════════════════
  // 3. 补课完成处理
  // ═══════════════════════════════════════════════════

  async completeMakeupLesson(makeupLessonId: number): Promise<void> {
    // 1. Find the makeup lesson
    const makeupLesson = await this.findLessonOrThrow(makeupLessonId);

    if (!makeupLesson.isMakeup) {
      throw new BadRequestException(
        `课程 ${makeupLessonId} 不是补课课程`,
      );
    }

    // 2. Change makeup lesson status to FINISHED
    await this.transitionLessonStatus(
      makeupLessonId,
      LessonStatus.FINISHED,
      0,
      'SYSTEM',
      '补课完成',
    );

    // 3. Find the original lesson
    const originalLessonId = makeupLesson.originLessonId;
    if (!originalLessonId) {
      throw new BadRequestException(
        `补课课程 ${makeupLessonId} 缺少原课程关联`,
      );
    }

    // 4. Change original lesson status to MAKEUP_COMPLETED
    const originalLesson = await this.findLessonOrThrow(originalLessonId);

    // Directly update since MAKEUP_COMPLETED may not be in VALID_TRANSITIONS
    // for all current states
    if (originalLesson.status === LessonStatus.RESCHEDULED) {
      originalLesson.status = LessonStatus.MAKEUP_COMPLETED;
      await this.lessonRepo.save(originalLesson);
      this.logger.log(
        `Original lesson status updated: id=${originalLessonId} ${originalLesson.status} -> MAKEUP_COMPLETED`,
      );
    } else {
      // Try via transition service
      await this.transitionLessonStatus(
        originalLessonId,
        LessonStatus.MAKEUP_COMPLETED,
        0,
        'SYSTEM',
        '补课完成，原课程结课',
      );
    }

    // 5. Publish lesson.completed event for makeup lesson (triggers deduction)
    const makeupDuration = this.computeDurationMinutes(
      makeupLesson.startTime,
      makeupLesson.endTime,
    );
    this.eventBus.publish('lesson.completed', {
      lessonId: makeupLesson.id,
      classCode: makeupLesson.classCode,
      courseCode: makeupLesson.courseCode,
      teacherId: makeupLesson.teacherId,
      scheduledDate: makeupLesson.scheduledDate,
      actualStartTime: new Date().toISOString(),
      actualEndTime: new Date().toISOString(),
      durationMinutes: makeupDuration,
      isMakeup: true,
      originalLessonId: originalLessonId,
    });

    // 6. Publish salary calculation event
    this.eventBus.publish('salary.calculation.triggered', {
      lessonId: makeupLesson.id,
      teacherId: makeupLesson.teacherId,
      classCode: makeupLesson.classCode,
      scheduledDate: makeupLesson.scheduledDate,
      durationMinutes: makeupDuration,
      isMakeup: true,
    });

    this.logger.log(
      `Makeup lesson completed: makeupLessonId=${makeupLessonId}, originalLessonId=${originalLessonId}`,
    );
  }

  // ═══════════════════════════════════════════════════
  // Query Methods
  // ═══════════════════════════════════════════════════

  async findExceptionsByLesson(lessonId: number): Promise<LessonExceptionEntity[]> {
    return this.exceptionRepo.find({
      where: { lessonId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllExceptions(): Promise<LessonExceptionEntity[]> {
    return this.exceptionRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findExceptionById(id: number): Promise<LessonExceptionEntity> {
    const exception = await this.exceptionRepo.findOne({
      where: { id },
    });
    if (!exception) {
      throw new NotFoundException(`异常记录不存在: id=${id}`);
    }
    return exception;
  }

  async findReschedulesByException(
    exceptionId: number,
  ): Promise<LessonRescheduleEntity[]> {
    return this.rescheduleRepo.find({
      where: { exceptionId },
      order: { createdAt: 'DESC' },
    });
  }

  // ═══════════════════════════════════════════════════
  // 4. Query Methods with Data Isolation v2
  // ═══════════════════════════════════════════════════

  /**
   * Query exceptions with role-based data isolation and optional filter criteria.
   *
   * - SuperAdmin / Admin: see ALL exceptions
   * - Teacher: only exceptions for lessons where teacherId === user.sub
   * - Parent: only exceptions for lessons whose class has students linked to this parent
   */
  async findAllExceptionsWithQuery(
    query: QueryExceptionDto,
    user: any,
  ): Promise<LessonExceptionEntity[]> {
    const qb = this.exceptionRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.lesson', 'lesson')
      .orderBy('e.createdAt', 'DESC');

    const userId = Number(user.sub);
    const role = user.role;

    // ── Data isolation ──
    if (role === 'Teacher') {
      // Teacher: only exceptions for lessons they teach
      qb.andWhere('lesson.teacherId = :teacherId', { teacherId: userId });
    } else if (role === 'Parent') {
      // Parent: only exceptions for lessons in classes where their children are enrolled
      // Find all classCodes that have students linked to this parent
      const classCodes = await this.entityManager
        .createQueryBuilder()
        .select('DISTINCT enr.classCode', 'classCode')
        .from('enrollment', 'enr')
        .innerJoin('student', 's', 's.studentCode = enr.studentCode')
        .innerJoin('student_parent', 'sp', 'sp.studentId = s.id')
        .where('sp.parentId = :parentId', { parentId: userId })
        .getRawMany()
        .then((rows) => rows.map((r) => r.classCode));

      if (classCodes.length === 0) {
        return [];
      }

      qb.andWhere('lesson.classCode IN (:...classCodes)', { classCodes });
    }

    // ── Filter criteria ──
    if (query.status) {
      qb.andWhere('e.status = :status', { status: query.status });
    }
    if (query.exceptionType) {
      qb.andWhere('e.exceptionType = :exceptionType', { exceptionType: query.exceptionType });
    }
    if (query.startDate) {
      qb.andWhere('e.startTime >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('e.endTime <= :endDate', { endDate: query.endDate });
    }

    return qb.getMany();
  }

  /**
   * Find a single exception by id, with full relations loaded:
   * lesson, approval logs, and reschedule records.
   */
  async findExceptionByIdWithRelations(id: number): Promise<LessonExceptionEntity> {
    const exception = await this.exceptionRepo.findOne({
      where: { id },
      relations: { lesson: true } as any,
    });
    if (!exception) {
      throw new NotFoundException(`异常记录不存在: id=${id}`);
    }
    return exception;
  }

  /**
   * Check whether the given user is permitted to access an exception's data.
   */
  async canAccessException(exceptionId: number, user: any): Promise<boolean> {
    const role = user.role;
    if (role === 'SuperAdmin' || role === 'Admin') {
      return true;
    }

    const exception = await this.exceptionRepo.findOne({
      where: { id: exceptionId },
      relations: { lesson: true } as any,
    });
    if (!exception || !exception.lesson) {
      return false;
    }

    if (role === 'Teacher') {
      return exception.lesson.teacherId === Number(user.sub);
    }

    if (role === 'Parent') {
      // Check if the parent has a child in the lesson's class
      const count = await this.entityManager
        .createQueryBuilder()
        .from('enrollment', 'enr')
        .innerJoin('student', 's', 's.studentCode = enr.studentCode')
        .innerJoin('student_parent', 'sp', 'sp.studentId = s.id')
        .where('enr.classCode = :classCode', { classCode: exception.lesson.classCode })
        .andWhere('sp.parentId = :parentId', { parentId: Number(user.sub) })
        .getCount();
      return count > 0;
    }

    return false;
  }

  /**
   * Find a single reschedule record by exception id, with lesson info loaded.
   */
  async findRescheduleByExceptionId(
    exceptionId: number,
  ): Promise<LessonRescheduleEntity | null> {
    const reschedules = await this.rescheduleRepo.find({
      where: { exceptionId },
      relations: { originalLesson: true, newLesson: true, exception: true } as any,
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return reschedules.length > 0 ? reschedules[0] : null;
  }

  /**
   * Find all status-change logs for a given exception.
   */
  async findExceptionsLogsByException(
    exceptionId: number,
  ): Promise<LessonExceptionLogEntity[]> {
    return this.exceptionLogRepo.find({
      where: { exceptionId },
      order: { operatedAt: 'ASC' },
    });
  }

  // ═══════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════

  private async findLessonOrThrow(id: number): Promise<LessonEntity> {
    const lesson = await this.lessonRepo.findOne({ where: { id } });
    if (!lesson) {
      throw new NotFoundException(`课程不存在: id=${id}`);
    }
    return lesson;
  }

  private async logExceptionStatus(
    exceptionId: number,
    fromStatus: string | null,
    toStatus: string,
    operatorId: number,
    operatorType: 'USER' | 'SYSTEM',
    remark?: string | null,
  ): Promise<void> {
    const log = new LessonExceptionLogEntity();
    log.exceptionId = exceptionId;
    log.fromStatus = fromStatus ?? 'NONE';
    log.toStatus = toStatus;
    log.operatorType = operatorType;
    log.operatorId = operatorId;
    log.operatedAt = new Date();
    log.remark = remark ?? '';
    await this.exceptionLogRepo.save(log);
  }

  private computeDurationMinutes(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    return endH * 60 + endM - (startH * 60 + startM);
  }
}
