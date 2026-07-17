import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ClassRepository } from './class.repository';
import { ClassCodeGeneratorService } from './class-code-generator.service';
import { ClassEntity } from './class.entity';
import { ClassStatus } from './enums/class-status.enum';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { QueryClassDto } from './dto/query-class.dto';
import { TeacherAssignmentService } from '../teacher-assignment/teacher-assignment.service';
import { TeacherRole } from '@common/enums/teacher-role.enum';

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
  ) {}

  // ─── Create ───

  async create(dto: CreateClassDto, operatedBy: number): Promise<ClassEntity> {
    const classCode = await this.codeGenerator.generateClassCode();

    const cls = this.classRepo.raw.create({
      classCode,
      courseCode: dto.courseCode,
      name: dto.name,
      status: ClassStatus.DRAFT,
      startDate: dto.startDate,
      totalLessons: dto.totalLessons,
      defaultDuration: dto.defaultDuration,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      maxStudents: dto.maxStudents ?? 20,
      room: dto.room ?? null,
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
  ): Promise<{ items: ClassEntity[]; total: number }> {
    return this.classRepo.findMany({
      name: query.name,
      courseCode: query.courseCode,
      status: query.status,
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

    // Guard 3: totalLessons > 0
    if (!cls.totalLessons || cls.totalLessons <= 0) {
      errors.push('totalLessons must be greater than 0');
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Class activation failed — guards not met:\n  ${errors.join('\n  ')}`,
      );
    }
  }
}
