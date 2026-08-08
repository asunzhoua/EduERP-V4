import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WechatSubscribeService } from './wechat-subscribe.service';
import { WechatSubscribe } from './entities/wechat-subscribe.entity';
import { User } from '../identity/entities/user.entity';

describe('WechatSubscribeService', () => {
  let service: WechatSubscribeService;
  let userRepo: jest.Mocked<Partial<Repository<User>>>;
  let subscribeRepo: jest.Mocked<Partial<Repository<WechatSubscribe>>>;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
    };
    subscribeRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WechatSubscribeService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: getRepositoryToken(WechatSubscribe),
          useValue: subscribeRepo,
        },
      ],
    }).compile();

    service = module.get<WechatSubscribeService>(WechatSubscribeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTemplates', () => {
    it('should return 5 built-in templates with configured templateId', () => {
      process.env.WX_SUBSCRIBE_TEMPLATE_ATTENDANCE = 'TMPL_ATT_001';

      const templates = service.getTemplates();

      expect(templates).toHaveLength(5);
      const attendance = templates.find(
        (t) => t.templateType === 'ATTENDANCE_NOTICE',
      );
      expect(attendance).toEqual(
        expect.objectContaining({
          templateId: 'TMPL_ATT_001',
          templateName: '考勤通知',
          templateTitle: '考勤通知',
          fields: ['thing1', 'thing2', 'phrase3', 'time4'],
        }),
      );
    });

    it('should return empty templateId when env not configured', () => {
      delete process.env.WX_SUBSCRIBE_TEMPLATE_ATTENDANCE;

      const templates = service.getTemplates();
      const attendance = templates.find(
        (t) => t.templateType === 'ATTENDANCE_NOTICE',
      );

      expect(attendance!.templateId).toBe('');
    });
  });

  describe('recordSubscription', () => {
    const acceptSub = {
      templateId: 'TMPL_001',
      templateType: 'ATTENDANCE_NOTICE',
      status: 'accept',
    };
    const rejectSub = {
      templateId: 'TMPL_002',
      templateType: 'CLASS_REMINDER',
      status: 'reject',
    };

    it('should throw when user has no openid', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, openid: null });

      await expect(service.recordSubscription(1, [acceptSub])).rejects.toThrow(
        BadRequestException,
      );
      expect(subscribeRepo.save).not.toHaveBeenCalled();
    });

    it('should insert new subscription with quota 1 for accept', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, openid: 'oX-abc' });
      subscribeRepo.findOne.mockResolvedValue(null);
      subscribeRepo.create.mockImplementation((e: any) => e);

      const result = await service.recordSubscription(1, [acceptSub]);

      expect(result.recorded).toBe(1);
      expect(subscribeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          templateType: 'ATTENDANCE_NOTICE',
          templateId: 'TMPL_001',
          quota: 1,
        }),
      );
      expect(subscribeRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should increment quota when subscription already exists', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, openid: 'oX-abc' });
      const existing = {
        id: 9,
        userId: 1,
        templateType: 'ATTENDANCE_NOTICE',
        templateId: 'OLD_TMPL',
        quota: 2,
        lastSubscribedAt: null,
      } as WechatSubscribe;
      subscribeRepo.findOne.mockResolvedValue(existing);

      const result = await service.recordSubscription(1, [acceptSub]);

      expect(result.recorded).toBe(1);
      expect(existing.quota).toBe(3);
      expect(existing.templateId).toBe('TMPL_001');
      expect(existing.lastSubscribedAt).toBeInstanceOf(Date);
      expect(subscribeRepo.save).toHaveBeenCalledWith(existing);
      expect(subscribeRepo.create).not.toHaveBeenCalled();
    });

    it('should ignore reject/ban subscriptions', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, openid: 'oX-abc' });

      const result = await service.recordSubscription(1, [rejectSub]);

      expect(result.recorded).toBe(0);
      expect(subscribeRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getMySubscriptions', () => {
    it('should return subscriptions with template name and quota', async () => {
      const rows = [
        {
          id: 1,
          userId: 1,
          templateType: 'ATTENDANCE_NOTICE',
          templateId: 'TMPL_001',
          quota: 2,
          lastSubscribedAt: new Date('2026-07-24T10:30:00Z'),
        },
        {
          id: 2,
          userId: 1,
          templateType: 'COURSE_CHANGE',
          templateId: 'TMPL_002',
          quota: 1,
          lastSubscribedAt: new Date('2026-07-24T10:31:00Z'),
        },
      ] as WechatSubscribe[];

      // find returns array
      const find = subscribeRepo.find as jest.Mock;
      if (!find) {
        (subscribeRepo as any).find = jest.fn().mockResolvedValue(rows);
      } else {
        find.mockResolvedValue(rows);
      }

      const result = await service.getMySubscriptions(1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          templateType: 'ATTENDANCE_NOTICE',
          templateName: '考勤通知',
          quota: 2,
        }),
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          templateType: 'COURSE_CHANGE',
          templateName: '课时变动',
        }),
      );
    });

    it('should return empty array when no subscriptions', async () => {
      const find = subscribeRepo.find as jest.Mock;
      if (!find) {
        (subscribeRepo as any).find = jest.fn().mockResolvedValue([]);
      } else {
        find.mockResolvedValue([]);
      }

      const result = await service.getMySubscriptions(1);

      expect(result).toEqual([]);
    });
  });
});
