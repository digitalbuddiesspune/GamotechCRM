import api from '../api/axios'

/**
 * Upload a File directly to S3 (presigned PUT).
 * Only a tiny JSON request goes through the API — file bytes never hit the server (avoids 413).
 * @param {File} file
 * @param {{ folder?: string }} [options]
 * @returns {Promise<{ url: string, fileName: string, mimeType: string, size: number, key: string, folder: string }>}
 */
export async function uploadFile(file, options = {}) {
  if (!file) throw new Error('File is required')
  const folder = options.folder || 'misc'
  const mimeType = file.type || 'application/octet-stream'

  const { data } = await api.post('/uploads/presign', {
    fileName: file.name,
    mimeType,
    folder,
    size: file.size || 0,
  })

  const uploadUrl = data?.uploadUrl
  if (!uploadUrl) throw new Error(data?.message || 'Failed to get upload URL')

  const contentType = data?.headers?.['Content-Type'] || mimeType
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  })

  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => '')
    throw new Error(
      detail?.slice(0, 200) || `Direct S3 upload failed (${putRes.status})`
    )
  }

  return {
    url: data?.url || data?.documentUrl || '',
    fileName: data?.fileName || file.name,
    mimeType: data?.mimeType || mimeType,
    size: data?.size || file.size || 0,
    key: data?.key || '',
    folder: data?.folder || folder,
  }
}
