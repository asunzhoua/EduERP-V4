import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { appConfig } from './configuration';

const config = appConfig();

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
};
