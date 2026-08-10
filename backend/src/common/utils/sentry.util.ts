import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

export interface SentryConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  enabled: boolean;
}

export function initSentry(config: SentryConfig): void {
  if (!config.enabled || !config.dsn) {
    console.log('[Sentry] Disabled or DSN not configured');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({
        // Express app will be added later
      }),
    ],
    beforeSend(event) {
      // 可以在这里过滤敏感信息
      return event;
    },
  });

  console.log('[Sentry] Initialized successfully');
}

export function captureException(error: Error, context?: any): void {
  Sentry.captureException(error, { extra: context });
}

export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
): void {
  Sentry.captureMessage(message, level);
}

export function startTransaction(name: string, op: string): Sentry.Transaction {
  return Sentry.startTransaction({ name, op });
}

export { Sentry };
