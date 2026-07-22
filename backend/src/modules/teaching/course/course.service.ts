import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CourseRepository } from './course.repository';
import { CourseCodeGeneratorService } from './course-code-generator.service';
import { CourseEntity } from './course.entity';
import { CourseAuditLog } from './course-audit-log.entity';
import { CourseStatus } from './enums/course-status.enum';
import { AuditAction } from '@common/enums/audit-action.enum';
import { CreatedSource } from '@common/enums/created-source.enum';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassRepository } from '../class/class.repository';

/** Allowed status transitions per CourseStateMachine */
const VALID_TRANSITIONS: Record<CourseStatus, CourseStatus[]> = {
  [CourseStatus.DRAFT]: [CourseStatus.PUBLISHED],
  [CourseStatus.PUBLISHED]: [CourseStatus.ARCHIVED],
  [CourseStatus.ARCHIVED]: [CourseStatus.PUBLISHED],
};

@Injectable()
export class CourseService {
  private readonly logger = new Logger(CourseService.name);

  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly codeGenerator: CourseCodeGeneratorService,
    @InjectRepository(CourseAuditLog)
    private readonly auditLogRepo: Repository<CourseAuditLog>,
    private readonly eventEmitter: EventEmitter2,
    private readonly classRepo: ClassRepository,
  ) {}

  // ─── Create ───

  async create(
    dto: CreateCourseDto,
    operatedBy: number,
  ): Promise<CourseEntity> {
    const courseCode = await this.codeGenerator.generateCourseCode();

    const course = this.courseRepo.raw.create({
      courseCode,
      name: dto.name,
      subject: dto.subject,
      type: dto.type,
      description: dto.description ?? null,
      totalHours: dto.totalHours,
      totalLessons: dto.totalLessons,
      defaultDuration: dto.defaultDuration,
      status: CourseStatus.DRAFT,
      tags: dto.tags ?? null,
      coverImage: dto.coverImage ?? null,
      note: dto.note ?? null,
      createdBy: operatedBy,
    });

    const saved = await this.courseRepo.save(course);

    await this.writeAudit(
      saved.courseCode,
      AuditAction.CREATE,
      null,
      null,
      null,
      operatedBy,
    );

    this.logger.log(`Course created: ${saved.courseCode}`);
    return saved;
  }

  // ─── Read ───

  async findByCode(courseCode: string): Promise<CourseEntity> {
    const course = await this.courseRepo.findOneByCode(courseCode);
    if (!course) {
      throw new NotFoundException(`Course not found: ${courseCode}`);
    }
    return course;
  }

  async findAll(
    query: QueryCourseDto,
  ): Promise<{ items: CourseEntity[]; total: number }> {
    return this.courseRepo.findMany({
      name: query.name,
      subject: query.subject,
      type: query.type,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  // ─── Enrichment ───

  async enrichCourses(courses: CourseEntity[]): Promise<any[]> {
    if (!courses.length) return [];
    const courseCodes = courses.map(c => c.courseCode);
    const enrolledClassCounts = await this.classRepo.countActiveByCourseCodes(courseCodes);
    return courses.map(course => ({
      ...course,
      lessonCount: course.totalLessons,
      enrolledClasses: enrolledClassCounts.get(course.courseCode) ?? 0,
    }));
  }

  async enrichCourse(course: CourseEntity): Promise<any> {
    const enrolledClasses = await this.classRepo.countActiveByCourseCode(course.courseCode);
    return {
      ...course,
      lessonCount: course.totalLessons,
      enrolledClasses,
    };
  }

  // ─── Update ───

  async update(
    courseCode: string,
    dto: UpdateCourseDto,
    operatedBy: number,
  ): Promise<CourseEntity> {
    const course = await this.findByCode(courseCode);

    const updatableFields: Array<keyof UpdateCourseDto> = [
      'name',
      'subject',
      'type',
      'description',
      'totalHours',
      'totalLessons',
      'defaultDuration',
      'tags',
      'coverImage',
      'note',
    ];

    for (const field of updatableFields) {
      const newValue = dto[field];
      if (newValue !== undefined) {
        const oldValue = course[field as keyof CourseEntity];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          (course[field as keyof CourseEntity] as typeof newValue) = newValue;
          await this.writeAudit(
            courseCode,
            AuditAction.UPDATE,
            field,
            String(oldValue),
            String(newValue),
            operatedBy,
          );
        }
      }
    }

    course.updatedBy = operatedBy;
    const saved = await this.courseRepo.save(course);

    this.logger.log(`Course updated: ${courseCode}`);
    return saved;
  }

  // ─── Status Change ───

  async updateStatus(
    courseCode: string,
    targetStatus: CourseStatus,
    operatedBy: number,
  ): Promise<CourseEntity> {
    const course = await this.findByCode(courseCode);

    if (course.status === targetStatus) {
      throw new BadRequestException(
        `Course is already in status: ${targetStatus}`,
      );
    }

    const allowed = VALID_TRANSITIONS[course.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${course.status} -> ${targetStatus}. ` +
          `Allowed transitions from ${course.status}: ${allowed.join(', ')}`,
      );
    }

    const oldStatus = course.status;
    course.status = targetStatus;
    course.updatedBy = operatedBy;

    const saved = await this.courseRepo.save(course);
    await this.writeAudit(
      courseCode,
      AuditAction.STATUS_CHANGE,
      'status',
      oldStatus,
      targetStatus,
      operatedBy,
    );

    this.logger.log(
      `Course status changed: ${courseCode} ${oldStatus} -> ${targetStatus}`,
    );
    return saved;
  }

  // ─── Soft Delete ───

  async remove(courseCode: string, operatedBy: number): Promise<void> {
    const course = await this.findByCode(courseCode);

    if (course.status !== CourseStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT courses can be deleted. Current status: ${course.status}`,
      );
    }

    // Check for existing classes (future: query Class entity)
    // For now, the guard is status-based only.

    course.deleted = true;
    course.updatedBy = operatedBy;
    await this.courseRepo.save(course);

    await this.writeAudit(
      courseCode,
      AuditAction.DELETE,
      null,
      course.status,
      'DELETED',
      operatedBy,
    );

    this.logger.log(`Course soft-deleted: ${courseCode}`);
  }

  // ─── Audit ───

  private async writeAudit(
    courseCode: string,
    action: AuditAction,
    fieldName: string | null,
    oldValue: string | null,
    newValue: string | null,
    operatedBy: number,
  ): Promise<void> {
    const log = this.auditLogRepo.create({
      courseCode,
      action,
      fieldName,
      oldValue,
      newValue,
      operatedBy,
      source: CreatedSource.API,
    });
    await this.auditLogRepo.save(log);
  }
}
