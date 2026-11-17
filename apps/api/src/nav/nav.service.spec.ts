import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NavService } from './nav.service';

describe('NavService', () => {
  let service: NavService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      navCategory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      navLink: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops)),
    };
    service = new NavService(prisma as PrismaService);
  });

  it('listPublic 按 sortOrder 返回分类与旗下链接', async () => {
    const rows = [
      {
        id: 'c1',
        name: '教育优惠',
        sortOrder: 0,
        links: [{ id: 'l1', title: 'EduMails', url: 'https://nav.edumails.cn/' }],
      },
    ];
    prisma.navCategory.findMany.mockResolvedValue(rows);
    await expect(service.listPublic()).resolves.toEqual(rows);
    expect(prisma.navCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.anything() }),
    );
  });

  it('createCategory 追加到末尾（sortOrder 取当前分类数）', async () => {
    prisma.navCategory.count.mockResolvedValue(2);
    prisma.navCategory.create.mockResolvedValue({ id: 'c3', name: '开发', sortOrder: 2 });
    const created = await service.createCategory({ name: '开发' });
    expect(created.sortOrder).toBe(2);
    expect(prisma.navCategory.create).toHaveBeenCalledWith({
      data: { name: '开发', sortOrder: 2 },
    });
  });

  it('createCategory 同名时报 ConflictException', async () => {
    prisma.navCategory.count.mockResolvedValue(0);
    prisma.navCategory.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.createCategory({ name: '教育优惠' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('createLink 分类不存在时报 NotFoundException，不写库', async () => {
    prisma.navCategory.findUnique.mockResolvedValue(null);
    await expect(
      service.createLink({
        categoryId: 'missing',
        title: 'x',
        url: 'https://example.com/',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.navLink.create).not.toHaveBeenCalled();
  });

  it('moveLink 上移时与上一条交换 sortOrder', async () => {
    const first = { id: 'l1', categoryId: 'c1', sortOrder: 0 };
    const second = { id: 'l2', categoryId: 'c1', sortOrder: 1 };
    prisma.navLink.findUnique.mockResolvedValue(second);
    prisma.navLink.findMany.mockResolvedValue([first, second]);
    const moved = await service.moveLink('l2', 'up');
    expect(moved.sortOrder).toBe(0);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.navLink.update).toHaveBeenCalledWith({
      where: { id: 'l2' },
      data: { sortOrder: 0 },
    });
    expect(prisma.navLink.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { sortOrder: 1 },
    });
  });

  it('moveLink 已在首位时不再上移', async () => {
    const first = { id: 'l1', categoryId: 'c1', sortOrder: 0 };
    prisma.navLink.findUnique.mockResolvedValue(first);
    prisma.navLink.findMany.mockResolvedValue([first]);
    const moved = await service.moveLink('l1', 'up');
    expect(moved).toEqual(first);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deleteCategory 不存在时报 NotFoundException', async () => {
    prisma.navCategory.findUnique.mockResolvedValue(null);
    await expect(service.deleteCategory('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.navCategory.delete).not.toHaveBeenCalled();
  });
});
