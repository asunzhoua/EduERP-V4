import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { In } from 'typeorm';
import { EnrollmentRepository } from './enrollment.repository';
import { ContractRepository } from '../contract/contract.repository';
import { EnrollmentEntity } from './enrollment.entity';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { ContractStatus } from '../contract/enums/contract-status.enum';
import { StudentRepository } from '../../student/student.repository';

/**
 * Formal state transition table.
 * COMPLETED exists per Blueprint but is NOT activated (no transition target).
 * ENROLL-004: COMPLETED is terminal (when activated in future).
 */
export const VALID_ENROLLMENT_TRANSITIONS: Record<
  EnrollmentStatus,
  EnrollmentStatus[]
> = {
  [EnrollmentStatus.ACTIVE]: [EnrollmentStatus.WITHDRAWN],
  [EnrollmentStatus.WITHDRAWN]: [], // ENROLL-005: terminal
  [EnrollmentStatus.COMPLETED]: [], // ENROLL-004: terminal (not activated)
};

/** Input for enrolling a student. */
export interface EnrollInput {
  classCode: string;
  studentCode: string;
  contractCode: string;
}

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly contractRepo: ContractRepository,
    private readonly studentRepo: StudentRepository,
  ) {}

  // ─── Enroll ───

  async enroll(input: EnrollInput): Promise<EnrollmentEntity> {
    // Guard: Contract must exist and be ACTIVE
    const contract = await this.contractRepo.findOneByCode(input.contractCode);
    if (!contract) {
      throw new BadRequestException(
        `Contract not found: ${input.contractCode}`,
      );
    }
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException(
        `Contract ${input.contractCode} is not ACTIVE (current: ${contract.status})`,
      );
    }

    // ENROLL-NEW: Contract must belong to the same student
    if (contract.studentCode !== input.studentCode) {
      throw new BadRequestException(
        `Contract ${input.contractCode} does not belong to student ${input.studentCode}`,
      );
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
      existing.contractCode = input.contractCode;
      existing.withdrawReason = null;
      existing.enrolledBy = 0;

      const saved = await this.enrollmentRepo.save(existing);
      this.logger.log(
        `Enrollment re-activated: class=${saved.classCode}, student=${saved.studentCode}, contract=${saved.contractCode}`,
      );
      return saved;
    }

    const enrollment = new EnrollmentEntity();
    enrollment.classCode = input.classCode;
    enrollment.studentCode = input.studentCode;
    enrollment.contractCode = input.contractCode;
    enrollment.status = EnrollmentStatus.ACTIVE;
    enrollment.withdrawReason = null;
    enrollment.enrolledBy = 0;

    const saved = await this.enrollmentRepo.save(enrollment);
    this.logger.log(
      `Enrollment created: class=${saved.classCode}, student=${saved.studentCode}, contract=${saved.contractCode}`,
    );
    return saved;
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

  async findByStudentCode(studentCode: string): Promise<EnrollmentEntity[]> {
    return this.enrollmentRepo.findByStudentCode(studentCode);
  }

  /**
   * Find actively enrolled students with personal info for a class.
   * Reads ACTIVE enrollments → resolves student names via StudentRepository.
   */
  async findStudentsByClassCode(classCode: string) {
    const enrollments = await this.enrollmentRepo.findByClassCode(classCode);
    const activeEnrollments = enrollments.filter(
      e => e.status === EnrollmentStatus.ACTIVE,
    );
    const studentCodes = activeEnrollments.map(e => e.studentCode);

    if (studentCodes.length === 0) {
      return [];
    }

    const students = await this.studentRepo.raw.find({
      where: { studentCode: In(studentCodes), deleted: false },
    });
    const studentMap = new Map(students.map(s => [s.studentCode, s]));

    return activeEnrollments.map(e => {
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
}
