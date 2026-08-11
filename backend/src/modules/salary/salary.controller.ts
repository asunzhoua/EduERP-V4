import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SalaryService } from './salary.service';
import { SalarySettlementService } from './services/salary-settlement.service';
import {
  CreateSalaryRuleDto,
  UpdateSalaryRuleDto,
  QuerySalaryRecordDto,
  UpdateSalaryRecordStatusDto,
  SalaryStatisticsQueryDto,
  SettleDto,
} from './dto/salary.dto';
import {
  UpsertTeacherSalaryProfileDto,
  QuerySalaryTeacherDto,
  CreateOutingRecordDto,
  UpdateOutingRecordDto,
  UpdateOutingRecordStatusDto,
  QueryOutingRecordDto,
} from './dto/salary-profile.dto';
import {
  CreateTaxPolicyDto,
  UpdateTaxPolicyDto,
  QueryTaxPolicyDto,
  CreateInsurancePolicyDto,
  UpdateInsurancePolicyDto,
  ImportInsurancePolicyDto,
  SyncInsurancePolicyDto,
  QueryInsurancePolicyDto,
} from './dto/salary-policy.dto';
import {
  GenerateSlipsDto,
  PreviewSlipsDto,
  QuerySalarySlipDto,
  UpdateSlipStatusDto,
  CreatePayrollDto,
  UpdatePayrollStatusDto,
  QueryPayrollDto,
} from './dto/salary-slip.dto';
import { TaxPolicyService } from './services/tax-policy.service';
import { InsurancePolicyService } from './services/insurance-policy.service';
import { seedCities } from './services/insurance-policy.service';
import { SalarySlipService } from './services/salary-slip.service';
import { SalaryPayrollService } from './services/salary-payroll.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthedRequest } from '../../common/types/authed-request';

@ApiTags('salary')
@Controller('salary')
@UseGuards(RolesGuard)
export class SalaryController {
  constructor(
    private readonly salaryService: SalaryService,
    private readonly settlementService: SalarySettlementService,
    private readonly taxPolicyService: TaxPolicyService,
    private readonly insurancePolicyService: InsurancePolicyService,
    private readonly slipService: SalarySlipService,
    private readonly payrollService: SalaryPayrollService,
  ) {}

  /** 中文文件名：RFC 5987 filename* 编码，ASCII 回退名防解析问题 */
  private disposition(filename: string): string {
    const fallback = `export_${Date.now()}.xlsx`;
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
  }

  // ==================== 教师接口 ====================

  @Get('my-records')
  @Roles('Teacher')
  @ApiOperation({ summary: '教师查询自己的工资记录' })
  @ApiResponse({ status: 200, description: '成功返回工资记录列表' })
  async getMyRecords(
    @Request() req: AuthedRequest,
    @Query() query: QuerySalaryRecordDto,
  ) {
    const teacherId = req.user.sub;
    return this.salaryService.getRecords({ ...query, teacherId });
  }

  @Get('my-statistics')
  @Roles('Teacher')
  @ApiOperation({ summary: '教师查询自己的工资统计' })
  @ApiResponse({ status: 200, description: '成功返回工资统计' })
  async getMyStatistics(
    @Request() req: AuthedRequest,
    @Query() query: SalaryStatisticsQueryDto,
  ) {
    const teacherId = req.user.sub;
    return this.salaryService.getStatistics({ ...query, teacherId });
  }

  // ==================== 管理员接口 ====================

  @Get('records')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '管理员查询所有工资记录' })
  @ApiResponse({ status: 200, description: '成功返回工资记录列表' })
  async getAllRecords(@Query() query: QuerySalaryRecordDto) {
    return this.salaryService.getRecords(query);
  }

  @Put('records/:id/status')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({
    summary:
      '管理员更新工资记录状态（PENDING→APPROVED→PAID；APPROVED→PENDING）',
  })
  @ApiResponse({ status: 200, description: '成功更新状态' })
  async updateRecordStatus(
    @Param('id') id: number,
    @Body() dto: UpdateSalaryRecordStatusDto,
    @Request() req: AuthedRequest,
  ) {
    return this.salaryService.updateRecordStatus(
      id,
      dto.status,
      dto.notes,
      req.user.sub,
    );
  }

  @Get('statistics')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '管理员查询工资统计' })
  @ApiResponse({ status: 200, description: '成功返回工资统计' })
  async getStatistics(@Query() query: SalaryStatisticsQueryDto) {
    return this.salaryService.getStatistics(query);
  }

  // ==================== 月度结算 ====================

  @Post('settle')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({
    summary: '月度结算：按当月 FINISHED 课时 + 出勤生成工资记录（幂等）',
  })
  @ApiResponse({ status: 201, description: '成功生成结算记录' })
  async settle(@Body() dto: SettleDto, @Request() req: AuthedRequest) {
    return this.settlementService.settle(
      dto.month,
      dto.teacherId,
      req.user.sub,
    );
  }

  // ==================== 规则管理接口 ====================

  @Post('rules')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '管理员创建工资规则' })
  @ApiResponse({ status: 201, description: '成功创建规则' })
  async createRule(
    @Body() dto: CreateSalaryRuleDto,
    @Request() req: AuthedRequest,
  ) {
    return this.salaryService.createRule(dto, req.user.sub);
  }

  @Put('rules/:id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '管理员更新工资规则' })
  @ApiResponse({ status: 200, description: '成功更新规则' })
  async updateRule(
    @Param('id') id: number,
    @Body() dto: UpdateSalaryRuleDto,
    @Request() req: AuthedRequest,
  ) {
    return this.salaryService.updateRule(id, dto, req.user.sub);
  }

  @Delete('rules/:id')
  @Roles('Admin', 'SuperAdmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '管理员删除工资规则（软删除）' })
  @ApiResponse({ status: 204, description: '成功删除规则' })
  async deleteRule(@Param('id') id: number) {
    return this.salaryService.deleteRule(id);
  }

  @Get('rules')
  @ApiOperation({ summary: '查询工资规则列表' })
  @ApiResponse({ status: 200, description: '成功返回规则列表' })
  async getRules(@Query('activeOnly') activeOnly: boolean = true) {
    return this.salaryService.getRules(activeOnly);
  }

  @Get('rules/:id')
  @ApiOperation({ summary: '查询单个工资规则' })
  @ApiResponse({ status: 200, description: '成功返回规则' })
  async getRule(@Param('id') id: number) {
    return this.salaryService.getRule(id);
  }

  // ==================== 教师薪资档案接口 ====================

  @Get('teachers')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '教师列表（建档选择）' })
  @ApiResponse({ status: 200, description: '成功返回教师列表' })
  async getTeachers(@Query() query: QuerySalaryTeacherDto) {
    return this.salaryService.getTeachers(query);
  }

  @Get('teachers/:id/profile')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '查询某教师的薪资档案' })
  @ApiResponse({ status: 200, description: '成功返回档案（可能为 null）' })
  async getProfile(@Param('id') id: number) {
    return this.salaryService.getProfile(id);
  }

  @Put('teachers/:id/profile')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '创建/更新某教师的薪资档案（upsert）' })
  @ApiResponse({ status: 200, description: '成功保存档案' })
  async upsertProfile(
    @Param('id') id: number,
    @Body() dto: UpsertTeacherSalaryProfileDto,
    @Request() req: AuthedRequest,
  ) {
    return this.salaryService.upsertProfile(id, dto, req.user.sub);
  }

  // ==================== 外派课时接口 ====================

  @Post('outing')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '新建外派课时记录' })
  @ApiResponse({ status: 201, description: '成功创建外派记录' })
  async createOuting(
    @Body() dto: CreateOutingRecordDto,
    @Request() req: AuthedRequest,
  ) {
    return this.salaryService.createOuting(dto, req.user.sub);
  }

  @Get('outing')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '查询外派课时记录' })
  @ApiResponse({ status: 200, description: '成功返回外派记录列表' })
  async getOutings(@Query() query: QueryOutingRecordDto) {
    return this.salaryService.getOutings(query);
  }

  @Put('outing/:id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '更新外派课时记录' })
  @ApiResponse({ status: 200, description: '成功更新外派记录' })
  async updateOuting(
    @Param('id') id: number,
    @Body() dto: UpdateOutingRecordDto,
    @Request() req: AuthedRequest,
  ) {
    return this.salaryService.updateOuting(id, dto, req.user.sub);
  }

  @Put('outing/:id/status')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '外派记录状态流转（PENDING→CONFIRMED）' })
  @ApiResponse({ status: 200, description: '成功更新状态' })
  async updateOutingStatus(
    @Param('id') id: number,
    @Body() dto: UpdateOutingRecordStatusDto,
    @Request() req: AuthedRequest,
  ) {
    return this.salaryService.updateOutingStatus(id, dto.status, req.user.sub);
  }

  @Delete('outing/:id')
  @Roles('Admin', 'SuperAdmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除外派课时记录' })
  @ApiResponse({ status: 204, description: '成功删除外派记录' })
  async deleteOuting(@Param('id') id: number) {
    return this.salaryService.deleteOuting(id);
  }

  // ==================== 个税政策（P2） ====================

  @Get('tax-policy')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '个税政策版本列表（activeOnly 仅查启用中）' })
  @ApiResponse({ status: 200, description: '成功返回政策列表' })
  async listTaxPolicy(@Query() query: QueryTaxPolicyDto) {
    return this.taxPolicyService.list(query);
  }

  @Post('tax-policy')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '新建个税政策版本' })
  @ApiResponse({ status: 201, description: '成功创建政策' })
  async createTaxPolicy(
    @Body() dto: CreateTaxPolicyDto,
    @Request() req: AuthedRequest,
  ) {
    return this.taxPolicyService.create(dto, req.user.sub);
  }

  @Put('tax-policy/:id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '更新个税政策版本' })
  @ApiResponse({ status: 200, description: '成功更新政策' })
  async updateTaxPolicy(
    @Param('id') id: number,
    @Body() dto: UpdateTaxPolicyDto,
    @Request() req: AuthedRequest,
  ) {
    return this.taxPolicyService.update(id, dto, req.user.sub);
  }

  @Delete('tax-policy/:id')
  @Roles('Admin', 'SuperAdmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除个税政策版本（历史快照不受影响）' })
  @ApiResponse({ status: 204, description: '成功删除政策' })
  async deleteTaxPolicy(@Param('id') id: number) {
    return this.taxPolicyService.remove(id);
  }

  // ==================== 五险一金政策（P3） ====================

  @Get('insurance-policy')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '五险一金政策列表（城市 × 生效区间多版本）' })
  @ApiResponse({ status: 200, description: '成功返回政策列表' })
  async listInsurancePolicy(@Query() query: QueryInsurancePolicyDto) {
    return this.insurancePolicyService.list(query);
  }

  @Get('insurance-policy/cities')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '内置种子城市列表（供「一键导入新版本」下拉）' })
  @ApiResponse({ status: 200, description: '成功返回城市数组' })
  insuranceCities() {
    return seedCities();
  }

  @Post('insurance-policy')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '新建五险一金政策版本' })
  @ApiResponse({ status: 201, description: '成功创建政策' })
  async createInsurancePolicy(
    @Body() dto: CreateInsurancePolicyDto,
    @Request() req: AuthedRequest,
  ) {
    return this.insurancePolicyService.create(dto, req.user.sub);
  }

  @Put('insurance-policy/:id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '更新五险一金政策版本' })
  @ApiResponse({ status: 200, description: '成功更新政策' })
  async updateInsurancePolicy(
    @Param('id') id: number,
    @Body() dto: UpdateInsurancePolicyDto,
    @Request() req: AuthedRequest,
  ) {
    return this.insurancePolicyService.update(id, dto, req.user.sub);
  }

  @Delete('insurance-policy/:id')
  @Roles('Admin', 'SuperAdmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除五险一金政策版本' })
  @ApiResponse({ status: 204, description: '成功删除政策' })
  async deleteInsurancePolicy(@Param('id') id: number) {
    return this.insurancePolicyService.remove(id);
  }

  @Post('insurance-policy/import')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '一键导入内置种子（生成新版本，不覆盖历史）' })
  @ApiResponse({ status: 201, description: '成功生成新版本' })
  async importInsurancePolicy(
    @Body() dto: ImportInsurancePolicyDto,
    @Request() req: AuthedRequest,
  ) {
    return this.insurancePolicyService.importFromSeed(dto, req.user.sub);
  }

  @Post('insurance-policy/sync')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '第三方数据源同步（本期预留扩展点）' })
  @ApiResponse({ status: 200, description: '成功返回同步结果' })
  async syncInsurancePolicy(
    @Body() dto: SyncInsurancePolicyDto,
    @Request() req: AuthedRequest,
  ) {
    return this.insurancePolicyService.sync(dto, req.user.sub);
  }

  // ==================== 工资条（P2） ====================

  @Get('slips')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '工资条分页查询' })
  @ApiResponse({ status: 200, description: '成功返回工资条列表' })
  async getSlips(@Query() query: QuerySalarySlipDto) {
    return this.slipService.getSlips(query);
  }

  @Get('slips/:id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '工资条详情' })
  @ApiResponse({ status: 200, description: '成功返回工资条详情' })
  async getSlip(@Param('id') id: number) {
    return this.slipService.getSlip(id);
  }

  @Post('slips/generate')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '生成工资条（幂等：teacherId+month 已存在则跳过）' })
  @ApiResponse({ status: 201, description: '成功生成工资条' })
  async generateSlips(
    @Body() dto: GenerateSlipsDto,
    @Request() req: AuthedRequest,
  ) {
    return this.slipService.generateSlips(
      dto.month,
      dto.teacherId,
      req.user.sub,
    );
  }

  @Post('slips/preview')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '工资条试算（dry-run，不落库）' })
  @ApiResponse({ status: 201, description: '成功返回试算结果' })
  async previewSlips(@Body() dto: PreviewSlipsDto) {
    return this.slipService.preview(dto.month, dto.teacherId);
  }

  @Put('slips/:id/status')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '工资条状态流转（置 PAID 联动当月工资记录）' })
  @ApiResponse({ status: 200, description: '成功更新状态' })
  async updateSlipStatus(
    @Param('id') id: number,
    @Body() dto: UpdateSlipStatusDto,
    @Request() req: AuthedRequest,
  ) {
    return this.slipService.updateSlipStatus(
      id,
      dto.status,
      dto.notes,
      req.user.sub,
    );
  }

  @Post('slips/export')
  @Roles('Admin', 'SuperAdmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '导出工资条 Excel（按筛选条件全部导出）' })
  @ApiResponse({ status: 200, description: '返回 xlsx 文件流' })
  async exportSlips(@Body() query: QuerySalarySlipDto, @Res() res: Response) {
    const buffer = await this.slipService.exportExcel(query);
    const filename = `工资条_${Date.now()}.xlsx`;
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': this.disposition(filename),
    });
    res.send(buffer);
  }

  // ==================== 发放批次（P3） ====================

  @Get('payroll')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '发放批次分页查询' })
  @ApiResponse({ status: 200, description: '成功返回批次列表' })
  async getPayrolls(@Query() query: QueryPayrollDto) {
    return this.payrollService.list(query);
  }

  @Post('payroll')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '创建发放批次（缺省收该月全部待发放工资条）' })
  @ApiResponse({ status: 201, description: '成功创建批次' })
  async createPayroll(
    @Body() dto: CreatePayrollDto,
    @Request() req: AuthedRequest,
  ) {
    return this.payrollService.create(dto, req.user.sub);
  }

  @Get('payroll/:id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '发放批次详情' })
  @ApiResponse({ status: 200, description: '成功返回批次详情' })
  async getPayroll(@Param('id') id: number) {
    return this.payrollService.get(id);
  }

  @Put('payroll/:id/status')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '发放批次状态流转（DRAFT/CONFIRMED/PAID/CLOSED）' })
  @ApiResponse({ status: 200, description: '成功更新状态' })
  async updatePayrollStatus(
    @Param('id') id: number,
    @Body() dto: UpdatePayrollStatusDto,
    @Request() req: AuthedRequest,
  ) {
    return this.payrollService.updateStatus(id, dto.status, req.user.sub);
  }

  @Post('payroll/:id/export')
  @Roles('Admin', 'SuperAdmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发放批次导出 Excel（批次信息 + 工资条明细）' })
  @ApiResponse({ status: 200, description: '返回 xlsx 文件流' })
  async exportPayroll(@Param('id') id: number, @Res() res: Response) {
    const buffer = await this.payrollService.exportExcel(id);
    const filename = `发放批次_${Date.now()}.xlsx`;
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': this.disposition(filename),
    });
    res.send(buffer);
  }
}
