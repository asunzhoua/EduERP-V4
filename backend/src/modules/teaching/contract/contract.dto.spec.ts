import { CreateContractDto } from './dto/create-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

describe('Contract DTOs', () => {
  describe('CreateContractDto', () => {
    it('should instantiate with no arguments', () => {
      const dto = new CreateContractDto();
      expect(dto).toBeDefined();
    });

    it('should have all expected properties defined', () => {
      const dto = new CreateContractDto();
      // Properties are declared with class-validator decorators
      // They exist on the instance after decorator processing
      expect('studentCode' in dto).toBe(true);
      expect('subject' in dto).toBe(true);
      expect('totalLessons' in dto).toBe(true);
      expect('validFrom' in dto).toBe(true);
      expect('validTo' in dto).toBe(true);
      expect('unitPrice' in dto).toBe(true);
      expect('totalAmount' in dto).toBe(true);
      expect('note' in dto).toBe(true);
      expect('tags' in dto).toBe(true);
    });
  });

  describe('QueryContractDto', () => {
    it('should instantiate with no arguments', () => {
      const dto = new QueryContractDto();
      expect(dto).toBeDefined();
    });

    it('should have no enumerable properties by default', () => {
      const dto = new QueryContractDto();
      expect(Object.keys(dto)).toHaveLength(0);
    });
  });

  describe('UpdateContractDto', () => {
    it('should instantiate with no arguments', () => {
      const dto = new UpdateContractDto();
      expect(dto).toBeDefined();
    });

    it('should have no enumerable properties by default', () => {
      const dto = new UpdateContractDto();
      expect(Object.keys(dto)).toHaveLength(0);
    });
  });
});
