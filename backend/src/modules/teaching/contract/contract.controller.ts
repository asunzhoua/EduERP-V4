import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Logger,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { QueryConsumeRecordsDto } from './dto/query-consume-records.dto';
import { QueryRenewalWarningsDto } from './dto/query-renewal-warnings.dto';
import { AdjustContractLessonsDto } from './dto/adjust-contract-lessons.dto';
import { CreateContractInput } from './contract.service';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { DataScopeService } from '@common/services/data-scope.service';
import { AuthedRequest } from '@common/types/authed-request';

@ApiTags('Contract')
@ApiBearerAuth()
@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractController {
  private readonly logger = new Logger(ContractController.name);

  constructor(
    private readonly contractService: ContractService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Post()
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Create a new contract' })
  async create(@Body() dto: CreateContractDto, @Req() req: AuthedRequest) {
    this.logger.log(`Creating contract for student: ${dto.studentCode}`);

    const input: CreateContractInput = {
      studentCode: dto.studentCode,
      subject: dto.subject,
      totalLessons: dto.totalLessons,
      validFrom: dto.validFrom,
      validTo: dto.validTo ?? null,
      unitPrice: dto.unitPrice ?? null,
      totalAmount: dto.totalAmount ?? null,
      note: dto.note ?? null,
      tags: dto.tags ?? null,
      operatorId: req.user?.sub,
      operatorName: req.user?.name,
    };

    const result = await this.contractService.create(input);
    return ApiResponse.success(result, 'Contract created');
  }

  @Post('import-lessons')
  @Roles('SuperAdmin', 'Admin')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '批量分配课时（累加），Excel 列：学员编码/科目/课时数',
  })
  async importLessons(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }
    const report = await this.contractService.importLessons(
      file.buffer,
      file.originalname,
      req.user.sub,
      req.user.name,
    );
    return ApiResponse.success(report);
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'List all contracts (paginated, filterable)' })
  async findAll(@Query() query: QueryContractDto) {
    const result = await this.contractService.findAll({
      studentCode: query.studentCode,
      subject: query.subject,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return ApiResponse.success(result);
  }

  @Get('students/:studentCode/contracts')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  @ApiParam({ name: 'studentCode', description: '学生编号' })
  @ApiOperation({ summary: 'Get all contracts for a student' })
  async findByStudentCode(
    @Param('studentCode') studentCode: string,
    @Req() req: AuthedRequest,
  ) {
    // V-04 修复: 验证当前用户是否有权访问该学生的合同记录
    await this.dataScopeService.verifyStudentAccess(req.user, studentCode);

    const result = await this.contractService.findByStudentCode(studentCode);
    return ApiResponse.success(result);
  }

  // 注意：renewal-warnings 必须声明在 @Get(':code') 之前，避免被 :code 吞掉。
  @Get('renewal-warnings')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: '续费预警合同列表（剩余课时 <= 阈值）' })
  async getRenewalWarnings(@Query() query: QueryRenewalWarningsDto) {
    const result = await this.contractService.getRenewalWarnings(
      query.threshold,
    );
    return ApiResponse.success(result);
  }

  @Get(':code')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Get contract by contractCode' })
  async findOneByCode(@Param('code') code: string) {
    const result = await this.contractService.findOneByCode(code);
    return ApiResponse.success(result);
  }

  @Get(':code/consume-records')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  @ApiParam({ name: 'code', description: '合同编号' })
  @ApiOperation({ summary: '合同课时消耗流水（分页）' })
  async getConsumeRecords(
    @Param('code') code: string,
    @Query() query: QueryConsumeRecordsDto,
    @Req() req: AuthedRequest,
  ) {
    // 先取合同再校验学生访问权（家长只能看自己孩子），不信任 :code 参数本身。
    const contract = await this.contractService.findOneByCode(code);
    await this.dataScopeService.verifyStudentAccess(
      req.user,
      contract.studentCode,
    );
    const result = await this.contractService.getConsumeRecords(
      contract,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return ApiResponse.success(result);
  }

  @Patch(':code/lessons')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({
    summary: 'Adjust contract lessons (add / reduce / set custom)',
  })
  async adjustLessons(
    @Param('code') code: string,
    @Body() dto: AdjustContractLessonsDto,
    @Req() req: AuthedRequest,
  ) {
    const operatorId = req.user.sub;
    const result = await this.contractService.adjustLessons(
      code,
      dto,
      operatorId,
      req.user.name,
    );
    return ApiResponse.success(result, 'Contract lessons adjusted');
  }

  @Patch(':code/freeze')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Freeze contract (stop deductions)' })
  async freeze(@Param('code') code: string, @Req() req: AuthedRequest) {
    const operatorId = req.user.sub;
    const result = await this.contractService.freeze(code, operatorId);
    return ApiResponse.success(result, 'Contract frozen');
  }

  @Patch(':code/unfreeze')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Unfreeze contract (resume deductions)' })
  async unfreeze(@Param('code') code: string, @Req() req: AuthedRequest) {
    const operatorId = req.user.sub;
    const result = await this.contractService.unfreeze(code, operatorId);
    return ApiResponse.success(result, 'Contract unfrozen');
  }
}
