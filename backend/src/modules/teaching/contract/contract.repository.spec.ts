import { ContractRepository } from './contract.repository';
import { ContractStatus } from './enums/contract-status.enum';
import { Subject } from '@common/enums/subject.enum';

describe('ContractRepository', () => {
  let repo: ContractRepository;
  const mockRepo = { findOne: jest.fn(), find: jest.fn() };

  beforeEach(() => {
    mockRepo.findOne.mockReset();
    mockRepo.find.mockReset();
    repo = new ContractRepository(mockRepo as any);
  });

  it('findActiveByStudentCodeAndSubject filters by student+subject+ACTIVE and orders validFrom ASC', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await repo.findActiveByStudentCodeAndSubject('STU001', Subject.MATH);
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: {
        studentCode: 'STU001',
        subject: Subject.MATH,
        status: ContractStatus.ACTIVE,
      },
      order: { validFrom: 'ASC' },
    });
  });
});
