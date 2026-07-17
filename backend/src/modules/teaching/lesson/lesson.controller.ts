import { Controller, Get, Post, Put, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotImplementedException } from '@nestjs/common';

@ApiTags('Lesson')
@ApiBearerAuth()
@Controller()
export class LessonController {
  @Get('classes/:code/lessons')
  @ApiOperation({ summary: 'List lessons for a class (paginated)' })
  findByClass(@Param('code') _code: string) {
    throw new NotImplementedException();
  }

  @Get('classes/:code/lessons/:lessonNumber')
  @ApiOperation({ summary: 'Get lesson by classCode + lessonNumber' })
  findOne(
    @Param('code') _code: string,
    @Param('lessonNumber') _lessonNumber: string,
  ) {
    throw new NotImplementedException();
  }

  @Patch('classes/:code/lessons/:lessonNumber/start')
  @ApiOperation({ summary: 'Mark lesson as TEACHING (in progress)' })
  start(
    @Param('code') _code: string,
    @Param('lessonNumber') _lessonNumber: string,
  ) {
    throw new NotImplementedException();
  }

  @Patch('classes/:code/lessons/:lessonNumber/complete')
  @ApiOperation({
    summary: 'Complete lesson into FINISHED + emit LessonCompleted',
  })
  complete(
    @Param('code') _code: string,
    @Param('lessonNumber') _lessonNumber: string,
  ) {
    throw new NotImplementedException();
  }

  @Patch('classes/:code/lessons/:lessonNumber/confirm')
  @ApiOperation({
    summary: 'Confirm lesson into ARCHIVED + emit LessonFinished',
  })
  confirm(
    @Param('code') _code: string,
    @Param('lessonNumber') _lessonNumber: string,
  ) {
    throw new NotImplementedException();
  }

  @Patch('classes/:code/lessons/:lessonNumber/cancel')
  @ApiOperation({ summary: 'Cancel lesson (requires reason)' })
  cancel(
    @Param('code') _code: string,
    @Param('lessonNumber') _lessonNumber: string,
  ) {
    throw new NotImplementedException();
  }

  @Post('classes/:code/lessons/makeup')
  @ApiOperation({ summary: 'Create a makeup lesson' })
  createMakeup(@Param('code') _code: string) {
    throw new NotImplementedException();
  }

  @Get('lessons/:id/attendance')
  @ApiOperation({ summary: 'Get attendance records for a lesson' })
  getAttendance(@Param('id') _id: string) {
    throw new NotImplementedException();
  }

  @Put('lessons/:id/attendance')
  @ApiOperation({ summary: 'Set attendance records (bulk update)' })
  setAttendance(@Param('id') _id: string) {
    throw new NotImplementedException();
  }

  @Post('lessons/:id/change-request')
  @ApiOperation({ summary: 'Create a lesson change request' })
  createChangeRequest(@Param('id') _id: string) {
    throw new NotImplementedException();
  }

  @Get('lessons/pending-confirmation')
  @ApiOperation({ summary: 'List all FINISHED lessons awaiting confirmation' })
  getPendingConfirmation() {
    throw new NotImplementedException();
  }

  @Post('lessons/:id/confirm')
  @ApiOperation({ summary: 'Confirm a single lesson' })
  confirmLesson(@Param('id') _id: string) {
    throw new NotImplementedException();
  }

  @Post('lessons/batch-confirm')
  @ApiOperation({ summary: 'Batch confirm multiple lessons' })
  batchConfirm() {
    throw new NotImplementedException();
  }
}
