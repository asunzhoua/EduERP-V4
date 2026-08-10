import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

@Injectable()
export class SentryService implements OnModuleInit {
  private readonly dsn: string;
  private readonly environment: string;
  private readonly tracesSampleRate: number;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.dsn = this.configService.get<string>('SENTRY_DSN') || '';
    this.environment =
      this.configService.get<string>('NODE_ENV') || 'development';
    this.tracesSampleRate = parseFloat(
      this.configService.get<string>('SENTRY_TRACES_SAMPLE_RATE') || '0.1',
    );
    this.enabled = this.configService.get<string>('SENTRY_ENABLED') === 'true';
  }

  onModuleInit() {
    if (!this.enabled || !this.dsn) {
      console.log('[Sentry] Disabled or DSN not configured');
      return;
    }

    Sentry.init({
      dsn: this.dsn,
      environment: this.environment,
      tracesSampleRate: this.tracesSampleRate,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Tracing.Integrations.Express({}),
      ],
      beforeSend(event) {
        // 可以在这里过滤敏感信息
        return event;
      },
    });

    console.log('[Sentry] Initialized successfully');
  }

  captureException(error: Error, context?: unknown): void {
    if (!this.enabled) return;
    Sentry.captureException(error, {
      extra: context as Record<string, unknown>,
    });
  }

  captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
    if (!this.enabled) return;
    Sentry.captureMessage(message, level);
  }

  startTransaction(name: string, op: string): Sentry.Transaction | null {
    if (!this.enabled) return null;
    return Sentry.startTransaction({ name, op });
  }

  isEnabled(): boolean {
    return this.enabled && !!this.dsn;
  }
}
