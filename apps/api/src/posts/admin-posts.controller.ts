import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';
import { QueryPostDto } from './dto/query-post.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminPostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('posts')
  async findAdminPosts(@Query() query: QueryPostDto) {
    return this.postsService.findAdminPosts(query);
  }

  @Get('stats')
  async getStats() {
    return this.postsService.getAdminStats();
  }
}
