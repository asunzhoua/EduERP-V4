import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { SuspendRequestRepository } from './suspend-request.repository';
import {
  SuspendRequestEntity,
  SuspendRequestStatus,
} from './suspend-request.entity';
import { StudentRepository } from '@modules/student/student.repository';
import { StudentService } from '@modules/student/services/student.service';
import { EnrollmentRepository } from '../enrollment/enrollment.repository';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { ContractService } from '../contract/contract.service';

/** Allowed status transitions. */
const VALID_TRANSITIONS: Record<SuspendRequestStatus, SuspendRequestStatus[]> =
  {
    [SuspendRequestStatus.PENDING]: [
      SuspendRequestStatus.APPROVED,
      SuspendRequestStatus.REJECTED,
    ],
    [SuspendRequestStatus.APPROVED]: [],
    [SuspendRequestStatus.REJECTED]: [],
  };

/** Input for creating a suspend request. */
export interface CreateSuspendRequestInput {
  studentCode: string;
  classCode: string;
  suspendFrom: string;
  suspendTo: string;
  reason: string;
  createdBy: number;
  userId: number;
  userRole: string;
}

@Injectable()
export class SuspendRequestService {
  private readonly logger = new Logger(SuspendRequestService.name);

  constructor(
    private readonly requestRepo: SuspendRequestRepository,
    private readonly studentRepo: StudentRepository,
    private readonly studentService: StudentService,
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly contractService: ContractService,
  ) {}

  // ─── Create ───

  /**
   * Submit a new suspend request. Status = PENDING.
   * Parent/Student self-service endpoint.
   */
  async createRequest(
    input: CreateSuspendRequestInput,
  ): Promise<SuspendRequestEntity> {
    // Validate required fields
    if (!input.reason?.trim()) {
      throw new BadRequestException('停课原因不能为空');
    }
    if (!input.suspendFrom || !input.suspendTo) {
      throw new BadRequestException('停课起止日期不能为空');
    }

    // Validate date ordering
    if (input.suspendFrom > input.suspendTo) {
      throw new BadRequestException('停课开始日期不能晚于结束日期');
    }

    // Validate suspendFrom is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (input.suspendFrom < today) {
      throw new BadRequestException('停课开始日期不能早于今天');
    }

    // Validate max duration (e.g., 30 days)
    const fromDate = new Date(input.suspendFrom);
    const toDate = new Date(input.suspendTo);
    const diffDays = Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays > 30) {
      throw new BadRequestException('单次停课申请不得超过30天');
    }

    // Verify student exists
    const student = await this.studentRepo.findByStudentCode(input.studentCode);
    if (!student) {
      throw new NotFoundException(`学生不存在: ${input.studentCode}`);
    }

    // ── V-06: Ownership validation ──
    // Ensure the requesting user has the right to create a suspend request for this student.
    await this.validateOwnership(input.userId, input.userRole, student);

    // Verify student is currently enrolled and ACTIVE in the class
    const enrollment = await this.enrollmentRepo.findByClassAndStudent(
      input.classCode,
      input.studentCode,
    );
    if (!enrollment) {
      throw new BadRequestException(
        `学生 ${input.studentCode} 未在班级 ${input.classCode} 中注册`,
      );
    }
    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new BadRequestException(
        `学生 ${input.studentCode} 在当前班级的状态不是 ACTIVE (当前: ${enrollment.status})，无法提交停课申请`,
      );
    }

    // Check for existing PENDING/APPROVED suspend request with overlapping dates
    const existing = await this.requestRepo.findAll({
      studentCode: input.studentCode,
      status: SuspendRequestStatus.PENDING,
      page: 1,
      pageSize: 100,
    });
    const overlapping = existing.items.find(
      (r) =>
        r.suspendFrom <= input.suspendTo && r.suspendTo >= input.suspendFrom,
    );
    if (overlapping) {
      throw new BadRequestException(
        `该学生在 ${input.suspendFrom} 至 ${input.suspendTo} 期间已有停课申请 (id=${overlapping.id})`,
      );
    }

    const entity = new SuspendRequestEntity();
    entity.studentCode = input.studentCode;
    entity.classCode = input.classCode;
    entity.suspendFrom = input.suspendFrom;
    entity.suspendTo = input.suspendTo;
    entity.reason = input.reason;
    entity.status = SuspendRequestStatus.PENDING;
    entity.createdBy = input.createdBy;

    const saved = await this.requestRepo.save(entity);
    this.logger.log(
      `Suspend request created: id=${saved.id}, student=${saved.studentCode}, ` +
        `from=${saved.suspendFrom}, to=${saved.suspendTo}`,
    );
    return saved;
  }

  // ─── Approve ───

  /**
   * Admin approves a PENDING suspend request. PENDING → APPROVED.
   * Also updates EnrollmentStatus to SUSPEND for the student.
   */
  async approve(
    requestId: number,
    reviewedBy: number,
  ): Promise<SuspendRequestEntity> {
    const entity = await this.requestRepo.findOneById(requestId);
    if (!entity) {
      throw new NotFoundException(`停课申请不存在: id=${requestId}`);
    }

    this.validateTransition(entity.status, SuspendRequestStatus.APPROVED);

    // Update enrollment status to SUSPEND
    const enrollment = await this.enrollmentRepo.findByClassAndStudent(
      entity.classCode,
      entity.studentCode,
    );
    if (!enrollment) {
      throw new NotFoundException(
        `未找到学生在班级中的注册: ${entity.studentCode} @ ${entity.classCode}`,
      );
    }
    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new BadRequestException(
        `学生 ${entity.studentCode} 在班级中的状态不是 ACTIVE (当前: ${enrollment.status})，无法批准停课`,
      );
    }

    enrollment.status = EnrollmentStatus.SUSPEND;
    await this.enrollmentRepo.save(enrollment);

    // Freeze the associated contract to prevent lesson deductions during suspend.
    // 家长添加的孩子可能无合同（contractCode 为 null），此时无可冻结合同，仅改班级注册状态。
    if (enrollment.contractCode) {
      await this.contractService.freeze(
        enrollment.contractCode,
        reviewedBy,
        `停课冻结 (申请id=${requestId})`,
      );
    }

    entity.status = SuspendRequestStatus.APPROVED;
    entity.reviewedBy = reviewedBy;
    entity.reviewedAt = new Date();

    const saved = await this.requestRepo.save(entity);
    this.logger.log(
      `Suspend request approved: id=${saved.id}, student=${entity.studentCode}, ` +
        `enrollment status → SUSPEND, contract ${enrollment.contractCode} → FROZEN`,
    );
    return saved;
  }

  // ─── Reject ───

  /**
   * Admin rejects a PENDING suspend request. PENDING → REJECTED.
   */
  async reject(
    requestId: number,
    reviewedBy: number,
    rejectionReason: string,
  ): Promise<SuspendRequestEntity> {
    if (!rejectionReason?.trim()) {
      throw new BadRequestException('驳回原因不能为空');
    }

    const entity = await this.requestRepo.findOneById(requestId);
    if (!entity) {
      throw new NotFoundException(`停课申请不存在: id=${requestId}`);
    }

    this.validateTransition(entity.status, SuspendRequestStatus.REJECTED);

    entity.status = SuspendRequestStatus.REJECTED;
    entity.reviewedBy = reviewedBy;
    entity.reviewedAt = new Date();
    entity.rejectionReason = rejectionReason;

    const saved = await this.requestRepo.save(entity);
    this.logger.log(
      `Suspend request rejected: id=${saved.id}, reason=${rejectionReason}`,
    );
    return saved;
  }

  // ─── Resume (restore after suspend ends) ───

  /**
   * Resume a student after suspend period ends.
   * Restores Enrollment to ACTIVE and unfreezes the Contract.
   */
  async resume(
    requestId: number,
    operatedBy: number,
  ): Promise<SuspendRequestEntity> {
    const entity = await this.requestRepo.findOneById(requestId);
    if (!entity) {
      throw new NotFoundException(`停课申请不存在: id=${requestId}`);
    }
    if (entity.status !== SuspendRequestStatus.APPROVED) {
      throw new BadRequestException(
        `只有已批准的停课申请才能恢复 (当前: ${entity.status})`,
      );
    }

    // Restore enrollment to ACTIVE
    const enrollment = await this.enrollmentRepo.findByClassAndStudent(
      entity.classCode,
      entity.studentCode,
    );
    if (!enrollment) {
      throw new NotFoundException(
        `未找到学生在班级中的注册: ${entity.studentCode} @ ${entity.classCode}`,
      );
    }
    enrollment.status = EnrollmentStatus.ACTIVE;
    await this.enrollmentRepo.save(enrollment);

    // Unfreeze the contract (跳过无合同的孩子，如家长自助添加未签合同的班级)
    if (enrollment.contractCode) {
      await this.contractService.unfreeze(enrollment.contractCode, operatedBy);
    }

    this.logger.log(
      `Suspend resumed: id=${requestId}, student=${entity.studentCode}, ` +
        `enrollment → ACTIVE, contract ${enrollment.contractCode} → ACTIVE`,
    );
    return entity;
  }

  // ─── Queries ───

  /**
   * List all suspend requests with optional filters.
   * For admin panel.
   */
  async findAll(options: {
    status?: SuspendRequestStatus;
    studentCode?: string;
    classCode?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: SuspendRequestEntity[]; total: number }> {
    return this.requestRepo.findAll({
      status: options.status,
      studentCode: options.studentCode,
      classCode: options.classCode,
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 20,
    });
  }

  /**
   * Find suspend requests for a specific student.
   */
  async findByStudentCode(
    studentCode: string,
  ): Promise<SuspendRequestEntity[]> {
    return this.requestRepo.findByStudentCode(studentCode);
  }

  // ─── Private Helpers ───

  /**
   * V-06: Verify that the requesting user has the right to create
   * a suspend request for the given student.
   *
   * - Student: the student record must be linked to the same userId.
   * - Parent:  the student must be among the user's children (student_parent table).
   * - Admin / SuperAdmin: no restriction.
   */
  private async validateOwnership(
    userId: number,
    userRole: string,
    student: { id: number; userId: number | null; studentCode: string },
  ): Promise<void> {
    if (userRole === 'Admin' || userRole === 'SuperAdmin') {
      return; // admins may act on any student
    }

    if (userRole === 'Student') {
      if (student.userId !== userId) {
        throw new BadRequestException(
          `无权为学生 ${student.studentCode} 提交停课申请：该学生不属于当前用户`,
        );
      }
      return;
    }

    if (userRole === 'Parent') {
      const children = await this.studentService.getChildrenByUserId(userId);
      const isLinked = children.some(
        (c) => c.studentCode === student.studentCode,
      );
      if (!isLinked) {
        throw new BadRequestException(
          `无权为学生 ${student.studentCode} 提交停课申请：该学生不是当前家长的子女`,
        );
      }
      return;
    }

    // Unknown role — deny by default
    throw new BadRequestException(`未知用户角色: ${userRole}`);
  }

  private validateTransition(
    current: SuspendRequestStatus,
    target: SuspendRequestStatus,
  ): void {
    const allowed = VALID_TRANSITIONS[current];
    if (!allowed || !allowed.includes(target)) {
      throw new BadRequestException(`状态转换无效: ${current} → ${target}`);
    }
  }
}
