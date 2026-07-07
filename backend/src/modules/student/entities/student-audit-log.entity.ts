import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditAction } from '../enums/audit-action.enum';
import { CreatedSource } from '../enums/created-source.enum';

@Entity('student_audit_log')
export class StudentAuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  @Index()
  studentId: number;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fieldName: string;

  @Column({ type: 'text', nullable: true })
  oldValue: string;

  @Column({ type: 'text', nullable: true })
  newValue: string;

  @Column({ type: 'bigint' })
  operatedBy: number;

  @Column({ type: 'enum', enum: CreatedSource, default: CreatedSource.API })
  source: CreatedSource;

  @Column({ type: 'text', nullable: true })
  detail: string;

  @CreateDateColumn()
  operateTime: Date;
}
