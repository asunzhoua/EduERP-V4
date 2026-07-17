import { FakeUuid } from '../fake-uuid';

describe('FakeUuid', () => {
  it('should generate sequential UUIDs', () => {
    const uuid = new FakeUuid();

    expect(uuid.generate()).toBe('00000000-0000-0000-0000-000000000001');
    expect(uuid.generate()).toBe('00000000-0000-0000-0000-000000000002');
    expect(uuid.generate()).toBe('00000000-0000-0000-0000-000000000003');
  });

  it('should accept custom prefix', () => {
    const uuid = new FakeUuid('11111111-1111-1111-1111');

    expect(uuid.generate()).toBe('11111111-1111-1111-1111-000000000001');
  });

  describe('reset()', () => {
    it('should reset counter', () => {
      const uuid = new FakeUuid();
      uuid.generate();
      uuid.generate();
      uuid.generate();

      uuid.reset();

      expect(uuid.generate()).toBe('00000000-0000-0000-0000-000000000001');
    });
  });
});
