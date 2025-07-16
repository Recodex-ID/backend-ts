export const AVIATION_ROLES = {
    SUPER_ADMIN: 'super_admin',
    OPERATIONS_MANAGER: 'operations_manager',
    FINANCE_MANAGER: 'finance_manager', 
    MAINTENANCE_MANAGER: 'maintenance_manager',
    CLIENT_SERVICES: 'client_services',
    CREW_MEMBER: 'crew_member',
    CLIENT: 'client'
} as const;

export const PERMISSION_LEVELS = {
    SUPER_ADMIN: 0x1fff0,
    OPERATIONS_MANAGER: 0x1000,
    FINANCE_MANAGER: 0x0800,
    MAINTENANCE_MANAGER: 0x0400,
    CLIENT_SERVICES: 0x0200,
    CREW_MEMBER: 0x0100,
    CLIENT: 0x0080
} as const;

export const PERMISSIONS = {
    // Core System Permissions
    SYSTEM_ADMIN: 0x8000,
    USER_MANAGEMENT: 0x4000,
    SYSTEM_CONFIG: 0x2000,
    
    // Flight Operations
    FLIGHT_PLANNING: 0x1000,
    FLIGHT_DISPATCH: 0x0800,
    FLIGHT_SCHEDULING: 0x0400,
    AIRCRAFT_ASSIGNMENT: 0x0200,
    
    // Client Management
    CLIENT_READ: 0x0100,
    CLIENT_WRITE: 0x0080,
    CLIENT_BOOKING: 0x0040,
    CLIENT_BILLING: 0x0020,
    
    // Crew Management
    CREW_SCHEDULING: 0x0010,
    CREW_QUALIFICATIONS: 0x0008,
    CREW_ASSIGNMENTS: 0x0004,
    
    // Maintenance
    MAINTENANCE_SCHEDULE: 0x0002,
    MAINTENANCE_RECORDS: 0x0001,
    
    // Financial
    BILLING_ACCESS: 0x10000,
    FINANCIAL_REPORTS: 0x20000,
    PRICING_MANAGEMENT: 0x40000,
    
    // Compliance & Security
    AUDIT_LOGS: 0x80000,
    COMPLIANCE_REPORTS: 0x100000,
    SECURITY_SETTINGS: 0x200000
} as const;

export const ROLE_PERMISSIONS = {
    [AVIATION_ROLES.SUPER_ADMIN]: 
        PERMISSIONS.SYSTEM_ADMIN | 
        PERMISSIONS.USER_MANAGEMENT | 
        PERMISSIONS.SYSTEM_CONFIG |
        PERMISSIONS.FLIGHT_PLANNING |
        PERMISSIONS.FLIGHT_DISPATCH |
        PERMISSIONS.FLIGHT_SCHEDULING |
        PERMISSIONS.AIRCRAFT_ASSIGNMENT |
        PERMISSIONS.CLIENT_READ |
        PERMISSIONS.CLIENT_WRITE |
        PERMISSIONS.CLIENT_BOOKING |
        PERMISSIONS.CLIENT_BILLING |
        PERMISSIONS.CREW_SCHEDULING |
        PERMISSIONS.CREW_QUALIFICATIONS |
        PERMISSIONS.CREW_ASSIGNMENTS |
        PERMISSIONS.MAINTENANCE_SCHEDULE |
        PERMISSIONS.MAINTENANCE_RECORDS |
        PERMISSIONS.BILLING_ACCESS |
        PERMISSIONS.FINANCIAL_REPORTS |
        PERMISSIONS.PRICING_MANAGEMENT |
        PERMISSIONS.AUDIT_LOGS |
        PERMISSIONS.COMPLIANCE_REPORTS |
        PERMISSIONS.SECURITY_SETTINGS,
        
    [AVIATION_ROLES.OPERATIONS_MANAGER]:
        PERMISSIONS.FLIGHT_PLANNING |
        PERMISSIONS.FLIGHT_DISPATCH |
        PERMISSIONS.FLIGHT_SCHEDULING |
        PERMISSIONS.AIRCRAFT_ASSIGNMENT |
        PERMISSIONS.CLIENT_READ |
        PERMISSIONS.CLIENT_BOOKING |
        PERMISSIONS.CREW_SCHEDULING |
        PERMISSIONS.CREW_QUALIFICATIONS |
        PERMISSIONS.CREW_ASSIGNMENTS |
        PERMISSIONS.COMPLIANCE_REPORTS,
        
    [AVIATION_ROLES.FINANCE_MANAGER]:
        PERMISSIONS.CLIENT_READ |
        PERMISSIONS.CLIENT_BILLING |
        PERMISSIONS.BILLING_ACCESS |
        PERMISSIONS.FINANCIAL_REPORTS |
        PERMISSIONS.PRICING_MANAGEMENT |
        PERMISSIONS.AUDIT_LOGS,
        
    [AVIATION_ROLES.MAINTENANCE_MANAGER]:
        PERMISSIONS.MAINTENANCE_SCHEDULE |
        PERMISSIONS.MAINTENANCE_RECORDS |
        PERMISSIONS.COMPLIANCE_REPORTS |
        PERMISSIONS.AUDIT_LOGS,
        
    [AVIATION_ROLES.CLIENT_SERVICES]:
        PERMISSIONS.CLIENT_READ |
        PERMISSIONS.CLIENT_WRITE |
        PERMISSIONS.CLIENT_BOOKING |
        PERMISSIONS.FLIGHT_SCHEDULING,
        
    [AVIATION_ROLES.CREW_MEMBER]:
        PERMISSIONS.CLIENT_READ |
        PERMISSIONS.CREW_ASSIGNMENTS,
        
    [AVIATION_ROLES.CLIENT]:
        PERMISSIONS.CLIENT_READ
} as const;

export interface UserPermissions {
    role: keyof typeof AVIATION_ROLES;
    level: number;
    permissions: number;
}

export const hasPermission = (userLevel: number, requiredPermission: number): boolean => {
    return (userLevel & requiredPermission) === requiredPermission;
};

export const hasAnyPermission = (userLevel: number, permissions: number[]): boolean => {
    return permissions.some(permission => hasPermission(userLevel, permission));
};

export const getUserPermissions = (role: string): number => {
    return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || ROLE_PERMISSIONS[AVIATION_ROLES.CLIENT];
};

export const getRoleFromLevel = (level: number): string => {
    for (const [role, roleLevel] of Object.entries(PERMISSION_LEVELS)) {
        if (level === roleLevel) {
            return role.toLowerCase();
        }
    }
    return AVIATION_ROLES.CLIENT;
};

export const canAccessResource = (userRole: string, userLevel: number, requiredRole: string, requiredPermissions: number[] = []): boolean => {
    const roleHierarchy = [
        AVIATION_ROLES.CLIENT,
        AVIATION_ROLES.CREW_MEMBER,
        AVIATION_ROLES.CLIENT_SERVICES,
        AVIATION_ROLES.MAINTENANCE_MANAGER,
        AVIATION_ROLES.FINANCE_MANAGER,
        AVIATION_ROLES.OPERATIONS_MANAGER,
        AVIATION_ROLES.SUPER_ADMIN
    ];
    
    const userRoleIndex = roleHierarchy.findIndex(role => role === userRole);
    const requiredRoleIndex = roleHierarchy.findIndex(role => role === requiredRole);
    
    if (userRoleIndex >= requiredRoleIndex) {
        if (requiredPermissions.length === 0) return true;
        return hasAnyPermission(userLevel, requiredPermissions);
    }
    
    return false;
};

export const getAviationRoleDisplayName = (role: string): string => {
    const roleNames = {
        [AVIATION_ROLES.SUPER_ADMIN]: 'Super Administrator',
        [AVIATION_ROLES.OPERATIONS_MANAGER]: 'Operations Manager',
        [AVIATION_ROLES.FINANCE_MANAGER]: 'Finance Manager',
        [AVIATION_ROLES.MAINTENANCE_MANAGER]: 'Maintenance Manager',
        [AVIATION_ROLES.CLIENT_SERVICES]: 'Client Services',
        [AVIATION_ROLES.CREW_MEMBER]: 'Crew Member',
        [AVIATION_ROLES.CLIENT]: 'Client'
    };
    
    return roleNames[role as keyof typeof roleNames] || 'Unknown Role';
};