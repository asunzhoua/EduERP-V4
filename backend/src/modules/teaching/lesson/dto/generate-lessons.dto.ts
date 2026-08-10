import {
  IsDateString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';

/**
 * 一键排课 DTO（P3-2 批量生成课时）。
 */
export class GenerateLessonsDto {
  /** 起始日期（YYYY-MM-DD），从该日起按班级 dayOfWeek 生成 */
  @IsDateString({}, { message: 'startDate must be a valid date (YYYY-MM-DD)' })
  startDate: string;

  /** 生成数量；缺省则按剩余课时（totalLessons - 已排）全量生成 */
  @IsNumber()
  @Min(1, { message: 'count must be >= 1' })
  @IsOptional()
  count?: number;

  /** 是否检测教师时间冲突（默认 false） */
  @IsBoolean()
  @IsOptional()
  checkConflict?: boolean;

  /** 任课教师（主教师），缺省由后端从班级主教师自动推断 */
  @IsNumber()
  @IsOptional()
  teacherId?: number;
}
