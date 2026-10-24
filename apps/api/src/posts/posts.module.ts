import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { AdminPostsController } from './admin-posts.controller';
import { PostsService } from './posts.service';

@Module({
  controllers: [PostsController, AdminPostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
