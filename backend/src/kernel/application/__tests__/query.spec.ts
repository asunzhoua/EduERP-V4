import { QueryBase } from '../query/query';
import { IQueryHandler } from '../query/query-handler';
import { Result } from '../../../shared/result/result';

interface StudentDto {
  id: number;
  name: string;
}

class GetStudentQuery extends QueryBase<StudentDto> {
  constructor(public readonly studentId: number) {
    super();
  }
}

class GetStudentHandler implements IQueryHandler<GetStudentQuery, StudentDto> {
  async execute(query: GetStudentQuery): Promise<Result<StudentDto>> {
    if (query.studentId <= 0) {
      return Result.fail(new Error('Invalid student ID'));
    }
    return Result.ok({ id: query.studentId, name: 'Alice' });
  }
}

describe('Query', () => {
  describe('QueryBase', () => {
    it('should generate queryId and timestamp', () => {
      const query = new GetStudentQuery(1);

      expect(query.queryId).toBeDefined();
      expect(query.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('IQueryHandler', () => {
    it('should execute query and return result', async () => {
      const handler = new GetStudentHandler();
      const query = new GetStudentQuery(1);

      const result = await handler.execute(query);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({ id: 1, name: 'Alice' });
    });

    it('should return failure for invalid input', async () => {
      const handler = new GetStudentHandler();
      const query = new GetStudentQuery(-1);

      const result = await handler.execute(query);

      expect(result.isFailure).toBe(true);
    });
  });
});
