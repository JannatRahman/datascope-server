import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
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
  SavedViewsService,
  CreateSavedViewDto,
  UpdateSavedViewDto,
} from './saved-views.service.js';

@ApiTags('Saved Views')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller('api/v1/saved-views')
export class SavedViewsController {
  constructor(
    @Inject(SavedViewsService) private readonly savedViewsService: SavedViewsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List user saved views, shared views, and directly granted views' })
  async findAll(
    @Query('datasetId') datasetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.savedViewsService.findAll(user, datasetId);
    return { success: true, data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get single saved view configuration' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.savedViewsService.findOne(id, user);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save new dataset view' })
  async create(
    @Body() dto: CreateSavedViewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.savedViewsService.create(user, dto);
    return { success: true, data };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update existing saved view' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSavedViewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.savedViewsService.update(id, user, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete saved view' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.savedViewsService.delete(id, user);
    return result;
  }

  @Post(':id/shares')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Share saved view with a specific user' })
  async shareWithUser(
    @Param('id') id: string,
    @Body('userId') targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.savedViewsService.shareWithUser(id, targetUserId, user);
    return result;
  }

  @Get(':id/shares')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get list of users a view is shared with' })
  async getShares(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.savedViewsService.getShares(id, user);
    return { success: true, data };
  }

  @Delete(':id/shares/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke view share from a specific user' })
  async removeShare(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.savedViewsService.removeShare(id, targetUserId, user);
    return result;
  }
}
