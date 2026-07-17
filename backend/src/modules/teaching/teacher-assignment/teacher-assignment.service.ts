import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { TeacherAssignmentRepository } from './teacher-assignment.repository';
import { TeacherAssignmentEntity } from './teacher-assignment.entity';
import { TeacherRole } from '@common/enums/teacher-role.enum';

@Injectable()
export class TeacherAssignmentService {
  private readonly logger = new Logger(TeacherAssignmentService.name);

  constructor(private readonly repo: TeacherAssignmentRepository) {}

  /**
   * Assign a teacher to a class.
   * Enforces: exactly 1 PRIMARY at any time; no duplicate active assignment
   * for same teacher+role on same class.
   */
  async assign(params: {
    classCode: string;
    teacherId: number;
    role: TeacherRole;
    assignedBy: number;
    reason?: string;
  }): Promise<TeacherAssignmentEntity> {
    const { classCode, teacherId, role, assignedBy, reason } = params;

    // Check for existing active assignment (same teacher, same class, any role)
    const existing = await this.repo.findActiveByClassAndTeacher(
      classCode,
      teacherId,
    );
    if (existing) {
      throw new BadRequestException(
        `Teacher ${teacherId} is already assigned to class ${classCode} (role: ${existing.role})`,
      );
    }

    // Enforce exactly 1 PRIMARY
    if (role === TeacherRole.PRIMARY) {
      const currentPrimary = await this.repo.findActivePrimary(classCode);
      if (currentPrimary) {
        throw new BadRequestException(
          `Class ${classCode} already has a PRIMARY teacher (userId: ${currentPrimary.teacherId}). ` +
            `End the current assignment first.`,
        );
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    const assignment = this.repo['repo'].create({
      classCode,
      teacherId,
      role,
      effectiveFrom: today,
      effectiveTo: null,
      assignedBy,
      reason: reason ?? null,
    });

    const saved = await this.repo.save(assignment);
    this.logger.log(
      `Teacher assigned: userId=${teacherId} → class ${classCode} as ${role}`,
    );
    return saved;
  }

  /**
   * End a teacher assignment (set effectiveTo).
   * Does NOT delete — preserves assignment history.
   */
  async unassign(assignmentId: number): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await this.repo.endAssignment(assignmentId, today);
    this.logger.log(`Teacher assignment ended: id=${assignmentId}`);
  }

  /** All active (non-ended) assignments for a class. */
  async findActiveByClass(
    classCode: string,
  ): Promise<TeacherAssignmentEntity[]> {
    return this.repo.findActiveByClass(classCode);
  }

  /** The current PRIMARY teacher for a class. Returns null if none. */
  async findActivePrimary(
    classCode: string,
  ): Promise<TeacherAssignmentEntity | null> {
    return this.repo.findActivePrimary(classCode);
  }

  /** Count active PRIMARY assignments. Used by Class activation guard. */
  async countActivePrimary(classCode: string): Promise<number> {
    return this.repo.countActivePrimary(classCode);
  }

  /** All assignments (including ended) for a class — for history view. */
  async findAllByClass(classCode: string): Promise<TeacherAssignmentEntity[]> {
    return this.repo.findByClass(classCode);
  }
}
