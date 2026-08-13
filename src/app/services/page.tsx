'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Service, Package } from '@/types'
import BottomNav from '@/components/BottomNav'

function formatPrice(price: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price)
}

function ServicesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'services' | 'packages'>(
    searchParams.get('tab') === 'packages' ? 'packages' : 'services'
  )

  const [services, setServices] = useState<Service[]>([])
  const [loadingSvc, setLoadingSvc] = useState(true)
  const [deletingSvc, setDeletingSvc] = useState<string | null>(null)

  const [packages, setPackages] = useState<Package[]>([])
  const [loadingPkg, setLoadingPkg] = useState(false)
  const [deletingPkg, setDeletingPkg] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const filteredServices = q ? services.filter(s => s.name.toLowerCase().includes(q)) : services
  const filteredPackages = q
    ? packages.filter(p => p.name.toLowerCase().includes(q) || (p.service?.name.toLowerCase().includes(q) ?? false))
    : packages

  async function loadServices() {
    setLoadingSvc(true)
    const res = await fetch('/api/services')
    if (res.ok) setServices(await res.json())
    setLoadingSvc(false)
  }

  async function loadPackages() {
    setLoadingPkg(true)
    const res = await fetch('/api/packages')
    if (res.ok) setPackages(await res.json())
    setLoadingPkg(false)
  }

  useEffect(() => { loadServices() }, [])
  useEffect(() => { if (tab === 'packages') loadPackages() }, [tab])

  async function handleDeleteService(id: string, name: string) {
    if (!confirm(`Nonaktifkan layanan "${name}"?`)) return
    setDeletingSvc(id)
    await fetch(`/api/services/${id}`, { method: 'DELETE' })
    await loadServices()
    setDeletingSvc(null)
  }

  async function handleDeletePackage(id: string, name: string) {
    if (!confirm(`Nonaktifkan paket "${name}"?`)) return
    setDeletingPkg(id)
    await fetch(`/api/packages/${id}`, { method: 'DELETE' })
    await loadPackages()
    setDeletingPkg(null)
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">Layanan</h1>
        <button
          onClick={() => router.push(tab === 'services' ? '/services/new' : '/packages/new')}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#2D5A3D] text-white text-sm font-medium rounded-xl active:opacity-80"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Tambah
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-100">
        {(['services', 'packages'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: tab === t ? '#2D5A3D' : '#f3f4f6',
              color: tab === t ? '#fff' : '#6b7280',
            }}
          >
            {t === 'services' ? 'Layanan' : 'Paket'}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pt-3">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
            placeholder={tab === 'services' ? 'Cari layanan...' : 'Cari paket...'}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {tab === 'services' ? (
          loadingSvc ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 rounded-full border-2 border-[#2D5A3D] border-t-transparent animate-spin" />
            </div>
          ) : services.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">Belum ada layanan</p>
              <button onClick={() => router.push('/services/new')} className="px-4 py-2 bg-[#2D5A3D] text-white text-sm font-medium rounded-xl active:opacity-80">
                Tambah Layanan
              </button>
            </div>
          ) : filteredServices.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-16">Tidak ada layanan &quot;{search}&quot;</p>
          ) : (
            <div className="px-4 py-4">
              {(['female', 'male', 'all'] as const).map(gender => {
                const group = filteredServices.filter(s => s.gender_target === gender)
                if (group.length === 0) return null
                const label = gender === 'female' ? '♀ Wanita' : gender === 'male' ? '♂ Pria' : '✦ Semua Gender'
                const labelColor = gender === 'female' ? '#be185d' : gender === 'male' ? '#1d4ed8' : '#6b7280'
                const lineColor = gender === 'female' ? '#fce7f3' : gender === 'male' ? '#eff6ff' : '#f3f4f6'
                return (
                  <div key={gender} className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: labelColor }}>{label}</span>
                      <div className="flex-1 h-px" style={{ background: lineColor }} />
                      <span className="text-xs text-gray-400">{group.length} layanan</span>
                    </div>
                    <div className="space-y-3">
                      {group.map(s => (
                        <div key={s.id} className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100">
                          <div className="w-10 h-10 rounded-xl bg-[#E8F0EA] flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-[#2D5A3D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                            <p className="text-sm font-semibold text-[#2D5A3D] mt-0.5">{formatPrice(s.price)}</p>
                          </div>
                          <button onClick={() => router.push(`/services/${s.id}/edit`)} className="p-2 text-gray-400 active:text-[#2D5A3D]">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDeleteService(s.id, s.name)} disabled={deletingSvc === s.id} className="p-2 text-gray-300 active:text-red-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          loadingPkg ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 rounded-full border-2 border-[#2D5A3D] border-t-transparent animate-spin" />
            </div>
          ) : packages.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm">Belum ada paket</p>
              <button onClick={() => router.push('/packages/new')} className="px-4 py-2 bg-[#2D5A3D] text-white text-sm font-medium rounded-xl active:opacity-80">
                Tambah Paket
              </button>
            </div>
          ) : filteredPackages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-16">Tidak ada paket &quot;{search}&quot;</p>
          ) : (
            <div className="px-4 py-4">
              {(['female', 'male', 'all'] as const).map(gender => {
                const group = filteredPackages.filter(p => (p.gender_target ?? 'all') === gender)
                if (group.length === 0) return null
                const label = gender === 'female' ? '♀ Wanita' : gender === 'male' ? '♂ Pria' : '✦ Semua Gender'
                const labelColor = gender === 'female' ? '#be185d' : gender === 'male' ? '#1d4ed8' : '#6b7280'
                const lineColor = gender === 'female' ? '#fce7f3' : gender === 'male' ? '#eff6ff' : '#f3f4f6'
                return (
                  <div key={gender} className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: labelColor }}>{label}</span>
                      <div className="flex-1 h-px" style={{ background: lineColor }} />
                      <span className="text-xs text-gray-400">{group.length} paket</span>
                    </div>
                    <div className="space-y-3">
                      {group.map(p => (
                        <div key={p.id} className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100">
                          <div className="w-10 h-10 rounded-xl bg-[#E8F0EA] flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-[#2D5A3D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{p.service?.name ?? 'Semua layanan'} · {p.sessions}x</p>
                            <p className="text-sm font-semibold text-[#2D5A3D] mt-0.5">{formatPrice(p.price)}</p>
                          </div>
                          <button onClick={() => router.push(`/packages/${p.id}/edit`)} className="p-2 text-gray-400 active:text-[#2D5A3D]">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDeletePackage(p.id, p.name)} disabled={deletingPkg === p.id} className="p-2 text-gray-300 active:text-red-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      <BottomNav active="services" />
    </div>
  )
}

export default function ServicesPage() {
  return (
    <Suspense>
      <ServicesContent />
    </Suspense>
  )
}

