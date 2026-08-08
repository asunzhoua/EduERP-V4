import { Test, TestingModule } from '@nestjs/testing';
import { WechatController } from './wechat.controller';
import { WechatSubscribeService } from './wechat-subscribe.service';

describe('WechatController', () => {
  let controller: WechatController;
  let subscribeService: jest.Mocked<
    Pick<
      WechatSubscribeService,
      'getTemplates' | 'recordSubscription' | 'getMySubscriptions'
    >
  >;

  beforeEach(async () => {
    subscribeService = {
      getTemplates: jest.fn(),
      recordSubscription: jest.fn(),
      getMySubscriptions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WechatController],
      providers: [
        { provide: WechatSubscribeService, useValue: subscribeService },
      ],
    }).compile();

    controller = module.get<WechatController>(WechatController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET templates returns template list', () => {
    subscribeService.getTemplates.mockReturnValue([
      {
        templateId: '',
        templateType: 'CLASS_REMINDER',
        templateName: '上课提醒',
        templateTitle: '课程提醒',
        fields: ['thing1'],
        fieldDescriptions: { thing1: '课程名称' },
      },
    ]);

    const res = controller.getTemplates();

    expect(res.code).toBe(0);
    expect(res.data.templates).toHaveLength(1);
    expect(subscribeService.getTemplates).toHaveBeenCalled();
  });

  it('POST / records subscription for current user', async () => {
    subscribeService.recordSubscription.mockResolvedValue({ recorded: 2 });
    const dto = {
      subscriptions: [
        { templateId: 'T1', templateType: 'CLASS_REMINDER', status: 'accept' },
        {
          templateId: 'T2',
          templateType: 'ATTENDANCE_NOTICE',
          status: 'accept',
        },
      ],
    };

    const res = await controller.recordSubscription(dto, {
      user: { sub: 1 },
    });

    expect(res.code).toBe(0);
    expect(res.data.recorded).toBe(2);
    expect(subscribeService.recordSubscription).toHaveBeenCalledWith(
      1,
      dto.subscriptions,
    );
  });

  it('GET my returns current user subscriptions', async () => {
    subscribeService.getMySubscriptions.mockResolvedValue([
      {
        templateType: 'ATTENDANCE_NOTICE',
        templateName: '考勤通知',
        quota: 3,
        lastSubscribedAt: null,
      },
    ]);

    const res = await controller.getMySubscriptions({ user: { sub: 1 } });

    expect(res.code).toBe(0);
    expect(res.data.subscriptions).toHaveLength(1);
    expect(subscribeService.getMySubscriptions).toHaveBeenCalledWith(1);
  });
});
