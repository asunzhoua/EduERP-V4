import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  get raw(): Repository<User> {
    return this.repo;
  }

  async save(entity: User): Promise<User> {
    return this.repo.save(entity);
  }

  async findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id, deleted: false } });
  }

  async findByIdWithPassword(id: number): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id })
      .andWhere('u.deleted = :deleted', { deleted: false })
      .getOne();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username, deleted: false } });
  }

  async findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.username = :username', { username })
      .andWhere('u.deleted = :deleted', { deleted: false })
      .getOne();
  }

  async findByRefreshToken(refreshToken: string): Promise<User | null> {
    return this.repo.findOne({ where: { refreshToken, deleted: false } });
  }

  async update(id: number, partial: Partial<User>): Promise<void> {
    await this.repo.update(id, partial);
  }
}
