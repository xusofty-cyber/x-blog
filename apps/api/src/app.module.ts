import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PostsModule } from './posts/posts.module';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { HealthModule } from './health/health.module';
import { UploadsModule } from './uploads/uploads.module';
import { SettingsModule } from './settings/settings.module';
import { MailModule } from './mail/mail.module';
import { PerksModule } from './perks/perks.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PostsModule,
    CategoriesModule,
    TagsModule,
    HealthModule,
    UploadsModule,
    SettingsModule,
    MailModule,
    PerksModule,
  ],
})
export class AppModule {}
