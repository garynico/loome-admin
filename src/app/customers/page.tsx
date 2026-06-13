'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { differenceInDays, parseISO, format } from 'date-fns'
import { id } from 'date-fns/locale'
import type { Customer } from '@/types'
import BottomNav from '@/components/BottomNav'

type Tab = 'all' | 'followup'

interface FollowupCustomer extends Customer {
  last_booking_date: string | null
  last_service: string | null
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return '62' + digits.slice(1)
  if (digits.startsWith('62')) return digits
  return '62' + digits
}

export default function CustomersPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [followups, setFollowups] = useState<FollowupCustomer[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`)
    if (res.ok) setCustomers(await res.json())
    setLoading(false)
  }, [])

  const loadFollowups = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/customers?followup=true')
    if (res.ok) setFollowups(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'all') {
      const timer = setTimeout(() => search(query), 300)
      return () => clearTimeout(timer)
    }
  }, [query, search, tab])

  useEffect(() => {
    if (tab === 'followup') loadFollowups()
  }, [tab, loadFollowups])

  function waFollowupLink(c: FollowupCustomer) {
    const msg = `Halo ${c.name}! 👋\n\nSudah lama tidak bertemu ya! Kami kangen sama kamu di Loome Hair Removal 💚\n\nYuk jadwalkan sesi hair removal berikutnya! Hubungi kami untuk info lebih lanjut ya kak 😊`
    return `https://wa.me/${formatPhone(c.phone)}?text=${encodeURIComponent(msg)}`
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="px-4 pt-4 pb-0 border-b border-gray-100">
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

        {/* Tabs */}
        <div className="flex gap-1">
          {([['all', 'Semua'], ['followup', 'Perlu Follow Up']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-2 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: tab === t ? '#2D5A3D' : 'transparent',
                color: tab === t ? '#2D5A3D' : '#6b7280',
              }}
            >
              {label}
              {t === 'followup' && followups.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-600 font-semibold">
                  {followups.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {tab === 'all' && (
        <div className="px-4 py-2.5 border-b border-gray-100">
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
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-[#2D5A3D] border-t-transparent animate-spin" />
          </div>
        ) : tab === 'all' ? (
          customers.length === 0 ? (
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
                      <span className="text-sm font-bold text-[#2D5A3D]">{c.name.charAt(0).toUpperCase()}</span>
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
          )
        ) : (
          followups.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-500">Semua pelanggan sudah kembali</p>
              <p className="text-xs text-gray-400 mt-1">Tidak ada yang perlu di-follow up</p>
            </div>
          ) : (
            <>
              <p className="px-4 pt-3 pb-1 text-xs text-gray-400">
                {followups.length} pelanggan belum kembali dalam 30 hari terakhir
              </p>
              <ul>
                {followups.map(c => {
                  const days = c.last_booking_date
                    ? differenceInDays(new Date(), parseISO(c.last_booking_date))
                    : null
                  return (
                    <li key={c.id} className="border-b border-gray-50">
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <button
                          onClick={() => router.push(`/customers/${c.id}`)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70"
                        >
                          <div className="w-10 h-10 rounded-full bg-[#E8F0EA] flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-[#2D5A3D]">{c.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                            {c.last_booking_date ? (
                              <>
                                <p className="text-xs text-orange-500 font-medium mt-0.5">
                                  {days} hari lalu · {format(parseISO(c.last_booking_date), 'd MMM yyyy', { locale: id })}
                                </p>
                                {c.last_service && (
                                  <p className="text-xs text-gray-400 truncate mt-0.5">{c.last_service}</p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5">Belum pernah booking</p>
                            )}
                          </div>
                        </button>
                        <a
                          href={waFollowupLink(c)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold active:opacity-70"
                          style={{ background: '#E8F0EA', color: '#2D5A3D' }}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.523 5.847L.057 23.428a.5.5 0 00.609.61l5.68-1.459A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.67-.5-5.21-1.373l-.374-.217-3.87.994.998-3.774-.237-.389A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                          </svg>
                          WA
                        </a>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )
        )}
      </div>

      <BottomNav active="customers" />
    </div>
  )
}
