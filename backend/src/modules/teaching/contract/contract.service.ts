import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Repository,
  In,
  Not,
  Between,
} from 'typeorm';
import { ContractRepository } from './contract.repository';
import { ContractCodeGeneratorService } from './contract-code-generator.service';
import { ContractEntity } from './contract.entity';
import { ContractStatus } from './enums/contract-status.enum';
import {
  LessonAdjustmentAction,
  LessonAdjustmentSource,
} from './enums/lesson-adjustment.enums';
import { LessonAdjustmentAudit } from './entities/lesson-adjustment-audit.entity';
import { Subject } from '@common/enums/subject.enum';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { Student } from '@modules/student/entities/student.entity';
import { ImportService } from '@utils/services/import.service';
import { ImportColumn, ImportReport } from '@utils/services/import.service';

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
  subject: string;
  totalLessons: number;
  validFrom: string;
  validTo?: string | null;
  unitPrice?: number | null;
  totalAmount?: number | null;
  note?: string | null;
  tags?: string[] | null;
  operatorId?: number;
  operatorName?: string;
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

/** 课时变更审计入参（contract 变更前/后的快照）。 */
export interface AuditParams {
  contract: ContractEntity;
  action: LessonAdjustmentAction;
  beforeTotal: number;
  beforeRemaining: number;
  afterTotal: number;
  afterRemaining: number;
  reason?: string | null;
  source: LessonAdjustmentSource;
  operatorId: number;
  operatorName?: string | null;
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
    @InjectRepository(LessonAdjustmentAudit)
    private readonly auditRepo: Repository<LessonAdjustmentAudit>,
    private readonly importService: ImportService,
    private readonly dataSource: DataSource,
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
    contract.createdBy = input.operatorId ?? 0;

    const saved = await this.contractRepo.save(contract);
    this.logger.log(
      `Contract created: code=${saved.contractCode}, student=${saved.studentCode}, lessons=${saved.totalLessons}`,
    );

    await this.recordAudit({
      contract: saved,
      action: LessonAdjustmentAction.ADD,
      beforeTotal: 0,
      beforeRemaining: 0,
      afterTotal: saved.totalLessons,
      afterRemaining: saved.remainingLessons,
      reason: this.truncate(input.note ?? '合同创建', 200),
      source: LessonAdjustmentSource.CONTRACT_CREATE,
      operatorId: input.operatorId ?? 0,
      operatorName: input.operatorName ?? null,
    });

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

  async findAll(query: {
    studentCode?: string;
    subject?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: ContractEntity[]; total: number }> {
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
    input: {
      totalLessons?: number;
      remainingLessons?: number;
      reason?: string;
    },
    operatedBy: number,
    operatorName?: string,
  ): Promise<ContractEntity> {
    const contract = await this.findOneByCode(contractCode);

    if (contract.status === ContractStatus.REFUNDED) {
      throw new BadRequestException('Refunded contract cannot be adjusted');
    }

    const beforeTotal = contract.totalLessons;
    const beforeRemaining = contract.remainingLessons;

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

    const delta = saved.remainingLessons - beforeRemaining;
    let action = LessonAdjustmentAction.SET;
    if (delta > 0) action = LessonAdjustmentAction.ADD;
    else if (delta < 0) action = LessonAdjustmentAction.DELETE;

    await this.recordAudit({
      contract: saved,
      action,
      beforeTotal,
      beforeRemaining,
      afterTotal: saved.totalLessons,
      afterRemaining: saved.remainingLessons,
      reason: input.reason ?? null,
      source: LessonAdjustmentSource.ADMIN_MANUAL,
      operatorId: operatedBy,
      operatorName: operatorName ?? null,
    });

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
  ): Promise<{
    items: ConsumeRecord[];
    total: number;
    page: number;
    pageSize: number;
  }> {
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
          lessonType: lesson?.isMakeup
            ? ('MAKEUP' as const)
            : ('NORMAL' as const),
          lessonTypeLabel: lesson?.isMakeup
            ? ('补课' as const)
            : ('正常' as const),
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
    const t =
      threshold ?? this.config.get<number>('app.renewal.warningThreshold', 5);

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
        ? await this.courseRepo.find({
            where: { courseCode: In(lastCourseCodes) },
          })
        : [];
    const courseMap = new Map(courses.map((c) => [c.courseCode, c]));

    return contracts.map((c) => {
      // TypeORM 对 MySQL bigint 返回 string，归一为 number 才命中 perContract 的键
      const g = perContract.get(Number(c.id));
      const lastLesson = g?.last ? lessonMap.get(g.last.lessonId) : undefined;
      const course = lastLesson
        ? courseMap.get(lastLesson.courseCode)
        : undefined;
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

  // ─── Lesson Adjustment Audit (P2-5: 课时变更提醒/追溯) ───

  async getLessonAudits(query: {
    action?: string;
    source?: string;
    operatorId?: number;
    startDate?: string;
    endDate?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: LessonAdjustmentAudit[]; total: number }> {
    const where: FindOptionsWhere<LessonAdjustmentAudit> = {};
    if (query.action) where.action = query.action as LessonAdjustmentAction;
    if (query.source) where.source = query.source as LessonAdjustmentSource;
    if (query.operatorId != null) where.operatorId = query.operatorId;

    const range = this.toDayRange(query.startDate, query.endDate);
    if (range) {
      where.createdAt = Between(range.start, range.end);
    }

    const total = await this.auditRepo.count({ where });
    const items = await this.auditRepo.find({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return { items, total };
  }

  // ─── Lesson Bulk Import (P2-2: 课时批量分配，累加语义) ───

  /**
   * 批量分配课时（累加，非覆盖）。
   * 每行：学员编码 + 科目 + 课时数(+可选单价/到期日)。
   * - 学员不存在 → 该行失败。
   * - 存在有效（非 EXPIRED/REFUNDED）同科目合同 → total/remaining 同时累加。
   * - 无有效合同 → 新建合同（total=remaining=课时数）。
   * 整体单事务，单行失败记录原因不中断；每行合同变更写审计。
   */
  async importLessons(
    buffer: Buffer,
    fileName: string,
    operatorId: number,
    operatorName?: string,
  ): Promise<ImportReport> {
    const rows = this.importService.parseBuffer(buffer, fileName);

    const columns: ImportColumn[] = [
      {
        header: 'studentcode',
        aliases: ['学员编码', '学员编号', '学生编码', '学号'],
        required: true,
      },
      {
        header: 'subject',
        aliases: ['科目'],
        required: true,
        validate: (v) =>
          this.parseSubject(v) ? null : '科目无效（如 MATH/数学）',
      },
      {
        header: 'lessons',
        aliases: ['课时数', '课时', '课时数量'],
        required: true,
        validate: (v) => {
          const n = Number(v);
          return !Number.isInteger(n) || n <= 0 ? '课时数必须为正整数' : null;
        },
      },
      {
        header: 'unitprice',
        aliases: ['单价'],
        required: false,
        validate: (v) => (v && isNaN(Number(v)) ? '单价格式错误' : null),
      },
      {
        header: 'validto',
        aliases: ['到期日', '截止日期'],
        required: false,
        validate: (v) => (v && isNaN(Date.parse(v)) ? '到期日格式错误' : null),
      },
    ];

    const { report } = this.importService.validateRows(rows, columns, fileName);

    if (report.success === 0) {
      return report;
    }

    await this.dataSource.transaction(async (manager) => {
      for (const detail of report.details) {
        if (!detail.success) continue;
        const row = detail.data;
        try {
          const student = await manager.findOne(Student, {
            where: { studentCode: row['studentcode'], deleted: false },
          });
          if (!student) {
            throw new Error(`学员不存在: ${row['studentcode']}`);
          }

          const subject = this.parseSubject(row['subject']) as string;
          const lessons = Number(row['lessons']);
          const unitPrice = row['unitprice']
            ? Number(row['unitprice'])
            : undefined;
          const validTo = row['validto'] || undefined;

          const existing = await manager.findOne(ContractEntity, {
            where: {
              studentCode: student.studentCode,
              subject,
              status: Not(
                In([ContractStatus.EXPIRED, ContractStatus.REFUNDED]),
              ),
            },
            order: { createdAt: 'DESC' },
          });

          if (existing) {
            const beforeTotal = existing.totalLessons;
            const beforeRemaining = existing.remainingLessons;
            existing.totalLessons += lessons;
            existing.remainingLessons += lessons;
            if (
              existing.remainingLessons > 0 &&
              existing.status === ContractStatus.EXHAUSTED
            ) {
              existing.status = ContractStatus.ACTIVE;
            }
            if (validTo) existing.validTo = validTo;
            if (unitPrice != null) existing.unitPrice = unitPrice;
            const saved = await manager.save(ContractEntity, existing);
            await this.saveAuditWithManager(manager, {
              contract: saved,
              action: LessonAdjustmentAction.ADD,
              beforeTotal,
              beforeRemaining,
              afterTotal: saved.totalLessons,
              afterRemaining: saved.remainingLessons,
              reason: '课时批量导入',
              source: LessonAdjustmentSource.IMPORT,
              operatorId,
              operatorName,
            });
          } else {
            const contract = new ContractEntity();
            contract.contractCode =
              await this.codeGenerator.generateContractCode();
            contract.studentCode = student.studentCode;
            contract.subject = subject;
            contract.totalLessons = lessons;
            contract.remainingLessons = lessons;
            contract.status = ContractStatus.ACTIVE;
            contract.validFrom = new Date().toISOString().slice(0, 10);
            contract.validTo = validTo ?? null;
            contract.unitPrice = unitPrice ?? null;
            contract.totalAmount =
              unitPrice != null
                ? Math.round(unitPrice * lessons * 100) / 100
                : null;
            contract.note = '课时导入';
            contract.tags = null;
            contract.createdBy = operatorId;
            const saved = await manager.save(ContractEntity, contract);
            await this.saveAuditWithManager(manager, {
              contract: saved,
              action: LessonAdjustmentAction.ADD,
              beforeTotal: 0,
              beforeRemaining: 0,
              afterTotal: saved.totalLessons,
              afterRemaining: saved.remainingLessons,
              reason: '课时批量导入',
              source: LessonAdjustmentSource.IMPORT,
              operatorId,
              operatorName,
            });
          }
        } catch (error) {
          report.success--;
          report.failure++;
          detail.success = false;
          detail.errors.push(`导入失败: ${(error as Error).message}`);
        }
      }
    });

    return report;
  }

  // ─── Audit helpers ───

  private buildAudit(params: AuditParams): LessonAdjustmentAudit {
    const audit = new LessonAdjustmentAudit();
    audit.contractId = Number(params.contract.id);
    audit.contractCode = params.contract.contractCode;
    audit.studentCode = params.contract.studentCode;
    audit.action = params.action;
    audit.beforeTotal = params.beforeTotal;
    audit.afterTotal = params.afterTotal;
    audit.beforeRemaining = params.beforeRemaining;
    audit.afterRemaining = params.afterRemaining;
    audit.delta = params.afterRemaining - params.beforeRemaining;
    audit.reason = params.reason ?? null;
    audit.source = params.source;
    audit.operatorId = Number(params.operatorId);
    audit.operatorName = params.operatorName ?? null;
    return audit;
  }

  private async recordAudit(params: AuditParams): Promise<void> {
    await this.auditRepo.save(this.buildAudit(params));
  }

  private async saveAuditWithManager(
    manager: EntityManager,
    params: AuditParams,
  ): Promise<void> {
    await manager.save(LessonAdjustmentAudit, this.buildAudit(params));
  }

  private truncate(value: string | null, max: number): string | null {
    if (!value) return value;
    return value.length > max ? value.slice(0, max) : value;
  }

  /**
   * 科目：接受枚举值（大小写不敏感）或中文别名；
   * 未知字符串（自定义学科 code / 名称）原样透传，不再 throw。
   */
  private parseSubject(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const upper = trimmed.toUpperCase();
    if (upper in Subject) {
      return Subject[upper as keyof typeof Subject];
    }
    const aliases: Record<string, string> = {
      数学: 'MATH',
      英语: 'ENGLISH',
      英文: 'ENGLISH',
      语文: 'CHINESE',
      中文: 'CHINESE',
      物理: 'PHYSICS',
      化学: 'CHEMISTRY',
      美术: 'ART',
      音乐: 'MUSIC',
      舞蹈: 'DANCE',
      体育: 'SPORTS',
      运动: 'SPORTS',
      编程: 'CODING',
      计算机: 'CODING',
      游泳: 'SWIMMING',
      篮球: 'BASKETBALL',
      足球: 'FOOTBALL',
      羽毛球: 'BADMINTON',
      跆拳道: 'TAEKWONDO',
      围棋: 'GO',
      象棋: 'CHESS',
      乐高: 'LEGO',
      机器人: 'ROBOTICS',
      科学实验: 'SCIENCE_EXP',
      书法: 'CALLIGRAPHY',
      素描: 'SKETCH',
      国画: 'CHINESE_PAINTING',
      手工: 'HANDCRAFT',
      陶艺: 'CERAMICS',
      乐器: 'INSTRUMENT',
      口才: 'ELOQUENCE',
      阅读: 'READING',
      硬笔书法: 'HANDWRITING',
      专注力: 'FOCUS',
      其他: 'OTHER',
    };
    return aliases[trimmed] ?? trimmed;
  }

  /** 日期字符串（YYYY-MM-DD）转当天起止 Date 范围；用于 createdAt 时间戳过滤 */
  private toDayRange(
    start?: string,
    end?: string,
  ): { start: Date; end: Date } | null {
    if (!start) return null;
    const s = new Date(`${start}T00:00:00.000`);
    const e = end
      ? new Date(`${end}T23:59:59.999`)
      : new Date(`${start}T23:59:59.999`);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    return { start: s, end: e };
  }
}
