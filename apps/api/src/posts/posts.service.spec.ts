import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PostsService', () => {
  let service: PostsService;
  let prisma: Partial<PrismaService>;

  beforeEach(() => {
    prisma = {
      post: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      } as any,
    };
    service = new PostsService(prisma as PrismaService);
  });

  describe('findPublished', () => {
    it('should order posts by isPinned desc, publishedAt desc, createdAt desc', async () => {
      (prisma.post!.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.post!.count as jest.Mock).mockResolvedValue(0);

      await service.findPublished({});

      expect(prisma.post!.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        }),
      );
    });
  });

  describe('update', () => {
    it('should update isPinned when provided in dto', async () => {
      const mockPost = {
        id: 'post-1',
        slug: 'hello-world',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        tags: [],
      };
      (prisma.post!.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prisma.post!.update as jest.Mock).mockResolvedValue({ ...mockPost, isPinned: true });

      await service.update('post-1', { isPinned: true });

      expect(prisma.post!.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: expect.objectContaining({
            isPinned: true,
          }),
        }),
      );
    });
  });
});
