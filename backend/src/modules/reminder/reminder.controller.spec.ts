import { Test, TestingModule } from '@nestjs/testing';
import { ReminderController } from './reminder.controller';
import { ReminderService } from './reminder.service';
import { ReminderType } from './enums/reminder-type.enum';
import { ReminderStatus } from './enums/reminder-status.enum';
import { TargetType } from './enums/target-type.enum';
import { ApiResponse } from '@common/dto/api-response';

describe('ReminderController', () => {
  let controller: ReminderController;

  const mockReminder = {
    id: 1,
    type: ReminderType.CLASS_REMINDER,
    title: '上课提醒',
    content: '明天有课',
    targetUserId: 1,
    targetType: TargetType.STUDENT,
    status: ReminderStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    readAt: null,
  };

  const mockReq = { user: { sub: 1 } };

  const mockService = {
    createReminder: jest.fn().mockResolvedValue(mockReminder),
    findByUserId: jest.fn().mockResolvedValue({ items: [mockReminder], total: 1 }),
    markAsRead: jest.fn().mockResolvedValue({ ...mockReminder, status: ReminderStatus.READ }),
    markAllAsRead: jest.fn().mockResolvedValue({ affected: 3 }),
    getUnreadCount: jest.fn().mockResolvedValue(5),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReminderController],
      providers: [
        { provide: ReminderService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<ReminderController>(ReminderController);
    jest.clearAllMocks();
    mockService.createReminder.mockResolvedValue(mockReminder);
    mockService.findByUserId.mockResolvedValue({ items: [mockReminder], total: 1 });
    mockService.markAsRead.mockResolvedValue({ ...mockReminder, status: ReminderStatus.READ });
    mockService.markAllAsRead.mockResolvedValue({ affected: 3 });
    mockService.getUnreadCount.mockResolvedValue(5);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.createReminder and return ApiResponse', async () => {
      const dto = {
        type: ReminderType.CLASS_REMINDER,
        title: '上课提醒',
        content: '明天有课',
        targetUserId: 1,
        targetType: TargetType.STUDENT,
      };

      const result = await controller.create(dto);

      expect(mockService.createReminder).toHaveBeenCalledWith(dto);
      expect(result).toEqual(ApiResponse.success(mockReminder));
    });
  });

  describe('findMyReminders', () => {
    it('should call service.findByUserId with userId from req', async () => {
      const query = { status: ReminderStatus.PENDING, page: 1, pageSize: 20 };
      const result = await controller.findMyReminders(mockReq, query);

      expect(mockService.findByUserId).toHaveBeenCalledWith(1, ReminderStatus.PENDING, 1, 20);
      expect(result).toEqual(ApiResponse.success({ items: [mockReminder], total: 1 }));
    });

    it('should use default page and pageSize when not provided', async () => {
      const query = {};
      await controller.findMyReminders(mockReq, query);

      expect(mockService.findByUserId).toHaveBeenCalledWith(1, undefined, 1, 20);
    });
  });

  describe('markAsRead', () => {
    it('should call service.markAsRead with id and userId', async () => {
      const result = await controller.markAsRead(1, mockReq);

      expect(mockService.markAsRead).toHaveBeenCalledWith(1, 1);
      expect(result.code).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('should call service.markAllAsRead with userId', async () => {
      const result = await controller.markAllAsRead(mockReq);

      expect(mockService.markAllAsRead).toHaveBeenCalledWith(1);
      expect(result).toEqual(ApiResponse.success({ affected: 3 }));
    });
  });

  describe('getUnreadCount', () => {
    it('should call service.getUnreadCount with userId', async () => {
      const result = await controller.getUnreadCount(mockReq);

      expect(mockService.getUnreadCount).toHaveBeenCalledWith(1);
      expect(result).toEqual(ApiResponse.success({ count: 5 }));
    });
  });
});
