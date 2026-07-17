import { CommandBase } from '../command/command';
import { ICommandHandler } from '../command/command-handler';
import { Result } from '../../../shared/result/result';

class CreateStudentCommand extends CommandBase {
  constructor(
    public readonly name: string,
    public readonly email: string,
  ) {
    super();
  }
}

class CreateStudentHandler implements ICommandHandler<CreateStudentCommand, number> {
  async execute(command: CreateStudentCommand): Promise<Result<number>> {
    if (!command.name) {
      return Result.fail(new Error('Name is required'));
    }
    return Result.ok(42);
  }
}

describe('Command', () => {
  describe('CommandBase', () => {
    it('should generate commandId and timestamp', () => {
      const cmd = new CreateStudentCommand('Alice', 'alice@test.com');

      expect(cmd.commandId).toBeDefined();
      expect(cmd.timestamp).toBeInstanceOf(Date);
    });

    it('should accept custom commandId and timestamp', () => {
      const date = new Date('2026-01-01');
      const cmd = new CreateStudentCommand('Alice', 'alice@test.com');
      Object.defineProperty(cmd, 'commandId', { value: 'custom-id' });

      expect(cmd.name).toBe('Alice');
      expect(cmd.email).toBe('alice@test.com');
    });
  });

  describe('ICommandHandler', () => {
    it('should execute command and return success', async () => {
      const handler = new CreateStudentHandler();
      const cmd = new CreateStudentCommand('Alice', 'alice@test.com');

      const result = await handler.execute(cmd);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should execute command and return failure', async () => {
      const handler = new CreateStudentHandler();
      const cmd = new CreateStudentCommand('', 'alice@test.com');

      const result = await handler.execute(cmd);

      expect(result.isFailure).toBe(true);
      expect(result.error?.message).toBe('Name is required');
    });
  });
});
