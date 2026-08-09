import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.SERVER_PORT) || 3000,
  jwt: {
    secret:
      process.env.JWT_SECRET ||
      (process.env.NODE_ENV === 'production'
        ? (() => {
            throw new Error('JWT_SECRET must be set in production');
          })()
        : 'dev-jwt-secret-do-not-use-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username:
      process.env.DB_USERNAME ||
      (process.env.NODE_ENV === 'production'
        ? (() => {
            throw new Error('DB_USERNAME must be set in production');
          })()
        : 'root'),
    password:
      process.env.DB_PASSWORD ||
      (process.env.NODE_ENV === 'production'
        ? (() => {
            throw new Error('DB_PASSWORD must be set in production');
          })()
        : 'root'),
    database: process.env.DB_DATABASE || 'EduOS',
  },
  wechat: {
    appid: process.env.WECHAT_APPID || '',
    secret: process.env.WECHAT_SECRET || '',
    subscribeTemplates: {
      CLASS_REMINDER: process.env.WX_SUBSCRIBE_TEMPLATE_CLASS_REMINDER || '',
      ATTENDANCE_NOTICE: process.env.WX_SUBSCRIBE_TEMPLATE_ATTENDANCE || '',
      COURSE_CHANGE: process.env.WX_SUBSCRIBE_TEMPLATE_LESSON_CHANGE || '',
      FEEDBACK_NOTICE: process.env.WX_SUBSCRIBE_TEMPLATE_FEEDBACK || '',
      LEAVE_RESULT: process.env.WX_SUBSCRIBE_TEMPLATE_LEAVE_RESULT || '',
    },
  },
  renewal: {
    warningThreshold: Number(process.env.RENEWAL_WARNING_THRESHOLD) || 5,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
}));
