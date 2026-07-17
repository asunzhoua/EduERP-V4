import { FakeClock } from '../fake-clock';

describe('FakeClock', () => {
  it('should return initial time', () => {
    const clock = new FakeClock();

    expect(clock.now()).toEqual(new Date('2026-01-01T00:00:00Z'));
  });

  it('should accept custom initial time', () => {
    const date = new Date('2026-07-15T12:00:00Z');
    const clock = new FakeClock(date);

    expect(clock.now()).toEqual(date);
  });

  it('should return a copy, not the original', () => {
    const clock = new FakeClock();
    const time1 = clock.now();
    const time2 = clock.now();

    expect(time1).not.toBe(time2);
    expect(time1).toEqual(time2);
  });

  describe('set()', () => {
    it('should set the clock to a specific time', () => {
      const clock = new FakeClock();
      const newTime = new Date('2026-12-31T23:59:59Z');

      clock.set(newTime);

      expect(clock.now()).toEqual(newTime);
    });
  });

  describe('advance()', () => {
    it('should advance by milliseconds', () => {
      const clock = new FakeClock();

      clock.advance(1000);

      expect(clock.now()).toEqual(new Date('2026-01-01T00:00:01Z'));
    });
  });

  describe('advanceSeconds()', () => {
    it('should advance by seconds', () => {
      const clock = new FakeClock();

      clock.advanceSeconds(60);

      expect(clock.now()).toEqual(new Date('2026-01-01T00:01:00Z'));
    });
  });

  describe('advanceMinutes()', () => {
    it('should advance by minutes', () => {
      const clock = new FakeClock();

      clock.advanceMinutes(30);

      expect(clock.now()).toEqual(new Date('2026-01-01T00:30:00Z'));
    });
  });

  describe('advanceHours()', () => {
    it('should advance by hours', () => {
      const clock = new FakeClock();

      clock.advanceHours(3);

      expect(clock.now()).toEqual(new Date('2026-01-01T03:00:00Z'));
    });
  });

  describe('advanceDays()', () => {
    it('should advance by days', () => {
      const clock = new FakeClock();

      clock.advanceDays(7);

      expect(clock.now()).toEqual(new Date('2026-01-08T00:00:00Z'));
    });
  });
});
