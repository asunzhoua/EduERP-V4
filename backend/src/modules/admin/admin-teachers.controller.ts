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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { AuthedRequest } from '@common/types/authed-request';
import { AdminTeachersService } from './admin-teachers.service';
import {
  CreateTeacherDto,
  UpdateTeacherDto,
  UpdateTeacherStatusDto,
  QueryTeacherDto,
} from './dto/teacher.dto';

@ApiTags('Admin-Teachers')
@ApiBearerAuth()
@Controller('admin/teachers')
@UseGuards(RolesGuard)
@Roles('SuperAdmin', 'Admin')
export class AdminTeachersController {
  constructor(private readonly teachersService: AdminTeachersService) {}

  @Get()
  @ApiOperation({ summary: '教师列表（含授课数、本月工资）' })
  async findAll(@Query() query: QueryTeacherDto) {
    const result = await this.teachersService.findAll({
      keyword: query.keyword,
      status: query.status,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
    return ApiResponse.success(result);
  }

  @Post()
  @ApiOperation({ summary: '新增教师' })
  async create(@Body() dto: CreateTeacherDto, @Req() req: AuthedRequest) {
    const user = await this.teachersService.create(dto, Number(req.user.sub));
    return ApiResponse.success(user, '教师创建成功');
  }

  @Get(':id')
  @ApiOperation({ summary: '教师详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const teacher = await this.teachersService.findById(id);
    return ApiResponse.success(teacher);
  }

  @Put(':id')
  @ApiOperation({ summary: '修改教师' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeacherDto,
  ) {
    const user = await this.teachersService.update(id, dto);
    return ApiResponse.success(user, '教师修改成功');
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '启用/停用教师' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeacherStatusDto,
  ) {
    const user = await this.teachersService.updateStatus(
      id,
      Number(dto.status),
    );
    return ApiResponse.success(user, '状态已更新');
  }
}
