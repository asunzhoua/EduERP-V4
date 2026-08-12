import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SubjectEntity } from './subject.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';

@Injectable()
export class SubjectService {
  private readonly logger = new Logger(SubjectService.name);

  constructor(
    @InjectRepository(SubjectEntity)
    private readonly repo: Repository<SubjectEntity>,
  ) {}

  async findAll(): Promise<SubjectEntity[]> {
    return this.repo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL')
      .orderBy('s.sortOrder', 'ASC')
      .addOrderBy('s.code', 'ASC')
      .getMany();
  }

  async findByCode(code: string): Promise<SubjectEntity | null> {
    return this.repo.findOne({ where: { code, deletedAt: IsNull() } });
  }

  /**
   * 新建自定义学科（幂等）：同名非软删学科已存在 → 直接返回既有，防止目录重复。
   * code 用 SUBJ + 4 位序号，软删记录纳入编码空间（code UNIQUE 防撞）。
   */
  async create(
    dto: CreateSubjectDto,
    operatorId: number,
  ): Promise<SubjectEntity> {
    const name = dto.name.trim();
    const existing = await this.repo.findOne({
      where: { name, deletedAt: IsNull() },
    });
    if (existing) return existing;

    const code = await this.generateCode();
    const seq = parseInt(code.slice(4), 10);
    const entity = this.repo.create({
      code,
      name,
      category: dto.category,
      isDefault: false,
      sortOrder: 1000 + seq,
      createdBy: operatorId,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(`Subject created: ${saved.name} (${saved.code})`);
    return saved;
  }

  /** 软删自定义学科；内置学科与 Teacher 非本人创建的不允许删。 */
  async remove(code: string, operatorId: number, role: string): Promise<void> {
    const entity = await this.findByCode(code);
    if (!entity) {
      throw new NotFoundException(`Subject not found: ${code}`);
    }
    if (entity.isDefault) {
      throw new BadRequestException(`内置学科不可删除: ${entity.name}`);
    }
    if (role === 'Teacher' && Number(entity.createdBy) !== operatorId) {
      throw new ForbiddenException('只能删除自己创建的学科');
    }
    entity.deletedAt = new Date();
    entity.updatedBy = operatorId;
    await this.repo.save(entity);
    this.logger.log(`Subject soft-deleted: ${code}`);
  }

  /** code 形如 SUBJ0001；软删记录仍占用编码空间，max 计算必须纳入。 */
  private async generateCode(): Promise<string> {
    const latest = await this.repo
      .createQueryBuilder('s')
      .where('s.code LIKE :prefix', { prefix: 'SUBJ%' })
      .orderBy('s.code', 'DESC')
      .getOne();

    let seq = 1;
    if (latest) {
      const last = parseInt(latest.code.slice(4), 10);
      if (!Number.isNaN(last)) seq = last + 1;
    }
    return `SUBJ${seq.toString().padStart(4, '0')}`;
  }
}
