import { Test, TestingModule } from '@nestjs/testing';
import { LessonChangeRequestController } from './lesson-change-request.controller';
import { LessonChangeRequestService } from './lesson-change-request.service';
import { LessonChangeRequestEntity } from './lesson-change-request.entity';
import { ChangeRequestType } from '@common/enums/change-request-type.enum';
import { ChangeRequestStatus } from './enums/change-request-status.enum';

describe('LessonChangeRequestController', () => {
  let controller: LessonChangeRequestController;
  let service: jest.Mocked<LessonChangeRequestService>;

  beforeEach(async () => {
    const mockService = {
      createRequest: jest.fn(),
      findByLessonId: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LessonChangeRequestController],
      providers: [
        { provide: LessonChangeRequestService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<LessonChangeRequestController>(LessonChangeRequestController);
    service = module.get(LessonChangeRequestService) as any;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createRequest', () => {
    it('should call service.createRequest with mapped input', async () => {
      const dto = {
        requestType: ChangeRequestType.RESCHEDULE,
        reason: '需要调课',
        previousDate: '2026-07-20',
        newDate: '2026-07-22',
      };
      const entity = new LessonChangeRequestEntity();
      service.createRequest.mockResolvedValue(entity);

      const result = await controller.createRequest(1, dto as any);

      expect(service.createRequest).toHaveBeenCalledWith({
        lessonId: 1,
        requestType: ChangeRequestType.RESCHEDULE,
        requestedBy: 0,
        reason: '需要调课',
        previousDate: '2026-07-20',
        newDate: '2026-07-22',
        previousStartTime: undefined,
        newStartTime: undefined,
        previousEndTime: undefined,
        newEndTime: undefined,
        previousTeacherId: undefined,
        newTeacherId: undefined,
      });
      expect(result).toBe(entity);
    });
  });

  describe('findByLesson', () => {
    it('should call service.findByLessonId', async () => {
      const entities = [new LessonChangeRequestEntity()];
      service.findByLessonId.mockResolvedValue(entities);

      const result = await controller.findByLesson(1);

      expect(service.findByLessonId).toHaveBeenCalledWith(1);
      expect(result).toBe(entities);
    });
  });

  describe('approve', () => {
    it('should call service.approve', async () => {
      const entity = new LessonChangeRequestEntity();
      entity.status = ChangeRequestStatus.APPROVED;
      service.approve.mockResolvedValue(entity);

      const result = await controller.approve(1);

      expect(service.approve).toHaveBeenCalledWith(1, 0);
      expect(result.status).toBe(ChangeRequestStatus.APPROVED);
    });
  });

  describe('reject', () => {
    it('should call service.reject with reason', async () => {
      const entity = new LessonChangeRequestEntity();
      entity.status = ChangeRequestStatus.REJECTED;
      service.reject.mockResolvedValue(entity);

      const result = await controller.reject(1, { reason: '拒绝理由' });

      expect(service.reject).toHaveBeenCalledWith(1, 0, '拒绝理由');
      expect(result.status).toBe(ChangeRequestStatus.REJECTED);
    });
  });
});
