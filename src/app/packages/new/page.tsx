'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Service } from '@/types'

function formatPrice(price: number) {
  if (!price) return ''
  return new Intl.NumberFormat('id-ID').format(price)
}

export default function NewPackagePage() {
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [name, setName] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [genderTarget, setGenderTarget] = useState<'male' | 'female' | 'all'>('all')
  const [sessions, setSessions] = useState('')
  const [priceRaw, setPriceRaw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(setServices)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = Number(priceRaw)
    const sess = Number(sessions)
    if (!name.trim() || !sess || !price) {
      setError('Nama, jumlah sesi, dan harga wajib diisi')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), service_id: serviceId || null, sessions: sess, price, gender_target: genderTarget }),
    })
    if (res.ok) {
      router.push('/services?tab=packages')
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
        <h1 className="text-lg font-bold text-gray-900">Paket Baru</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-4 py-6 space-y-5 overflow-y-auto">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Paket</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
            placeholder="Contoh: Brazilian 12x, Full Leg 10x..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender Paket</label>
          <div className="grid grid-cols-3 gap-2">
            {(['all', 'female', 'male'] as const).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => { setGenderTarget(g); setServiceId('') }}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl border text-sm font-semibold transition-all active:opacity-80"
                style={{
                  borderColor: genderTarget === g ? '#2D5A3D' : '#e5e7eb',
                  background: genderTarget === g ? '#E8F0EA' : '#fff',
                  color: genderTarget === g ? '#2D5A3D' : '#6b7280',
                }}
              >
                {g === 'all' ? 'Semua' : g === 'female' ? '♀ Wanita' : '♂ Pria'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Layanan yang Dicakup</label>
          <select
            value={serviceId}
            onChange={e => setServiceId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
          >
            <option value="">— Pilih layanan (opsional) —</option>
            {services
              .filter(s => genderTarget === 'all' || s.gender_target === 'all' || s.gender_target === genderTarget)
              .map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Jumlah Sesi</label>
          <input
            type="number"
            inputMode="numeric"
            value={sessions}
            onChange={e => setSessions(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
            placeholder="12"
            min={1}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Harga Paket (IDR)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={priceRaw ? formatPrice(Number(priceRaw)) : ''}
              onChange={e => setPriceRaw(e.target.value.replace(/\D/g, ''))}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
              placeholder="1.800.000"
              required
            />
          </div>
        </div>

        {name && sessions && priceRaw && (
          <div className="p-4 rounded-2xl bg-[#E8F0EA]">
            <p className="text-xs font-semibold text-[#2D5A3D] uppercase tracking-wide mb-2">Preview</p>
            <p className="text-sm font-semibold text-gray-900">{name}</p>
            {serviceId && <p className="text-xs text-gray-500 mt-0.5">{services.find(s => s.id === serviceId)?.name}</p>}
            <p className="text-sm text-gray-600 mt-0.5">{sessions} sesi · Rp {formatPrice(Number(priceRaw))}</p>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-[#2D5A3D] text-white font-semibold text-base disabled:opacity-60 active:opacity-80"
        >
          {loading ? 'Menyimpan...' : 'Simpan Paket'}
        </button>
      </form>
    </div>
  )
}
