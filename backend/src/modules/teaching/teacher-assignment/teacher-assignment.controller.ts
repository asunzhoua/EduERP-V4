import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherAssignmentService } from './teacher-assignment.service';
import { TeacherAssignmentEntity } from './teacher-assignment.entity';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { AuthedRequest } from '@common/types/authed-request';

@ApiTags('Teacher Assignment')
@ApiBearerAuth()
@Controller('teacher-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherAssignmentController {
  constructor(
    private readonly service: TeacherAssignmentService,
    @InjectRepository(TeacherAssignmentEntity)
    private readonly assignmentRepo: Repository<TeacherAssignmentEntity>,
  ) {}

  @Post()
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Create teacher assignment' })
  async create(@Body() body: CreateTeacherAssignmentDto, @Req() req: AuthedRequest) {
    const result = await this.service.assign({
      classCode: body.classCode,
      teacherId: body.teacherId,
      role: body.role,
      assignedBy: req.user.sub,
      reason: body.reason,
    });
    return ApiResponse.success(result, 'Teacher assigned');
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'List all teacher assignments' })
  async findAll(@Req() req: AuthedRequest) {
    // M-02 修复: Teacher 只能看到自己的分配记录
    const teacherId =
      req.user.role === 'Teacher' ? Number(req.user.sub) : undefined;
    const result = await this.service.findAll(teacherId);
    return ApiResponse.success(result);
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Get teacher assignment by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    const assignment = await this.assignmentRepo.findOneBy({ id });
    if (!assignment) {
      throw new NotFoundException(`Teacher assignment #${id} not found`);
    }
    // M-02 修复: Teacher 只能看到自己的分配记录
    if (
      req.user.role === 'Teacher' &&
      assignment.teacherId !== Number(req.user.sub)
    ) {
      return ApiResponse.success(null);
    }
    return ApiResponse.success(assignment);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Remove teacher assignment (end dated)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.service.unassign(id);
    return ApiResponse.success(result, 'Teacher assignment ended');
  }
}
