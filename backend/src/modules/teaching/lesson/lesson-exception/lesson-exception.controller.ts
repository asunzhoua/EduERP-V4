import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  ParseIntPipe,
  Req,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { LessonExceptionService } from './lesson-exception.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { ApplySuspendDto } from './dto/apply-suspend.dto';
import { ApplyMakeupDto } from './dto/apply-makeup.dto';
import { ApproveExceptionDto, RejectExceptionDto } from './dto/approve-exception.dto';
import { QueryExceptionDto } from './dto/query-exception.dto';
import { ApiResponse } from '@common/dto/api-response';
import { JwtAuthGuard } from '@modules/identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@ApiTags('Lesson Exception')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonExceptionController {
  constructor(
    private readonly lessonExceptionService: LessonExceptionService,
  ) {}

  // ═══════════════════════════════════════════════════
  // 申请类接口
  // ═══════════════════════════════════════════════════

  @Post('lessons/:id/leave')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: '申请请假' })
  @SwaggerResponse({ status: 201, description: '请假申请已提交' })
  @SwaggerResponse({ status: 400, description: '参数错误或业务规则校验失败' })
  @SwaggerResponse({ status: 403, description: '无权操作' })
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
  @SwaggerResponse({ status: 201, description: '停课申请已提交' })
  @SwaggerResponse({ status: 400, description: '参数错误' })
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
  @SwaggerResponse({ status: 201, description: '补课申请已提交' })
  @SwaggerResponse({ status: 400, description: '参数错误' })
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

  // ═══════════════════════════════════════════════════
  // 审批类接口
  // ═══════════════════════════════════════════════════

  @Put('lesson-exceptions/:id/approve')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: '审批通过（仅管理员）' })
  @ApiParam({ name: 'id', description: '异常记录ID' })
  @SwaggerResponse({ status: 200, description: '审批通过' })
  @SwaggerResponse({ status: 400, description: '状态校验失败' })
  @SwaggerResponse({ status: 403, description: '教师不能审批自己的课程异常' })
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveExceptionDto,
    @CurrentUser() user: any,
  ) {
    // 教师不能审批自己的课程异常
    if (user.role === 'Teacher') {
      const exception = await this.lessonExceptionService.findExceptionByIdWithRelations(id);
      if (exception.lesson && exception.lesson.teacherId === Number(user.sub)) {
        throw new ForbiddenException('教师不能审批自己的课程异常');
      }
    }
    const operatorId = Number(user.sub);
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
  @ApiParam({ name: 'id', description: '异常记录ID' })
  @SwaggerResponse({ status: 200, description: '已拒绝' })
  @SwaggerResponse({ status: 400, description: '状态校验失败' })
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

  // ═══════════════════════════════════════════════════
  // 查询类接口
  // ═══════════════════════════════════════════════════

  @Get('lesson-exceptions')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Parent')
  @ApiOperation({ summary: '查询异常申请列表（权限隔离）' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'], description: '审批状态' })
  @ApiQuery({ name: 'exceptionType', required: false, enum: ['LEAVE_SICK', 'LEAVE_PERSONAL', 'LEAVE_TRAINING', 'SUSPEND_SHORT', 'SUSPEND_LONG'], description: '异常类型' })
  @ApiQuery({ name: 'startDate', required: false, description: '开始日期（含）' })
  @ApiQuery({ name: 'endDate', required: false, description: '结束日期（含）' })
  @SwaggerResponse({ status: 200, description: '成功返回异常列表' })
  @SwaggerResponse({ status: 403, description: '无权访问' })
  async findAll(
    @Query() query: QueryExceptionDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.lessonExceptionService.findAllExceptionsWithQuery(query, user);
    return ApiResponse.success(result);
  }

  @Get('lesson-exceptions/:id')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Parent')
  @ApiOperation({ summary: '查询异常详情' })
  @ApiParam({ name: 'id', description: '异常记录ID' })
  @SwaggerResponse({ status: 200, description: '成功返回异常详情（含课程、审批记录、补课信息）' })
  @SwaggerResponse({ status: 403, description: '无权访问' })
  @SwaggerResponse({ status: 404, description: '异常不存在' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    // Permission check
    const canAccess = await this.lessonExceptionService.canAccessException(id, user);
    if (!canAccess) {
      throw new ForbiddenException('无权访问该异常');
    }

    const exception = await this.lessonExceptionService.findExceptionByIdWithRelations(id);

    // Attach logs and reschedule
    const logs = await this.lessonExceptionService.findExceptionsLogsByException(id);
    const reschedule = await this.lessonExceptionService.findRescheduleByExceptionId(id);

    return ApiResponse.success({
      ...exception,
      logs,
      reschedule,
    });
  }

  @Get('lesson-exceptions/:id/reschedule')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Parent')
  @ApiOperation({ summary: '查询补课安排' })
  @ApiParam({ name: 'id', description: '异常记录ID' })
  @SwaggerResponse({ status: 200, description: '成功返回补课安排' })
  @SwaggerResponse({ status: 403, description: '无权访问' })
  async findReschedule(
    @Param('id', ParseIntPipe) exceptionId: number,
    @CurrentUser() user: any,
  ) {
    // Permission check
    const canAccess = await this.lessonExceptionService.canAccessException(exceptionId, user);
    if (!canAccess) {
      throw new ForbiddenException('无权访问该异常');
    }

    const result = await this.lessonExceptionService.findRescheduleByExceptionId(exceptionId);
    return ApiResponse.success(result);
  }

  // ═══════════════════════════════════════════════════
  // 遗留兼容接口
  // ═══════════════════════════════════════════════════

  @Get('lessons/:id/exceptions')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: '查询课程的异常记录' })
  @SwaggerResponse({ status: 200, description: '成功返回异常记录' })
  async findByLesson(@Param('id', ParseIntPipe) id: number) {
    const result = await this.lessonExceptionService.findExceptionsByLesson(id);
    return ApiResponse.success(result);
  }
}
