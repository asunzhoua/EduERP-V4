import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reminder } from './entities/reminder.entity';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ReminderStatus } from './enums/reminder-status.enum';

@Injectable()
export class ReminderService {
  constructor(
    @InjectRepository(Reminder)
    private reminderRepository: Repository<Reminder>,
  ) {}

  async createReminder(dto: CreateReminderDto): Promise<Reminder> {
    const reminder = this.reminderRepository.create(dto);
    return this.reminderRepository.save(reminder);
  }

  async findByUserId(
    userId: number,
    status?: ReminderStatus,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ items: Reminder[]; total: number }> {
    const qb = this.reminderRepository.createQueryBuilder('r')
      .where('r.targetUserId = :userId', { userId });

    if (status) {
      qb.andWhere('r.status = :status', { status });
    }

    qb.orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async markAsRead(reminderId: number, userId: number): Promise<Reminder> {
    const reminder = await this.reminderRepository.findOne({
      where: { id: reminderId, targetUserId: userId },
    });
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }
    reminder.status = ReminderStatus.READ;
    reminder.readAt = new Date();
    return this.reminderRepository.save(reminder);
  }

  async markAllAsRead(userId: number): Promise<{ affected: number }> {
    const result = await this.reminderRepository.update(
      { targetUserId: userId, status: ReminderStatus.PENDING },
      { status: ReminderStatus.READ, readAt: new Date() },
    );
    return { affected: result.affected ?? 0 };
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.reminderRepository.count({
      where: { targetUserId: userId, status: ReminderStatus.PENDING },
    });
  }
}
