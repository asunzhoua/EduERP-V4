import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { {{REPOSITORY}} } from './{{NAME_KEBAB}}.repository';
import { {{ENTITY}} } from './{{NAME_KEBAB}}.entity';
import { {{NAME}}Status } from './enums/{{NAME_KEBAB}}-status.enum';
import { Create{{NAME}}Dto } from './dto/create-{{NAME_KEBAB}}.dto';
import { Update{{NAME}}Dto } from './dto/update-{{NAME_KEBAB}}.dto';
import { Query{{NAME}}Dto } from './dto/query-{{NAME_KEBAB}}.dto';

const VALID_TRANSITIONS: Record<{{NAME}}Status, {{NAME}}Status[]> = {
  [{{NAME}}Status.DRAFT]: [{{NAME}}Status.ACTIVE, {{NAME}}Status.CANCELLED],
  [{{NAME}}Status.ACTIVE]: [{{NAME}}Status.INACTIVE],
  [{{NAME}}Status.INACTIVE]: [{{NAME}}Status.ACTIVE],
  [{{NAME}}Status.CANCELLED]: [],
};

@Injectable()
export class {{SERVICE}} {
  private readonly logger = new Logger({{SERVICE}}.name);

  constructor(private readonly {{NAME_CAMEL}}Repo: {{REPOSITORY}}) {}

  async create(
    dto: Create{{NAME}}Dto,
    operatedBy: number,
  ): Promise<{{ENTITY}}> {
    const existing = await this.{{NAME_CAMEL}}Repo.findOneByCode(dto.{{NAME_CAMEL}}Code);
    if (existing) {
      throw new BadRequestException(
        `{{NAME}} with code ${dto.{{NAME_CAMEL}}Code} already exists`,
      );
    }

    const entity = this.{{NAME_CAMEL}}Repo.raw.create({
      ...dto,
      status: {{NAME}}Status.DRAFT,
      createdBy: operatedBy,
    });

    const saved = await this.{{NAME_CAMEL}}Repo.save(entity);
    this.logger.log(`{{NAME}} created: ${saved.{{NAME_CAMEL}}Code}`);
    return saved;
  }

  async findByCode({{NAME_CAMEL}}Code: string): Promise<{{ENTITY}}> {
    const entity = await this.{{NAME_CAMEL}}Repo.findOneByCode({{NAME_CAMEL}}Code);
    if (!entity) {
      throw new NotFoundException(
        `{{NAME}} not found: ${{{NAME_CAMEL}}Code}`,
      );
    }
    return entity;
  }

  async findAll(
    query: Query{{NAME}}Dto,
  ): Promise<{ items: {{ENTITY}}[]; total: number }> {
    return this.{{NAME_CAMEL}}Repo.findMany(query);
  }

  async update(
    {{NAME_CAMEL}}Code: string,
    dto: Update{{NAME}}Dto,
    operatedBy: number,
  ): Promise<{{ENTITY}}> {
    const entity = await this.findByCode({{NAME_CAMEL}}Code);

    if (entity.status !== {{NAME}}Status.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT {{NAME}} can be updated',
      );
    }

    const updatableFields = ['name'] as const;
    for (const field of updatableFields) {
      if ((dto as any)[field] !== undefined) {
        (entity as any)[field] = (dto as any)[field];
      }
    }
    entity.updatedBy = operatedBy;

    const saved = await this.{{NAME_CAMEL}}Repo.save(entity);
    this.logger.log(`{{NAME}} updated: ${saved.{{NAME_CAMEL}}Code}`);
    return saved;
  }

  async updateStatus(
    {{NAME_CAMEL}}Code: string,
    targetStatus: {{NAME}}Status,
    operatedBy: number,
  ): Promise<{{ENTITY}}> {
    const entity = await this.findByCode({{NAME_CAMEL}}Code);

    const allowed = VALID_TRANSITIONS[entity.status];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${entity.status} to ${targetStatus}`,
      );
    }

    entity.status = targetStatus;
    entity.updatedBy = operatedBy;

    const saved = await this.{{NAME_CAMEL}}Repo.save(entity);
    this.logger.log(
      `{{NAME}} status: ${entity.{{NAME_CAMEL}}Code} ${entity.status} -> ${targetStatus}`,
    );
    return saved;
  }

  async remove(
    {{NAME_CAMEL}}Code: string,
    operatedBy: number,
  ): Promise<void> {
    const entity = await this.findByCode({{NAME_CAMEL}}Code);

    if (entity.status !== {{NAME}}Status.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT {{NAME}} can be deleted',
      );
    }

    entity.deleted = true;
    entity.updatedBy = operatedBy;
    await this.{{NAME_CAMEL}}Repo.save(entity);
    this.logger.log(`{{NAME}} deleted: ${{{NAME_CAMEL}}Code}`);
  }
}
