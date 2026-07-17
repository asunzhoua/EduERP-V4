import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { ContractStatus } from './enums/contract-status.enum';
import { Subject } from '@common/enums/subject.enum';

@Entity('contract')
@Unique(['contractCode'])
export class ContractEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── Business Identity ───

  @Column({ type: 'varchar', length: 20 })
  @Index()
  contractCode: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  studentCode: string;

  // ─── Product ───

  @Column({ type: 'enum', enum: Subject })
  subject: Subject;

  @Column({ type: 'int' })
  totalLessons: number;

  @Column({ type: 'int' })
  remainingLessons: number;

  // ─── Status ───

  @Column({
    type: 'enum',
    enum: ContractStatus,
    default: ContractStatus.ACTIVE,
  })
  @Index()
  status: ContractStatus;

  // ─── Validity ───

  @Column({ type: 'date' })
  validFrom: string;

  @Column({ type: 'date', nullable: true })
  validTo: string | null;

  // ─── Pricing (reference only) ───

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitPrice: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalAmount: number | null;

  // ─── Notes ───

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[] | null;

  // ─── Audit ───

  @Column({ type: 'bigint' })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;
}
