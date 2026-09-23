export const getEmployeeApiError = (error, fallback) => {
  if (!error) return { status: 500, message: fallback };

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors || {}).map((e) => e.message);
    return {
      status: 400,
      message: messages.join(', ') || error.message || fallback,
    };
  }

  if (error.name === 'CastError') {
    return {
      status: 400,
      message: `Invalid value for ${error.path}`,
    };
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'email';
    return {
      status: 409,
      message: `An employee with this ${field} already exists`,
    };
  }

  return {
    status: 500,
    message: error.message || fallback,
  };
};

export const validateEmployeePayload = (payload) => {
  const missing = [];
  if (!payload.name?.trim()) missing.push('name');
  if (!payload.email?.trim()) missing.push('email');
  if (!payload.designation) missing.push('designation');
  if (!payload.department?.trim()) missing.push('department');
  if (!payload.dateOfJoining) missing.push('dateOfJoining');
  if (payload.salary === undefined || payload.salary === null || Number.isNaN(payload.salary)) {
    missing.push('salary');
  }
  if (!payload.workingHours?.trim()) missing.push('workingHours');
  return missing;
};
