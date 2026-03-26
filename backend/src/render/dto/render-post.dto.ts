import { IsString, IsNotEmpty } from 'class-validator';

export class RenderPostDto {
  @IsString()
  @IsNotEmpty()
  postId: string;

  @IsString()
  @IsNotEmpty()
  templateId: string;
}
