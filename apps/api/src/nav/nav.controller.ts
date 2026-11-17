import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateCategoryDto,
  CreateLinkDto,
  MoveDto,
  UpdateCategoryDto,
  UpdateLinkDto,
} from './dto/nav.dto';
import { NavService } from './nav.service';

@Controller('nav')
export class NavController {
  constructor(private readonly navService: NavService) {}

  /** 公开读取：前台 /nav 导航页用，不鉴权 */
  @Get()
  listPublic() {
    return this.navService.listPublic();
  }

  @UseGuards(JwtAuthGuard)
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.navService.createCategory(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.navService.updateCategory(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.navService.deleteCategory(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('categories/:id/move')
  moveCategory(@Param('id') id: string, @Body() dto: MoveDto) {
    return this.navService.moveCategory(id, dto.direction);
  }

  @UseGuards(JwtAuthGuard)
  @Post('links')
  createLink(@Body() dto: CreateLinkDto) {
    return this.navService.createLink(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('links/:id')
  updateLink(@Param('id') id: string, @Body() dto: UpdateLinkDto) {
    return this.navService.updateLink(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('links/:id')
  deleteLink(@Param('id') id: string) {
    return this.navService.deleteLink(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('links/:id/move')
  moveLink(@Param('id') id: string, @Body() dto: MoveDto) {
    return this.navService.moveLink(id, dto.direction);
  }
}
