'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (res.ok) {
      router.push('/calendar')
    } else {
      setError('Username atau password salah')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <div className="w-40 h-40 rounded-2xl overflow-hidden bg-[#2D5A3D]">
            <Image
              src="/logo.jpeg"
              alt="Loome"
              width={160}
              height={160}
              className="w-full h-full object-cover"
              priority
            />
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-1">
          Admin Panel
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          Loome Hair Removal & Etc
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:border-transparent text-base"
              placeholder="Username"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] focus:border-transparent text-base"
              placeholder="Password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#2D5A3D] text-white font-semibold text-base disabled:opacity-60 active:opacity-80 transition-opacity mt-2"
          >
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
