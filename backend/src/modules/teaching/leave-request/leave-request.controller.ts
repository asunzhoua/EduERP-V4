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
import { LeaveRequestService } from './leave-request.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { LeaveRequestStatus } from './leave-request.entity';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { AuthedRequest } from '@common/types/authed-request';

@ApiTags('LeaveRequest')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveRequestController {
  constructor(private readonly service: LeaveRequestService) {}

  // ─── Parent/Student Self-Service ───

  @Post('students/self/leave-requests')
  @Roles('SuperAdmin', 'Admin', 'Student', 'Parent')
  @ApiOperation({ summary: 'Submit a leave request (parent/student)' })
  async createRequest(@Body() body: CreateLeaveRequestDto, @Req() req: AuthedRequest) {
    const result = await this.service.createRequest({
      studentCode: body.studentCode,
      classCode: body.classCode,
      leaveType: body.leaveType,
      leaveDate: body.leaveDate,
      reason: body.reason,
      createdBy: req.user.sub,
    });
    return ApiResponse.success(result, 'Leave request submitted');
  }

  // ─── Admin Endpoints ───

  @Get('admin/leave-requests')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'List all leave requests (admin)' })
  async findAll(
    @Query('status') status?: string,
    @Query('studentCode') studentCode?: string,
    @Query('classCode') classCode?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const statusFilter = status
      ? (status.toUpperCase() as LeaveRequestStatus)
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

  @Post('admin/leave-requests/:id/approve')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Approve a leave request (admin)' })
  async approve(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    const result = await this.service.approve(id, req.user.sub);
    return ApiResponse.success(result, 'Leave request approved');
  }

  @Post('admin/leave-requests/:id/reject')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Reject a leave request (admin)' })
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReviewLeaveRequestDto,
    @Req() req: AuthedRequest,
  ) {
    const result = await this.service.reject(
      id,
      req.user.sub,
      body.rejectionReason || '未通过审批',
    );
    return ApiResponse.success(result, 'Leave request rejected');
  }
}
