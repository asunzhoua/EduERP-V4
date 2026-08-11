import { NumberId, StringId } from '../entity/identifier';

describe('NumberId', () => {
  it('should create number id', () => {
    const id = NumberId.create(123);

    expect(id.value).toBe(123);
  });

  it('should be equal for same value', () => {
    const a = NumberId.create(123);
    const b = NumberId.create(123);

    expect(a.equals(b)).toBe(true);
  });

  it('should not be equal for different values', () => {
    const a = NumberId.create(123);
    const b = NumberId.create(456);

    expect(a.equals(b)).toBe(false);
  });
});

describe('StringId', () => {
  it('should create string id', () => {
    const id = StringId.create('CS2026070001');

    expect(id.value).toBe('CS2026070001');
  });

  it('should be equal for same value', () => {
    const a = StringId.create('CS2026070001');
    const b = StringId.create('CS2026070001');

    expect(a.equals(b)).toBe(true);
  });

  it('should not be equal for different values', () => {
    const a = StringId.create('CS2026070001');
    const b = StringId.create('CS2026070002');

    expect(a.equals(b)).toBe(false);
  });
});
