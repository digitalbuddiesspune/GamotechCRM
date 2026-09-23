import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getDashboardPathForUser } from '../config/dashboardRoutes'
import Logo from '../assets/gamotech-Photoroom.png'

const MailIcon = () => (
  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='w-5 h-5 text-gray-400'>
    <path strokeLinecap='round' strokeLinejoin='round' d='M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75' />
  </svg>
)

const LockIcon = () => (
  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='w-5 h-5 text-gray-400'>
    <path strokeLinecap='round' strokeLinejoin='round' d='M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z' />
  </svg>
)

const EyeIcon = ({ open }) => (
  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='w-5 h-5 text-gray-400'>
    {open ? (
      <path strokeLinecap='round' strokeLinejoin='round' d='M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88' />
    ) : (
      <path strokeLinecap='round' strokeLinejoin='round' d='M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' />
    )}
  </svg>
)

const REMEMBER_KEY = 'crm_remember_email'

const Login = () => {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const appName = typeof document !== 'undefined'
    ? (document.title || 'CRM').replace(/\s*CRM\s*$/i, '').trim() || 'CRM'
    : 'CRM'
  const year = new Date().getFullYear()

  useEffect(() => {
    if (user) navigate(getDashboardPathForUser(user), { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      setEmail(saved)
      setRemember(true)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const loggedInUser = await login(email, password)
      if (remember) localStorage.setItem(REMEMBER_KEY, email)
      else localStorage.removeItem(REMEMBER_KEY)

      const today = new Date().toISOString().slice(0, 10)
      const lastLoginDate = localStorage.getItem('crm_last_login_date')
      if (lastLoginDate !== today) {
        sessionStorage.setItem('crm_show_location_prompt', '1')
        localStorage.setItem('crm_last_login_date', today)
      }
      navigate(getDashboardPathForUser(loggedInUser))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSocial = (provider) => {
    setError('')
    setInfo(`${provider} sign-in is coming soon. Please use email and password.`)
  }

  return (
    <div className='min-h-screen flex flex-col bg-gradient-to-br from-indigo-50 via-white to-violet-50'>
      <div className='flex-1 flex items-center justify-center p-6 sm:p-10'>
        <div className='w-full max-w-md'>
          <div className='bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 p-8 sm:p-10'>
            <div className='flex justify-center mb-8'>
              <img
                src={Logo}
                alt={`${appName} logo`}
                className='max-w-[280px] w-full h-auto object-contain'
              />
            </div>

            <form onSubmit={handleSubmit} className='space-y-5'>
                <div>
                  <label htmlFor='email' className='block text-sm font-semibold text-slate-800 mb-1.5'>Email Address</label>
                  <div className='relative'>
                    <span className='absolute left-3 top-1/2 -translate-y-1/2'><MailIcon /></span>
                    <input
                      id='email'
                      type='email'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete='email'
                      className='w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                      placeholder='Enter your email'
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor='password' className='block text-sm font-semibold text-slate-800 mb-1.5'>Password</label>
                  <div className='relative'>
                    <span className='absolute left-3 top-1/2 -translate-y-1/2'><LockIcon /></span>
                    <input
                      id='password'
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete='current-password'
                      className='w-full border border-gray-200 rounded-xl pl-10 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                      placeholder='Enter your password'
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword((v) => !v)}
                      className='absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100'
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>

                <div className='flex items-center justify-between text-sm'>
                  <label className='flex items-center gap-2 text-gray-600 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className='rounded border-gray-300 text-indigo-600 focus:ring-indigo-500'
                    />
                    Remember me
                  </label>
                  <button
                    type='button'
                    onClick={() => { setError(''); setInfo('Please contact your administrator to reset your password.') }}
                    className='font-medium text-indigo-600 hover:text-indigo-700'
                  >
                    Forgot password?
                  </button>
                </div>

                {error && <p className='text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2'>{error}</p>}
                {info && <p className='text-indigo-700 text-sm bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2'>{info}</p>}

                <button
                  type='submit'
                  disabled={loading}
                  className='w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 shadow-lg shadow-indigo-200'
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className='relative my-8'>
                <div className='absolute inset-0 flex items-center'><div className='w-full border-t border-gray-200' /></div>
                <div className='relative flex justify-center text-xs uppercase'><span className='bg-white px-3 text-gray-400'>or</span></div>
              </div>

              <div className='space-y-3'>
                <button
                  type='button'
                  onClick={() => handleSocial('Google')}
                  className='w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 text-sm font-medium text-slate-700 hover:bg-gray-50 transition-colors'
                >
                  <svg className='w-5 h-5' viewBox='0 0 24 24'><path fill='#4285F4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'/><path fill='#34A853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'/><path fill='#FBBC05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'/><path fill='#EA4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'/></svg>
                  Sign in with Google
                </button>
                <button
                  type='button'
                  onClick={() => handleSocial('Microsoft')}
                  className='w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 text-sm font-medium text-slate-700 hover:bg-gray-50 transition-colors'
                >
                  <svg className='w-5 h-5' viewBox='0 0 23 23'><path fill='#f35325' d='M1 1h10v10H1z'/><path fill='#81bc06' d='M12 1h10v10H12z'/><path fill='#05a6f0' d='M1 12h10v10H1z'/><path fill='#ffba08' d='M12 12h10v10H12z'/></svg>
                  Sign in with Microsoft
                </button>
              </div>

             
          </div>
        </div>
      </div>

      <p className='text-center text-xs text-gray-400 pb-6'>
        © {year} {appName} CRM. All rights reserved.
      </p>
    </div>
  )
}

export default Login
