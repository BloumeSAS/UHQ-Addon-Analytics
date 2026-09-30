import { Module } from '@nestjs/common';
import { PanelClient } from './panel-client.service';
import { InsightsService } from './insights.service';
import { StatsController } from './stats.controller';

@Module({
  controllers: [StatsController],
  providers: [PanelClient, InsightsService],
})
export class StatsModule {}
