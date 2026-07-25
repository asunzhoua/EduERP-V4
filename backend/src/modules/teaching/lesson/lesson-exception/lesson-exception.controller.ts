import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LessonExceptionService } from './lesson-exception.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { ApplySuspendDto } from './dto/apply-suspend.dto';
import { ApplyMakeupDto } from './dto/apply-makeup.dto';
import { ApproveExceptionDto, RejectExceptionDto } from './dto/approve-exception.dto';
import { ApiResponse } from '@common/dto/api-response';
import { JwtAuthGuard } from '@modules/identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Lesson Exception')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonExceptionController {
  constructor(
    private readonly lessonExceptionService: LessonExceptionService,
  ) {}

  @Post('lessons/:id/leave')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: '申请请假' })
  async applyLeave(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApplyLeaveDto,
    @Req() req: any,
  ) {
    const operatorId = req.user.sub;
    const result = await this.lessonExceptionService.applyLeave(
      id,
      dto.exceptionType,
      dto.reason,
      new Date(dto.startTime),
      new Date(dto.endTime),
      dto.attachments ?? [],
      operatorId,
    );
    return ApiResponse.success(result, '请假申请已提交');
  }

  @Post('lessons/suspend')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: '申请停课' })
  async applySuspend(
    @Body() dto: ApplySuspendDto,
    @Req() req: any,
  ) {
    const operatorId = req.user.sub;
    const result = await this.lessonExceptionService.applySuspend(
      dto.lessonIds,
      dto.exceptionType,
      dto.reason,
      new Date(dto.startTime),
      new Date(dto.endTime),
      dto.autoRestore,
      operatorId,
    );
    return ApiResponse.success(result, '停课申请已提交');
  }

  @Post('lessons/:id/makeup')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: '申请补课' })
  async applyMakeup(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApplyMakeupDto,
    @Req() req: any,
  ) {
    const operatorId = req.user.sub;
    const result = await this.lessonExceptionService.applyMakeup(
      dto.originalLessonId,
      dto.exceptionId,
      new Date(dto.rescheduledStart),
      new Date(dto.rescheduledEnd),
      dto.teacherId,
      dto.roomId,
      operatorId,
    );
    return ApiResponse.success(result, '补课申请已提交');
  }

  @Put('lesson-exceptions/:id/approve')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: '审批通过' })
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveExceptionDto,
    @Req() req: any,
  ) {
    const operatorId = req.user.sub;
    const result = await this.lessonExceptionService.approve(
      id,
      operatorId,
      dto.remark,
    );
    return ApiResponse.success(result, '审批通过');
  }

  @Put('lesson-exceptions/:id/reject')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: '审批拒绝' })
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectExceptionDto,
    @Req() req: any,
  ) {
    const operatorId = req.user.sub;
    const result = await this.lessonExceptionService.reject(
      id,
      operatorId,
      dto.rejectReason,
    );
    return ApiResponse.success(result, '已拒绝');
  }

  @Get('lesson-exceptions')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: '查询异常列表' })
  async findAll() {
    const result = await this.lessonExceptionService.findAllExceptions();
    return ApiResponse.success(result);
  }

  @Get('lessons/:id/exceptions')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: '查询课程异常记录' })
  async findByLesson(@Param('id', ParseIntPipe) id: number) {
    const result = await this.lessonExceptionService.findExceptionsByLesson(id);
    return ApiResponse.success(result);
  }
}
