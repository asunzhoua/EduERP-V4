import { RepositoryBase } from '../repository-base';
import { IMapper } from '../mapper-base';
import { IPersistenceAdapter } from '../persistence-adapter';

interface DomainUser {
  id: number;
  name: string;
}

interface PersistenceUser {
  id: number;
  user_name: string;
}

class UserMapper implements IMapper<DomainUser, PersistenceUser> {
  toDomain(entity: PersistenceUser): DomainUser {
    return { id: entity.id, name: entity.user_name };
  }

  toPersistence(domain: DomainUser): PersistenceUser {
    return { id: domain.id, user_name: domain.name };
  }
}

class FakeUserAdapter implements IPersistenceAdapter<DomainUser, PersistenceUser, number> {
  private store = new Map<number, PersistenceUser>();
  private nextId = 1;

  async findById(id: number): Promise<PersistenceUser | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<PersistenceUser[]> {
    return Array.from(this.store.values());
  }

  async save(entity: PersistenceUser): Promise<PersistenceUser> {
    if (!entity.id) {
      entity = { ...entity, id: this.nextId++ };
    }
    this.store.set(entity.id, entity);
    return entity;
  }

  async delete(id: number): Promise<void> {
    this.store.delete(id);
  }

  async exists(id: number): Promise<boolean> {
    return this.store.has(id);
  }

  async count(): Promise<number> {
    return this.store.size;
  }
}

class UserRepository extends RepositoryBase<DomainUser, PersistenceUser, number> {
  constructor(adapter: FakeUserAdapter) {
    super(adapter, new UserMapper());
  }
}

describe('Infrastructure Runtime', () => {
  describe('RepositoryBase', () => {
    let repo: UserRepository;
    let adapter: FakeUserAdapter;

    beforeEach(() => {
      adapter = new FakeUserAdapter();
      repo = new UserRepository(adapter);
    });

    it('should save and find by id', async () => {
      const user: DomainUser = { id: 0, name: 'Alice' };

      await repo.save(user);
      const found = await repo.findById(1);

      expect(found).not.toBeNull();
      expect(found!.name).toBe('Alice');
    });

    it('should return null when not found', async () => {
      const found = await repo.findById(999);
      expect(found).toBeNull();
    });

    it('should find all', async () => {
      await repo.save({ id: 0, name: 'Alice' });
      await repo.save({ id: 0, name: 'Bob' });

      const all = await repo.findAll();

      expect(all).toHaveLength(2);
    });

    it('should delete', async () => {
      await repo.save({ id: 0, name: 'Alice' });
      await repo.delete(1);

      const found = await repo.findById(1);
      expect(found).toBeNull();
    });

    it('should check exists', async () => {
      await repo.save({ id: 0, name: 'Alice' });

      expect(await repo.exists(1)).toBe(true);
      expect(await repo.exists(999)).toBe(false);
    });

    it('should count', async () => {
      expect(await repo.count()).toBe(0);

      await repo.save({ id: 0, name: 'Alice' });
      await repo.save({ id: 0, name: 'Bob' });

      expect(await repo.count()).toBe(2);
    });
  });

  describe('IMapper', () => {
    it('should map domain to persistence and back', () => {
      const mapper = new UserMapper();

      const domain: DomainUser = { id: 1, name: 'Alice' };
      const persistence = mapper.toPersistence(domain);
      const backToDomain = mapper.toDomain(persistence);

      expect(persistence.user_name).toBe('Alice');
      expect(backToDomain.name).toBe('Alice');
      expect(backToDomain.id).toBe(1);
    });
  });

  describe('ClockAdapter', () => {
    it('should delegate to underlying clock', async () => {
      const { ClockAdapter } = await import('../clock-adapter');
      const { SystemClock } = await import('../../../shared/clock/system-clock');

      const adapter = new ClockAdapter(new SystemClock());
      const now = adapter.now();

      expect(now).toBeInstanceOf(Date);
    });
  });

  describe('UuidAdapter', () => {
    it('should delegate to underlying uuid generator', async () => {
      const { UuidAdapter } = await import('../uuid-adapter');

      const fakeUuid = { generate: () => 'test-uuid-123' };
      const adapter = new UuidAdapter(fakeUuid);
      const id = adapter.generate();

      expect(id).toBe('test-uuid-123');
    });
  });
});
