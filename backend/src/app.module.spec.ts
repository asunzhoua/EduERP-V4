import 'reflect-metadata';
import { AppModule } from './app.module';

describe('AppModule', () => {
  it('should register ScheduleModule so @Cron jobs are scheduled', () => {
    const imports: any[] = Reflect.getMetadata('imports', AppModule) ?? [];
    const hasScheduleModule = imports.some((mod) => {
      const name = mod?.module?.name ?? mod?.name;
      return name === 'ScheduleModule';
    });
    expect(hasScheduleModule).toBe(true);
  });
});
