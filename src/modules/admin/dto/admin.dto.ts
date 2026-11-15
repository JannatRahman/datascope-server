export interface CreateUserDto {
  email: string;
  name: string;
  password?: string;
  roleId?: string;
}

export interface UpdateUserDto {
  name?: string;
  roleId?: string;
  emailVerified?: boolean;
}

export interface UpdateRolePermissionsDto {
  permissionIds: string[];
}

export interface AddDatasetMemberDto {
  userId: string;
  accessLevel: 'viewer' | 'editor' | 'manager';
}
