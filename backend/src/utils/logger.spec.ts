import * as path from 'path';

const mockLogDir = path.resolve(__dirname, '../../logs');

// Mock specific fs functions used by AppLogger, not the entire fs module
// to avoid interference with winston's internal fs usage.
// existsSync must return true ONLY for the exact log dir so the
// file-stream-rotator size-rotation probe (which calls existsSync in a loop
// while creating numbered rotated files) terminates instead of looping forever.
const mockFs = {
  existsSync: jest
    .fn<boolean, [p: string]>()
    .mockImplementation((p) => p === mockLogDir),
  mkdirSync: jest.fn<void, [p: string, options?: { recursive?: boolean }]>(),
  appendFileSync: jest.fn<void, [path: string, data: string]>(),
};

jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  existsSync: mockFs.existsSync,
  mkdirSync: mockFs.mkdirSync,
  appendFileSync: mockFs.appendFileSync,
}));

import { AppLogger } from './logger';

describe('AppLogger', () => {
  let logger: AppLogger;

  const mockSystemLog = path.join(mockLogDir, 'system.log');
  const mockErrorLog = path.join(mockLogDir, 'error.log');
  const mockApiLog = path.join(mockLogDir, 'api.log');
  const mockEventLog = path.join(mockLogDir, 'event.log');

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockImplementation((p) => p === mockLogDir);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.appendFileSync.mockImplementation(() => undefined);

    logger = new AppLogger();
  });

  describe('constructor', () => {
    it('should create log directory when it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const newLogger = new AppLogger();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(mockLogDir, {
        recursive: true,
      });
      expect(newLogger).toBeDefined();
    });

    it('should not create log directory when it already exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      const newLogger = new AppLogger();

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
      expect(newLogger).toBeDefined();
    });
  });

  describe('log()', () => {
    it('should write to system.log and call console.log', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.log('test message', 'TestCtx');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        mockSystemLog,
        expect.stringContaining('[LOG] [TestCtx] test message'),
      );
      expect(consoleSpy).toHaveBeenCalledWith('[TestCtx] test message');

      consoleSpy.mockRestore();
    });

    it('should use default context when not provided', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.log('hello');

      expect(consoleSpy).toHaveBeenCalledWith('[System] hello');
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        mockSystemLog,
        expect.stringContaining('[LOG] hello'),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('error()', () => {
    it('should write to error.log and call console.error', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      logger.error('fail', undefined, 'ErrorCtx');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        mockErrorLog,
        expect.stringContaining('[ERROR] [ErrorCtx] fail'),
      );
      expect(consoleSpy).toHaveBeenCalledWith('[ErrorCtx] ERROR: fail');

      consoleSpy.mockRestore();
    });

    it('should write trace to error.log when provided', () => {
      jest.spyOn(console, 'error').mockImplementation();

      logger.error('fail', 'stack-trace', 'Ctx');

      const calls = mockFs.appendFileSync.mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[1][1]).toContain('stack-trace');
    });

    it('should not write trace when not provided', () => {
      jest.spyOn(console, 'error').mockImplementation();

      logger.error('fail');

      const calls = mockFs.appendFileSync.mock.calls;
      expect(calls.length).toBe(1);
    });
  });

  describe('warn()', () => {
    it('should write to system.log and call console.warn', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      logger.warn('caution', 'WarnCtx');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        mockSystemLog,
        expect.stringContaining('[WARN] [WarnCtx] caution'),
      );
      expect(consoleSpy).toHaveBeenCalledWith('[WarnCtx] WARN: caution');

      consoleSpy.mockRestore();
    });
  });

  describe('debug()', () => {
    it('should write to system.log and call console.debug', () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

      logger.debug('detail', 'DebugCtx');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        mockSystemLog,
        expect.stringContaining('[DEBUG] [DebugCtx] detail'),
      );
      expect(consoleSpy).toHaveBeenCalledWith('[DebugCtx] DEBUG: detail');

      consoleSpy.mockRestore();
    });
  });

  describe('verbose()', () => {
    it('should write to system.log without console output', () => {
      const spies = {
        log: jest.spyOn(console, 'log').mockImplementation(),
        warn: jest.spyOn(console, 'warn').mockImplementation(),
        error: jest.spyOn(console, 'error').mockImplementation(),
        debug: jest.spyOn(console, 'debug').mockImplementation(),
      };

      logger.verbose('verbose msg', 'VerboseCtx');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        mockSystemLog,
        expect.stringContaining('[VERBOSE] [VerboseCtx] verbose msg'),
      );
      expect(spies.log).not.toHaveBeenCalled();
      expect(spies.warn).not.toHaveBeenCalled();
      expect(spies.error).not.toHaveBeenCalled();
      expect(spies.debug).not.toHaveBeenCalled();

      Object.values(spies).forEach((s) => s.mockRestore());
    });
  });

  describe('logApi()', () => {
    it('should write to api.log with method, url, status, and duration', () => {
      logger.logApi('GET', '/api/users', 200, 42);

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        mockApiLog,
        expect.stringContaining('[API] GET /api/users → 200 (42ms)'),
      );
    });
  });

  describe('logEvent()', () => {
    it('should write to event.log with event name, id, and status', () => {
      logger.logEvent('UserCreated', 'evt-123', 'SUCCESS');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        mockEventLog,
        expect.stringContaining(
          '[EVENT] Event: UserCreated [evt-123] → SUCCESS',
        ),
      );
    });
  });
});
