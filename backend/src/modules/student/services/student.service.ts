import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Brackets } from 'typeorm';
import { Student } from '../entities/student.entity';
import { StudentParent } from '../entities/student-parent.entity';
import { StudentAuditLog } from '../entities/student-audit-log.entity';
import { StudentRepository } from '../student.repository';
import { StudentCodeGeneratorService } from './student-code-generator.service';
import { CreateStudentDto } from '../dto/create-student.dto';
import { UpdateStudentDto } from '../dto/update-student.dto';
import { UpdateStudentStatusDto } from '../dto/update-student-status.dto';
import { QueryStudentDto } from '../dto/query-student.dto';
import { StudentStatus } from '../enums/student-status.enum';
import { CreatedSource } from '@common/enums/created-source.enum';
import { AuditAction } from '@common/enums/audit-action.enum';
import { ImportService, ImportReport } from '@utils/services/import.service';
import { Gender } from '../enums/gender.enum';

@Injectable()
export class StudentService {
  constructor(
    private studentRepository: StudentRepository,
    @InjectRepository(StudentParent)
    private studentParentRepository: Repository<StudentParent>,
    @InjectRepository(StudentAuditLog)
    private studentAuditLogRepository: Repository<StudentAuditLog>,
    private studentCodeGenerator: StudentCodeGeneratorService,
    private importService: ImportService,
  ) {}

  async create(dto: CreateStudentDto, operatorId: number, source: CreatedSource = CreatedSource.API): Promise<Student> {
    const studentCode = await this.studentCodeGenerator.generateStudentCode();

    const student = new Student();
    student.studentCode = studentCode;
    student.name = dto.name;
    student.gender = dto.gender;
    student.birthDate = dto.birthDate;
    student.phone = dto.phone || null;
    student.email = dto.email || null;
    student.school = dto.school || null;
    student.grade = dto.grade || null;
    student.tags = dto.tags || null;
    student.note = dto.note || null;
    student.status = StudentStatus.ACTIVE;
    student.createdBy = operatorId;
    student.createdSource = source;
    student.updatedBy = operatorId;
    student.deleted = false;

    const saved = await this.studentRepository.save(student);

    // Link parents if provided
    if (dto.parentIds && dto.parentIds.length > 0) {
      for (const parentId of dto.parentIds) {
        const link = new StudentParent();
        link.studentId = saved.id;
        link.parentId = parentId;
        link.relation = null;
        link.isPrimary = false;
        await this.studentParentRepository.save(link);
      }
    }

    // Audit log
    const audit = new StudentAuditLog();
    audit.studentId = saved.id;
    audit.action = AuditAction.CREATE;
    audit.operatedBy = operatorId;
    audit.source = source;
    audit.detail = `创建学生: ${saved.name} (${saved.studentCode})`;
    await this.studentAuditLogRepository.save(audit);

    return saved;
  }

  async findAll(query: QueryStudentDto): Promise<{ items: Student[]; total: number; page: number; pageSize: number }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { deleted: false };

    if (query.name) {
      where.name = Like(`%${query.name}%`);
    }
    if (query.studentCode) {
      where.studentCode = Like(`%${query.studentCode}%`);
    }
    if (query.gender) {
      where.gender = query.gender;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.phone) {
      where.phone = Like(`%${query.phone}%`);
    }
    if (query.school) {
      where.school = Like(`%${query.school}%`);
    }
    if (query.grade) {
      where.grade = Like(`%${query.grade}%`);
    }
    // keyword search: OR logic across multiple fields
    // If both name and keyword are provided, they work together
    const keyword = query.keyword;

    const [items, total] = await this.studentRepository.findAndCount({
      where: (qb) => {
        qb.where(where);
        if (keyword) {
          qb.andWhere(
            new Brackets((subQb) => {
              subQb.where('student.name LIKE :kw', { kw: `%${keyword}%` })
                .orWhere('student.studentCode LIKE :kw', { kw: `%${keyword}%` })
                .orWhere('student.phone LIKE :kw', { kw: `%${keyword}%` })
                .orWhere('student.school LIKE :kw', { kw: `%${keyword}%` });
            })
          );
        }
      },
      skip,
      take: pageSize,
      order: { createTime: 'DESC' } as any,
    });

    return { items, total, page, pageSize };
  }

  async findById(id: number): Promise<Student> {
    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`学生不存在 (ID: ${id})`);
    }
    return student;
  }

  async update(id: number, dto: UpdateStudentDto, operatorId: number): Promise<Student> {
    const student = await this.findById(id);
    const changes: { fieldName: string; oldValue: string; newValue: string }[] = [];

    const updatableFields: (keyof UpdateStudentDto)[] = [
      'name', 'gender', 'birthDate', 'phone', 'email',
      'school', 'grade', 'tags', 'note',
    ];

    for (const field of updatableFields) {
      if ((dto as any)[field] !== undefined) {
        const oldVal = String((student as any)[field] ?? '');
        const newVal = String((dto as any)[field] ?? '');
        if (oldVal !== newVal) {
          changes.push({ fieldName: field, oldValue: oldVal, newValue: newVal });
          (student as any)[field] = (dto as any)[field];
        }
      }
    }

    if (changes.length === 0) {
      return student;
    }

    student.updatedBy = operatorId;
    const saved = await this.studentRepository.save(student);

    // Audit log for each change
    for (const change of changes) {
      const audit = new StudentAuditLog();
      audit.studentId = id;
      audit.action = AuditAction.UPDATE;
      audit.fieldName = change.fieldName;
      audit.oldValue = change.oldValue;
      audit.newValue = change.newValue;
      audit.operatedBy = operatorId;
      audit.source = CreatedSource.API;
      await this.studentAuditLogRepository.save(audit);
    }

    return saved;
  }

  async updateStatus(id: number, dto: UpdateStudentStatusDto, operatorId: number): Promise<Student> {
    const student = await this.findById(id);
    const oldStatus = student.status;
    const newStatus = dto.status;

    if (oldStatus === newStatus) {
      return student;
    }

    if (oldStatus === StudentStatus.GRADUATED) {
      throw new BadRequestException('已毕业的学生不能变更状态');
    }

    student.status = newStatus;
    student.updatedBy = operatorId;
    const saved = await this.studentRepository.save(student);

    const audit = new StudentAuditLog();
    audit.studentId = id;
    audit.action = AuditAction.STATUS_CHANGE;
    audit.fieldName = 'status';
    audit.oldValue = oldStatus;
    audit.newValue = newStatus;
    audit.operatedBy = operatorId;
    audit.source = CreatedSource.API;
    audit.detail = `状态变更: ${oldStatus} → ${newStatus}`;
    await this.studentAuditLogRepository.save(audit);

    return saved;
  }

  async softDelete(id: number, operatorId: number): Promise<void> {
    const student = await this.findById(id);
    student.deleted = true;
    student.updatedBy = operatorId;
    await this.studentRepository.save(student);

    const audit = new StudentAuditLog();
    audit.studentId = id;
    audit.action = AuditAction.DELETE;
    audit.operatedBy = operatorId;
    audit.source = CreatedSource.API;
    audit.detail = `删除学生: ${student.name} (${student.studentCode})`;
    await this.studentAuditLogRepository.save(audit);
  }

  // --- Parent-Student relations ---

  async linkParent(studentId: number, parentId: number, relation?: string, isPrimary?: boolean): Promise<StudentParent> {
    await this.findById(studentId);

    const existing = await this.studentParentRepository.findOne({
      where: { studentId, parentId } as any,
    });
    if (existing) {
      throw new BadRequestException('该家长已关联此学生');
    }

    const link = new StudentParent();
    link.studentId = studentId;
    link.parentId = parentId;
    link.relation = relation || null;
    link.isPrimary = isPrimary || false;
    return this.studentParentRepository.save(link);
  }

  async unlinkParent(studentId: number, parentId: number): Promise<void> {
    const link = await this.studentParentRepository.findOne({
      where: { studentId, parentId } as any,
    });
    if (!link) {
      throw new NotFoundException('家长关联不存在');
    }
    await this.studentParentRepository.remove(link);
  }

  async getParents(studentId: number): Promise<StudentParent[]> {
    await this.findById(studentId);
    return this.studentParentRepository.find({
      where: { studentId } as any,
      relations: { parent: true } as any,
    });
  }

  async getStudentsByParent(parentId: number): Promise<StudentParent[]> {
    return this.studentParentRepository.find({
      where: { parentId } as any,
      relations: { student: true } as any,
    });
  }

  // --- Import ---

  async importStudents(buffer: Buffer, fileName: string, operatorId: number): Promise<ImportReport> {
    const rows = this.importService.parseBuffer(buffer, fileName);

    const columns = [
      { header: 'name', required: true, validate: (v: string) => (v.length > 50 ? '姓名不能超过50个字符' : null) },
      { header: 'gender', required: true, validate: (v: string) => (!['MALE', 'FEMALE', '男', '女'].includes(v) ? '性别格式错误 (MALE/FEMALE/男/女)' : null) },
      { header: 'birthDate', required: true, validate: (v: string) => (isNaN(Date.parse(v)) ? '出生日期格式错误' : null) },
      { header: 'phone', required: false },
      { header: 'email', required: false },
      { header: 'school', required: false },
      { header: 'grade', required: false },
      { header: 'tags', required: false },
      { header: 'note', required: false },
    ];

    const { validRows, report } = this.importService.validateRows(rows, columns, fileName);

    for (const row of validRows) {
      try {
        const gender = row['gender'] === '男' || row['gender'] === 'MALE' ? Gender.MALE : Gender.FEMALE;
        const tags = row['tags'] ? row['tags'].split(/[,，、]/).map((t: string) => t.trim()).filter(Boolean) : null;

        const dto = new CreateStudentDto();
        dto.name = row['name'];
        dto.gender = gender;
        dto.birthDate = row['birthDate'];
        dto.phone = row['phone'] || undefined;
        dto.email = row['email'] || undefined;
        dto.school = row['school'] || undefined;
        dto.grade = row['grade'] || undefined;
        dto.tags = tags || undefined;
        dto.note = row['note'] || undefined;

        await this.create(dto, operatorId, CreatedSource.IMPORT);
      } catch (error) {
        report.failure++;
        report.success--;
        const detail = report.details.find((d) => d.data['name'] === row['name'] && d.success);
        if (detail) {
          detail.success = false;
          detail.errors.push(`导入失败: ${(error as Error).message}`);
        }
      }
    }

    return report;
  }
}
