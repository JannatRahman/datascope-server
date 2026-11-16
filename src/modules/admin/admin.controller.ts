import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
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
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser, ROLES } from '../auth/types/auth.types.js';
import { AdminService } from './admin.service.js';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateRolePermissionsDto,
  AddDatasetMemberDto,
  CreateDatasetDto,
  UpdateDatasetDto,
  CreateDatasetFieldDto,
  UpdateDatasetFieldDto,
  GenerateDatasetRecordsDto,
  ImportDatasetRecordsDto,
  UpdateSharedViewDto,
} from './dto/admin.dto.js';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, RolesGuard)
@Roles(ROLES.ADMINISTRATOR)
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly adminService: AdminService,
  ) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get platform administration metrics, health, and logs overview' })
  async getOverview() {
    const data = await this.adminService.getOverview();
    return { success: true, data };
  }

  @Get('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List platform users with roles' })
  async getUsers(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('roleId') roleId?: string,
    @Query('status') status?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 25));
    const result = await this.adminService.getUsers(q, p, ps, roleId, status);
    return { success: true, ...result };
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.adminService.createUser(dto, user);
    return { success: true, data };
  }

  @Patch('users/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user profile or role' })
  async updateUser(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.adminService.updateUser(userId, dto, user);
    return { success: true, data };
  }

  @Delete('users/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate and delete user' })
  async deleteUser(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.adminService.deleteUser(userId, user);
    return result;
  }

  @Get('users/:userId/activity')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single user activity timeline and summary' })
  async getUserActivity(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const result = await this.adminService.getUserActivity(userId, p, ps);
    return { success: true, ...result };
  }

  @Post('users/:userId/reset-access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force-reset user access and revoke all sessions' })
  async resetUserAccess(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.resetUserAccess(userId, user);
  }

  @Get('roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all roles with member counts and permissions' })
  async getRoles() {
    const data = await this.adminService.getRoles();
    return { success: true, data };
  }

  @Get('permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all system permissions' })
  async getPermissions() {
    const data = await this.adminService.getPermissions();
    return { success: true, data };
  }

  @Get('roles/:roleId/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get permissions assigned to a role' })
  async getRolePermissions(@Param('roleId') roleId: string) {
    const data = await this.adminService.getRolePermissions(roleId);
    return { success: true, data };
  }

  @Put('roles/:roleId/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update permissions assigned to a role' })
  async updateRolePermissions(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.adminService.updateRolePermissions(
      roleId,
      dto.permissionIds,
      user,
    );
    return result;
  }

  @Get('datasets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List datasets with their members and permissions' })
  async getDatasets() {
    const data = await this.adminService.getDatasetsWithMembers();
    return { success: true, data };
  }

  @Post('datasets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new dataset with field definitions' })
  async createDataset(
    @Body() dto: CreateDatasetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.adminService.createDataset(dto, user);
    return { success: true, data };
  }

  @Patch('datasets/:datasetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update dataset metadata or status' })
  async updateDataset(
    @Param('datasetId') datasetId: string,
    @Body() dto: UpdateDatasetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.adminService.updateDataset(datasetId, dto, user);
    return { success: true, data };
  }

  @Delete('datasets/:datasetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a dataset and all dependent data' })
  async deleteDataset(
    @Param('datasetId') datasetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.deleteDataset(datasetId, user);
  }

  @Get('datasets/:datasetId/fields')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List field definitions for a dataset' })
  async getDatasetFields(@Param('datasetId') datasetId: string) {
    const data = await this.adminService.getDatasetFields(datasetId);
    return { success: true, data };
  }

  @Post('datasets/:datasetId/fields')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a field definition to a dataset' })
  async createDatasetField(
    @Param('datasetId') datasetId: string,
    @Body() dto: CreateDatasetFieldDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.adminService.createDatasetField(datasetId, dto, user);
    return { success: true, data };
  }

  @Patch('datasets/:datasetId/fields/:fieldId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a dataset field definition' })
  async updateDatasetField(
    @Param('datasetId') datasetId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateDatasetFieldDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.adminService.updateDatasetField(
      datasetId,
      fieldId,
      dto,
      user,
    );
    return { success: true, data };
  }

  @Delete('datasets/:datasetId/fields/:fieldId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a dataset field definition' })
  async deleteDatasetField(
    @Param('datasetId') datasetId: string,
    @Param('fieldId') fieldId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.deleteDatasetField(datasetId, fieldId, user);
  }

  @Post('datasets/:datasetId/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate synthetic records based on field definitions' })
  async generateDatasetRecords(
    @Param('datasetId') datasetId: string,
    @Body() dto: GenerateDatasetRecordsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.generateDatasetRecords(datasetId, dto, user);
  }

  @Post('datasets/:datasetId/import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import JSON records into a dataset' })
  async importDatasetRecords(
    @Param('datasetId') datasetId: string,
    @Body() dto: ImportDatasetRecordsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.importDatasetRecords(datasetId, dto, user);
  }

  @Post('datasets/:datasetId/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add or update member access on dataset' })
  async addDatasetMember(
    @Param('datasetId') datasetId: string,
    @Body() dto: AddDatasetMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.adminService.addOrUpdateDatasetMember(
      datasetId,
      dto,
      user,
    );
    return result;
  }

  @Delete('datasets/:datasetId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke dataset membership' })
  async removeDatasetMember(
    @Param('datasetId') datasetId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.adminService.removeDatasetMember(
      datasetId,
      userId,
      user,
    );
    return result;
  }

  @Get('shared-views')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List saved views and their sharing status' })
  async getSharedViews() {
    const data = await this.adminService.getSharedViews();
    return { success: true, data };
  }

  @Patch('shared-views/:viewId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable or disable sharing for a saved view' })
  async updateSharedView(
    @Param('viewId') viewId: string,
    @Body() dto: UpdateSharedViewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.adminService.updateSharedView(viewId, dto, user);
    return { success: true, data };
  }

  @Delete('shared-views/:viewId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a shared saved view' })
  async deleteSharedView(
    @Param('viewId') viewId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.deleteSharedView(viewId, user);
  }

  @Get('activity-logs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get audit activity logs' })
  async getActivityLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const result = await this.adminService.getActivityLogs(p, ps, type);
    return { success: true, ...result };
  }

  @Get('logs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get audit activity logs (alias)' })
  async getLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
  ) {
    return this.getActivityLogs(page, pageSize, type);
  }

  @Get('performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get query performance logs' })
  async getPerformance(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const result = await this.adminService.getPerformanceLogs(p, ps);
    return { success: true, ...result };
  }

  @Get('exports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List background export jobs' })
  async getExports(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const result = await this.adminService.getExports(p, ps);
    return { success: true, ...result };
  }
}
