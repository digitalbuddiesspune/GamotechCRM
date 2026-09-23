import React, { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const getCurrentEmployeeId = (user) => user?._id || user?.id || null

const ChatFloatingButton = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  const employeeId = getCurrentEmployeeId(user)
  const isOnChatPage = location.pathname === '/module/chat'

  const fetchUnreadCount = useCallback(async () => {
    if (!employeeId) return
    try {
      const res = await api.get('/chat/team', { params: { employeeId } })
      setUnreadCount(Number(res.data?.conversation?.unreadCount) || 0)
    } catch {
      setUnreadCount(0)
    }
  }, [employeeId])

  useEffect(() => {
    if (!employeeId || isOnChatPage) return undefined
    fetchUnreadCount()
    const intervalId = setInterval(fetchUnreadCount, 5000)
    return () => clearInterval(intervalId)
  }, [employeeId, isOnChatPage, fetchUnreadCount])

  useEffect(() => {
    if (isOnChatPage) setUnreadCount(0)
  }, [isOnChatPage])

  if (!user || !employeeId || isOnChatPage) return null

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <button
      type='button'
      onClick={() => navigate('/module/chat')}
      className='fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center hover:shadow-xl hover:scale-105 transition-all focus:outline-none focus:ring-2 focus:ring-[#128c7e] focus:ring-offset-2'
      aria-label={unreadCount > 0 ? `Open team chat, ${unreadCount} unread` : 'Open team chat'}
      title='Team chat'
    >
      <img src='/chat-bot.svg' alt='' className='w-12 h-12 object-contain pointer-events-none' />
      {unreadCount > 0 && (
        <span className='absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold shadow'>
          {badgeLabel}
        </span>
      )}
    </button>
  )
}

export default ChatFloatingButton
