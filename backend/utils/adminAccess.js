import { getDefaultDesignationMeta } from './designationFields.js';

export const ALL_SIDEBAR_SECTION_IDS = [
  'dashboard',
  'crm',
  'properties',
  'projects',
  'employees',
  'finance',
  'inventory',
  'sales',
  'marketing',
  'documents',
  'company',
  'reports',
  'communication',
  'administration',
  'workspace',
];

export const isAdminEmployee = (user) => {
  const title = String(user?.designation?.title || user?.designation?.name || '').trim().toLowerCase();
  const accessRole = String(user?.designation?.accessRole || '').trim().toLowerCase();
  return title === 'admin' || accessRole === 'admin';
};

export const isSalesManagerTitle = (title = '') => {
  const t = String(title || '').trim().toLowerCase();
  return t.includes('sales') && t.includes('manager');
};

export const isOperationalManagerEmployee = (user) => {
  if (!user || isAdminEmployee(user)) return false;
  const accessRole = String(user?.designation?.accessRole || '').trim().toLowerCase();
  const title = String(user?.designation?.title || user?.designation?.name || '').trim().toLowerCase();
  if (title === 'hr manager' || accessRole === 'hr') return false;
  if (isSalesManagerTitle(title)) return true;
  if (accessRole === 'manager') return true;
  if (title === 'manager') return true;
  if (title.includes('manager')) return true;
  if (title.includes('operations')) return true;
  return false;
};

export const enrichLoginUser = (user) => {
  if (!user) return user;

  if (isAdminEmployee(user)) {
    const adminMeta = getDefaultDesignationMeta('Admin');
    return {
      ...user,
      designation: {
        ...user.designation,
        title: user.designation?.title || 'Admin',
        accessRole: 'admin',
        permissions: { ...adminMeta.permissions },
      },
      access: {
        ...(user.access || {}),
        sidebarSections: ALL_SIDEBAR_SECTION_IDS,
      },
    };
  }

  if (isOperationalManagerEmployee(user)) {
    const designationTitle = user.designation?.title || user.designation?.name || 'Manager';
    const managerMeta = getDefaultDesignationMeta(designationTitle);
    return {
      ...user,
      designation: {
        ...user.designation,
        accessRole: managerMeta.accessRole || user.designation?.accessRole || 'manager',
        permissions: {
          ...managerMeta.permissions,
          ...(user.designation?.permissions || {}),
          hasFullAccess: true,
        },
      },
      access: {
        ...(user.access || {}),
        sidebarSections: ALL_SIDEBAR_SECTION_IDS,
      },
    };
  }

  return user;
};
