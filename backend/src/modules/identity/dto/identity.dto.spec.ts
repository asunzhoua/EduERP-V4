import { LoginDto } from './login.dto';
import { RefreshDto } from './refresh.dto';

describe('Identity DTOs', () => {
  // ── LoginDto ────────────────────────────────────────────────────────────
  describe('LoginDto', () => {
    it('should instantiate with required fields', () => {
      const dto = new LoginDto();
      dto.username = 'admin';
      dto.password = 'secret123';

      expect(dto.username).toBe('admin');
      expect(dto.password).toBe('secret123');
    });

    it('should allow setting optional device field', () => {
      const dto = new LoginDto();
      dto.username = 'admin';
      dto.password = 'secret123';
      dto.device = 'ios-iphone14';

      expect(dto.device).toBe('ios-iphone14');
    });

    it('should allow device to be undefined', () => {
      const dto = new LoginDto();
      dto.username = 'user1';
      dto.password = 'pass1';

      expect(dto.device).toBeUndefined();
    });
  });

  // ── RefreshDto ──────────────────────────────────────────────────────────
  describe('RefreshDto', () => {
    it('should instantiate with refreshToken', () => {
      const dto = new RefreshDto();
      dto.refreshToken = 'jwt-refresh-token-abc';

      expect(dto.refreshToken).toBe('jwt-refresh-token-abc');
    });

    it('should allow overwriting refreshToken', () => {
      const dto = new RefreshDto();
      dto.refreshToken = 'first';
      dto.refreshToken = 'second';

      expect(dto.refreshToken).toBe('second');
    });
  });
});
