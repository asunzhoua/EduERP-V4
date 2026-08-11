import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as https from 'https';
import { WechatService } from './wechat.service';
import { WechatTokenStore } from './wechat-token.store';
import { WechatSubscribe } from './entities/wechat-subscribe.entity';
import { WechatMessageLog } from './entities/wechat-message-log.entity';
import { User } from '../identity/entities/user.entity';

jest.mock('https');
const mockedHttps = https as jest.Mocked<typeof https>;

type MockResponse = {
  on: jest.Mock;
};

function mockResponse(body: string): MockResponse {
  return {
    on: jest.fn((event: string, cb: (chunk?: string) => void) => {
      if (event === 'data') {
        cb(body);
      } else if (event === 'end') {
        cb();
      }
      return mockResponseBody;
    }),
  };
}
const mockResponseBody = {
  on: jest.fn(),
};

function mockQueryBuilder(affected = 1) {
  const qb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected }),
  };
  return qb;
}

describe('WechatService', () => {
  let service: WechatService;
  let subscribeRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let messageLogRepo: { create: jest.Mock; save: jest.Mock };
  let userRepo: { findOne: jest.Mock };
  let tokenStore: WechatTokenStore;

  const openidUser = { id: 1, openid: 'oX-abc', deleted: false } as User;
  const subscribedRow = {
    id: 1,
    userId: 1,
    templateType: 'ATTENDANCE_NOTICE',
    templateId: 'TMPL_001',
    quota: 2,
  } as WechatSubscribe;

  beforeEach(async () => {
    subscribeRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    messageLogRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    userRepo = {
      findOne: jest.fn(),
    };
    tokenStore = new WechatTokenStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WechatService,
        { provide: WechatTokenStore, useValue: tokenStore },
        {
          provide: getRepositoryToken(WechatSubscribe),
          useValue: subscribeRepo,
        },
        {
          provide: getRepositoryToken(WechatMessageLog),
          useValue: messageLogRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<WechatService>(WechatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getAccessToken ───

  describe('getAccessToken', () => {
    it('should return cached token without calling https', async () => {
      tokenStore.set('cached-token', 7200);
      (mockedHttps.get as jest.Mock).mockImplementation(() => {
        throw new Error('should not call https');
      });

      const token = await service.getAccessToken();

      expect(token).toBe('cached-token');
      expect(mockedHttps.get).not.toHaveBeenCalled();
    });

    it('should fetch token from WeChat API and cache it', async () => {
      process.env.WECHAT_APPID = 'test-appid';
      process.env.WECHAT_SECRET = 'test-secret';
      const res = mockResponse(
        JSON.stringify({ access_token: 'fresh-token', expires_in: 7200 }),
      );
      (mockedHttps.get as jest.Mock).mockImplementation(
        (_url: string, cb: (res: MockResponse) => void) => {
          cb(res);
          return { on: jest.fn() };
        },
      );

      const token = await service.getAccessToken();

      expect(token).toBe('fresh-token');
      expect(tokenStore.get()).toBe('fresh-token');
      expect(mockedHttps.get).toHaveBeenCalledTimes(1);
    });

    it('should return null and not call https when appid/secret unconfigured', async () => {
      process.env.WECHAT_APPID = '';
      process.env.WECHAT_SECRET = '';

      const token = await service.getAccessToken();

      expect(token).toBeNull();
      expect(mockedHttps.get).not.toHaveBeenCalled();
    });
  });

  // ─── sendSubscribeMessage ───

  describe('sendSubscribeMessage', () => {
    const baseInput = {
      userId: 1,
      templateType: 'ATTENDANCE_NOTICE',
      data: {
        thing1: { value: '张三' },
        thing2: { value: '高中数学' },
        phrase3: { value: '已到校' },
        time4: { value: '2026-07-25 14:00' },
      },
      relatedEntityId: 100,
      relatedEntityType: 'lesson',
    };

    it('should write skipped log when user has no openid', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, openid: null });

      await service.sendSubscribeMessage(baseInput);

      expect(messageLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          templateType: 'ATTENDANCE_NOTICE',
          status: 'skipped',
        }),
      );
      expect(messageLogRepo.save).toHaveBeenCalled();
      expect(subscribeRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should write skipped log when template id is not configured', async () => {
      userRepo.findOne.mockResolvedValue(openidUser);
      subscribeRepo.findOne.mockResolvedValue({
        ...subscribedRow,
        templateId: '',
      });

      await service.sendSubscribeMessage(baseInput);

      expect(messageLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'skipped' }),
      );
    });

    it('should write skipped log when quota is zero', async () => {
      userRepo.findOne.mockResolvedValue(openidUser);
      subscribeRepo.findOne.mockResolvedValue({
        ...subscribedRow,
        quota: 0,
      });

      await service.sendSubscribeMessage(baseInput);

      expect(messageLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'skipped' }),
      );
      expect(subscribeRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should write skipped log when a field is too long', async () => {
      userRepo.findOne.mockResolvedValue(openidUser);
      subscribeRepo.findOne.mockResolvedValue(subscribedRow);

      await service.sendSubscribeMessage({
        ...baseInput,
        data: { thing1: { value: '超'.repeat(25) } },
      });

      expect(messageLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'skipped' }),
      );
      expect(subscribeRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should send successfully, write sent log and atomically decrement quota', async () => {
      userRepo.findOne.mockResolvedValue(openidUser);
      subscribeRepo.findOne.mockResolvedValue(subscribedRow);
      tokenStore.set('access-token', 7200);

      const sendRes = mockResponse(
        JSON.stringify({ errcode: 0, errmsg: 'ok' }),
      );
      (mockedHttps.request as jest.Mock).mockImplementation(
        (_url: unknown, _opts: unknown, cb: (res: MockResponse) => void) => {
          cb(sendRes);
          return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
        },
      );

      const qb = mockQueryBuilder(1);
      subscribeRepo.createQueryBuilder.mockReturnValue(qb);

      await service.sendSubscribeMessage(baseInput);

      expect(messageLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          relatedEntityId: 100,
          relatedEntityType: 'lesson',
        }),
      );
      expect(messageLogRepo.save).toHaveBeenCalled();
      expect(qb.set).toHaveBeenCalledWith({
        quota: expect.any(Function) as number,
      });
      expect(qb.where).toHaveBeenCalledWith(
        expect.stringContaining('quota > 0'),
        expect.objectContaining({
          userId: 1,
          templateType: 'ATTENDANCE_NOTICE',
        }),
      );
    });

    it('should write failed log with errcode and not decrement quota on failure', async () => {
      userRepo.findOne.mockResolvedValue(openidUser);
      subscribeRepo.findOne.mockResolvedValue(subscribedRow);
      tokenStore.set('access-token', 'access-token');

      const sendRes = mockResponse(
        JSON.stringify({
          errcode: 45009,
          errmsg: 'reach max api daily quota limit',
        }),
      );
      (mockedHttps.request as jest.Mock).mockImplementation(
        (_url: unknown, _opts: unknown, cb: (res: MockResponse) => void) => {
          cb(sendRes);
          return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
        },
      );

      await service.sendSubscribeMessage(baseInput);

      expect(messageLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', wechatErrcode: 45009 }),
      );
      expect(messageLogRepo.save).toHaveBeenCalled();
      expect(subscribeRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
