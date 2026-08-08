import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum PointsExchangeStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const PointsExchangeStatusLabels: Record<PointsExchangeStatus, string> = {
  [PointsExchangeStatus.PENDING]: '待兑换',
  [PointsExchangeStatus.COMPLETED]: '已兑换',
  [PointsExchangeStatus.CANCELLED]: '已取消',
};

@Entity('points_exchange_record')
export class PointsExchangeRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'productId' })
  productId: number;

  @Column({ type: 'varchar', length: 100, name: 'productName' })
  productName: string;

  @Column({ type: 'varchar', length: 20, name: 'studentCode' })
  @Index()
  studentCode: string;

  @Column({ type: 'varchar', length: 50, name: 'studentName' })
  studentName: string;

  @Column({ type: 'int', name: 'pointsCost' })
  pointsCost: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({
    type: 'enum',
    enum: PointsExchangeStatus,
    default: PointsExchangeStatus.PENDING,
  })
  @Index()
  status: PointsExchangeStatus;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
