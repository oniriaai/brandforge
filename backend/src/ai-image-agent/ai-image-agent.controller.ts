import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AiImageAgentService } from './ai-image-agent.service';
import { AgentApproveDto, AgentGenerateDto, AgentRejectDto } from './dto/agent.dto';

@ApiTags('ai-image-agent')
@Controller('ai-image-agent')
export class AiImageAgentController {
  constructor(private readonly service: AiImageAgentService) {}

  @Post('generate')
  generate(@Body() dto: AgentGenerateDto) {
    return this.service.generate(dto);
  }

  @Get('jobs/:jobId')
  getJob(@Param('jobId') jobId: string) {
    return this.service.getJob(jobId);
  }

  @Get('approvals/pending')
  getPendingApprovals() {
    return this.service.getPendingApprovals();
  }

  @Post('approvals/:jobId/approve')
  approve(
    @Param('jobId') jobId: string,
    @Body() dto: AgentApproveDto,
  ) {
    return this.service.approve(jobId, dto);
  }

  @Post('approvals/:jobId/reject')
  reject(
    @Param('jobId') jobId: string,
    @Body() dto: AgentRejectDto,
  ) {
    return this.service.reject(jobId, dto);
  }

  @Get('jobs/:jobId/deliver')
  deliver(@Param('jobId') jobId: string) {
    return this.service.deliver(jobId);
  }
}
