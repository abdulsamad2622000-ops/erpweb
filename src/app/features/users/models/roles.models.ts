export interface RoleListItem {
  id: number;
  name: string;
  description: string;
  permissionCount: number;
  userCount: number;
  isSystem: boolean;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  isSystem: boolean;
}

export interface RoleBody {
  name: string;
  description: string;
  permissions: string[];
}
