import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LessonService } from './lesson.service';
import { CancelLessonDto } from './dto/cancel-lesson.dto';
import { CreateMakeupDto } from './dto/create-makeup.dto';
import { LessonStatus } from './enums/lesson-status.enum';

@ApiTags('Lesson')
@ApiBearerAuth()
@Controller()
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Get('classes/:code/lessons')
  @ApiOperation({ summary: 'List lessons for a class (paginated)' })
  findByClass(@Param('code') code: string) {
    return this.lessonService.findByClassCode(code);
  }

  @Get('classes/:code/lessons/:lessonNumber')
  @ApiOperation({ summary: 'Get lesson by classCode + lessonNumber' })
  async findOne(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
  ) {
    // Find all lessons for this class
    const lessons = await this.lessonService.findByClassCode(code);
    
    // Find the specific lesson by lessonNumber
    const lesson = lessons.find((l) => l.lessonNumber === lessonNumber);
    
    if (!lesson) {
      throw new Error(`Lesson not found: class=${code}, lessonNumber=${lessonNumber}`);
    }
    
    return lesson;
  }

  @Patch('classes/:code/lessons/:lessonNumber/start')
  @ApiOperation({ summary: 'Mark lesson as TEACHING (in progress)' })
  async start(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
  ) {
    // Find the lesson first
    const lessons = await this.lessonService.findByClassCode(code);
    const lesson = lessons.find((l) => l.lessonNumber === lessonNumber);
    
    if (!lesson) {
      throw new Error(`Lesson not found: class=${code}, lessonNumber=${lessonNumber}`);
    }
    
    // Update status to TEACHING
    const operatedBy = 0; // TODO: Get from JWT when auth is implemented
    return this.lessonService.updateStatus(lesson.id, LessonStatus.TEACHING, operatedBy);
  }

  @Patch('classes/:code/lessons/:lessonNumber/complete')
  @ApiOperation({
    summary: 'Complete lesson into FINISHED + emit LessonCompleted',
  })
  async complete(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
  ) {
    // Find the lesson first
    const lessons = await this.lessonService.findByClassCode(code);
    const lesson = lessons.find((l) => l.lessonNumber === lessonNumber);
    
    if (!lesson) {
      throw new Error(`Lesson not found: class=${code}, lessonNumber=${lessonNumber}`);
    }
    
    // Update status to FINISHED
    const operatedBy = 0; // TODO: Get from JWT when auth is implemented
    return this.lessonService.updateStatus(lesson.id, LessonStatus.FINISHED, operatedBy);
  }

  @Patch('classes/:code/lessons/:lessonNumber/confirm')
  @ApiOperation({
    summary: 'Confirm lesson into ARCHIVED + emit LessonFinished',
  })
  async confirm(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
  ) {
    // Find the lesson first
    const lessons = await this.lessonService.findByClassCode(code);
    const lesson = lessons.find((l) => l.lessonNumber === lessonNumber);
    
    if (!lesson) {
      throw new Error(`Lesson not found: class=${code}, lessonNumber=${lessonNumber}`);
    }
    
    // Update status to ARCHIVED
    const operatedBy = 0; // TODO: Get from JWT when auth is implemented
    return this.lessonService.updateStatus(lesson.id, LessonStatus.ARCHIVED, operatedBy);
  }

  @Patch('classes/:code/lessons/:lessonNumber/cancel')
  @ApiOperation({ summary: 'Cancel lesson (requires reason)' })
  async cancel(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
    @Body() body: CancelLessonDto,
  ) {
    // Find the lesson first
    const lessons = await this.lessonService.findByClassCode(code);
    const lesson = lessons.find((l) => l.lessonNumber === lessonNumber);
    
    if (!lesson) {
      throw new Error(`Lesson not found: class=${code}, lessonNumber=${lessonNumber}`);
    }
    
    // Update status to CANCELLED with reason
    const operatedBy = 0; // TODO: Get from JWT when auth is implemented
    return this.lessonService.updateStatus(
      lesson.id,
      LessonStatus.CANCELLED,
      operatedBy,
      body.reason,
    );
  }

  @Post('classes/:code/lessons/makeup')
  @ApiOperation({ summary: 'Create a makeup lesson' })
  createMakeup(
    @Param('code') code: string,
    @Body() body: CreateMakeupDto,
  ) {
    const operatedBy = 0; // TODO: Get from JWT when auth is implemented
    
    return this.lessonService.create({
      classCode: code,
      courseCode: body.courseCode,
      lessonNumber: body.lessonNumber,
      scheduledDate: body.scheduledDate,
      startTime: body.startTime,
      endTime: body.endTime,
      teacherId: body.teacherId,
      isMakeup: true,
      originLessonId: body.originLessonId,
      createdBy: operatedBy,
    });
  }

  @Get('lessons/:id/attendance')
  @ApiOperation({ summary: 'Get attendance records for a lesson' })
  getAttendance(@Param('id') _id: string) {
    // TODO: Implement when attendance module is ready
    throw new Error('Not implemented: attendance module not ready');
  }

  @Put('lessons/:id/attendance')
  @ApiOperation({ summary: 'Set attendance records (bulk update)' })
  setAttendance(@Param('id') _id: string) {
    // TODO: Implement when attendance module is ready
    throw new Error('Not implemented: attendance module not ready');
  }

  @Post('lessons/:id/change-request')
  @ApiOperation({ summary: 'Create a lesson change request' })
  createChangeRequest(@Param('id') _id: string) {
    // TODO: Implement when change request module is ready
    throw new Error('Not implemented: change request module not ready');
  }

  @Get('lessons/pending-confirmation')
  @ApiOperation({ summary: 'List all FINISHED lessons awaiting confirmation' })
  getPendingConfirmation() {
    // TODO: Implement when needed
    throw new Error('Not implemented: pending confirmation feature not ready');
  }

  @Post('lessons/:id/confirm')
  @ApiOperation({ summary: 'Confirm a single lesson' })
  confirmLesson(@Param('id') _id: string) {
    // TODO: Implement when needed
    throw new Error('Not implemented: confirm lesson by ID not ready');
  }

  @Post('lessons/batch-confirm')
  @ApiOperation({ summary: 'Batch confirm multiple lessons' })
  batchConfirm() {
    // TODO: Implement when needed
    throw new Error('Not implemented: batch confirm feature not ready');
  }
}