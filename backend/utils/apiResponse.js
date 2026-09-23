/**
 * Standardized API response helpers.
 * @module utils/apiResponse
 */

export function success(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({ success: true, ...data });
}

export function error(res, err, fallbackMessage = 'Request failed') {
  const statusCode = err?.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err?.message || fallbackMessage,
    code: err?.code || 'INTERNAL_ERROR',
  });
}

export function paginated(items, { page, limit, total }) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}
