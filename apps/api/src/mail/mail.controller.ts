import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MailService } from './mail.service';
import { CreateMailAccountDto } from './dto/create-mail-account.dto';
import { UpdateMailAccountDto } from './dto/update-mail-account.dto';
import { AddMailboxDto, CreateQqGroupDto } from './dto/create-qq-group.dto';
import { UpdateMailboxDto, UpdateQqGroupDto } from './dto/update-qq-group.dto';

@UseGuards(JwtAuthGuard)
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('groups')
  listGroups() {
    return this.mailService.listGroups();
  }

  @Post('groups')
  createGroup(@Body() dto: CreateQqGroupDto) {
    return this.mailService.createGroup(dto);
  }

  @Put('groups/:id')
  updateGroup(@Param('id') id: string, @Body() dto: UpdateQqGroupDto) {
    return this.mailService.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) {
    return this.mailService.deleteGroup(id);
  }

  @Post('groups/:id/mailboxes')
  addMailbox(@Param('id') id: string, @Body() dto: AddMailboxDto) {
    return this.mailService.addMailbox(id, dto);
  }

  @Put('mailboxes/:id')
  updateMailbox(@Param('id') id: string, @Body() dto: UpdateMailboxDto) {
    return this.mailService.updateMailbox(id, dto);
  }

  @Delete('mailboxes/:id')
  deleteMailbox(@Param('id') id: string) {
    return this.mailService.deleteMailbox(id);
  }

  @Get('accounts')
  listAccounts() {
    return this.mailService.listAccounts();
  }

  @Post('accounts')
  createAccount(@Body() dto: CreateMailAccountDto) {
    return this.mailService.createAccount(dto);
  }

  @Put('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateMailAccountDto) {
    return this.mailService.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string) {
    return this.mailService.deleteAccount(id);
  }

  @Get('accounts/:id/messages')
  listMessages(
    @Param('id') id: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
    @Query('q') q?: string,
  ) {
    const page = Math.max(1, parseInt(pageRaw || '1', 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(pageSizeRaw || '20', 10) || 20));
    return this.mailService.listMessages(id, page, pageSize, q?.trim() || undefined);
  }

  @Get('accounts/:id/messages/:uid')
  getMessage(@Param('id') id: string, @Param('uid') uidRaw: string) {
    return this.mailService.getMessage(id, parseInt(uidRaw, 10));
  }

  @Post('accounts/:id/messages/:uid/read')
  markRead(@Param('id') id: string, @Param('uid') uidRaw: string) {
    return this.mailService.markRead(id, parseInt(uidRaw, 10));
  }

  @Get('accounts/:id/messages/:uid/attachments/:index')
  async getAttachment(
    @Param('id') id: string,
    @Param('uid') uidRaw: string,
    @Param('index') indexRaw: string,
    @Res() res: Response,
  ) {
    const att = await this.mailService.getAttachment(id, parseInt(uidRaw, 10), parseInt(indexRaw, 10));
    res.setHeader('Content-Type', att.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
    );
    res.send(att.buffer);
  }
}
