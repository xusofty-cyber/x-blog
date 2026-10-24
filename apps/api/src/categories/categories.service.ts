import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { slugify } from '../common/slug';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      include: {
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });
    if (!category) {
      throw new NotFoundException(`分类不存在: ${id}`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug ? slugify(dto.slug, 'cat') : slugify(dto.name, 'cat');

    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`分类 Slug "${slug}" 已存在`);
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`分类不存在: ${id}`);
    }

    let slug = category.slug;
    if (dto.slug !== undefined) {
      slug = slugify(dto.slug, 'cat');
    }

    if (slug !== category.slug) {
      const existing = await this.prisma.category.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`分类 Slug "${slug}" 已存在`);
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name ?? category.name,
        slug,
      },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`分类不存在: ${id}`);
    }

    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }
}
