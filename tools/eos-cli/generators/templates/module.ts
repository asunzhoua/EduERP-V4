import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { {{CONTROLLER}} } from './{{NAME_KEBAB}}.controller';
import { {{SERVICE}} } from './{{NAME_KEBAB}}.service';
import { {{REPOSITORY}} } from './{{NAME_KEBAB}}.repository';
import { {{ENTITY}} } from './{{NAME_KEBAB}}.entity';

@Module({
  imports: [TypeOrmModule.forFeature([{{ENTITY}}])],
  controllers: [{{CONTROLLER}}],
  providers: [{{SERVICE}}, {{REPOSITORY}}],
  exports: [{{SERVICE}}, {{REPOSITORY}}],
})
export class {{NAME}}Module {}
