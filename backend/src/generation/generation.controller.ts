import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GenerationService } from './generation.service';
import { GenerateContentDto, RefineContentDto } from './dto/generation.dto';

@ApiTags('generation')
@Controller('generation')
export class GenerationController {
  constructor(private readonly service: GenerationService) {}

  @Post('generate')
  generate(@Body() dto: GenerateContentDto) {
    return this.service.generate(dto);
  }

  @Post('refine')
  refine(@Body() dto: RefineContentDto) {
    return this.service.refine(dto);
  }
}
