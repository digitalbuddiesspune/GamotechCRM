import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api/axios'

const REVIEW_BADGE = {
  Pending: 'bg-amber-100 text-amber-800',
  Accepted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  'Need Changes': 'bg-purple-100 text-purple-800',
}

const SocialCalendarClientView = () => {
  const { token } = useParams()
  const [calendar, setCalendar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [noteDraftByPost, setNoteDraftByPost] = useState({})
  const [savingByPost, setSavingByPost] = useState({})
  const [viewMode, setViewMode] = useState('grid')
  const [selectedPost, setSelectedPost] = useState(null)

  const fetchCalendar = async () => {
    if (!token) return
    try {
      setLoading(true)
      const res = await api.get(`/social-calendars/shared/${token}`)
      const data = res.data
      setCalendar(data)
      const noteSeed = {}
      ;(data.posts || []).forEach((p) => {
        noteSeed[p._id] = p.clientNote || ''
      })
      setNoteDraftByPost(noteSeed)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load calendar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const sortedPosts = useMemo(
    () => [...(calendar?.posts || [])].sort((a, b) => new Date(a.scheduledTime || 0) - new Date(b.scheduledTime || 0)),
    [calendar?.posts]
  )

  const feed30Days = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setDate(now.getDate() + 30)
    return sortedPosts.filter((p) => {
      if (!p?.scheduledTime) return true
      const d = new Date(p.scheduledTime)
      return d >= now && d <= end
    })
  }, [sortedPosts])

  const feedPosts = sortedPosts

  const updateReview = async (postId, action, onlyNote = false) => {
    const note = noteDraftByPost[postId] || ''
    setSavingByPost((s) => ({ ...s, [postId]: true }))
    try {
      const payload = onlyNote ? { clientNote: note } : { action, clientNote: note }
      await api.put(`/social-calendars/shared/${token}/posts/${postId}/review`, payload)
      await fetchCalendar()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to update review')
    } finally {
      setSavingByPost((s) => ({ ...s, [postId]: false }))
    }
  }

  const renderDescription = (post) => {
    if (post.contentType === 'Carousel' && Array.isArray(post.carouselItems) && post.carouselItems.length > 0) {
      return (
        <div className='space-y-2'>
          {post.carouselItems.map((item, idx) => (
            <div key={idx} className='border border-gray-200 rounded-lg p-3'>
              <p className='text-xs text-gray-500'>Post {idx + 1}</p>
              <p className='text-sm font-semibold text-gray-900'>{item.subject || '—'}</p>
              <p className='text-sm text-gray-700 whitespace-pre-wrap'>{item.description || '—'}</p>
            </div>
          ))}
        </div>
      )
    }
    return (
      <div>
        {post.subject && <p className='text-sm font-semibold text-gray-900'>{post.subject}</p>}
        <p className='text-sm text-gray-700 whitespace-pre-wrap'>{post.description || '—'}</p>
      </div>
    )
  }

  const isImageSrc = (src = '') => {
    const s = String(src || '').toLowerCase()
    return s.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/.test(s)
  }

  const isVideoSrc = (src = '') => {
    const s = String(src || '').toLowerCase()
    return s.startsWith('data:video/') || /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(s) || s.includes('youtube.com') || s.includes('youtu.be') || s.includes('vimeo.com') || s.includes('instagram.com/reel/') || s.includes('instagram.com/p/')
  }

  const toEmbedUrl = (src = '') => {
    const s = String(src || '')
    if (!s) return ''
    if (s.includes('youtube.com/watch')) {
      const url = new URL(s)
      const v = url.searchParams.get('v')
      return v ? `https://www.youtube.com/embed/${v}` : s
    }
    if (s.includes('youtu.be/')) {
      const id = s.split('youtu.be/')[1]?.split(/[?&]/)[0]
      return id ? `https://www.youtube.com/embed/${id}` : s
    }
    if (s.includes('vimeo.com/')) {
      const id = s.split('vimeo.com/')[1]?.split(/[?&]/)[0]
      return id ? `https://player.vimeo.com/video/${id}` : s
    }
    if (s.includes('instagram.com/reel/')) {
      const id = s.split('instagram.com/reel/')[1]?.split(/[/?#&]/)[0]
      return id ? `https://www.instagram.com/reel/${id}/embed` : s
    }
    if (s.includes('instagram.com/p/')) {
      const id = s.split('instagram.com/p/')[1]?.split(/[/?#&]/)[0]
      return id ? `https://www.instagram.com/p/${id}/embed` : s
    }
    return s
  }

  const mediaCandidates = (post) => {
    const arr = []
    if (post?.referenceUpload?.dataUrl) arr.push(post.referenceUpload.dataUrl)
    if (post?.referenceLink) arr.push(post.referenceLink)
    if (Array.isArray(post?.uploadedLinks)) {
      post.uploadedLinks.forEach((l) => l?.url && arr.push(l.url))
    }
    return arr.filter(Boolean)
  }

  const canRenderMedia = (src) => isImageSrc(src) || isVideoSrc(src)

  const renderMedia = (src, className = 'w-full h-48 object-cover') => {
    if (!src) return null
    if (isImageSrc(src)) {
      return <img src={src} alt='Post media' className={className} />
    }
    if (isVideoSrc(src)) {
      const embedSrc = toEmbedUrl(src)
      if (/\.((mp4|webm|ogg|mov|m4v))(\?.*)?$/i.test(embedSrc) || embedSrc.startsWith('data:video/')) {
        return (
          <video className='w-full h-48 rounded border border-gray-200 bg-black' controls src={embedSrc}>
            Your browser does not support video playback.
          </video>
        )
      }
      return (
        <iframe
          src={embedSrc}
          title='Post video'
          className='w-full h-48 rounded border border-gray-200'
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
          allowFullScreen
        />
      )
    }
    return null
  }

  const postPreviewImage = (post) => {
    if (post?.referenceUpload?.dataUrl) return post.referenceUpload.dataUrl
    if (post?.contentType === 'Carousel' && Array.isArray(post.carouselItems)) {
      const withUpload = post.carouselItems.find((s) => s?.referenceUpload?.dataUrl)
      if (withUpload?.referenceUpload?.dataUrl) return withUpload.referenceUpload.dataUrl
    }
    return ''
  }

  if (loading) return <div className='p-6 text-sm text-gray-600'>Loading shared calendar...</div>
  if (error) return <div className='p-6 text-sm text-red-600'>{error}</div>
  if (!calendar) return <div className='p-6 text-sm text-gray-600'>Calendar not found.</div>

  return (
    <div className='min-h-screen bg-gray-50 p-4 md:p-6'>
      <div className='w-full'>
        <div className='mb-5'>
          <h1 className='text-2xl font-bold text-gray-900'>Client Social Feed</h1>
          <p className='text-sm text-gray-600 mt-1'>
            Client: <span className='font-medium'>{calendar.client?.clientName || '—'}</span>
          </p>
          <div className='mt-3 inline-flex rounded-lg border border-gray-200 p-1 bg-white'>
            <button
              type='button'
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs rounded ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              3 Grid
            </button>
            <button
              type='button'
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs rounded ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              1 Column
            </button>
          </div>
        </div>

        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
          {feedPosts.length === 0 ? (
            <div className='bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600'>
              No social posts available.
            </div>
          ) : (
            feedPosts.map((post) => {
              const noteDraft = noteDraftByPost[post._id] || ''
              const preview = [...mediaCandidates(post), postPreviewImage(post)].find((src) => canRenderMedia(src))
              return (
                viewMode === 'grid' ? (
                  <div key={post._id} className='rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden'>
                    <button
                      type='button'
                      onClick={() => setSelectedPost(post)}
                      className='group relative aspect-square w-full overflow-hidden bg-black text-left hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500'
                    >
                      {preview ? (
                        <div className='h-full w-full'>
                          {renderMedia(preview, 'h-full w-full object-cover')}
                        </div>
                      ) : (
                        <div className='h-full w-full flex items-center justify-center bg-gray-900 text-gray-300 text-sm'>
                          No preview
                        </div>
                      )}
                      <div className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90' />
                      <div className='absolute bottom-0 left-0 right-0 p-3'>
                        <p className='text-sm font-semibold text-white line-clamp-1'>{post.title}</p>
                        <p className='text-[11px] text-gray-200 line-clamp-1'>
                          {post.platform} • {post.contentType || 'Post'}
                        </p>
                      </div>
                      <span className={`absolute top-2 left-2 inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${REVIEW_BADGE[post.clientReviewStatus || 'Pending'] || REVIEW_BADGE.Pending}`}>
                        {post.clientReviewStatus || 'Pending'}
                      </span>
                    </button>
                    <div className='p-2'>
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraftByPost((s) => ({ ...s, [post._id]: e.target.value }))}
                        rows={2}
                        className='w-full border border-gray-300 rounded px-2 py-1.5 text-[11px]'
                        placeholder='Add comment for changes...'
                      />
                      <div className='mt-1.5 flex flex-nowrap gap-1 overflow-x-auto'>
                        <button
                          type='button'
                          onClick={() => updateReview(post._id, undefined, true)}
                          disabled={!!savingByPost[post._id]}
                          className='px-2 py-1 rounded text-[11px] font-medium border border-indigo-600 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 whitespace-nowrap'
                        >
                          {savingByPost[post._id] ? 'Saving...' : 'Save Comment'}
                        </button>
                        <button type='button' onClick={() => updateReview(post._id, 'accept')} disabled={!!savingByPost[post._id]} className='px-2 py-1 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap'>Accept</button>
                        <button type='button' onClick={() => updateReview(post._id, 'reject')} disabled={!!savingByPost[post._id]} className='px-2 py-1 rounded text-[11px] font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap'>Reject</button>
                        <button type='button' onClick={() => updateReview(post._id, 'need_changes')} disabled={!!savingByPost[post._id]} className='px-2 py-1 rounded text-[11px] font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap'>Need Changes</button>
                      </div>
                    </div>
                    <div className='px-2 pb-2'>
                      <p className='text-[11px] text-gray-500'>
                        Scheduled for: {post.scheduledTime ? new Date(post.scheduledTime).toLocaleDateString() : 'Not scheduled'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={post._id} className='bg-white border border-gray-200 rounded-xl p-4 shadow-sm'>
                    <div className='flex flex-wrap items-start justify-between gap-3 mb-3'>
                      <p className='text-xs text-gray-600'>
                        {post.platform} • {post.contentType || 'Post'} • {post.scheduledTime ? new Date(post.scheduledTime).toLocaleString() : 'No schedule'}
                      </p>
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${REVIEW_BADGE[post.clientReviewStatus || 'Pending'] || REVIEW_BADGE.Pending}`}>
                        {post.clientReviewStatus || 'Pending'}
                      </span>
                    </div>

                    <button
                      type='button'
                      onClick={() => setSelectedPost(post)}
                      className='w-full text-left border border-gray-100 rounded-lg overflow-hidden bg-gray-50 hover:border-indigo-300'
                    >
                      {preview ? renderMedia(preview) : (
                        <div className='w-full h-48 flex items-center justify-center bg-gray-100 text-gray-500 text-sm'>
                          No preview
                        </div>
                      )}
                    </button>

                    <div className='mt-3'>
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraftByPost((s) => ({ ...s, [post._id]: e.target.value }))}
                        rows={2}
                        className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                        placeholder='Add note for changes or feedback...'
                      />
                      <div className='mt-2 flex flex-nowrap gap-1.5 overflow-x-auto'>
                        <button
                          type='button'
                          onClick={() => updateReview(post._id, undefined, true)}
                          disabled={!!savingByPost[post._id]}
                          className='px-3 py-1.5 rounded border border-indigo-600 text-indigo-700 text-xs font-medium hover:bg-indigo-50 disabled:opacity-50 whitespace-nowrap'
                        >
                          {savingByPost[post._id] ? 'Saving...' : 'Save Comment'}
                        </button>
                        <button type='button' onClick={() => updateReview(post._id, 'accept')} disabled={!!savingByPost[post._id]} className='px-3 py-1.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap'>Accept</button>
                        <button type='button' onClick={() => updateReview(post._id, 'reject')} disabled={!!savingByPost[post._id]} className='px-3 py-1.5 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap'>Reject</button>
                        <button type='button' onClick={() => updateReview(post._id, 'need_changes')} disabled={!!savingByPost[post._id]} className='px-3 py-1.5 rounded text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap'>Need Changes</button>
                      </div>
                    </div>

                    {Array.isArray(post.uploadedLinks) && post.uploadedLinks.length > 0 && (
                      <div className='border-t border-gray-100 pt-3'>
                        <p className='text-sm font-semibold text-gray-800'>Post is uploaded</p>
                        <div className='mt-2 space-y-1'>
                          {post.uploadedLinks.map((link, idx) => (
                            <div key={`${link.url}-${idx}`} className='text-sm'>
                              <span className='text-gray-500'>{link.platform || 'Platform'}: </span>
                              <a href={link.url} target='_blank' rel='noopener noreferrer' className='text-indigo-600 hover:underline break-all'>
                                {link.url}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className='mt-3 pt-2 border-t border-gray-100'>
                      <p className='text-xs text-gray-500'>
                        Scheduled for: {post.scheduledTime ? new Date(post.scheduledTime).toLocaleDateString() : 'Not scheduled'}
                      </p>
                    </div>
                  </div>
                )
              )
            })
          )}
        </div>

        {selectedPost && (
          <div className='fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center' onClick={() => setSelectedPost(null)}>
            <div className='bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5' onClick={(e) => e.stopPropagation()}>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <h3 className='text-lg font-bold text-gray-900'>{selectedPost.title}</h3>
                  <p className='text-xs text-gray-600 mt-0.5'>
                    {selectedPost.platform} • {selectedPost.contentType || 'Post'} • {selectedPost.scheduledTime ? new Date(selectedPost.scheduledTime).toLocaleString() : 'No schedule'}
                  </p>
                </div>
                <button type='button' onClick={() => setSelectedPost(null)} className='text-gray-500 hover:text-gray-700'>Close</button>
              </div>
              <div className='mt-4'>
                {[...mediaCandidates(selectedPost), postPreviewImage(selectedPost)].find((src) => canRenderMedia(src)) ? (
                  <div className='rounded-lg overflow-hidden border border-gray-200'>
                    {renderMedia(
                      [...mediaCandidates(selectedPost), postPreviewImage(selectedPost)].find((src) => canRenderMedia(src)),
                      'w-full max-h-[380px] object-cover'
                    )}
                  </div>
                ) : (
                  <div className='w-full h-64 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-500 text-sm'>No preview</div>
                )}
              </div>
              <div className='mt-4'>
                {renderDescription(selectedPost)}
              </div>
              <div className='mt-4 text-sm'>
                {selectedPost.referenceLink ? (
                  <a href={selectedPost.referenceLink} target='_blank' rel='noopener noreferrer' className='text-indigo-600 hover:underline break-all'>
                    {selectedPost.referenceLink}
                  </a>
                ) : selectedPost.referenceUpload?.dataUrl ? (
                  <a href={selectedPost.referenceUpload.dataUrl} target='_blank' rel='noopener noreferrer' className='text-indigo-600 hover:underline break-all'>
                    {selectedPost.referenceUpload.fileName || 'Open uploaded reference'}
                  </a>
                ) : (
                  <p className='text-gray-500'>No reference shared.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SocialCalendarClientView
