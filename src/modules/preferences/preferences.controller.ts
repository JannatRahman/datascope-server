import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';
import {
  PreferencesService,
  UserPreferencesDto,
} from './preferences.service.js';

@ApiTags('User Preferences')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller('api/v1/preferences')
export class PreferencesController {
  constructor(
    @Inject(PreferencesService) private readonly preferencesService: PreferencesService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user UI & explorer preferences' })
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.preferencesService.getPreferences(user.id);
    return { success: true, data };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user UI & explorer preferences' })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UserPreferencesDto,
  ) {
    const data = await this.preferencesService.updatePreferences(user.id, dto);
    return { success: true, data };
  }
}
