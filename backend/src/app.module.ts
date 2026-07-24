import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventBusModule } from '@events/event-bus.module';
import { IdentityModule } from '@modules/identity/identity.module';
import { StudentModule } from '@modules/student/student.module';
import { TeachingModule } from '@modules/teaching/teaching.module';
import { DatabaseModule } from '@database/database.module';
import { AnalyticsModule } from '@modules/analytics/analytics.module';
import { ReminderModule } from '@modules/reminder/reminder.module';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { JwtAuthGuard } from '@modules/identity/auth/jwt-auth.guard';
import { appConfig } from '@config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => {
        console.log('[DB Config]', {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD?.substring(0, 3) + '...',
          database: process.env.DB_DATABASE,
        });
        return {
        type: 'mysql',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        username: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: process.env.DB_DATABASE || 'EduOS',
        entities: [__dirname + '/**/*.entity.js'],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
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
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
