import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { JwtAuthGuard } from '@modules/identity/auth/jwt-auth.guard';
import { FeedbackService } from './feedback.service';

class CreateFeedbackDto {
  @IsNumber()
  lessonId!: number;

  @IsString()
  @IsNotEmpty({ message: '学生学号不能为空' })
  studentCode!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  performance?: string;

  @IsOptional()
  @IsString()
  homework?: string;

  @IsOptional()
  @IsString()
  suggestion?: string;
}

@Controller('feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /** 教师/管理员填写课程反馈 */
  @Post()
  @Roles('Teacher', 'Admin', 'SuperAdmin')
  async create(@Body() dto: CreateFeedbackDto, @Req() req: any) {
    const feedback = await this.feedbackService.create({
      lessonId: dto.lessonId,
      studentCode: dto.studentCode,
      teacherId: Number(req.user.sub),
      content: dto.content,
      performance: dto.performance,
      homework: dto.homework,
      suggestion: dto.suggestion,
    });
    return ApiResponse.success(feedback, '反馈已保存');
  }

  /** 某节课的反馈列表（教师端） */
  @Get('lesson/:lessonId')
  @Roles('Teacher', 'Admin', 'SuperAdmin')
  async findByLesson(@Param('lessonId', ParseIntPipe) lessonId: number) {
    const list = await this.feedbackService.findByLessonId(lessonId);
    return ApiResponse.success(list);
  }
}
