import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditAction } from '@common/enums/audit-action.enum';
import { CreatedSource } from '@common/enums/created-source.enum';

@Entity('course_audit_log')
export class CourseAuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  courseCode: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fieldName: string | null;

  @Column({ type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ type: 'text', nullable: true })
  newValue: string | null;

  @Column({ type: 'bigint' })
  operatedBy: number;

  @Column({ type: 'enum', enum: CreatedSource, default: CreatedSource.API })
  source: CreatedSource;

  @CreateDateColumn()
  operateTime: Date;
}
