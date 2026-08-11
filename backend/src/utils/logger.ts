import { Injectable, LoggerService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

const LOG_DIR = path.resolve(__dirname, '../../logs');

const sharedWinstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
      const ctx = typeof context === 'string' && context ? ` [${context}]` : '';
      const metaStr = Object.keys(meta).length ? ` ${util.inspect(meta)}` : '';
      return `[${String(timestamp)}] [${level.toUpperCase()}]${ctx} ${String(message)}${metaStr}`;
    }),
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
    }),
  ],
});

@Injectable()
export class AppLogger implements LoggerService {
  private logDir: string;
  private errorLog: string;
  private apiLog: string;
  private eventLog: string;
  private systemLog: string;
  private winstonLogger: winston.Logger;

  constructor() {
    this.logDir = path.resolve(__dirname, '../../logs');
    this.ensureLogDir();
    this.errorLog = path.join(this.logDir, 'error.log');
    this.apiLog = path.join(this.logDir, 'api.log');
    this.eventLog = path.join(this.logDir, 'event.log');
    this.systemLog = path.join(this.logDir, 'system.log');

    // Share one module-level winston instance: reusing the same transports
    // instead of creating a new set per AppLogger prevents handle/timer
    // accumulation across multiple instances.
    this.winstonLogger = sharedWinstonLogger;
  }

  private ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private writeToFile(
    filePath: string,
    level: string,
    message: any,
    context?: string,
  ) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}]${context ? ' [' + context + ']' : ''} ${typeof message === 'string' ? message : util.inspect(message)}\n`;
    fs.appendFileSync(filePath, logLine);
  }

  log(message: any, context?: string) {
    this.writeToFile(this.systemLog, 'LOG', message, context);
    this.winstonLogger.info(message as string, { context });
    console.log(`[${context || 'System'}] ${message}`);
  }

  error(message: any, trace?: string, context?: string) {
    this.writeToFile(this.errorLog, 'ERROR', message, context);
    if (trace) {
      this.writeToFile(this.errorLog, 'ERROR', trace, context);
    }
    this.winstonLogger.error(message as string, { context, trace });
    console.error(`[${context || 'System'}] ERROR: ${message}`);
  }

  warn(message: any, context?: string) {
    this.writeToFile(this.systemLog, 'WARN', message, context);
    this.winstonLogger.warn(message as string, { context });
    console.warn(`[${context || 'System'}] WARN: ${message}`);
  }

  debug(message: any, context?: string) {
    this.writeToFile(this.systemLog, 'DEBUG', message, context);
    this.winstonLogger.debug(message as string, { context });
    console.debug(`[${context || 'System'}] DEBUG: ${message}`);
  }

  verbose(message: any, context?: string) {
    this.writeToFile(this.systemLog, 'VERBOSE', message, context);
    this.winstonLogger.verbose(message as string, { context });
  }

  logApi(method: string, url: string, statusCode: number, duration: number) {
    const message = `${method} ${url} → ${statusCode} (${duration}ms)`;
    this.writeToFile(this.apiLog, 'API', message);
    this.winstonLogger.info(message, { context: 'API' });
  }

  logEvent(eventName: string, eventId: string, status: string) {
    const message = `Event: ${eventName} [${eventId}] → ${status}`;
    this.writeToFile(this.eventLog, 'EVENT', message);
    this.winstonLogger.info(message, { context: 'EVENT' });
  }
}
