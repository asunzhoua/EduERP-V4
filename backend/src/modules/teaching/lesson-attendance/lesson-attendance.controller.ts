import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotImplementedException } from '@nestjs/common';

@ApiTags('LessonAttendance')
@ApiBearerAuth()
@Controller()
export class LessonAttendanceController {
  @Post('lessons/:id/attendance')
  @ApiOperation({
    summary: 'Batch roll call — record attendance for all students',
  })
  batchRollCall(@Param('id') _id: string, @Body() _body: any) {
    throw new NotImplementedException();
  }

  @Patch('lessons/:id/attendance/:studentCode')
  @ApiOperation({ summary: 'Update attendance for a single student' })
  updateAttendance(
    @Param('id') _id: string,
    @Param('studentCode') _studentCode: string,
    @Body() _body: any,
  ) {
    throw new NotImplementedException();
  }

  @Get('lessons/:id/attendance')
  @ApiOperation({ summary: 'List attendance records for a lesson' })
  findByLesson(@Param('id') _id: string) {
    throw new NotImplementedException();
  }

  @Post('lessons/:id/attendance/confirm')
  @ApiOperation({ summary: 'Confirm all attendance for a lesson (admin)' })
  confirmAll(@Param('id') _id: string) {
    throw new NotImplementedException();
  }

  @Get('students/:studentCode/attendance')
  @ApiOperation({ summary: 'Student attendance history' })
  findByStudent(@Param('studentCode') _studentCode: string) {
    throw new NotImplementedException();
  }
}
