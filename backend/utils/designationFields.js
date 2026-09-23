/** Shared designation schema fields for all company CRM instances. */
export const getDesignationFields = () => ({
  title: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  code: {
    type: String,
    trim: true,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  department: {
    type: String,
    default: '',
  },
  level: {
    type: String,
    enum: ['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive', ''],
    default: '',
  },
  accessRole: {
    type: String,
    enum: ['employee', 'manager', 'team_leader', 'hr', 'admin', 'technical_lead'],
    default: 'employee',
  },
  permissions: {
    hasFullAccess: { type: Boolean, default: false },
    canAddProject: { type: Boolean, default: false },
    canEditProject: { type: Boolean, default: false },
    canViewProjects: { type: Boolean, default: false },
    canAssignTask: { type: Boolean, default: false },
    canApproveLeave: { type: Boolean, default: false },
    canManageEmployees: { type: Boolean, default: false },
    canManageSocialCalendar: { type: Boolean, default: true },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
});

const toSlugCode = (title) =>
  String(title || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24);

/** Default access profile from a designation title (used by seeds and fallbacks). */
export const getDefaultDesignationMeta = (title) => {
  const t = String(title || '').trim().toLowerCase();
  const base = {
    code: toSlugCode(title),
    description: '',
    department: '',
    level: '',
    accessRole: 'employee',
    permissions: {
      hasFullAccess: false,
      canAddProject: false,
      canEditProject: false,
      canViewProjects: false,
      canAssignTask: false,
      canApproveLeave: false,
      canManageEmployees: false,
      canManageSocialCalendar: true,
    },
    isActive: true,
    sortOrder: 100,
  };

  if (t === 'admin') {
    return {
      ...base,
      code: 'ADMIN',
      description: 'Full system access',
      department: 'Administration',
      level: 'Executive',
      accessRole: 'admin',
      sortOrder: 1,
      permissions: {
        hasFullAccess: true,
        canAddProject: true,
        canEditProject: true,
        canViewProjects: true,
        canAssignTask: true,
        canApproveLeave: true,
        canManageEmployees: true,
        canManageSocialCalendar: true,
      },
    };
  }

  if (t === 'hr manager') {
    return {
      ...base,
      code: 'HR_MANAGER',
      description: 'Human resources and employee management',
      department: 'Human Resources',
      level: 'Manager',
      accessRole: 'hr',
      sortOrder: 2,
      permissions: {
        hasFullAccess: true,
        canAddProject: true,
        canEditProject: true,
        canViewProjects: true,
        canAssignTask: true,
        canApproveLeave: true,
        canManageEmployees: true,
        canManageSocialCalendar: true,
      },
    };
  }

  if (t === 'technical lead') {
    return {
      ...base,
      code: 'TECH_LEAD',
      description: 'Technical leadership and delivery',
      department: 'Engineering',
      level: 'Lead',
      accessRole: 'technical_lead',
      sortOrder: 3,
      permissions: {
        hasFullAccess: true,
        canAddProject: true,
        canEditProject: true,
        canViewProjects: true,
        canAssignTask: true,
        canApproveLeave: true,
        canManageEmployees: false,
        canManageSocialCalendar: true,
      },
    };
  }

  if (t === 'team leader') {
    return {
      ...base,
      code: 'TEAM_LEADER',
      description: 'Team leadership and task coordination',
      level: 'Lead',
      accessRole: 'team_leader',
      sortOrder: 8,
      permissions: {
        ...base.permissions,
        canAddProject: true,
        canEditProject: true,
        canViewProjects: true,
        canAssignTask: true,
        canApproveLeave: true,
        canManageEmployees: true,
      },
    };
  }

  if (t === 'manager') {
    return {
      ...base,
      code: 'MANAGER',
      description: 'Department manager — projects, clients, and team coordination',
      level: 'Manager',
      accessRole: 'manager',
      sortOrder: 9,
      permissions: {
        hasFullAccess: true,
        canAddProject: true,
        canEditProject: true,
        canViewProjects: true,
        canAssignTask: true,
        canApproveLeave: true,
        canManageEmployees: true,
        canManageSocialCalendar: true,
      },
    };
  }

  // Sales Manager, Senior Sales Manager, Regional Sales Manager, etc.
  if (t.includes('sales') && t.includes('manager')) {
    return {
      ...base,
      code: toSlugCode(title),
      description: 'Sales leadership — full CRM access and team management',
      department: 'Sales',
      level: t.includes('senior') ? 'Senior' : 'Manager',
      accessRole: 'manager',
      sortOrder: 10,
      permissions: {
        hasFullAccess: true,
        canAddProject: true,
        canEditProject: true,
        canViewProjects: true,
        canAssignTask: true,
        canApproveLeave: true,
        canManageEmployees: true,
        canManageSocialCalendar: true,
      },
    };
  }

  if (['project manager', 'engineering manager', 'product manager'].includes(t)) {
    return {
      ...base,
      department: t.includes('product') ? 'Product' : t.includes('engineering') ? 'Engineering' : 'Operations',
      level: 'Manager',
      accessRole: 'manager',
      sortOrder: 10,
      permissions: {
        hasFullAccess: false,
        canAddProject: t !== 'engineering manager',
        canEditProject: true,
        canViewProjects: true,
        canAssignTask: true,
        canApproveLeave: true,
        canManageEmployees: false,
        canManageSocialCalendar: true,
      },
    };
  }

  if (
    t.endsWith(' manager')
    && t !== 'hr manager'
    && !['admin'].includes(t)
  ) {
    return {
      ...base,
      level: 'Manager',
      accessRole: 'manager',
      sortOrder: 15,
      permissions: {
        hasFullAccess: false,
        canAddProject: ['program manager', 'sales manager', 'account manager'].includes(t)
          || (t.includes('sales') && t.includes('manager')),
        canEditProject: true,
        canViewProjects: true,
        canAssignTask: true,
        canApproveLeave: ['program manager', 'sales manager', 'account manager', 'customer success manager'].includes(t)
          || (t.includes('sales') && t.includes('manager')),
        canManageEmployees: false,
        canManageSocialCalendar: true,
      },
    };
  }

  if (['senior software engineer', 'software engineer', 'full stack engineer'].includes(t)) {
    return {
      ...base,
      department: 'Engineering',
      level: t.startsWith('senior') ? 'Senior' : 'Mid',
      accessRole: 'employee',
      permissions: {
        ...base.permissions,
        canAddProject: t === 'senior software engineer',
        canEditProject: t === 'senior software engineer',
        canViewProjects: true,
        canAssignTask: t === 'senior software engineer',
      },
    };
  }

  if (t === 'social media manager') {
    return {
      ...base,
      department: 'Marketing',
      level: 'Manager',
      accessRole: 'manager',
      permissions: {
        ...base.permissions,
        canViewProjects: true,
        canAssignTask: true,
      },
    };
  }

  if (t === 'site coordinator' || t === 'site co-ordinator' || t.includes('site coordinator') || t.includes('site co-ordinator')) {
    return {
      ...base,
      code: 'SITE_COORDINATOR',
      description: 'Coordinates site visits for property leads',
      department: 'Sales',
      level: 'Mid',
      accessRole: 'site_coordinator',
      sortOrder: 40,
      permissions: {
        ...base.permissions,
        canViewProjects: true,
      },
    };
  }

  if (t === 'operations head') {
    return {
      ...base,
      department: 'Operations',
      level: 'Manager',
      accessRole: 'manager',
      sortOrder: 12,
      permissions: {
        ...base.permissions,
        canAddProject: true,
        canEditProject: true,
        canViewProjects: true,
        canAssignTask: true,
        canApproveLeave: true,
        canManageEmployees: true,
      },
    };
  }

  if (['video editor', 'web developer', 'tele caller', 'personal assistant'].includes(t)) {
    return {
      ...base,
      department:
        t === 'video editor'
          ? 'Creative'
          : t === 'web developer'
            ? 'Engineering'
            : t === 'tele caller'
              ? 'Sales'
              : 'Administration',
      level: 'Mid',
      accessRole: 'employee',
      permissions: {
        ...base.permissions,
        canViewProjects: true,
      },
    };
  }

  if (['chief executive officer', 'chief technology officer', 'chief operating officer', 'chief financial officer'].includes(t)) {
    return {
      ...base,
      department: 'Leadership',
      level: 'Executive',
      accessRole: 'admin',
      sortOrder: 5,
      permissions: {
        hasFullAccess: true,
        canAddProject: true,
        canEditProject: true,
        canViewProjects: true,
        canAssignTask: true,
        canApproveLeave: true,
        canManageEmployees: true,
        canManageSocialCalendar: true,
      },
    };
  }

  if (t === 'intern') {
    return {
      ...base,
      level: 'Entry',
      accessRole: 'employee',
      sortOrder: 200,
    };
  }

  return base;
};

export const buildDesignationPayload = (body = {}) => {
  const title = String(body.title || '').trim();
  const defaults = getDefaultDesignationMeta(title);
  const permissions = {
    ...defaults.permissions,
    ...(body.permissions || {}),
  };

  return {
    title,
    code: String(body.code || defaults.code || '').trim(),
    description: String(body.description ?? defaults.description ?? '').trim(),
    department: String(body.department ?? defaults.department ?? '').trim(),
    level: body.level ?? defaults.level ?? '',
    accessRole: body.accessRole ?? defaults.accessRole ?? 'employee',
    permissions,
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : defaults.isActive,
    sortOrder: body.sortOrder != null ? Number(body.sortOrder) : defaults.sortOrder,
  };
};
