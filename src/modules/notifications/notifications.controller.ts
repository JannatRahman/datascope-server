import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List notifications for current user' })
  async findAll(
    @Query('limit') limit: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const l = Math.min(100, Math.max(1, Number(limit) || 50));
    const data = await this.notificationsService.findAll(user, l);
    return { success: true, data };
  }

  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    const unreadCount = await this.notificationsService.getUnreadCount(user);
    return { success: true, data: { unreadCount } };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.notificationsService.markAsRead(id, user);
    return { success: true, data };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.notificationsService.markAllAsRead(user);
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a notification' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.notificationsService.delete(id, user);
    return result;
  }
}
