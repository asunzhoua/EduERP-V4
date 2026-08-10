import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { LeaveRequestRepository } from './leave-request.repository';
import {
  LeaveRequestEntity,
  LeaveRequestStatus,
  LeaveType,
} from './leave-request.entity';
import { StudentRepository } from '@modules/student/student.repository';

/** Allowed status transitions. */
const VALID_TRANSITIONS: Record<LeaveRequestStatus, LeaveRequestStatus[]> = {
  [LeaveRequestStatus.PENDING]: [
    LeaveRequestStatus.APPROVED,
    LeaveRequestStatus.REJECTED,
  ],
  [LeaveRequestStatus.APPROVED]: [],
  [LeaveRequestStatus.REJECTED]: [],
};

/** Input for creating a leave request. */
export interface CreateLeaveRequestInput {
  studentCode: string;
  classCode: string;
  leaveType: LeaveType;
  leaveDate: string;
  reason: string;
  createdBy: number;
}

@Injectable()
export class LeaveRequestService {
  private readonly logger = new Logger(LeaveRequestService.name);

  constructor(
    private readonly requestRepo: LeaveRequestRepository,
    private readonly studentRepo: StudentRepository,
  ) {}

  // ─── Create ───

  /**
   * Submit a new leave request. Status = PENDING.
   * Parent/Student self-service endpoint.
   */
  async createRequest(
    input: CreateLeaveRequestInput,
  ): Promise<LeaveRequestEntity> {
    // Validate required fields
    if (!input.reason?.trim()) {
      throw new BadRequestException('请假原因不能为空');
    }
    if (!input.leaveDate) {
      throw new BadRequestException('请假日期不能为空');
    }

    // Validate leave date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (input.leaveDate < today) {
      throw new BadRequestException('请假日期不能早于今天');
    }

    // Verify student exists
    const student = await this.studentRepo.findByStudentCode(input.studentCode);
    if (!student) {
      throw new NotFoundException(`学生不存在: ${input.studentCode}`);
    }

    // Check for existing PENDING leave request on same date
    const existing = await this.requestRepo.findAll({
      studentCode: input.studentCode,
      status: LeaveRequestStatus.PENDING,
      page: 1,
      pageSize: 1,
    });
    const sameDatePending = existing.items.find(
      (r) => r.leaveDate === input.leaveDate,
    );
    if (sameDatePending) {
      throw new BadRequestException(
        `该学生在 ${input.leaveDate} 已有待审批的请假申请`,
      );
    }

    const entity = new LeaveRequestEntity();
    entity.studentCode = input.studentCode;
    entity.classCode = input.classCode;
    entity.leaveType = input.leaveType;
    entity.leaveDate = input.leaveDate;
    entity.reason = input.reason;
    entity.status = LeaveRequestStatus.PENDING;
    entity.createdBy = input.createdBy;

    const saved = await this.requestRepo.save(entity);
    this.logger.log(
      `Leave request created: id=${saved.id}, student=${saved.studentCode}, date=${saved.leaveDate}`,
    );
    return saved;
  }

  // ─── Approve ───

  /**
   * Admin approves a PENDING leave request. PENDING → APPROVED.
   */
  async approve(
    requestId: number,
    reviewedBy: number,
  ): Promise<LeaveRequestEntity> {
    const entity = await this.requestRepo.findOneById(requestId);
    if (!entity) {
      throw new NotFoundException(`请假申请不存在: id=${requestId}`);
    }

    this.validateTransition(entity.status, LeaveRequestStatus.APPROVED);

    entity.status = LeaveRequestStatus.APPROVED;
    entity.reviewedBy = reviewedBy;
    entity.reviewedAt = new Date();

    const saved = await this.requestRepo.save(entity);
    this.logger.log(
      `Leave request approved: id=${saved.id}, reviewedBy=${reviewedBy}`,
    );
    return saved;
  }

  // ─── Reject ───

  /**
   * Admin rejects a PENDING leave request. PENDING → REJECTED.
   */
  async reject(
    requestId: number,
    reviewedBy: number,
    rejectionReason: string,
  ): Promise<LeaveRequestEntity> {
    if (!rejectionReason?.trim()) {
      throw new BadRequestException('驳回原因不能为空');
    }

    const entity = await this.requestRepo.findOneById(requestId);
    if (!entity) {
      throw new NotFoundException(`请假申请不存在: id=${requestId}`);
    }

    this.validateTransition(entity.status, LeaveRequestStatus.REJECTED);

    entity.status = LeaveRequestStatus.REJECTED;
    entity.reviewedBy = reviewedBy;
    entity.reviewedAt = new Date();
    entity.rejectionReason = rejectionReason;

    const saved = await this.requestRepo.save(entity);
    this.logger.log(
      `Leave request rejected: id=${saved.id}, reason=${rejectionReason}`,
    );
    return saved;
  }

  // ─── Queries ───

  /**
   * List all leave requests with optional filters.
   * For admin panel.
   */
  async findAll(options: {
    status?: LeaveRequestStatus;
    studentCode?: string;
    classCode?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: LeaveRequestEntity[]; total: number }> {
    return this.requestRepo.findAll({
      status: options.status,
      studentCode: options.studentCode,
      classCode: options.classCode,
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 20,
    });
  }

  /**
   * Find leave requests for a specific student.
   */
  async findByStudentCode(studentCode: string): Promise<LeaveRequestEntity[]> {
    return this.requestRepo.findByStudentCode(studentCode);
  }

  // ─── Private Helpers ───

  private validateTransition(
    current: LeaveRequestStatus,
    target: LeaveRequestStatus,
  ): void {
    const allowed = VALID_TRANSITIONS[current];
    if (!allowed || !allowed.includes(target)) {
      throw new BadRequestException(`状态转换无效: ${current} → ${target}`);
    }
  }
}
