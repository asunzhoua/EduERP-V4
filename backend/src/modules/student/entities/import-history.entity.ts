import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { CreatedSource } from '@common/enums/created-source.enum';

/**
 * Import history —预留表。
 * 记录每次批量导入操作的元数据，供日后查询和分析使用。
 * 当前 Sprint 仅建表，不开发查询功能。
 */
@Entity('import_history')
export class ImportHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 50 })
  entityType: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'int' })
  totalRows: number;

  @Column({ type: 'int' })
  successCount: number;

  @Column({ type: 'int' })
  failureCount: number;

  @Column({ type: 'text', nullable: true })
  errorDetails: string;

  @Column({ type: 'bigint' })
  importedBy: number;

  @Column({ type: 'enum', enum: CreatedSource, default: CreatedSource.IMPORT })
  source: CreatedSource;

  @CreateDateColumn()
  importTime: Date;
}
