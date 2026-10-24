import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { slugify } from '../common/slug';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tag.findMany({
      include: {
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });
    if (!tag) {
      throw new NotFoundException(`标签不存在: ${id}`);
    }
    return tag;
  }

  async create(dto: CreateTagDto) {
    const slug = dto.slug ? slugify(dto.slug, 'tag') : slugify(dto.name, 'tag');

    const existing = await this.prisma.tag.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`标签 Slug "${slug}" 已存在`);
    }

    return this.prisma.tag.create({
      data: {
        name: dto.name,
        slug,
      },
    });
  }

  async update(id: string, dto: UpdateTagDto) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`标签不存在: ${id}`);
    }

    let slug = tag.slug;
    if (dto.slug !== undefined) {
      slug = slugify(dto.slug, 'tag');
    }

    if (slug !== tag.slug) {
      const existing = await this.prisma.tag.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`标签 Slug "${slug}" 已存在`);
      }
    }

    return this.prisma.tag.update({
      where: { id },
      data: {
        name: dto.name ?? tag.name,
        slug,
      },
    });
  }

  async remove(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`标签不存在: ${id}`);
    }

    await this.prisma.tag.delete({ where: { id } });
    return { success: true };
  }
}
