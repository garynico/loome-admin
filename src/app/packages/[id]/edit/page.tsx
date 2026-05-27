'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Service, Package } from '@/types'

function formatPrice(price: number) {
  if (!price) return ''
  return new Intl.NumberFormat('id-ID').format(price)
}

export default function EditPackagePage() {
  const router = useRouter()
  const { id: packageId } = useParams<{ id: string }>()
  const [services, setServices] = useState<Service[]>([])
  const [name, setName] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [sessions, setSessions] = useState('')
  const [priceRaw, setPriceRaw] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [svcRes, pkgRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/packages'),
      ])
      if (svcRes.ok) setServices(await svcRes.json())
      if (pkgRes.ok) {
        const pkgs: Package[] = await pkgRes.json()
        const pkg = pkgs.find(p => p.id === packageId)
        if (pkg) {
          setName(pkg.name)
          setServiceId(pkg.service_id ?? '')
          setSessions(String(pkg.sessions))
          setPriceRaw(String(pkg.price))
        }
      }
      setLoading(false)
    }
    load()
  }, [packageId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = Number(priceRaw)
    const sess = Number(sessions)
    if (!name.trim() || !sess || !price) {
      setError('Nama, jumlah sesi, dan harga wajib diisi')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/packages/${packageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), service_id: serviceId || null, sessions: sess, price }),
    })
    if (res.ok) {
      router.push('/services?tab=packages')
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
        <h1 className="text-lg font-bold text-gray-900">Edit Paket</h1>
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Layanan yang Dicakup</label>
          <select
            value={serviceId}
            onChange={e => setServiceId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
          >
            <option value="">— Pilih layanan (opsional) —</option>
            {services.map(s => (
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
