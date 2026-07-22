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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherAssignmentService } from './teacher-assignment.service';
import { TeacherAssignmentEntity } from './teacher-assignment.entity';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';

@ApiTags('Teacher Assignment')
@ApiBearerAuth()
@Controller('teacher-assignments')
export class TeacherAssignmentController {
  constructor(
    private readonly service: TeacherAssignmentService,
    @InjectRepository(TeacherAssignmentEntity)
    private readonly assignmentRepo: Repository<TeacherAssignmentEntity>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create teacher assignment' })
  create(@Body() body: CreateTeacherAssignmentDto, @Req() req: any) {
    return this.service.assign({
      classCode: body.classCode,
      teacherId: body.teacherId,
      role: body.role,
      assignedBy: req.user.sub,
      reason: body.reason,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all teacher assignments' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get teacher assignment by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const assignment = await this.assignmentRepo.findOneBy({ id });
    if (!assignment) {
      throw new NotFoundException(`Teacher assignment #${id} not found`);
    }
    return assignment;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove teacher assignment (end dated)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.unassign(id);
  }
}
