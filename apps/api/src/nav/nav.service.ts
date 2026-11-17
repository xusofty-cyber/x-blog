import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCategoryDto,
  CreateLinkDto,
  UpdateCategoryDto,
  UpdateLinkDto,
} from './dto/nav.dto';

const LINK_ORDER = {
  orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
};
const CATEGORY_ORDER = {
  orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
};

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class NavService {
  constructor(private readonly prisma: PrismaService) {}

  /** 公开读取：全部分类 + 链接，按 sortOrder / 创建时间排好序 */
  listPublic() {
    return this.prisma.navCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { links: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('分类名不能为空');
    const count = await this.prisma.navCategory.count();
    try {
      return await this.prisma.navCategory.create({
        data: { name, sortOrder: count },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('已存在同名分类');
      }
      throw err;
    }
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    await this.requireCategory(id);
    const data: { name?: string } = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('分类名不能为空');
      data.name = name;
    }
    try {
      return await this.prisma.navCategory.update({ where: { id }, data });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('已存在同名分类');
      }
      throw err;
    }
  }

  /** 删分类会连同其下全部链接一起删（外键 Cascade），后台删前会二次确认 */
  async deleteCategory(id: string) {
    await this.requireCategory(id);
    await this.prisma.navCategory.delete({ where: { id } });
    return { deleted: true };
  }

  async moveCategory(id: string, direction: 'up' | 'down') {
    const categories = await this.prisma.navCategory.findMany(CATEGORY_ORDER);
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) throw new NotFoundException('分类不存在');
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= categories.length) {
      return categories[index];
    }
    const current = categories[index];
    const neighbor = categories[target];
    await this.prisma.$transaction([
      this.prisma.navCategory.update({
        where: { id: current.id },
        data: { sortOrder: neighbor.sortOrder },
      }),
      this.prisma.navCategory.update({
        where: { id: neighbor.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);
    return { ...current, sortOrder: neighbor.sortOrder };
  }

  async createLink(dto: CreateLinkDto) {
    await this.requireCategory(dto.categoryId);
    const title = dto.title.trim();
    const url = dto.url.trim();
    if (!title) throw new BadRequestException('链接标题不能为空');
    if (!url) throw new BadRequestException('链接地址不能为空');
    const count = await this.prisma.navLink.count({
      where: { categoryId: dto.categoryId },
    });
    try {
      return await this.prisma.navLink.create({
        data: {
          categoryId: dto.categoryId,
          title,
          url,
          description: dto.description?.trim() ?? '',
          sortOrder: count,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('该分类下已存在相同地址的链接');
      }
      throw err;
    }
  }

  async updateLink(id: string, dto: UpdateLinkDto) {
    await this.requireLink(id);
    if (dto.categoryId !== undefined) {
      await this.requireCategory(dto.categoryId);
    }
    const data: {
      categoryId?: string;
      title?: string;
      url?: string;
      description?: string;
    } = {};
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('链接标题不能为空');
      data.title = title;
    }
    if (dto.url !== undefined) {
      const url = dto.url.trim();
      if (!url) throw new BadRequestException('链接地址不能为空');
      data.url = url;
    }
    if (dto.description !== undefined) data.description = dto.description.trim();
    try {
      return await this.prisma.navLink.update({ where: { id }, data });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('该分类下已存在相同地址的链接');
      }
      throw err;
    }
  }

  async deleteLink(id: string) {
    await this.requireLink(id);
    await this.prisma.navLink.delete({ where: { id } });
    return { deleted: true };
  }

  async moveLink(id: string, direction: 'up' | 'down') {
    const link = await this.requireLink(id);
    const links = await this.prisma.navLink.findMany({
      where: { categoryId: link.categoryId },
      ...LINK_ORDER,
    });
    const index = links.findIndex((l) => l.id === id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= links.length) {
      return links[index];
    }
    const current = links[index];
    const neighbor = links[target];
    await this.prisma.$transaction([
      this.prisma.navLink.update({
        where: { id: current.id },
        data: { sortOrder: neighbor.sortOrder },
      }),
      this.prisma.navLink.update({
        where: { id: neighbor.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);
    return { ...current, sortOrder: neighbor.sortOrder };
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.navCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('分类不存在');
    return category;
  }

  private async requireLink(id: string) {
    const link = await this.prisma.navLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('链接不存在');
    return link;
  }
}
