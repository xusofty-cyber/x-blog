import { Module } from '@nestjs/common';
import { PerksController } from './perks.controller';
import { PerksFetcherService } from './perks-fetcher.service';
import { PerksService } from './perks.service';

@Module({
  controllers: [PerksController],
  providers: [PerksService, PerksFetcherService],
  exports: [PerksService],
})
export class PerksModule {}

