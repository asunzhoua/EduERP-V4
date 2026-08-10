import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, LessThanOrEqual, FindOptionsWhere } from 'typeorm';
import {
  PointsProduct,
  PointsProductStatus,
} from './entities/points-product.entity';
import {
  PointsExchangeRecord,
  PointsExchangeStatus,
} from './entities/points-exchange-record.entity';

export interface CreateProductInput {
  name: string;
  description?: string | null;
  coverImage?: string | null;
  pointsPrice: number;
  stock?: number;
  status?: PointsProductStatus;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  coverImage?: string | null;
  pointsPrice?: number;
  stock?: number;
  status?: PointsProductStatus;
}

export interface QueryProductDto {
  keyword?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface QueryExchangeDto {
  keyword?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class PointsMallService {
  constructor(
    @InjectRepository(PointsProduct)
    private readonly productRepo: Repository<PointsProduct>,
    @InjectRepository(PointsExchangeRecord)
    private readonly exchangeRepo: Repository<PointsExchangeRecord>,
  ) {}

  // ─── 商品管理 ───

  async findProducts(query: QueryProductDto): Promise<{
    items: PointsProduct[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const where: FindOptionsWhere<PointsProduct> = { deleted: false };
    if (query.status) where.status = query.status as PointsProductStatus;
    if (query.keyword) where.name = Like(`%${query.keyword}%`);
    const [items, total] = await this.productRepo.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    return { items, total, page, pageSize };
  }

  async createProduct(
    dto: CreateProductInput,
    operatorId: number,
  ): Promise<PointsProduct> {
    const product = this.productRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      coverImage: dto.coverImage ?? null,
      pointsPrice: dto.pointsPrice || 0,
      stock: dto.stock ?? 0,
      status: dto.status ?? PointsProductStatus.OFF_SALE,
      createdBy: operatorId,
      deleted: false,
    });
    return this.productRepo.save(product);
  }

  async updateProduct(
    id: number,
    dto: UpdateProductInput,
  ): Promise<PointsProduct> {
    const product = await this.productRepo.findOne({
      where: { id, deleted: false },
    });
    if (!product) throw new NotFoundException('商品不存在');
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.coverImage !== undefined) product.coverImage = dto.coverImage;
    if (dto.pointsPrice !== undefined) product.pointsPrice = dto.pointsPrice;
    if (dto.stock !== undefined) product.stock = dto.stock;
    if (dto.status !== undefined) product.status = dto.status;
    return this.productRepo.save(product);
  }

  async updateProductStatus(
    id: number,
    status: PointsProductStatus,
  ): Promise<PointsProduct> {
    const product = await this.productRepo.findOne({
      where: { id, deleted: false },
    });
    if (!product) throw new NotFoundException('商品不存在');
    product.status = status;
    return this.productRepo.save(product);
  }

  /** 低库存提醒：上架商品中库存低于阈值的数量 */
  async getLowStockCount(threshold = 5): Promise<number> {
    return this.productRepo.count({
      where: {
        status: PointsProductStatus.ON_SALE,
        deleted: false,
        stock: LessThanOrEqual(threshold),
      },
    });
  }

  // ─── 兑换记录 ───

  async findExchangeRecords(query: QueryExchangeDto): Promise<{
    items: PointsExchangeRecord[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const where: FindOptionsWhere<PointsExchangeRecord> = {};
    if (query.status) where.status = query.status as PointsExchangeStatus;
    if (query.keyword) {
      where.studentName = Like(`%${query.keyword}%`);
    }
    const [items, total] = await this.exchangeRepo.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    return { items, total, page, pageSize };
  }

  /** 内部：记录一次兑换（供兑换服务调用，当前页面仅读） */
  async createExchange(input: {
    productId: number;
    productName: string;
    studentCode: string;
    studentName: string;
    pointsCost: number;
    quantity?: number;
    status?: PointsExchangeStatus;
  }): Promise<PointsExchangeRecord> {
    const record = this.exchangeRepo.create({
      productId: input.productId,
      productName: input.productName,
      studentCode: input.studentCode,
      studentName: input.studentName,
      pointsCost: input.pointsCost,
      quantity: input.quantity ?? 1,
      status: input.status ?? PointsExchangeStatus.PENDING,
    });
    return this.exchangeRepo.save(record);
  }
}
