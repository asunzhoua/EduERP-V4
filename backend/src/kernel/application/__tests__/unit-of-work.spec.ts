import { IUnitOfWork } from '../unit-of-work';
import { ITransaction, IsolationLevel } from '../transaction';
import { ApplicationService } from '../application-service';

class FakeTransaction implements ITransaction {
  private _active = true;
  public committed = false;
  public rolledBack = false;

  async commit(): Promise<void> {
    this._active = false;
    this.committed = true;
  }

  async rollback(): Promise<void> {
    this._active = false;
    this.rolledBack = true;
  }

  get isActive(): boolean { return this._active; }
  get isolationLevel(): IsolationLevel { return IsolationLevel.READ_COMMITTED; }
}

class FakeUnitOfWork implements IUnitOfWork {
  private _transaction: FakeTransaction | null = null;

  async begin(): Promise<FakeTransaction> {
    this._transaction = new FakeTransaction();
    return this._transaction;
  }

  get isActive(): boolean {
    return this._transaction?.isActive ?? false;
  }
}

class TestApplicationService extends ApplicationService {
  constructor(uow: IUnitOfWork) {
    super(uow);
  }

  async doSomething(): Promise<number> {
    return this.executeInTransaction(async () => {
      return 42;
    }).then((r) => (r.isSuccess ? r.value : -1));
  }

  async failSomething(): Promise<string | null> {
    return this.executeInTransaction(async () => {
      throw new Error('Business error');
    }).then((r) => (r.isSuccess ? 'ok' : r.error?.message ?? null));
  }
}

describe('Application Runtime', () => {
  describe('IUnitOfWork', () => {
    it('should begin a transaction', async () => {
      const uow = new FakeUnitOfWork();
      const tx = await uow.begin();

      expect(tx).toBeDefined();
      expect(tx.isActive).toBe(true);
      expect(tx.isolationLevel).toBe(IsolationLevel.READ_COMMITTED);
    });

    it('should track active state', async () => {
      const uow = new FakeUnitOfWork();
      expect(uow.isActive).toBe(false);

      await uow.begin();
      expect(uow.isActive).toBe(true);
    });
  });

  describe('ITransaction', () => {
    it('should commit successfully', async () => {
      const tx = new FakeTransaction();

      await tx.commit();

      expect(tx.isActive).toBe(false);
      expect(tx.committed).toBe(true);
    });

    it('should rollback successfully', async () => {
      const tx = new FakeTransaction();

      await tx.rollback();

      expect(tx.isActive).toBe(false);
      expect(tx.rolledBack).toBe(true);
    });
  });

  describe('ApplicationService', () => {
    it('should execute operation in transaction and commit', async () => {
      const uow = new FakeUnitOfWork();
      const service = new TestApplicationService(uow);

      const result = await service.doSomething();

      expect(result).toBe(42);
    });

    it('should rollback on failure', async () => {
      const uow = new FakeUnitOfWork();
      const service = new TestApplicationService(uow);

      const result = await service.failSomething();

      expect(result).toBe('Business error');
    });
  });
});
