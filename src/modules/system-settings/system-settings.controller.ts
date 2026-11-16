import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser, ROLES } from '../auth/types/auth.types.js';
import { UpdateSystemSettingsDto } from '../admin/dto/admin.dto.js';
import { SystemSettingsService } from './system-settings.service.js';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, RolesGuard)
@Roles(ROLES.ADMINISTRATOR)
@Controller('api/v1/admin/settings')
export class SystemSettingsController {
  constructor(
    @Inject(SystemSettingsService)
    private readonly settingsService: SystemSettingsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get platform configuration and system preferences' })
  async getSettings() {
    const data = await this.settingsService.getSettings();
    return { success: true, data };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update platform configuration and system preferences' })
  async updateSettings(
    @Body() dto: UpdateSystemSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.settingsService.updateSettings(dto, user);
    return { success: true, data };
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset platform configuration to defaults' })
  async resetSettings(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.settingsService.resetSettings(user);
    return { success: true, data };
  }

  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all distributed cache entries' })
  async clearCache(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.settingsService.clearCache(user);
    return { success: true, data };
  }
}
