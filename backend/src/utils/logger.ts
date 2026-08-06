import { Injectable, LoggerService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

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

    // Initialize Winston with daily rotation
    this.winstonLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          const ctx = context ? ` [${context}]` : '';
          const metaStr = Object.keys(meta).length ? ` ${util.inspect(meta)}` : '';
          return `[${timestamp}] [${level.toUpperCase()}]${ctx} ${message}${metaStr}`;
        }),
      ),
      transports: [
        // Daily rotate file for all application logs
        new winston.transports.DailyRotateFile({
          filename: path.join(this.logDir, 'application-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
        }),
        // Error-specific daily rotate file
        new winston.transports.DailyRotateFile({
          filename: path.join(this.logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
        }),
      ],
    });
  }

  private ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private writeToFile(filePath: string, level: string, message: any, context?: string) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}]${context ? ' [' + context + ']' : ''} ${typeof message === 'string' ? message : util.inspect(message)}\n`;
    fs.appendFileSync(filePath, logLine);
  }

  log(message: any, context?: string) {
    this.writeToFile(this.systemLog, 'LOG', message, context);
    this.winstonLogger.info(message, { context });
    console.log(`[${context || 'System'}] ${message}`);
  }

  error(message: any, trace?: string, context?: string) {
    this.writeToFile(this.errorLog, 'ERROR', message, context);
    if (trace) {
      this.writeToFile(this.errorLog, 'ERROR', trace, context);
    }
    this.winstonLogger.error(message, { context, trace });
    console.error(`[${context || 'System'}] ERROR: ${message}`);
  }

  warn(message: any, context?: string) {
    this.writeToFile(this.systemLog, 'WARN', message, context);
    this.winstonLogger.warn(message, { context });
    console.warn(`[${context || 'System'}] WARN: ${message}`);
  }

  debug(message: any, context?: string) {
    this.writeToFile(this.systemLog, 'DEBUG', message, context);
    this.winstonLogger.debug(message, { context });
    console.debug(`[${context || 'System'}] DEBUG: ${message}`);
  }

  verbose(message: any, context?: string) {
    this.writeToFile(this.systemLog, 'VERBOSE', message, context);
    this.winstonLogger.verbose(message, { context });
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
