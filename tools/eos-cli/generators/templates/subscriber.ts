import { Injectable, Logger } from '@nestjs/common';
import { EventBusService } from '@events/event-bus.service';

interface {{NAME}}Payload {
  eventId: string;
  {{NAME_CAMEL}}Id: number;
  {{NAME_CAMEL}}Code: string;
  time: string;
}

@Injectable()
export class {{NAME}}Subscriber {
  private readonly logger = new Logger({{NAME}}Subscriber.name);

  constructor(private readonly eventBus: EventBusService) {
    this.eventBus.subscribe(
      '{{MODULE_KEBAB}}.{{NAME_CAMEL}}.created',
      (payload: {{NAME}}Payload) => {
        this.logger.log(
          `[{{MODULE_KEBAB}}.{{NAME_CAMEL}}.created] {{NAME}} ${payload.{{NAME_CAMEL}}Code} created`,
        );
      },
    );
  }
}
