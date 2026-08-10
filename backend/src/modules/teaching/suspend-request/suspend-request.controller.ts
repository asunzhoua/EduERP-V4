import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SuspendRequestService } from './suspend-request.service';
import { CreateSuspendRequestDto } from './dto/create-suspend-request.dto';
import { ReviewSuspendRequestDto } from './dto/review-suspend-request.dto';
import { SuspendRequestStatus } from './suspend-request.entity';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { AuthedRequest } from '@common/types/authed-request';

@ApiTags('SuspendRequest')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuspendRequestController {
  constructor(private readonly service: SuspendRequestService) {}

  // ─── Parent/Student Self-Service ───

  @Post('students/self/suspend-requests')
  @Roles('SuperAdmin', 'Admin', 'Student', 'Parent')
  @ApiOperation({ summary: 'Submit a suspend request (parent/student)' })
  async createRequest(@Body() body: CreateSuspendRequestDto, @Req() req: AuthedRequest) {
    const result = await this.service.createRequest({
      studentCode: body.studentCode,
      classCode: body.classCode,
      suspendFrom: body.suspendFrom,
      suspendTo: body.suspendTo,
      reason: body.reason,
      createdBy: req.user.sub,
      userId: req.user.sub,
      userRole: req.user.role,
    });
    return ApiResponse.success(result, 'Suspend request submitted');
  }

  // ─── Admin Endpoints ───

  @Get('admin/suspend-requests')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'List all suspend requests (admin)' })
  async findAll(
    @Query('status') status?: string,
    @Query('studentCode') studentCode?: string,
    @Query('classCode') classCode?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const statusFilter = status
      ? (status.toUpperCase() as SuspendRequestStatus)
      : undefined;
    const result = await this.service.findAll({
      status: statusFilter,
      studentCode,
      classCode,
      page: page ?? 1,
      pageSize: pageSize ?? 20,
    });
    return ApiResponse.success(result);
  }

  @Post('admin/suspend-requests/:id/approve')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Approve a suspend request (admin)' })
  async approve(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    const result = await this.service.approve(id, req.user.sub);
    return ApiResponse.success(result, 'Suspend request approved');
  }

  @Post('admin/suspend-requests/:id/reject')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Reject a suspend request (admin)' })
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReviewSuspendRequestDto,
    @Req() req: AuthedRequest,
  ) {
    const result = await this.service.reject(
      id,
      req.user.sub,
      body.rejectionReason || '未通过审批',
    );
    return ApiResponse.success(result, 'Suspend request rejected');
  }
}
