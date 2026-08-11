import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  SalaryPayrollEntity,
  PayrollStatus,
} from '../entities/salary-payroll.entity';
import { SalarySlipEntity } from '../entities/salary-slip.entity';
import { User } from '@modules/identity/entities/user.entity';
import { CreatePayrollDto, QueryPayrollDto } from '../dto/salary-slip.dto';
import { SalaryRecordStatus } from '../enums/salary.enums';
import { ExcelWriter } from '@modules/export/utils/excel-writer.util';

/** 批次号生成：PA + YYYYMM + 4 位随机大写 */
function genBatchNo(month: string): string {
  const rand = Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()
    .padEnd(4, '0');
  return `PA${month.replace('-', '')}-${rand}`;
}

@Injectable()
export class SalaryPayrollService {
  constructor(
    @InjectRepository(SalaryPayrollEntity)
    private readonly payrollRepo: Repository<SalaryPayrollEntity>,
    @InjectRepository(SalarySlipEntity)
    private readonly slipRepo: Repository<SalarySlipEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly excelWriter: ExcelWriter,
  ) {}

  async create(dto: CreatePayrollDto, createdBy: number) {
    const month = dto.month;

    // 选入批次的工资条：指定 slipIds；缺省取该月全部待发放（PENDING/APPROVED）
    let slipIds: number[];
    if (dto.slipIds?.length) {
      const slips = await this.slipRepo.find({
        where: { id: In(dto.slipIds), month },
      });
      if (slips.length !== dto.slipIds.length) {
        throw new BadRequestException('存在无效的工资条 ID 或不属于该月');
      }
      slipIds = dto.slipIds;
    } else {
      const slips = await this.slipRepo.find({
        where: {
          month,
          status: In([SalaryRecordStatus.PENDING, SalaryRecordStatus.APPROVED]),
        },
      });
      slipIds = slips.map((s) => s.id);
    }
    if (slipIds.length === 0) {
      throw new BadRequestException(`月份 ${month} 无待发放工资条`);
    }

    const slips = await this.slipRepo.find({ where: { id: In(slipIds) } });
    const totalAmount = slips.reduce(
      (s, x) => s + (Number(x.netAmount) || 0),
      0,
    );
    const teacherCount = new Set(slips.map((s) => Number(s.teacherId))).size;

    const entity = this.payrollRepo.create({
      month,
      batchNo: genBatchNo(month),
      totalAmount: Math.round(totalAmount * 100) / 100,
      status: PayrollStatus.DRAFT,
      detail: { slipIds, slipCount: slipIds.length, teacherCount },
      note: dto.note ?? null,
      createdBy,
    });
    return this.payrollRepo.save(entity);
  }

  async list(query: QueryPayrollDto) {
    const { month, status, page = 1, pageSize = 20 } = query;
    const qb = this.payrollRepo.createQueryBuilder('p');
    if (month) qb.andWhere('p.month = :month', { month });
    if (status) qb.andWhere('p.status = :status', { status });
    qb.orderBy('p.createTime', 'DESC').addOrderBy('p.id', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async get(id: number) {
    const payroll = await this.payrollRepo.findOne({ where: { id } });
    if (!payroll) throw new NotFoundException(`Payroll ${id} not found`);
    return payroll;
  }

  /** DRAFT → CONFIRMED → PAID → CLOSED */
  async updateStatus(id: number, status: string, updatedBy?: number) {
    const payroll = await this.payrollRepo.findOne({ where: { id } });
    if (!payroll) throw new NotFoundException(`Payroll ${id} not found`);

    const validTransitions: Record<string, string[]> = {
      [PayrollStatus.DRAFT]: [PayrollStatus.CONFIRMED],
      [PayrollStatus.CONFIRMED]: [PayrollStatus.PAID, PayrollStatus.DRAFT],
      [PayrollStatus.PAID]: [PayrollStatus.CLOSED],
      [PayrollStatus.CLOSED]: [],
    };
    if (!validTransitions[payroll.status]?.includes(status)) {
      throw new BadRequestException(
        `Invalid payroll status transition from ${payroll.status} to ${status}`,
      );
    }

    payroll.status = status as PayrollStatus;
    if (updatedBy) payroll.updatedBy = updatedBy;
    return this.payrollRepo.save(payroll);
  }

  /** 批次导出数据：批次 + 含教师名的工资条列表 */
  async exportData(id: number) {
    const payroll = await this.get(id);
    const slipIds = (payroll.detail?.slipIds as number[]) ?? [];
    const slips = slipIds.length
      ? await this.slipRepo.find({ where: { id: In(slipIds) } })
      : [];
    const teacherIds = [...new Set(slips.map((s) => Number(s.teacherId)))];
    const teachers = teacherIds.length
      ? await this.userRepo.find({
          where: { id: In(teacherIds) },
          select: { id: true, name: true },
        })
      : [];
    const nameByTeacher = new Map(teachers.map((u) => [Number(u.id), u.name]));
    const rows = slips.map((s) => ({
      ...s,
      teacherName: nameByTeacher.get(Number(s.teacherId)) ?? null,
    }));
    return { payroll, slips: rows };
  }

  /** 发放批次 Excel 导出（批次信息 + 含教师名的工资条明细） */
  async exportExcel(id: number): Promise<Buffer> {
    const { payroll, slips } = await this.exportData(id);
    const rows = slips.map((s) => ({
      month: payroll.month,
      batchNo: payroll.batchNo,
      teacherName: s.teacherName ?? '',
      grossAmount: Number(s.grossAmount) || 0,
      socialAmount: Number(s.socialAmount) || 0,
      taxAmount: Number(s.taxAmount) || 0,
      netAmount: Number(s.netAmount) || 0,
      status: s.status,
      notes: s.notes ?? '',
    }));
    return this.excelWriter.generate(
      rows,
      '发放批次',
      [
        'month',
        'batchNo',
        'teacherName',
        'grossAmount',
        'socialAmount',
        'taxAmount',
        'netAmount',
        'status',
        'notes',
      ],
      [
        '月份',
        '批次号',
        '教师',
        '应发',
        '五险一金',
        '个税',
        '实发',
        '状态',
        '备注',
      ],
    );
  }
}
