import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { {{SERVICE}} } from './{{NAME_KEBAB}}.service';
import { Create{{NAME}}Dto } from './dto/create-{{NAME_KEBAB}}.dto';
import { Update{{NAME}}Dto } from './dto/update-{{NAME_KEBAB}}.dto';
import { Query{{NAME}}Dto } from './dto/query-{{NAME_KEBAB}}.dto';
import { ApiResponse } from '@common/dto/api-response';

@ApiTags('{{NAME}}')
@ApiBearerAuth()
@Controller('{{MODULE_KEBAB}}s')
export class {{CONTROLLER}} {
  constructor(private readonly {{NAME_CAMEL}}Service: {{SERVICE}}) {}

  @Post()
  @ApiOperation({ summary: 'Create a new {{NAME_CAMEL}} (DRAFT)' })
  async create(@Body() dto: Create{{NAME}}Dto): Promise<ApiResponse> {
    const result = await this.{{NAME_CAMEL}}Service.create(dto, 1);
    return ApiResponse.success(result, '{{NAME}} created');
  }

  @Get()
  @ApiOperation({ summary: 'List all {{NAME_CAMEL}}s (paginated, filterable)' })
  async findAll(@Query() query: Query{{NAME}}Dto): Promise<ApiResponse> {
    const result = await this.{{NAME_CAMEL}}Service.findAll(query);
    return ApiResponse.success(result);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get {{NAME_CAMEL}} by code' })
  async findOne(@Param('code') code: string): Promise<ApiResponse> {
    const result = await this.{{NAME_CAMEL}}Service.findByCode(code);
    return ApiResponse.success(result);
  }

  @Put(':code')
  @ApiOperation({ summary: 'Update {{NAME_CAMEL}} (DRAFT only)' })
  async update(
    @Param('code') code: string,
    @Body() dto: Update{{NAME}}Dto,
  ): Promise<ApiResponse> {
    const result = await this.{{NAME_CAMEL}}Service.update(code, dto, 1);
    return ApiResponse.success(result, '{{NAME}} updated');
  }

  @Patch(':code/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update {{NAME_CAMEL}} status' })
  async updateStatus(
    @Param('code') code: string,
    @Body('status') status: string,
  ): Promise<ApiResponse> {
    const result = await this.{{NAME_CAMEL}}Service.updateStatus(
      code,
      status as any,
      1,
    );
    return ApiResponse.success(result, '{{NAME}} status updated');
  }

  @Delete(':code')
  @ApiOperation({ summary: 'Delete {{NAME_CAMEL}} (DRAFT only)' })
  async remove(@Param('code') code: string): Promise<ApiResponse> {
    await this.{{NAME_CAMEL}}Service.remove(code, 1);
    return ApiResponse.success(null, '{{NAME}} deleted');
  }
}
