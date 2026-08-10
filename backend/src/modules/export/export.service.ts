import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { ExportFilterDto } from './dto/export-filter.dto';
import { CsvWriter } from './utils/csv-writer.util';
import { ExcelWriter } from './utils/excel-writer.util';
import { Student } from '../student/entities/student.entity';
import { LessonEntity } from '../teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '../teaching/lesson-attendance/lesson-attendance.entity';
import { ContractEntity } from '../teaching/contract/contract.entity';
import { SalaryRecordEntity } from '../salary/entities/salary-record.entity';
import { EnrollmentEntity } from '../teaching/enrollment/enrollment.entity';
import { User } from '../identity/entities/user.entity';

/** 把英文列 key 映射为中文表头；未知 key 回退原样 */
function labels(cols: string[], map: Record<string, string>): string[] {
  return cols.map((c) => map[c] ?? c);
}

const STUDENT_HEADERS: Record<string, string> = {
  studentCode: '学员编码',
  studentName: '学员姓名',
  gender: '性别',
  phone: '手机号',
  school: '学校',
  grade: '年级',
  enrollmentDate: '入学日期',
  contractCode: '合同编号',
  totalLessons: '总课时',
  remainingLessons: '剩余课时',
  status: '状态',
};

const LESSON_HEADERS: Record<string, string> = {
  lessonId: '课时ID',
  classCode: '班级编码',
  courseCode: '课程编码',
  lessonNumber: '课次',
  scheduledDate: '上课日期',
  startTime: '开始时间',
  endTime: '结束时间',
  teacherId: '老师ID',
  status: '状态',
  isMakeup: '是否补课',
  presentCount: '到课人数',
  absentCount: '缺勤人数',
  totalAttendance: '应到人数',
  actualStartTime: '实际开始',
  actualEndTime: '实际结束',
  note: '备注',
};

const CONSUMPTION_HEADERS: Record<string, string> = {
  contractCode: '合同编号',
  studentCode: '学员编码',
  subject: '科目',
  totalLessons: '总课时',
  remainingLessons: '剩余课时',
  consumedLessons: '已消耗课时',
  unitPrice: '单价',
  consumedValue: '已消耗金额',
  status: '状态',
  validFrom: '生效日期',
  validTo: '失效日期',
};

const SALARY_HEADERS: Record<string, string> = {
  recordId: '记录ID',
  teacherId: '老师ID',
  teacherName: '老师姓名',
  lessonId: '课时ID',
  salaryRuleId: '工资规则ID',
  ruleVersion: '规则版本',
  amount: '金额',
  lessonDate: '上课日期',
  duration: '时长',
  status: '状态',
  notes: '备注',
  createdBy: '创建人',
  createTime: '创建时间',
};

const FINANCE_HEADERS: Record<string, string> = {
  type: '类型',
  referenceCode: '关联编号',
  studentCode: '学员编码',
  teacherId: '老师ID',
  subject: '科目',
  totalAmount: '合同总额',
  consumedValue: '已消耗金额',
  amount: '金额',
  lessonDate: '上课日期',
  status: '状态',
};

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(LessonAttendanceEntity)
    private readonly attendanceRepo: Repository<LessonAttendanceEntity>,
    @InjectRepository(ContractEntity)
    private readonly contractRepo: Repository<ContractEntity>,
    @InjectRepository(SalaryRecordEntity)
    private readonly salaryRepo: Repository<SalaryRecordEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly csvWriter: CsvWriter,
    private readonly excelWriter: ExcelWriter,
  ) {}

  // ─── 2.1 Export Students ───

  async exportStudents(
    filters: ExportFilterDto,
    format: 'csv' | 'excel',
  ): Promise<Buffer> {
    const where: any = { deleted: false };
    if (filters.status) where.status = filters.status;

    const students = await this.studentRepo.find({ where });

    // Enrich with enrollment & contract data
    const data = await Promise.all(
      students.map(async (s) => {
        const enrollments = await this.enrollmentRepo.find({
          where: { studentCode: s.studentCode },
        });
        const contracts = await this.contractRepo.find({
          where: { studentCode: s.studentCode },
        });

        return {
          studentCode: s.studentCode,
          studentName: s.name,
          gender: s.gender,
          phone: s.phone ?? '',
          school: s.school ?? '',
          grade: s.grade ?? '',
          enrollmentDate: enrollments[0]?.enrolledAt
            ? new Date(enrollments[0].enrolledAt).toISOString().slice(0, 10)
            : '',
          contractCode: contracts[0]?.contractCode ?? '',
          totalLessons: contracts[0]?.totalLessons ?? 0,
          remainingLessons: contracts[0]?.remainingLessons ?? 0,
          status: s.status,
        };
      }),
    );

    const columns = [
      'studentCode',
      'studentName',
      'gender',
      'phone',
      'school',
      'grade',
      'enrollmentDate',
      'contractCode',
      'totalLessons',
      'remainingLessons',
      'status',
    ];

    return format === 'csv'
      ? this.csvWriter.generate(data, columns, labels(columns, STUDENT_HEADERS))
      : this.excelWriter.generate(data, '学生数据', columns, labels(columns, STUDENT_HEADERS));
  }

  // ─── 2.2 Export Lessons ───

  async exportLessons(
    filters: ExportFilterDto,
    format: 'csv' | 'excel',
  ): Promise<Buffer> {
    const where: any = {};
    if (filters.startDate) where.scheduledDate = Between(filters.startDate, filters.endDate ?? filters.startDate);
    if (filters.status) where.status = filters.status;

    const lessons = await this.lessonRepo.find({ where });

    const data = await Promise.all(
      lessons.map(async (l) => {
        const attendances = await this.attendanceRepo.find({
          where: { lessonId: l.id },
        });
        const presentCount = attendances.filter(
          (a) => a.status === 'PRESENT',
        ).length;
        const absentCount = attendances.filter(
          (a) => a.status === 'ABSENT',
        ).length;

        return {
          lessonId: l.id,
          classCode: l.classCode,
          courseCode: l.courseCode,
          lessonNumber: l.lessonNumber,
          scheduledDate: l.scheduledDate,
          startTime: l.startTime,
          endTime: l.endTime,
          teacherId: l.teacherId,
          status: l.status,
          isMakeup: l.isMakeup,
          presentCount,
          absentCount,
          totalAttendance: attendances.length,
          actualStartTime: l.actualStartTime?.toISOString() ?? '',
          actualEndTime: l.actualEndTime?.toISOString() ?? '',
          note: l.note ?? '',
        };
      }),
    );

    const columns = [
      'lessonId',
      'classCode',
      'courseCode',
      'lessonNumber',
      'scheduledDate',
      'startTime',
      'endTime',
      'teacherId',
      'status',
      'isMakeup',
      'presentCount',
      'absentCount',
      'totalAttendance',
      'actualStartTime',
      'actualEndTime',
      'note',
    ];

    return format === 'csv'
      ? this.csvWriter.generate(data, columns, labels(columns, LESSON_HEADERS))
      : this.excelWriter.generate(data, '课程数据', columns, labels(columns, LESSON_HEADERS));
  }

  // ─── 2.3 Export Consumption ───

  async exportConsumption(
    filters: ExportFilterDto,
    format: 'csv' | 'excel',
  ): Promise<Buffer> {
    const where: any = {};
    if (filters.status) where.status = filters.status;

    const contracts = await this.contractRepo.find({ where });

    const data = contracts.map((c) => {
      const consumedLessons = c.totalLessons - c.remainingLessons;
      const unitPrice = Number(c.unitPrice ?? 0);
      return {
        contractCode: c.contractCode,
        studentCode: c.studentCode,
        subject: c.subject,
        totalLessons: c.totalLessons,
        remainingLessons: c.remainingLessons,
        consumedLessons,
        unitPrice,
        consumedValue: consumedLessons * unitPrice,
        status: c.status,
        validFrom: c.validFrom,
        validTo: c.validTo ?? '',
      };
    });

    const columns = [
      'contractCode',
      'studentCode',
      'subject',
      'totalLessons',
      'remainingLessons',
      'consumedLessons',
      'unitPrice',
      'consumedValue',
      'status',
      'validFrom',
      'validTo',
    ];

    return format === 'csv'
      ? this.csvWriter.generate(data, columns, labels(columns, CONSUMPTION_HEADERS))
      : this.excelWriter.generate(data, '课时消耗数据', columns, labels(columns, CONSUMPTION_HEADERS));
  }

  // ─── 2.4 Export Salary ───

  async exportSalary(
    filters: ExportFilterDto,
    format: 'csv' | 'excel',
  ): Promise<Buffer> {
    const where: any = {};
    if (filters.startDate) where.lessonDate = Between(filters.startDate, filters.endDate ?? filters.startDate);
    if (filters.status) where.status = filters.status;

    const records = await this.salaryRepo.find({ where });

    // Enrich with teacher data (from user entity) — teacherId is the user ID
    const teacherIds = [...new Set(records.map(r => r.teacherId))];
    const teachers = teacherIds.length > 0
      ? await this.userRepo
          .createQueryBuilder('user')
          .where('user.id IN (:...ids)', { ids: teacherIds })
          .getMany()
      : [];
    const teacherMap = new Map(teachers.map(t => [t.id, t.name]));

    const data = records.map((r) => ({
      recordId: r.id,
      teacherId: r.teacherId,
      teacherName: teacherMap.get(r.teacherId) || 'Unknown',
      lessonId: r.lessonId,
      salaryRuleId: r.salaryRuleId,
      ruleVersion: r.ruleVersion,
      amount: Number(r.amount),
      lessonDate: r.lessonDate,
      duration: r.duration,
      status: r.status,
      notes: r.notes ?? '',
      createdBy: r.createdBy,
      createTime: r.createTime.toISOString(),
    }));

    const columns = [
      'recordId',
      'teacherId',
      'teacherName',
      'lessonId',
      'salaryRuleId',
      'ruleVersion',
      'amount',
      'lessonDate',
      'duration',
      'status',
      'notes',
      'createdBy',
      'createTime',
    ];

    return format === 'csv'
      ? this.csvWriter.generate(data, columns, labels(columns, SALARY_HEADERS))
      : this.excelWriter.generate(data, '工资数据', columns, labels(columns, SALARY_HEADERS));
  }

  // ─── 2.5 Export Finance ───

  async exportFinance(
    filters: ExportFilterDto,
    format: 'csv' | 'excel',
  ): Promise<Buffer> {
    // 1. Contract revenue data
    const contractWhere: any = {};
    if (filters.status) contractWhere.status = filters.status;
    const contracts = await this.contractRepo.find({ where: contractWhere });

    // 2. Salary payout data (cost side)
    const salaryWhere: any = {};
    if (filters.startDate) salaryWhere.lessonDate = Between(filters.startDate, filters.endDate ?? filters.startDate);
    const salaryRecords = await this.salaryRepo.find({ where: salaryWhere });

    // Aggregate: contract revenue
    const contractRevenue = contracts.reduce((sum, c) => {
      const consumed = c.totalLessons - c.remainingLessons;
      const unitPrice = Number(c.unitPrice ?? 0);
      return sum + consumed * unitPrice;
    }, 0);
    const totalContractValue = contracts.reduce(
      (sum, c) => sum + Number(c.totalAmount ?? 0),
      0,
    );

    // Aggregate: salary payouts
    const totalSalaryPaid = salaryRecords.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );

    // Build detail rows
    const contractRows = contracts.map((c) => ({
      type: '合同收入',
      referenceCode: c.contractCode,
      studentCode: c.studentCode,
      subject: c.subject,
      totalAmount: Number(c.totalAmount ?? 0),
      consumedValue:
        (c.totalLessons - c.remainingLessons) * Number(c.unitPrice ?? 0),
      status: c.status,
    }));

    const salaryRows = salaryRecords.map((r) => ({
      type: '工资支出',
      referenceCode: `LESSON-${r.lessonId}`,
      teacherId: r.teacherId,
      amount: Number(r.amount),
      lessonDate: r.lessonDate,
      status: r.status,
    }));

    // Summary row
    const summaryRows = [
      {
        type: '汇总',
        referenceCode: '',
        totalContractValue,
        totalConsumedValue: contractRevenue,
        totalSalaryPaid,
        netValue: contractRevenue - totalSalaryPaid,
      },
    ];

    const columns = [
      'type',
      'referenceCode',
      'studentCode',
      'teacherId',
      'subject',
      'totalAmount',
      'consumedValue',
      'amount',
      'lessonDate',
      'status',
    ];

    // Combine all rows into a flat structure for the writer
    const allRows = [
      ...contractRows.map((r) => ({
        type: r.type,
        referenceCode: r.referenceCode,
        studentCode: r.studentCode,
        teacherId: '',
        subject: r.subject,
        totalAmount: r.totalAmount,
        consumedValue: r.consumedValue,
        amount: '',
        lessonDate: '',
        status: r.status,
      })),
      ...salaryRows.map((r) => ({
        type: r.type,
        referenceCode: r.referenceCode,
        studentCode: '',
        teacherId: String(r.teacherId),
        subject: '',
        totalAmount: '',
        consumedValue: '',
        amount: r.amount,
        lessonDate: r.lessonDate,
        status: r.status,
      })),
      ...summaryRows.map((r) => ({
        type: r.type,
        referenceCode: r.referenceCode,
        studentCode: '',
        teacherId: '',
        subject: '',
        totalAmount: r.totalContractValue,
        consumedValue: r.totalConsumedValue,
        amount: r.totalSalaryPaid,
        lessonDate: '',
        status: '',
      })),
    ];

    return format === 'csv'
      ? this.csvWriter.generate(allRows, columns, labels(columns, FINANCE_HEADERS))
      : this.excelWriter.generate(allRows, '财务数据', columns, labels(columns, FINANCE_HEADERS));
  }
}
