'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Customer } from '@/types'
import BottomNav from '@/components/BottomNav'

export default function CustomersPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`)
    if (res.ok) setCustomers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Pelanggan</h1>
          <button
            onClick={() => router.push('/customers/new')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#2D5A3D] text-white text-sm font-medium rounded-xl active:opacity-80"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Tambah
          </button>
        </div>
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari nama atau nomor HP..."
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-[#2D5A3D] border-t-transparent animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">{query ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'}</p>
          </div>
        ) : (
          <ul>
            {customers.map(c => (
              <li key={c.id}>
                <button
                  onClick={() => router.push(`/customers/${c.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 active:bg-gray-50 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-[#E8F0EA] flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#2D5A3D]">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.phone}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav active="customers" />
    </div>
  )
}

