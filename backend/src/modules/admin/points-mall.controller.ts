import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsNumberString,
} from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { PointsMallService } from './points-mall.service';
import { PointsProductStatus } from './entities/points-product.entity';

class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: '商品名称不能为空' })
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsNumber()
  pointsPrice!: number;

  @IsOptional()
  @IsNumber()
  stock?: number;

  @IsOptional()
  @IsEnum(PointsProductStatus)
  status?: PointsProductStatus;
}

class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsNumber()
  pointsPrice?: number;

  @IsOptional()
  @IsNumber()
  stock?: number;

  @IsOptional()
  @IsEnum(PointsProductStatus)
  status?: PointsProductStatus;
}

class UpdateProductStatusDto {
  @IsEnum(PointsProductStatus)
  status!: PointsProductStatus;
}

class QueryProductDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  pageSize?: string;
}

class QueryExchangeDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  pageSize?: string;
}

@ApiTags('Admin-PointsMall')
@ApiBearerAuth()
@Controller('admin/points')
@UseGuards(RolesGuard)
@Roles('SuperAdmin', 'Admin')
export class PointsMallController {
  constructor(private readonly pointsMallService: PointsMallService) {}

  // ─── 商品 ───

  @Get('products')
  @ApiOperation({ summary: '商品列表' })
  async findProducts(@Query() query: QueryProductDto) {
    const result = await this.pointsMallService.findProducts({
      keyword: query.keyword,
      status: query.status,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
    return ApiResponse.success(result);
  }

  @Post('products')
  @ApiOperation({ summary: '新增商品' })
  async createProduct(@Body() dto: CreateProductDto, @Req() req: any) {
    const product = await this.pointsMallService.createProduct(
      {
        name: dto.name,
        description: dto.description ?? null,
        coverImage: dto.coverImage ?? null,
        pointsPrice: dto.pointsPrice,
        stock: dto.stock,
        status: dto.status,
      },
      Number(req.user.sub),
    );
    return ApiResponse.success(product, '商品创建成功');
  }

  @Put('products/:id')
  @ApiOperation({ summary: '修改商品' })
  async updateProduct(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    const product = await this.pointsMallService.updateProduct(id, dto);
    return ApiResponse.success(product, '商品修改成功');
  }

  @Patch('products/:id/status')
  @ApiOperation({ summary: '上下架商品' })
  async updateProductStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductStatusDto,
  ) {
    const product = await this.pointsMallService.updateProductStatus(id, dto.status);
    return ApiResponse.success(product, '状态已更新');
  }

  @Get('products/low-stock-count')
  @ApiOperation({ summary: '低库存提醒数量' })
  async lowStockCount() {
    const count = await this.pointsMallService.getLowStockCount();
    return ApiResponse.success({ count });
  }

  // ─── 兑换记录 ───

  @Get('exchanges')
  @ApiOperation({ summary: '兑换记录列表' })
  async findExchanges(@Query() query: QueryExchangeDto) {
    const result = await this.pointsMallService.findExchangeRecords({
      keyword: query.keyword,
      status: query.status,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
    return ApiResponse.success(result);
  }
}
