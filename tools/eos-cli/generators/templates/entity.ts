import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { {{NAME}}Status } from './enums/{{NAME_KEBAB}}-status.enum';

@Entity('{{NAME_SNAKE}}')
export class {{ENTITY}} {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  @Index()
  {{NAME_CAMEL}}Code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: {{NAME}}Status, default: {{NAME}}Status.DRAFT })
  @Index()
  status: {{NAME}}Status;

  @Column({ type: 'bigint' })
  createdBy: number;

  @CreateDateColumn()
  createTime: Date;

  @Column({ type: 'bigint', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn()
  updateTime: Date;

  @VersionColumn({ default: 1 })
  version: number;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;
}
