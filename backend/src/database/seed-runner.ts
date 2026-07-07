import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from './seeds/seed.service';
import { AppLogger } from '../utils/logger';

async function bootstrap() {
  const logger = new AppLogger();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new AppLogger(),
  });

  try {
    const seedService = app.get(SeedService);
    await seedService.seed();
    logger.log('Seed completed successfully', 'SeedCLI');
  } catch (error) {
    logger.error(`Seed failed: ${(error as Error).message}`, (error as Error).stack, 'SeedCLI');
  } finally {
    await app.close();
  }
}

bootstrap();
