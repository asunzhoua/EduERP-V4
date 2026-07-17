import { Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotImplementedException } from '@nestjs/common';

@ApiTags('Teacher Assignment')
@ApiBearerAuth()
@Controller('teacher-assignments')
export class TeacherAssignmentController {
  @Post()
  @ApiOperation({ summary: 'Create teacher assignment' })
  create() {
    throw new NotImplementedException();
  }

  @Get()
  @ApiOperation({ summary: 'List all teacher assignments' })
  findAll() {
    throw new NotImplementedException();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get teacher assignment by ID' })
  findOne(@Param('id') _id: string) {
    throw new NotImplementedException();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove teacher assignment (end dated)' })
  remove(@Param('id') _id: string) {
    throw new NotImplementedException();
  }
}
