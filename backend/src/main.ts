import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppLogger } from '@utils/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new AppLogger(),
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('EduOS API')
    .setDescription('Education Operating System — API Documentation')
    .setVersion('v0.3.5')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const logger = new AppLogger();
  const port = process.env.SERVER_PORT || 3000;

  await app.listen(port);
  logger.log(`EduOS API Server started on port ${port}`, 'Bootstrap');
}

bootstrap();
