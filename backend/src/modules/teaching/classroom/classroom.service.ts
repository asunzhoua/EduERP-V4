import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ClassroomEntity } from './classroom.entity';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { QueryClassroomDto } from './dto/query-classroom.dto';
import { ClassroomStatus } from './dto/update-classroom-status.dto';

@Injectable()
export class ClassroomService {
  private readonly logger = new Logger(ClassroomService.name);

  constructor(
    @InjectRepository(ClassroomEntity)
    private readonly repo: Repository<ClassroomEntity>,
  ) {}

  // ─── Read ───

  async findAll(
    query: QueryClassroomDto,
  ): Promise<{ items: ClassroomEntity[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.repo.createQueryBuilder('cr').where('cr.deletedAt IS NULL');

    if (query.name) {
      qb.andWhere('cr.name LIKE :name', { name: `%${query.name}%` });
    }

    qb.orderBy('cr.createTime', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { items, total };
  }

  async findById(id: number): Promise<ClassroomEntity> {
    const classroom = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!classroom) {
      throw new NotFoundException(`Classroom not found: ${id}`);
    }
    return classroom;
  }

  /**
   * 批量查询教室（用于班级 enrich 展示 classroomName）。
   * 包含已软删教室，保证历史班级仍能解析到教室名。
   */
  async findByIds(ids: number[]): Promise<ClassroomEntity[]> {
    if (ids.length === 0) return [];
    return this.repo
      .createQueryBuilder('cr')
      .where('cr.id IN (:...ids)', { ids })
      .getMany();
  }

  // ─── Create ───

  async create(
    dto: CreateClassroomDto,
    operatorId: number,
  ): Promise<ClassroomEntity> {
    const classroom = this.repo.create({
      name: dto.name,
      capacity: dto.capacity ?? 20,
      note: dto.note ?? null,
      createdBy: operatorId,
    });

    const saved = await this.repo.save(classroom);
    this.logger.log(`Classroom created: ${saved.name}`);
    return saved;
  }

  // ─── Update ───

  async update(
    id: number,
    dto: UpdateClassroomDto,
    operatorId: number,
  ): Promise<ClassroomEntity> {
    const classroom = await this.findById(id);

    if (dto.name !== undefined) classroom.name = dto.name;
    if (dto.capacity !== undefined) classroom.capacity = dto.capacity;
    if (dto.note !== undefined) classroom.note = dto.note;

    classroom.updatedBy = operatorId;
    const saved = await this.repo.save(classroom);
    this.logger.log(`Classroom updated: ${id}`);
    return saved;
  }

  // ─── Soft Delete / Status ───

  async softDelete(id: number, operatorId: number): Promise<void> {
    const classroom = await this.findById(id);
    if (classroom.deletedAt) {
      throw new BadRequestException(`Classroom already disabled: ${id}`);
    }
    classroom.deletedAt = new Date();
    classroom.updatedBy = operatorId;
    await this.repo.save(classroom);
    this.logger.log(`Classroom soft-deleted: ${id}`);
  }

  /** 状态切换：DISABLED=软删，ACTIVE=恢复启用。 */
  async updateStatus(
    id: number,
    status: ClassroomStatus,
    operatorId: number,
  ): Promise<ClassroomEntity> {
    const classroom = await this.findById(id);
    if (status === ClassroomStatus.DISABLED) {
      if (!classroom.deletedAt) {
        classroom.deletedAt = new Date();
        classroom.updatedBy = operatorId;
        await this.repo.save(classroom);
        this.logger.log(`Classroom disabled: ${id}`);
      }
    } else {
      if (classroom.deletedAt) {
        classroom.deletedAt = null;
        classroom.updatedBy = operatorId;
        await this.repo.save(classroom);
        this.logger.log(`Classroom enabled: ${id}`);
      }
    }
    return this.findById(id);
  }
}
