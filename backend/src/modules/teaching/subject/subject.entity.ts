import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

/**
 * 动态学科目录表（DEC：教师可自定学科 + 全链路互通）
 *
 * 软删模型：deletedAt 非空 = 已停用。内置学科 isDefault=true 不可删；
 * 教师自定义学科 code = SUBJ + 4 位序号。
 */
@Entity('subjects')
export class SubjectEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  /** 学科编码（存 course.subject / contract.subject），内置为枚举码、自定义为 SUBJxxxx */
  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  /** 学科中文名称（展示用） */
  @Column({ type: 'varchar', length: 32 })
  name: string;

  /** 分组：ACADEMIC / ART / SPORT / STEM / LANG / OTHER */
  @Column({ type: 'varchar', length: 32 })
  @Index()
  category: string;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  // ─── Audit ───

  @Column({ type: 'bigint', nullable: true })
  createdBy: number | null;

  @CreateDateColumn()
  createTime: Date;

  @Column({ type: 'bigint', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn()
  updateTime: Date;

  @VersionColumn({ default: 1 })
  version: number;

  @Column({ type: 'datetime', nullable: true })
  @Index()
  deletedAt: Date | null;
}
