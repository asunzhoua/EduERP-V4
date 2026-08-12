import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { ClassroomService } from './classroom.service';
import { ClassroomEntity } from './classroom.entity';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { QueryClassroomDto } from './dto/query-classroom.dto';
import { UpdateClassroomStatusDto } from './dto/update-classroom-status.dto';
import { ApiResponse } from '@common/dto/api-response';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthedRequest } from '@common/types/authed-request';

@ApiTags('Classroom')
@ApiBearerAuth()
@Controller('classrooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassroomController {
  constructor(private readonly classroomService: ClassroomService) {}

  // ─── 对外视图（status 由 deletedAt 推导） ───

  private toView(c: ClassroomEntity): {
    id: number;
    name: string;
    capacity: number;
    status: string;
  } {
    return {
      id: Number(c.id),
      name: c.name,
      capacity: c.capacity,
      status: c.deletedAt ? 'DISABLED' : 'ACTIVE',
    };
  }

  // ─── Classroom CRUD ───

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Parent', 'Student')
  @ApiOperation({ summary: 'List classrooms (paginated, filterable)' })
  async findAll(@Query() query: QueryClassroomDto): Promise<ApiResponse> {
    const result = await this.classroomService.findAll(query);
    return ApiResponse.success({
      items: result.items.map((c) => this.toView(c)),
      total: result.total,
    });
  }

  @Post()
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Create a new classroom' })
  @SwaggerResponse({ status: 0, description: 'Classroom created successfully' })
  async create(
    @Body() dto: CreateClassroomDto,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    const classroom = await this.classroomService.create(dto, req.user.sub);
    return ApiResponse.success(this.toView(classroom), 'Classroom created');
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Parent', 'Student')
  @ApiOperation({ summary: 'Get classroom by id' })
  async findOne(@Param('id') id: string): Promise<ApiResponse> {
    const classroom = await this.classroomService.findById(Number(id));
    return ApiResponse.success(this.toView(classroom));
  }

  @Put(':id')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Update classroom' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClassroomDto,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    const classroom = await this.classroomService.update(
      Number(id),
      dto,
      req.user.sub,
    );
    return ApiResponse.success(this.toView(classroom), 'Classroom updated');
  }

  @Patch(':id/status')
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change classroom status (ACTIVE / DISABLED)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateClassroomStatusDto,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    const classroom = await this.classroomService.updateStatus(
      Number(id),
      dto.status,
      req.user.sub,
    );
    return ApiResponse.success(this.toView(classroom), 'Status updated');
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete classroom' })
  async remove(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    await this.classroomService.softDelete(Number(id), req.user.sub);
    return ApiResponse.success(null, 'Classroom deleted');
  }
}
