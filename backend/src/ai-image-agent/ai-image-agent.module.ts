import { Module } from '@nestjs/common';
import { AiImageAgentController } from './ai-image-agent.controller';
import { AiImageAgentService } from './ai-image-agent.service';

@Module({
  controllers: [AiImageAgentController],
  providers: [AiImageAgentService],
})
export class AiImageAgentModule {}
