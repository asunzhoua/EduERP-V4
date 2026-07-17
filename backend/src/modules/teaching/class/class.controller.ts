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
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { ClassService } from './class.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateClassStatusDto } from './dto/update-class-status.dto';
import { QueryClassDto } from './dto/query-class.dto';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { ApiResponse } from '@common/dto/api-response';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Class')
@ApiBearerAuth()
@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  // ─── Class CRUD ───

  @Post()
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Create a new class (DRAFT)' })
  @SwaggerResponse({ status: 0, description: 'Class created successfully' })
  async create(@Body() dto: CreateClassDto, @Req() req: any): Promise<ApiResponse> {
    const operatorId = req.user.sub;
    const cls = await this.classService.create(dto, operatorId);
    return ApiResponse.success(cls, 'Class created');
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'List all classes (paginated, filterable)' })
  async findAll(@Query() query: QueryClassDto): Promise<ApiResponse> {
    const result = await this.classService.findAll(query);
    return ApiResponse.success(result);
  }

  @Get(':code')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Get class by classCode' })
  async findOne(@Param('code') code: string): Promise<ApiResponse> {
    const cls = await this.classService.findByCode(code);
    return ApiResponse.success(cls);
  }

  @Put(':code')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Update class (DRAFT only)' })
  async update(
    @Param('code') code: string,
    @Body() dto: UpdateClassDto,
    @Req() req: any,
  ): Promise<ApiResponse> {
    const operatorId = req.user.sub;
    const cls = await this.classService.update(code, dto, operatorId);
    return ApiResponse.success(cls, 'Class updated');
  }

  @Patch(':code/status')
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change class status' })
  async updateStatus(
    @Param('code') code: string,
    @Body() dto: UpdateClassStatusDto,
    @Req() req: any,
  ): Promise<ApiResponse> {
    const operatorId = req.user.sub;
    const cls = await this.classService.updateStatus(
      code,
      dto.status,
      operatorId,
      dto.cancelledReason,
    );
    return ApiResponse.success(cls, 'Status updated');
  }

  @Delete(':code')
  @Roles('SuperAdmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete class (DRAFT only)' })
  async remove(@Param('code') code: string, @Req() req: any): Promise<ApiResponse> {
    const operatorId = req.user.sub;
    await this.classService.remove(code, operatorId);
    return ApiResponse.success(null, 'Class deleted');
  }

  // ─── Teacher Assignment (class-scoped) ───

  @Post(':code/teachers')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Assign teacher to class' })
  async assignTeacher(
    @Param('code') code: string,
    @Body() dto: AssignTeacherDto,
    @Req() req: any,
  ): Promise<ApiResponse> {
    const operatorId = req.user.sub;
    const assignment = await this.classService.assignTeacher({
      classCode: code,
      teacherId: dto.teacherId,
      role: dto.role,
      assignedBy: operatorId,
      reason: dto.reason,
    });
    return ApiResponse.success(assignment, 'Teacher assigned');
  }

  @Delete(':code/teachers/:assignmentId')
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove teacher from class (end assignment)' })
  async removeTeacher(
    @Param('code') _code: string,
    @Param('assignmentId') assignmentId: string,
    @Req() req: any,
  ): Promise<ApiResponse> {
    const operatorId = req.user.sub;
    await this.classService.removeTeacher(Number(assignmentId), operatorId);
    return ApiResponse.success(null, 'Teacher assignment ended');
  }

  @Get(':code/teachers')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Get active teachers assigned to class' })
  async getTeachers(@Param('code') code: string): Promise<ApiResponse> {
    const teachers = await this.classService.getTeachers(code);
    return ApiResponse.success(teachers);
  }
}
