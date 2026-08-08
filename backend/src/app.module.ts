import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventBusModule } from '@events/event-bus.module';
import { IdentityModule } from '@modules/identity/identity.module';
import { StudentModule } from '@modules/student/student.module';
import { TeachingModule } from '@modules/teaching/teaching.module';
import { DatabaseModule } from '@database/database.module';
import { AnalyticsModule } from '@modules/analytics/analytics.module';
import { ReminderModule } from '@modules/reminder/reminder.module';
import { SalaryModule } from '@modules/salary/salary.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { ExportModule } from '@modules/export/export.module';
import { AdminModule } from '@modules/admin/admin.module';
import { PointsModule } from '@modules/points/points.module';
import { FeedbackModule } from '@modules/feedback/feedback.module';
import { WechatModule } from '@modules/wechat/wechat.module';
import { HealthModule } from '@modules/health/health.module';
import { SentryModule } from '@common/sentry/sentry.module';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { OptimizedExceptionFilter } from '@common/filters/optimized-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { PerformanceInterceptor } from '@common/interceptors/performance.interceptor';
import { JwtAuthGuard } from '@modules/identity/auth/jwt-auth.guard';
import { appConfig } from '@config/configuration';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => {
        return {
          type: 'mysql',
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT) || 3306,
          username: process.env.DB_USERNAME || 'root',
          password: process.env.DB_PASSWORD || 'root',
          database: process.env.DB_DATABASE || 'EduOS',
          entities: [__dirname + '/**/*.entity.js'],
          synchronize: false,
          logging:
            process.env.NODE_ENV === 'development'
              ? ['error', 'warn']
              : ['error'],
          extra: {
            connectionLimit: 10,
            connectTimeout: 10000,
            idleTimeout: 30000,
          },
          retryAttempts: 1,
          retryDelay: 1000,
        };
      },
    }),
    EventBusModule,
    IdentityModule,
    StudentModule,
    TeachingModule,
    DatabaseModule,
    AnalyticsModule,
    ReminderModule,
    SalaryModule,
    DashboardModule,
    ExportModule,
    AdminModule,
    PointsModule,
    FeedbackModule,
    WechatModule,
    HealthModule,
    SentryModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: OptimizedExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
