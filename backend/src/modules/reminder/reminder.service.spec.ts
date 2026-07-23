import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { Reminder } from './entities/reminder.entity';
import { ReminderType } from './enums/reminder-type.enum';
import { ReminderStatus } from './enums/reminder-status.enum';
import { TargetType } from './enums/target-type.enum';

describe('ReminderService', () => {
  let service: ReminderService;

  const mockReminder: Partial<Reminder> = {
    id: 1,
    type: ReminderType.CLASS_REMINDER,
    title: '上课提醒',
    content: '明天有课',
    targetUserId: 10,
    targetType: TargetType.STUDENT,
    status: ReminderStatus.PENDING,
    relatedEntityId: null,
    relatedEntityType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    readAt: null,
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockReminder], 1]),
  };

  const mockRepository = {
    create: jest.fn().mockReturnValue(mockReminder),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 3 }),
    count: jest.fn().mockResolvedValue(5),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderService,
        { provide: getRepositoryToken(Reminder), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ReminderService>(ReminderService);

    jest.clearAllMocks();
    // Re-set repository mock implementations (clearAllMocks wipes them)
    mockRepository.create.mockReturnValue(mockReminder);
    mockRepository.save.mockImplementation((entity: any) => Promise.resolve(entity));
    mockRepository.update.mockResolvedValue({ affected: 3 });
    mockRepository.count.mockResolvedValue(5);
    // Re-set queryBuilder mock implementations
    mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.andWhere.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.orderBy.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.skip.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.take.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockReminder], 1]);
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReminder', () => {
    it('should call repository.create and repository.save', async () => {
      const dto = {
        type: ReminderType.CLASS_REMINDER,
        title: '上课提醒',
        content: '明天有课',
        targetUserId: 10,
        targetType: TargetType.STUDENT,
      };

      const result = await service.createReminder(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(dto);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockReminder);
    });
  });

  describe('findByUserId', () => {
    it('should build query with userId filter', async () => {
      const result = await service.findByUserId(10);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('r.targetUserId = :userId', { userId: 10 });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('r.createdAt', 'DESC');
      expect(result).toEqual({ items: [mockReminder], total: 1 });
    });

    it('should add status filter when provided', async () => {
      await service.findByUserId(10, ReminderStatus.PENDING);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.status = :status', { status: ReminderStatus.PENDING });
    });

    it('should apply pagination', async () => {
      await service.findByUserId(10, undefined, 2, 10);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should not add status filter when status is undefined', async () => {
      await service.findByUserId(10, undefined);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should set status to READ and readAt', async () => {
      const reminder = { ...mockReminder } as Reminder;
      mockRepository.findOne.mockResolvedValue(reminder);
      mockRepository.save.mockResolvedValue(reminder);

      const result = await service.markAsRead(1, 10);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, targetUserId: 10 },
      });
      expect(reminder.status).toBe(ReminderStatus.READ);
      expect(reminder.readAt).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledWith(reminder);
      expect(result).toEqual(reminder);
    });

    it('should throw NotFoundException when reminder not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.markAsRead(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should call repository.update with correct filters', async () => {
      const result = await service.markAllAsRead(10);

      expect(mockRepository.update).toHaveBeenCalledWith(
        { targetUserId: 10, status: ReminderStatus.PENDING },
        expect.objectContaining({ status: ReminderStatus.READ }),
      );
      expect(result).toEqual({ affected: 3 });
    });

    it('should return affected 0 when update returns undefined affected', async () => {
      mockRepository.update.mockResolvedValue({ affected: undefined });

      const result = await service.markAllAsRead(10);

      expect(result).toEqual({ affected: 0 });
    });
  });

  describe('getUnreadCount', () => {
    it('should call repository.count with correct where clause', async () => {
      const result = await service.getUnreadCount(10);

      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { targetUserId: 10, status: ReminderStatus.PENDING },
      });
      expect(result).toBe(5);
    });
  });
});
