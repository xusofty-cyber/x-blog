import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, PostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';
import { slugify } from '../common/slug';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublished(query: QueryPostDto) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, query.pageSize || 10);
    const skip = (page - 1) * pageSize;

    const where: Prisma.PostWhereInput = {
      status: PostStatus.PUBLISHED,
    };

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { excerpt: { contains: query.q, mode: 'insensitive' } },
        { content: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.category) {
      where.category = {
        OR: [{ slug: query.category }, { id: query.category }],
      };
    }

    if (query.tag) {
      where.tags = {
        some: {
          OR: [{ slug: query.tag }, { id: query.tag }],
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          category: true,
          tags: true,
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findBySlug(slug: string) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      include: {
        category: true,
        tags: true,
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException(`文章不存在: ${slug}`);
    }

    return post;
  }

  async findAdminPosts(query: QueryPostDto) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, query.pageSize || 10);
    const skip = (page - 1) * pageSize;

    const where: Prisma.PostWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { excerpt: { contains: query.q, mode: 'insensitive' } },
        { content: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.category) {
      where.category = {
        OR: [{ slug: query.category }, { id: query.category }],
      };
    }

    if (query.tag) {
      where.tags = {
        some: {
          OR: [{ slug: query.tag }, { id: query.tag }],
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          tags: true,
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getAdminStats() {
    const [totalPosts, publishedPosts, draftPosts, totalCategories, totalTags, totalUsers] =
      await Promise.all([
        this.prisma.post.count(),
        this.prisma.post.count({ where: { status: PostStatus.PUBLISHED } }),
        this.prisma.post.count({ where: { status: PostStatus.DRAFT } }),
        this.prisma.category.count(),
        this.prisma.tag.count(),
        this.prisma.user.count(),
      ]);

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      totalCategories,
      totalTags,
      totalUsers,
    };
  }

  async create(dto: CreatePostDto, authorId: string) {
    const slug = dto.slug ? slugify(dto.slug, 'post') : slugify(dto.title, 'post');

    const existing = await this.prisma.post.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`文章 Slug "${slug}" 已存在`);
    }

    const status = dto.status || PostStatus.DRAFT;
    const publishedAt =
      status === PostStatus.PUBLISHED
        ? dto.publishedAt
          ? new Date(dto.publishedAt)
          : new Date()
        : dto.publishedAt
          ? new Date(dto.publishedAt)
          : null;

    const data: Prisma.PostCreateInput = {
      title: dto.title,
      slug,
      excerpt: dto.excerpt,
      content: dto.content,
      coverImage: dto.coverImage || null,
      status,
      publishedAt,
      author: {
        connect: { id: authorId },
      },
    };

    if (dto.categoryId) {
      data.category = {
        connect: { id: dto.categoryId },
      };
    }

    if (dto.tagIds && dto.tagIds.length > 0) {
      data.tags = {
        connect: dto.tagIds.map((id) => ({ id })),
      };
    }

    return this.prisma.post.create({
      data,
      include: {
        category: true,
        tags: true,
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { tags: true },
    });
    if (!post) {
      throw new NotFoundException(`文章不存在: ${id}`);
    }

    let slug = post.slug;
    if (dto.slug !== undefined) {
      slug = slugify(dto.slug, 'post');
    }

    if (slug !== post.slug) {
      const existing = await this.prisma.post.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`文章 Slug "${slug}" 已存在`);
      }
    }

    const nextStatus = dto.status ?? post.status;
    let publishedAt = post.publishedAt;

    if (dto.publishedAt !== undefined) {
      publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    } else if (nextStatus === PostStatus.PUBLISHED && !post.publishedAt) {
      publishedAt = new Date();
    }

    const data: Prisma.PostUpdateInput = {
      slug,
      status: nextStatus,
      publishedAt,
    };

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.coverImage !== undefined) data.coverImage = dto.coverImage;

    if (dto.categoryId !== undefined) {
      if (dto.categoryId) {
        data.category = { connect: { id: dto.categoryId } };
      } else {
        data.category = { disconnect: true };
      }
    }

    if (dto.tagIds !== undefined) {
      data.tags = {
        set: dto.tagIds.map((tagId) => ({ id: tagId })),
      };
    }

    return this.prisma.post.update({
      where: { id },
      data,
      include: {
        category: true,
        tags: true,
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async remove(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`文章不存在: ${id}`);
    }

    await this.prisma.post.delete({ where: { id } });
    return { success: true };
  }
}
