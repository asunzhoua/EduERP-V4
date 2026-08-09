import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, In } from 'typeorm';
import { ContractRepository } from './contract.repository';
import { ContractCodeGeneratorService } from './contract-code-generator.service';
import { ContractEntity } from './contract.entity';
import { ContractStatus } from './enums/contract-status.enum';
import { Subject } from '@common/enums/subject.enum';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { Student } from '@modules/student/entities/student.entity';

/** Allowed status transitions per ContractStateMachine */
const VALID_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  [ContractStatus.ACTIVE]: [ContractStatus.FROZEN, ContractStatus.REFUNDED],
  [ContractStatus.EXHAUSTED]: [ContractStatus.REFUNDED],
  [ContractStatus.EXPIRED]: [ContractStatus.REFUNDED],
  [ContractStatus.FROZEN]: [ContractStatus.ACTIVE, ContractStatus.REFUNDED],
  [ContractStatus.REFUNDED]: [],
};

/** Input for creating a Contract. */
export interface CreateContractInput {
  studentCode: string;
  subject: Subject;
  totalLessons: number;
  validFrom: string;
  validTo?: string | null;
  unitPrice?: number | null;
  totalAmount?: number | null;
  note?: string | null;
  tags?: string[] | null;
}

/** 单条课时消耗流水（一条 = 该合同消耗 1 课时）。 */
export interface ConsumeRecord {
  lessonId: number;
  lessonDate: string | null;
  startTime: string | null;
  endTime: string | null;
  courseName: string | null;
  subject: string;
  lessonType: 'NORMAL' | 'MAKEUP';
  lessonTypeLabel: '正常' | '补课';
  lessonsConsumed: number;
  topic: string | null;
  status: string | null;
  deductedAt: string | null;
}

/** 续费预警条目（基于 remainingLessons 权威源实时计算）。 */
export interface RenewalWarningItem {
  contractId: number;
  contractCode: string;
  studentCode: string;
  studentName: string | null;
  subject: string;
  courseName: string | null;
  totalLessons: number;
  remainingLessons: number;
  lastDeductedAt: string | null;
  estimatedDaysLeft: number | null;
  warningLevel: 'WARN' | 'CRITICAL';
}

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    private readonly contractRepo: ContractRepository,
    private readonly codeGenerator: ContractCodeGeneratorService,
    @InjectRepository(LessonAttendanceEntity)
    private readonly attendanceRepo: Repository<LessonAttendanceEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    private readonly config: ConfigService,
  ) {}

  // ─── Create ───

  async create(input: CreateContractInput): Promise<ContractEntity> {
    if (input.totalLessons <= 0) {
      throw new BadRequestException('totalLessons must be greater than 0');
    }

    const contract = new ContractEntity();
    contract.contractCode = await this.codeGenerator.generateContractCode();
    contract.studentCode = input.studentCode;
    contract.subject = input.subject;
    contract.totalLessons = input.totalLessons;
    contract.remainingLessons = input.totalLessons; // starts equal
    contract.status = ContractStatus.ACTIVE;
    contract.validFrom = input.validFrom;
    contract.validTo = input.validTo ?? null;
    contract.unitPrice = input.unitPrice ?? null;
    contract.totalAmount = input.totalAmount ?? null;
    contract.note = input.note ?? null;
    contract.tags = input.tags ?? null;
    contract.createdBy = 0;

    const saved = await this.contractRepo.save(contract);
    this.logger.log(
      `Contract created: code=${saved.contractCode}, student=${saved.studentCode}, lessons=${saved.totalLessons}`,
    );
    return saved;
  }

  // ─── Read ───

  async findOne(id: number): Promise<ContractEntity> {
    const contract = await this.contractRepo.findOneById(id);
    if (!contract) {
      throw new NotFoundException(`Contract not found: id=${id}`);
    }
    return contract;
  }

  async findOneByCode(contractCode: string): Promise<ContractEntity> {
    const contract = await this.contractRepo.findOneByCode(contractCode);
    if (!contract) {
      throw new NotFoundException(`Contract not found: code=${contractCode}`);
    }
    return contract;
  }

  async findByStudentCode(studentCode: string): Promise<ContractEntity[]> {
    return this.contractRepo.findByStudentCode(studentCode);
  }

  async findAll(
    query: { studentCode?: string; subject?: string; status?: string; page?: number; pageSize?: number },
  ): Promise<{ items: ContractEntity[]; total: number }> {
    return this.contractRepo.findMany({
      studentCode: query.studentCode,
      subject: query.subject,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  // ─── Lesson Adjustment (Admin: add / reduce / set custom) ───

  /**
   * Adjust a contract's lesson counts.
   * totalLessons / remainingLessons: omitted fields keep current value.
   * Invariants: remaining >= 0, remaining <= total.
   * Reason required when reducing remaining lessons.
   * Status: remaining hits 0 → EXHAUSTED; EXHAUSTED topped up → ACTIVE.
   */
  async adjustLessons(
    contractCode: string,
    input: { totalLessons?: number; remainingLessons?: number; reason?: string },
    operatedBy: number,
  ): Promise<ContractEntity> {
    const contract = await this.findOneByCode(contractCode);

    if (contract.status === ContractStatus.REFUNDED) {
      throw new BadRequestException('Refunded contract cannot be adjusted');
    }

    const newTotal = input.totalLessons ?? contract.totalLessons;
    const newRemaining = input.remainingLessons ?? contract.remainingLessons;

    if (
      newTotal === contract.totalLessons &&
      newRemaining === contract.remainingLessons
    ) {
      throw new BadRequestException('No lesson change provided');
    }

    if (newRemaining < 0) {
      throw new BadRequestException('remainingLessons cannot be negative');
    }

    if (newRemaining > newTotal) {
      throw new BadRequestException(
        'remainingLessons cannot exceed totalLessons',
      );
    }

    const reduced = newRemaining < contract.remainingLessons;
    if (reduced && (!input.reason || input.reason.trim().length === 0)) {
      throw new BadRequestException('Reason required when reducing lessons');
    }

    contract.totalLessons = newTotal;
    contract.remainingLessons = newRemaining;

    if (newRemaining === 0 && contract.status !== ContractStatus.EXHAUSTED) {
      contract.status = ContractStatus.EXHAUSTED;
    } else if (
      newRemaining > 0 &&
      contract.status === ContractStatus.EXHAUSTED
    ) {
      contract.status = ContractStatus.ACTIVE;
    }

    const saved = await this.contractRepo.save(contract);
    this.logger.log(
      `Contract lessons adjusted: code=${contractCode} total=${newTotal} remaining=${newRemaining} by=${operatedBy}`,
    );
    return saved;
  }

  // ─── Status Transitions ───

  async freeze(
    contractCode: string,
    operatedBy: number,
    reason?: string,
  ): Promise<ContractEntity> {
    return this.updateStatus(
      contractCode,
      ContractStatus.FROZEN,
      operatedBy,
      reason,
    );
  }

  async unfreeze(
    contractCode: string,
    operatedBy: number,
  ): Promise<ContractEntity> {
    return this.updateStatus(contractCode, ContractStatus.ACTIVE, operatedBy);
  }

  private async updateStatus(
    contractCode: string,
    targetStatus: ContractStatus,
    operatedBy: number,
    reason?: string,
  ): Promise<ContractEntity> {
    const contract = await this.findOneByCode(contractCode);

    if (contract.status === targetStatus) {
      throw new BadRequestException(
        `Contract is already in status: ${targetStatus}`,
      );
    }

    const allowed = VALID_TRANSITIONS[contract.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${contract.status} -> ${targetStatus}. ` +
          `Allowed from ${contract.status}: ${allowed.join(', ') || 'none'}`,
      );
    }

    // Guard: FROZEN requires reason
    if (targetStatus === ContractStatus.FROZEN) {
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException('Reason required to freeze contract');
      }
    }

    const oldStatus = contract.status;
    contract.status = targetStatus;

    const saved = await this.contractRepo.save(contract);

    this.logger.log(
      `Contract status changed: code=${contractCode} ${oldStatus} -> ${targetStatus}`,
    );
    return saved;
  }

  // ─── Consume Records (E: 课时消耗流水) ───

  /**
   * 返回该合同的扣课流水（分页）。
   * 来源：lesson_attendance.deductedContractId 台账 + lesson/course 联查。
   * 每条流水 = 该合同消耗 1 课时。
   */
  async getConsumeRecords(
    contract: ContractEntity,
    page: number,
    pageSize: number,
  ): Promise<{ items: ConsumeRecord[]; total: number; page: number; pageSize: number }> {
    const where = { deductedContractId: contract.id };
    const total = await this.attendanceRepo.count({ where });
    const rows = await this.attendanceRepo.find({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const lessonIds = [...new Set(rows.map((r) => r.lessonId))];
    const lessons =
      lessonIds.length > 0
        ? await this.lessonRepo.find({ where: { id: In(lessonIds) } })
        : [];
    const lessonMap = new Map(lessons.map((l) => [l.id, l]));

    const courseCodes = [...new Set(lessons.map((l) => l.courseCode))];
    const courses =
      courseCodes.length > 0
        ? await this.courseRepo.find({ where: { courseCode: In(courseCodes) } })
        : [];
    const courseMap = new Map(courses.map((c) => [c.courseCode, c]));

    const items = rows
      .map((a) => {
        const lesson = lessonMap.get(a.lessonId);
        const course = lesson ? courseMap.get(lesson.courseCode) : undefined;
        return {
          lessonId: a.lessonId,
          lessonDate: lesson?.scheduledDate ?? null,
          startTime: lesson?.startTime ?? null,
          endTime: lesson?.endTime ?? null,
          courseName: course?.name ?? null,
          subject: course?.subject ?? contract.subject,
          lessonType: lesson?.isMakeup ? ('MAKEUP' as const) : ('NORMAL' as const),
          lessonTypeLabel: lesson?.isMakeup ? ('补课' as const) : ('正常' as const),
          lessonsConsumed: 1,
          topic: lesson?.topic ?? null,
          status: a.status ?? null,
          deductedAt: (a.checkInTime ?? a.createdAt)?.toISOString() ?? null,
        };
      })
      .sort((x, y) => {
        const d = (y.lessonDate ?? '').localeCompare(x.lessonDate ?? '');
        if (d !== 0) return d;
        return (y.startTime ?? '').localeCompare(x.startTime ?? '');
      });

    return { items, total, page, pageSize };
  }

  // ─── Renewal Warnings (A: 续费预警) ───

  /**
   * 续费预警：ACTIVE 且 remainingLessons <= 阈值 的合同（实时计算，无需状态机）。
   * estimatedDaysLeft：按近 30 天扣课速度估算用完天数；无近期消耗 → null。
   */
  async getRenewalWarnings(threshold?: number): Promise<RenewalWarningItem[]> {
    const t = threshold ?? this.config.get<number>('app.renewal.warningThreshold', 5);

    const contracts = await this.contractRepo.findActiveAtRisk(t);
    if (contracts.length === 0) return [];

    const contractIds = contracts.map((c) => c.id);
    const deductions = await this.attendanceRepo.find({
      where: { deductedContractId: In(contractIds) },
      order: { createdAt: 'DESC' },
    });

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const perContract = new Map<
      number,
      { count30d: number; last: LessonAttendanceEntity | undefined }
    >();
    for (const d of deductions) {
      const id = Number(d.deductedContractId);
      const g = perContract.get(id) ?? { count30d: 0, last: undefined };
      if (!g.last) g.last = d;
      const ts = d.checkInTime ?? d.createdAt;
      if (ts >= since) g.count30d += 1;
      perContract.set(id, g);
    }

    const studentCodes = [...new Set(contracts.map((c) => c.studentCode))];
    const students =
      studentCodes.length > 0
        ? await this.studentRepo.find({
            where: { studentCode: In(studentCodes), deleted: false },
          })
        : [];
    const studentMap = new Map(students.map((s) => [s.studentCode, s]));

    const lastLessonIds = [
      ...new Set(
        [...perContract.values()]
          .map((g) => g.last?.lessonId)
          .filter((id): id is number => id != null),
      ),
    ];
    const lessons =
      lastLessonIds.length > 0
        ? await this.lessonRepo.find({ where: { id: In(lastLessonIds) } })
        : [];
    const lessonMap = new Map(lessons.map((l) => [l.id, l]));

    const lastCourseCodes = [...new Set(lessons.map((l) => l.courseCode))];
    const courses =
      lastCourseCodes.length > 0
        ? await this.courseRepo.find({ where: { courseCode: In(lastCourseCodes) } })
        : [];
    const courseMap = new Map(courses.map((c) => [c.courseCode, c]));

    return contracts.map((c) => {
      // TypeORM 对 MySQL bigint 返回 string，归一为 number 才命中 perContract 的键
      const g = perContract.get(Number(c.id));
      const lastLesson = g?.last ? lessonMap.get(g.last.lessonId) : undefined;
      const course = lastLesson ? courseMap.get(lastLesson.courseCode) : undefined;
      const dailyRate = g ? g.count30d / 30 : 0;
      const estimatedDaysLeft =
        dailyRate > 0 ? Math.ceil(c.remainingLessons / dailyRate) : null;
      return {
        contractId: c.id,
        contractCode: c.contractCode,
        studentCode: c.studentCode,
        studentName: studentMap.get(c.studentCode)?.name ?? null,
        subject: c.subject,
        courseName: course?.name ?? null,
        totalLessons: c.totalLessons,
        remainingLessons: c.remainingLessons,
        lastDeductedAt: g?.last
          ? (g.last.checkInTime ?? g.last.createdAt).toISOString()
          : null,
        estimatedDaysLeft,
        warningLevel:
          c.remainingLessons <= Math.floor(t / 2) ? 'CRITICAL' : 'WARN',
      };
    });
  }
}
