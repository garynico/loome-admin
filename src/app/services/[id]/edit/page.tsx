'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Service } from '@/types'

function formatPrice(price: number) {
  if (!price) return ''
  return new Intl.NumberFormat('id-ID').format(price)
}

export default function EditServicePage() {
  const router = useRouter()
  const { id: serviceId } = useParams<{ id: string }>()

  const [name, setName] = useState('')
  const [priceRaw, setPriceRaw] = useState('')
  const [genderTarget, setGenderTarget] = useState<'all' | 'female' | 'male'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/services')
      if (res.ok) {
        const services: Service[] = await res.json()
        const s = services.find(x => x.id === serviceId)
        if (s) {
          setName(s.name)
          setPriceRaw(String(s.price))
          setGenderTarget(s.gender_target ?? 'all')
        }
      }
      setLoading(false)
    }
    load()
  }, [serviceId])

  function handlePriceChange(val: string) {
    setPriceRaw(val.replace(/\D/g, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = Number(priceRaw)
    if (!name.trim() || !price) {
      setError('Nama dan harga wajib diisi')
      return
    }
    setSaving(true)
    setError('')

    const res = await fetch(`/api/services/${serviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), price, gender_target: genderTarget }),
    })

    if (res.ok) {
      router.push('/services')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Terjadi kesalahan')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-6 h-6 rounded-full border-2 border-[#2D5A3D] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500 active:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Edit Layanan</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-4 py-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Layanan</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
            placeholder="Contoh: Underarm, Full Leg, Bikini..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Harga (IDR)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={priceRaw ? formatPrice(Number(priceRaw)) : ''}
              onChange={e => handlePriceChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
              placeholder="150.000"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Untuk Gender</label>
          <div className="grid grid-cols-3 gap-2">
            {(['all', 'female', 'male'] as const).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGenderTarget(g)}
                className="py-2.5 rounded-xl border text-sm font-semibold transition-all active:opacity-80"
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

        {name && priceRaw && (
          <div className="p-4 rounded-2xl bg-[#E8F0EA]">
            <p className="text-xs font-semibold text-[#2D5A3D] uppercase tracking-wide mb-2">Preview</p>
            <p className="text-sm font-semibold text-gray-900">{name}</p>
            <p className="text-sm text-gray-600">Rp {formatPrice(Number(priceRaw))}</p>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-[#2D5A3D] text-white font-semibold text-base disabled:opacity-60 active:opacity-80"
        >
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </form>
    </div>
  )
}
