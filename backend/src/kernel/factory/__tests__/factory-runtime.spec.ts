import { AggregateRoot } from '../../../shared/entity/aggregate-root';
import { ValueObject } from '../../../shared/entity/value-object';
import { IAggregateFactory } from '../aggregate-factory';
import { IValueObjectFactory } from '../value-object-factory';

/**
 * Test implementations to verify factory interfaces work correctly.
 */

class TestId extends ValueObject<{ value: number }> {
  // @ts-ignore: intentional override for test
  get value(): number { return this._value.value; }

  static create(id: number): TestId {
    return new TestId({ value: id });
  }
}

class TestAggregate extends AggregateRoot {
  private _name: string;

  constructor(id: number, name: string) {
    super(id, 0);
    this._name = name;
  }

  get name(): string { return this._name; }
}

class TestAggregateFactory implements IAggregateFactory<TestAggregate> {
  create(name: string): TestAggregate {
    return new TestAggregate(Date.now(), name);
  }

  reconstitute(data: Record<string, any>): TestAggregate {
    return new TestAggregate(data.id, data.name);
  }
}

class TestValueObject extends ValueObject<{ x: number; y: number }> {
  get x(): number { return this._value.x; }
  get y(): number { return this._value.y; }

  static create(x: number, y: number): TestValueObject {
    return new TestValueObject({ x, y });
  }
}

class TestValueObjectFactory implements IValueObjectFactory<TestValueObject> {
  create(x: number, y: number): TestValueObject {
    return TestValueObject.create(x, y);
  }

  tryCreate(x: number, y: number): TestValueObject | null {
    if (x < 0 || y < 0) {
      return null;
    }
    return TestValueObject.create(x, y);
  }
}

describe('Factory Runtime', () => {
  describe('IAggregateFactory', () => {
    let factory: TestAggregateFactory;

    beforeEach(() => {
      factory = new TestAggregateFactory();
    });

    it('should create a new aggregate', () => {
      const aggregate = factory.create('Test');

      expect(aggregate).toBeInstanceOf(TestAggregate);
      expect(aggregate.name).toBe('Test');
    });

    it('should reconstitute from persistence data', () => {
      const aggregate = factory.reconstitute({ id: 42, name: 'Restored' });

      expect(aggregate).toBeInstanceOf(TestAggregate);
      expect(aggregate.id).toBe(42);
      expect(aggregate.name).toBe('Restored');
    });
  });

  describe('IValueObjectFactory', () => {
    let factory: TestValueObjectFactory;

    beforeEach(() => {
      factory = new TestValueObjectFactory();
    });

    it('should create a value object', () => {
      const vo = factory.create(3, 4);

      expect(vo).toBeInstanceOf(TestValueObject);
      expect(vo.x).toBe(3);
      expect(vo.y).toBe(4);
    });

    it('should create via tryCreate when valid', () => {
      const vo = factory.tryCreate(3, 4);

      expect(vo).not.toBeNull();
      expect(vo!.x).toBe(3);
    });

    it('should return null via tryCreate when invalid', () => {
      const vo = factory.tryCreate(-1, 4);

      expect(vo).toBeNull();
    });
  });
});
