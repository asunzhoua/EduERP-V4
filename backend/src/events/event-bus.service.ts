import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppLogger } from '@utils/logger';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EventBusService {
  private logger = new AppLogger();

  constructor(private eventEmitter: EventEmitter2) {}

  publish(eventName: string, payload: any): void {
    const eventId = uuidv4();
    const enrichedPayload = {
      ...payload,
      eventId,
      timestamp: new Date().toISOString(),
    };

    this.logger.logEvent(eventName, eventId, 'PUBLISHED');
    this.eventEmitter.emit(eventName, enrichedPayload);
  }

  subscribe(eventName: string, handler: (payload: any) => void): void {
    this.eventEmitter.on(eventName, (payload: any) => {
      this.logger.logEvent(eventName, payload.eventId || 'unknown', 'RECEIVED');
      try {
        handler(payload);
        this.logger.logEvent(eventName, payload.eventId || 'unknown', 'SUCCESS');
      } catch (error) {
        this.logger.logEvent(eventName, payload.eventId || 'unknown', 'FAILED');
        this.logger.error(`Event handler failed for ${eventName}: ${error.message}`);
      }
    });
  }
}
