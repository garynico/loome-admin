'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function NewCustomerForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, gender: gender || null }),
    })

    if (res.ok) {
      const customer = await res.json()
      if (redirectTo === 'booking') {
        router.push(`/bookings/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.name)}`)
      } else {
        router.push(`/customers/${customer.id}`)
      }
    } else {
      const data = await res.json()
      setError(data.error ?? 'Terjadi kesalahan')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500 active:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Pelanggan Baru</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-4 py-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
            placeholder="Nama pelanggan"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nomor WhatsApp</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
            placeholder="08xxxxxxxxxx"
            required
          />
          <p className="text-xs text-gray-400 mt-1.5">Format: 08xxxxxxxxxx atau +62xxxxxxxxx</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Kelamin</label>
          <div className="grid grid-cols-2 gap-2">
            {(['female', 'male'] as const).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(gender === g ? '' : g)}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all active:opacity-80"
                style={{
                  borderColor: gender === g ? '#2D5A3D' : '#e5e7eb',
                  background: gender === g ? '#E8F0EA' : '#fff',
                  color: gender === g ? '#2D5A3D' : '#6b7280',
                }}
              >
                <span>{g === 'female' ? '♀' : '♂'}</span>
                {g === 'female' ? 'Wanita' : 'Pria'}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-[#2D5A3D] text-white font-semibold text-base disabled:opacity-60 active:opacity-80"
        >
          {loading ? 'Menyimpan...' : 'Simpan Pelanggan'}
        </button>
      </form>
    </div>
  )
}

export default function NewCustomerPage() {
  return (
    <Suspense>
      <NewCustomerForm />
    </Suspense>
  )
}
