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
 * 独立教室资源表（DEC：教师端班级改造）
 *
 * 软删模型：deletedAt 非空 = 已停用/删除，不用 status 枚举。
 * 对外 status 由 deletedAt 推导（ACTIVE / DISABLED）。
 */
@Entity('classroom')
export class ClassroomEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'int', default: 20 })
  capacity: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ type: 'datetime', nullable: true })
  @Index()
  deletedAt: Date | null;

  // ─── Audit Fields ───

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
}
