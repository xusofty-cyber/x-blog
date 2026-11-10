import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QueryPerksDto } from './dto/query-perks.dto';
import { RefreshPerksDto } from './dto/refresh-perks.dto';
import { UpdatePerkDto } from './dto/update-perk.dto';
import { PerksService } from './perks.service';

@UseGuards(JwtAuthGuard)
@Controller('perks')
export class PerksController {
  constructor(private readonly perksService: PerksService) {}

  @Get()
  listPerks(@Query() query: QueryPerksDto) {
    return this.perksService.listPerks(query);
  }

  @Get('status')
  getStatus() {
    return this.perksService.getStatus();
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshPerksDto) {
    return this.perksService.runRefresh('manual', dto.scope ?? 'all');
  }

  @Patch(':id')
  updatePerk(@Param('id') id: string, @Body() dto: UpdatePerkDto) {
    return this.perksService.updatePerk(id, dto);
  }
}

