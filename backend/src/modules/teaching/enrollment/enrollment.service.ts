import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnrollmentRepository } from './enrollment.repository';
import { ContractRepository } from '../contract/contract.repository';
import { EnrollmentEntity } from './enrollment.entity';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { ContractStatus } from '../contract/enums/contract-status.enum';
import { StudentRepository } from '../../student/student.repository';
import { ClassEntity } from '../class/class.entity';
import { CourseEntity } from '../course/course.entity';
import { LessonEntity } from '../lesson/lesson.entity';
import { LessonStatus } from '../lesson/enums/lesson-status.enum';

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
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
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

  async findByStudentCode(studentCode: string): Promise<any[]> {
    const enrollments = await this.enrollmentRepo.findByStudentCode(studentCode);
    if (!enrollments.length) return [];

    // Collect class codes
    const classCodes = enrollments.map(e => e.classCode);

    // Batch get classes
    const classes = await this.classRepo.find({ where: { classCode: In(classCodes) } });
    const classMap = new Map(classes.map(c => [c.classCode, c]));

    // Batch get courses (via courseCode from classes)
    const courseCodes = [...new Set(classes.map(c => c.courseCode))];
    const courses = await this.courseRepo.find({ where: { courseCode: In(courseCodes) } });
    const courseNameMap = new Map(courses.map(c => [c.courseCode, c.name]));

    // Batch get completed lessons count per class
    const completedLessonCounts = await this.lessonRepo
      .createQueryBuilder('l')
      .select('l.classCode', 'classCode')
      .addSelect('COUNT(*)', 'count')
      .where('l.classCode IN (:...classCodes)', { classCodes })
      .andWhere('l.status = :status', { status: LessonStatus.FINISHED })
      .groupBy('l.classCode')
      .getRawMany();
    const completedMap = new Map<string, number>();
    completedLessonCounts.forEach(r => completedMap.set(r.classCode, parseInt(r.count, 10)));

    // Assemble enriched response
    return enrollments.map(enrollment => {
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

  async findAll(
    query: { classCode?: string; studentCode?: string; status?: string; page?: number; pageSize?: number },
  ): Promise<{ items: EnrollmentEntity[]; total: number }> {
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
