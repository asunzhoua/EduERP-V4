import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
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
import { SubjectService } from './subject.service';
import { SubjectEntity } from './subject.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { ApiResponse } from '@common/dto/api-response';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthedRequest } from '@common/types/authed-request';

@ApiTags('Subject')
@ApiBearerAuth()
@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  private toView(s: SubjectEntity): {
    id: number;
    code: string;
    name: string;
    category: string;
    isDefault: boolean;
  } {
    return {
      id: Number(s.id),
      code: s.code,
      name: s.name,
      category: s.category,
      isDefault: s.isDefault,
    };
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Parent', 'Student')
  @ApiOperation({ summary: 'List subject catalog (default + custom)' })
  async findAll(): Promise<ApiResponse> {
    const list = await this.subjectService.findAll();
    return ApiResponse.success(list.map((s) => this.toView(s)));
  }

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Create a custom subject (idempotent by name)' })
  @SwaggerResponse({ status: 0, description: 'Subject created' })
  async create(
    @Body() dto: CreateSubjectDto,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    const subject = await this.subjectService.create(dto, req.user.sub);
    return ApiResponse.success(this.toView(subject), 'Subject created');
  }

  @Delete(':code')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a custom subject' })
  async remove(
    @Param('code') code: string,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    await this.subjectService.remove(code, req.user.sub, req.user.role);
    return ApiResponse.success(null, 'Subject deleted');
  }
}
