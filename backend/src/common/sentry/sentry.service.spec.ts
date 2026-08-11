import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SentryService } from './sentry.service';

describe('SentryService', () => {
  let service: SentryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SentryService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                SENTRY_DSN: 'https://test@sentry.io/123',
                NODE_ENV: 'test',
                SENTRY_TRACES_SAMPLE_RATE: '0.1',
                SENTRY_ENABLED: 'true',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SentryService>(SentryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isEnabled', () => {
    it('should return true when enabled and DSN is set', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should return false when disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SentryService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  SENTRY_DSN: '',
                  NODE_ENV: 'test',
                  SENTRY_TRACES_SAMPLE_RATE: '0.1',
                  SENTRY_ENABLED: 'false',
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<SentryService>(SentryService);
      expect(disabledService.isEnabled()).toBe(false);
    });
  });

  describe('captureException', () => {
    it('should not throw when capturing exception', () => {
      const error = new Error('Test error');
      expect(() => service.captureException(error)).not.toThrow();
    });

    it('should accept context parameter', () => {
      const error = new Error('Test error');
      const context = { userId: 123, action: 'login' };
      expect(() => service.captureException(error, context)).not.toThrow();
    });
  });

  describe('captureMessage', () => {
    it('should not throw when capturing message', () => {
      expect(() => service.captureMessage('Test message')).not.toThrow();
    });

    it('should accept different log levels', () => {
      expect(() =>
        service.captureMessage('Info message', 'info'),
      ).not.toThrow();
      expect(() =>
        service.captureMessage('Warning message', 'warning'),
      ).not.toThrow();
      expect(() =>
        service.captureMessage('Error message', 'error'),
      ).not.toThrow();
    });
  });

  describe('startTransaction', () => {
    it('should return null when disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SentryService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  SENTRY_DSN: '',
                  NODE_ENV: 'test',
                  SENTRY_TRACES_SAMPLE_RATE: '0.1',
                  SENTRY_ENABLED: 'false',
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<SentryService>(SentryService);
      const transaction = disabledService.startTransaction('test', 'test.op');
      expect(transaction).toBeNull();
    });
  });
});
