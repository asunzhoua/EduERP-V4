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
import { LessonStatus } from './enums/lesson-status.enum';
import { CreateLessonDto } from './dto/create-lesson.dto';

@ApiTags('Lesson')
@ApiBearerAuth()
@Controller()
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Get('classes/:code/lessons')
  @ApiOperation({ summary: 'List lessons for a class (paginated)' })
  async findByClass(@Param('code') code: string) {
    return this.lessonService.findByClassCode(code);
  }

  @Get('classes/:code/lessons/:lessonNumber')
  @ApiOperation({ summary: 'Get lesson by classCode + lessonNumber' })
  async findOne(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
  ) {
    return this.lessonService.findByClassCodeAndLessonNumber(code, lessonNumber);
  }

  @Patch('classes/:code/lessons/:lessonNumber/start')
  @ApiOperation({ summary: 'Mark lesson as TEACHING (in progress)' })
  async start(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
  ) {
    const lesson = await this.lessonService.findByClassCodeAndLessonNumber(
      code,
      lessonNumber,
    );
    return this.lessonService.updateStatus(
      lesson.id,
      LessonStatus.TEACHING,
      0, // TODO: get from auth context
    );
  }

  @Patch('classes/:code/lessons/:lessonNumber/complete')
  @ApiOperation({
    summary: 'Complete lesson into FINISHED + emit LessonCompleted',
  })
  async complete(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
  ) {
    const lesson = await this.lessonService.findByClassCodeAndLessonNumber(
      code,
      lessonNumber,
    );
    return this.lessonService.updateStatus(
      lesson.id,
      LessonStatus.FINISHED,
      0, // TODO: get from auth context
    );
  }

  @Patch('classes/:code/lessons/:lessonNumber/confirm')
  @ApiOperation({
    summary: 'Confirm lesson into ARCHIVED + emit LessonFinished',
  })
  async confirm(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
  ) {
    const lesson = await this.lessonService.findByClassCodeAndLessonNumber(
      code,
      lessonNumber,
    );
    return this.lessonService.updateStatus(
      lesson.id,
      LessonStatus.ARCHIVED,
      0, // TODO: get from auth context
    );
  }

  @Patch('classes/:code/lessons/:lessonNumber/cancel')
  @ApiOperation({ summary: 'Cancel lesson (requires reason)' })
  async cancel(
    @Param('code') code: string,
    @Param('lessonNumber', ParseIntPipe) lessonNumber: number,
    @Body('reason') reason: string,
  ) {
    const lesson = await this.lessonService.findByClassCodeAndLessonNumber(
      code,
      lessonNumber,
    );
    return this.lessonService.updateStatus(
      lesson.id,
      LessonStatus.CANCELLED,
      0, // TODO: get from auth context
      reason,
    );
  }

  @Post('classes/:code/lessons/makeup')
  @ApiOperation({ summary: 'Create a makeup lesson' })
  async createMakeup(
    @Param('code') code: string,
    @Body() dto: CreateLessonDto,
  ) {
    // Makeup lesson uses same create method with isMakeup flag
    const input = {
      ...dto,
      classCode: code,
      isMakeup: true,
    };
    return this.lessonService.create(input);
  }

  @Get('lessons/:id/attendance')
  @ApiOperation({ summary: 'Get attendance records for a lesson' })
  async getAttendance(@Param('id', ParseIntPipe) id: number) {
    // TODO: Implement attendance retrieval
    // For now, return the lesson entity which may contain attendance info
    return this.lessonService.findOne(id);
  }

  @Put('lessons/:id/attendance')
  @ApiOperation({ summary: 'Set attendance records (bulk update)' })
  async setAttendance(
    @Param('id', ParseIntPipe) id: number,
    @Body() _attendanceData: any,
  ) {
    // TODO: Implement attendance setting
    // For now, just return the lesson
    return this.lessonService.findOne(id);
  }

  @Post('lessons/:id/change-request')
  @ApiOperation({ summary: 'Create a lesson change request' })
  async createChangeRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() _requestData: any,
  ) {
    // TODO: Implement change request creation
    // For now, just return the lesson
    return this.lessonService.findOne(id);
  }

  @Get('lessons/pending-confirmation')
  @ApiOperation({ summary: 'List all FINISHED lessons awaiting confirmation' })
  async getPendingConfirmation() {
    // TODO: Implement pending confirmation list
    // For now, return empty array
    return [];
  }

  @Post('lessons/:id/confirm')
  @ApiOperation({ summary: 'Confirm a single lesson' })
  async confirmLesson(@Param('id', ParseIntPipe) id: number) {
    return this.lessonService.updateStatus(
      id,
      LessonStatus.ARCHIVED,
      0, // TODO: get from auth context
    );
  }

  @Post('lessons')
  @ApiOperation({ summary: 'Create a new lesson' })
  async create(@Body() dto: CreateLessonDto) {
    return this.lessonService.create(dto);
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Get lesson by id' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.lessonService.findOne(id);
  }

  @Patch('lessons/:id/reopen')
  @ApiOperation({ summary: 'Reopen a lesson (FINISHED -> SCHEDULED or ARCHIVED -> FINISHED)' })
  async reopen(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
  ) {
    const lesson = await this.lessonService.findOne(id);
    
    // Determine target status based on current status
    let targetStatus: LessonStatus;
    if (lesson.status === LessonStatus.ARCHIVED) {
      targetStatus = LessonStatus.FINISHED;
    } else if (lesson.status === LessonStatus.FINISHED) {
      targetStatus = LessonStatus.SCHEDULED;
    } else if (lesson.status === LessonStatus.CANCELLED) {
      targetStatus = LessonStatus.SCHEDULED;
    } else {
      throw new Error(`Cannot reopen lesson in status: ${lesson.status}`);
    }
    
    return this.lessonService.updateStatus(id, targetStatus, 0, reason);
  }
}