import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { setToken, setUserInfo } from '../lib/auth'
import { SPLASH_STORAGE_KEY } from '../components/SplashScreen'

interface LoginProps {
  onLogin: () => void
}

interface LoginResponse {
  access_token: string
  user_name: string
  is_admin: boolean
}

export default function Login({ onLogin }: LoginProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Auto-focus after form animation completes (~900ms)
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 900)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post<LoginResponse>('/auth/login', { password })
      setToken(response.access_token)
      setUserInfo({ name: response.user_name, is_admin: response.is_admin })

      // Clear splash flag so it plays after login
      sessionStorage.removeItem(SPLASH_STORAGE_KEY)

      // Fade out login page
      setFadingOut(true)
      setTimeout(() => {
        onLogin()
        navigate('/', { replace: true })
      }, 300)
    } catch {
      setError('Invalid password')
      setLoading(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center ${fadingOut ? 'login-fade-out' : ''}`}
      style={{ background: '#0d1b2a' }}
    >
      {/* Ambient glow */}
      <div
        className="pulse-glow"
        style={{
          position: 'absolute',
          top: '28%',
          left: '50%',
          width: 220,
          height: 220,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%)',
          filter: 'blur(30px)',
          zIndex: 1,
        }}
      />

      {/* SVG animation */}
      <svg
        width="220"
        height="200"
        viewBox="0 0 220 200"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible', marginBottom: 24, position: 'relative', zIndex: 2 }}
      >
        <defs>
          <linearGradient id="lgG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="l-shim-s" />
            <stop offset="100%" className="l-shim-e" />
          </linearGradient>
        </defs>

        {/* Orbit track */}
        <circle
          className="login-track-in"
          cx="110" cy="85" r="52"
          fill="none" stroke="#1e3a52" strokeWidth="1"
          strokeDasharray="3 7" opacity="0"
        />

        {/* Pulse ring */}
        <circle
          className="login-pulse"
          cx="110" cy="85" r="8"
          fill="none" stroke="url(#lgG)" strokeWidth="3"
          opacity="0"
        />

        {/* Orbiting dots */}
        <g className="login-orbit-1" style={{ transformOrigin: '110px 85px' }}>
          <circle className="login-d1-entry" cx="110" cy="85" r="3" fill="#0ea5e9" opacity="0" />
        </g>
        <g className="login-orbit-2" style={{ transformOrigin: '110px 85px' }}>
          <circle className="login-d2-entry" cx="110" cy="85" r="2.2" fill="#8b5cf6" opacity="0" />
        </g>
        <g className="login-orbit-3" style={{ transformOrigin: '110px 85px' }}>
          <circle className="login-d3-entry" cx="110" cy="85" r="1.8" fill="#22d3ee" opacity="0" />
        </g>

        {/* Logo P-mark layers */}
        <g transform="translate(72, 47) scale(0.76)">
          <path
            className="login-lb-in"
            d="M36 80 L36 24 L58 24 C69 24 76 31 76 40 C76 49 69 56 58 56 L48 56 L48 80 Z M48 34 L56 34 C62 34 64 37 64 40 C64 43 62 46 56 46 L48 46 Z"
            fill="url(#lgG)" opacity="0"
          />
          <path
            className="login-lm-in"
            d="M33 78 L33 22 L55 22 C66 22 73 29 73 38 C73 47 66 54 55 54 L45 54 L45 78 Z M45 32 L53 32 C59 32 61 35 61 38 C61 41 59 44 53 44 L45 44 Z"
            fill="url(#lgG)" opacity="0"
          />
          <path
            className="login-lf-in"
            d="M30 76 L30 20 L52 20 C63 20 70 27 70 36 C70 45 63 52 52 52 L42 52 L42 76 Z M42 30 L50 30 C56 30 58 33 58 36 C58 39 56 42 50 42 L42 42 Z"
            fill="url(#lgG)" opacity="0"
          />
        </g>

        {/* Wordmark */}
        <text
          className="login-word-in"
          x="110" y="170"
          fontFamily="Inter, sans-serif" fontSize="26" fontWeight="700"
          fill="url(#lgG)" textAnchor="middle" opacity="0"
        >
          Protocol
        </text>
      </svg>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="login-form-in"
        style={{ width: '100%', maxWidth: 295, padding: '0 20px', opacity: 0, position: 'relative', zIndex: 2 }}
      >
        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (error) setError('')
          }}
          placeholder="Password"
          style={{
            width: '100%',
            background: '#162a3e',
            border: '1.5px solid #1e3a52',
            borderRadius: 12,
            padding: '14px 16px',
            color: '#e2e8f0',
            fontSize: 14,
            fontWeight: 500,
            outline: 'none',
            textAlign: 'center',
            letterSpacing: '0.05em',
            marginBottom: 12,
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#0ea5e9'
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1), 0 0 20px rgba(14,165,233,0.05)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#1e3a52'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />

        {error && (
          <p className="text-red-400 text-sm text-center mb-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading || !password ? 'default' : 'pointer',
            transition: 'all 0.2s ease',
            background: 'transparent',
            color: '#0ea5e9',
            border: '1.5px solid rgba(14,165,233,0.25)',
            opacity: loading || !password ? 0.5 : 1,
          }}
        >
          {loading ? 'Signing in...' : 'Enter'}
        </button>
      </form>

      {/* Footer */}
      <div
        className="login-footer-in"
        style={{
          position: 'absolute',
          bottom: 44,
          opacity: 0,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: '#334155',
        }}
      >
        protocol-42.com
      </div>
    </div>
  )
}
