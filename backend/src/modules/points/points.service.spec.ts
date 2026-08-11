import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PointsService } from './points.service';
import { PointsAccount } from './points-account.entity';
import { PointsTransaction } from './points-transaction.entity';
import {
  PointsProduct,
  PointsProductStatus,
} from '@modules/admin/entities/points-product.entity';
import {
  PointsExchangeRecord,
  PointsExchangeStatus,
} from '@modules/admin/entities/points-exchange-record.entity';
import { ReminderService } from '@modules/reminder/reminder.service';

describe('PointsService', () => {
  let service: PointsService;

  const accountRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const txRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };
  const productRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };
  const exchangeRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const reminderService = {
    createReminder: jest.fn().mockResolvedValue({ id: 1 }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: getRepositoryToken(PointsAccount), useValue: accountRepo },
        { provide: getRepositoryToken(PointsTransaction), useValue: txRepo },
        { provide: getRepositoryToken(PointsProduct), useValue: productRepo },
        {
          provide: getRepositoryToken(PointsExchangeRecord),
          useValue: exchangeRepo,
        },
        { provide: ReminderService, useValue: reminderService },
      ],
    }).compile();

    service = module.get(PointsService);
  });

  it('getSummary - lazy-creates account when absent and returns zeros', async () => {
    accountRepo.findOne.mockResolvedValue(null);
    accountRepo.create.mockReturnValue({
      studentCode: 'STU1',
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
    });
    accountRepo.save.mockResolvedValue({
      id: 1,
      studentCode: 'STU1',
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
    });
    txRepo.find.mockResolvedValue([]);

    const summary = await service.getSummary('STU1');
    expect(summary.balance).toBe(0);
    expect(accountRepo.create).toHaveBeenCalled();
  });

  it('credit - increments balance and writes EARN transaction', async () => {
    accountRepo.findOne.mockResolvedValue({
      id: 1,
      studentCode: 'STU1',
      balance: 10,
      totalEarned: 10,
      totalSpent: 0,
    });
    accountRepo.save.mockImplementation((a: PointsAccount) =>
      Promise.resolve(a),
    );
    txRepo.create.mockImplementation((t: PointsTransaction) => t);
    txRepo.save.mockImplementation((t: PointsTransaction) =>
      Promise.resolve(t),
    );

    const account = await service.credit('STU1', 5, '完成课时', {
      type: 'LESSON',
      id: 9,
    });
    expect(account.balance).toBe(15);
    expect(account.totalEarned).toBe(15);
    expect(txRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'EARN', amount: 5, balanceAfter: 15 }),
    );
  });

  it('debit - throws when balance insufficient', async () => {
    accountRepo.findOne.mockResolvedValue({
      id: 1,
      studentCode: 'STU1',
      balance: 3,
      totalEarned: 3,
      totalSpent: 0,
    });

    await expect(service.debit('STU1', 10, '兑换')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('exchange - deducts points, decrements stock, writes record and sends reminder', async () => {
    accountRepo.findOne.mockResolvedValue({
      id: 1,
      studentCode: 'STU1',
      balance: 100,
      totalEarned: 100,
      totalSpent: 0,
    });
    accountRepo.save.mockImplementation((a: PointsAccount) =>
      Promise.resolve(a),
    );
    txRepo.create.mockImplementation((t: PointsTransaction) => t);
    txRepo.save.mockImplementation((t: PointsTransaction) =>
      Promise.resolve(t),
    );
    productRepo.findOne.mockResolvedValue({
      id: 1,
      name: '笔记本',
      pointsPrice: 30,
      stock: 5,
      status: PointsProductStatus.ON_SALE,
      deleted: false,
    });
    productRepo.save.mockImplementation((p: PointsProduct) =>
      Promise.resolve(p),
    );
    exchangeRepo.create.mockImplementation((r: PointsExchangeRecord) => r);
    exchangeRepo.save.mockImplementation((r: PointsExchangeRecord) =>
      Promise.resolve({ ...r, id: 10 }),
    );

    const record = await service.exchange('STU1', '张三', 1, 1, 7);

    expect(record.status).toBe(PointsExchangeStatus.COMPLETED);
    expect(productRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ stock: 4 }),
    );
    expect(reminderService.createReminder).toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: 7, title: '积分兑换成功' }),
    );
  });

  it('exchange - rejects off-sale product', async () => {
    productRepo.findOne.mockResolvedValue({
      id: 2,
      name: '已下架',
      pointsPrice: 10,
      stock: 5,
      status: PointsProductStatus.OFF_SALE,
      deleted: false,
    });
    await expect(
      service.exchange('STU1', '张三', 2, 1, 7),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exchange - rejects when stock insufficient', async () => {
    productRepo.findOne.mockResolvedValue({
      id: 3,
      name: '缺货',
      pointsPrice: 10,
      stock: 0,
      status: PointsProductStatus.ON_SALE,
      deleted: false,
    });
    await expect(
      service.exchange('STU1', '张三', 3, 1, 7),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exchange - throws when product not found', async () => {
    productRepo.findOne.mockResolvedValue(null);
    await expect(
      service.exchange('STU1', '张三', 999, 1, 7),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
