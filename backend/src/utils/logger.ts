import { Injectable, LoggerService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

@Injectable()
export class AppLogger implements LoggerService {
  private logDir: string;
  private errorLog: string;
  private apiLog: string;
  private eventLog: string;
  private systemLog: string;

  constructor() {
    this.logDir = path.resolve(__dirname, '../../logs');
    this.ensureLogDir();
    this.errorLog = path.join(this.logDir, 'error.log');
    this.apiLog = path.join(this.logDir, 'api.log');
    this.eventLog = path.join(this.logDir, 'event.log');
    this.systemLog = path.join(this.logDir, 'system.log');
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
    console.log(`[${context || 'System'}] ${message}`);
  }

  error(message: any, trace?: string, context?: string) {
    this.writeToFile(this.errorLog, 'ERROR', message, context);
    if (trace) {
      this.writeToFile(this.errorLog, 'ERROR', trace, context);
    }
    console.error(`[${context || 'System'}] ERROR: ${message}`);
  }

  warn(message: any, context?: string) {
    this.writeToFile(this.systemLog, 'WARN', message, context);
    console.warn(`[${context || 'System'}] WARN: ${message}`);
  }

  debug(message: any, context?: string) {
    this.writeToFile(this.systemLog, 'DEBUG', message, context);
    console.debug(`[${context || 'System'}] DEBUG: ${message}`);
  }

  verbose(message: any, context?: string) {
    this.writeToFile(this.systemLog, 'VERBOSE', message, context);
  }

  logApi(method: string, url: string, statusCode: number, duration: number) {
    const message = `${method} ${url} → ${statusCode} (${duration}ms)`;
    this.writeToFile(this.apiLog, 'API', message);
  }

  logEvent(eventName: string, eventId: string, status: string) {
    const message = `Event: ${eventName} [${eventId}] → ${status}`;
    this.writeToFile(this.eventLog, 'EVENT', message);
  }
}
