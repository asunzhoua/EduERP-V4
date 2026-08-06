import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
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

  it('should not log DB connection info on startup', () => {
    const source = readFileSync(join(__dirname, 'app.module.ts'), 'utf8');
    expect(source).not.toContain('[DB Config]');
  });
});
