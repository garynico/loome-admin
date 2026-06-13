'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, subMonths, addMonths, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import type { BookingWithRelations, CustomerPackage } from '@/types'
import BottomNav from '@/components/BottomNav'

const CORRECT_PIN = '020422'

function formatPrice(p: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(p)
}

function formatShort(p: number) {
  if (p >= 1_000_000_000) return `${(p / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(1).replace(/\.0$/, '')}jt`
  if (p >= 1_000) return `${Math.round(p / 1_000)}rb`
  return p.toString()
}

function bookingTotal(b: BookingWithRelations): number {
  const svcList = b.services?.length ? b.services : b.service ? [b.service] : []
  return b.custom_price ?? svcList.reduce((s, x) => s + x.price, 0)
}

export default function DashboardPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [shake, setShake] = useState(false)

  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [pkgPurchases, setPkgPurchases] = useState<CustomerPackage[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(format(now, 'yyyy-MM'))
  const [txnExpanded, setTxnExpanded] = useState(false)

  async function fetchData() {
    const [b, p] = await Promise.all([
      fetch('/api/bookings').then(r => r.ok ? r.json() : []),
      fetch('/api/customer-packages').then(r => r.ok ? r.json() : []),
    ])
    setBookings(b)
    setPkgPurchases(p)
    setLoading(false)
  }

  useEffect(() => {
    if (!unlocked) return
    fetchData()
  }, [unlocked])

  useEffect(() => {
    if (!unlocked) return
    function onVisible() {
      if (document.visibilityState === 'visible') fetchData()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [unlocked])

  function handleDigit(d: string) {
    if (pin.length >= 6) return
    const next = pin + d
    setPin(next)
    if (next.length === 6) {
      if (next === CORRECT_PIN) {
        setTimeout(() => setUnlocked(true), 150)
      } else {
        setShake(true)
        setTimeout(() => { setPin(''); setShake(false) }, 600)
      }
    }
  }

  function handleDelete() { setPin(p => p.slice(0, -1)) }

  function prevMonth() {
    const d = subMonths(new Date(selectedMonth + '-01'), 1)
    setSelectedMonth(format(d, 'yyyy-MM'))
    setTxnExpanded(false)
  }

  function nextMonth() {
    const d = addMonths(new Date(selectedMonth + '-01'), 1)
    if (d <= now) { setSelectedMonth(format(d, 'yyyy-MM')); setTxnExpanded(false) }
  }

  const isCurrentMonth = selectedMonth === format(now, 'yyyy-MM')

  const trendMonths = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => format(subMonths(now, 5 - i), 'yyyy-MM')),
  [])

  function monthRevenue(m: string) {
    const bookingRev = bookings
      .filter(b => b.status === 'completed' && b.date?.startsWith(m))
      .reduce((sum, b) => sum + bookingTotal(b), 0)
    const pkgRev = pkgPurchases
      .filter(p => p.purchased_at.startsWith(m) && p.status !== 'cancelled')
      .reduce((sum, p) => sum + p.paid_price, 0)
    return bookingRev + pkgRev
  }

  const trendData = useMemo(() =>
    trendMonths.map(m => ({ month: m, revenue: monthRevenue(m) })),
    [trendMonths, bookings, pkgPurchases]
  )

  const maxTrend = Math.max(...trendData.map(d => d.revenue), 1)

  // All-time total
  const allTimeRev = useMemo(() => {
    const bRev = bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + bookingTotal(b), 0)
    const pRev = pkgPurchases.filter(p => p.status !== 'cancelled').reduce((sum, p) => sum + p.paid_price, 0)
    return bRev + pRev
  }, [bookings, pkgPurchases])

  const metrics = useMemo(() => {
    const completed = bookings.filter(b => b.status === 'completed' && b.date?.startsWith(selectedMonth))
    const confirmed = bookings.filter(b => b.status === 'confirmed' && b.date?.startsWith(selectedMonth))
    const cancelled = bookings.filter(b => b.status === 'cancelled' && b.date?.startsWith(selectedMonth))
    const monthPkgs = pkgPurchases.filter(p => p.purchased_at.startsWith(selectedMonth) && p.status !== 'cancelled')

    const bookingRev = completed.reduce((sum, b) => sum + bookingTotal(b), 0)
    const pkgRev = monthPkgs.reduce((sum, p) => sum + p.paid_price, 0)
    const totalRev = bookingRev + pkgRev
    const avg = completed.length > 0 ? Math.round(bookingRev / completed.length) : 0
    const totalBooked = completed.length + cancelled.length
    const cancelRate = totalBooked > 0 ? Math.round((cancelled.length / totalBooked) * 100) : 0

    // MoM comparison
    const prevMonthStr = format(subMonths(new Date(selectedMonth + '-01'), 1), 'yyyy-MM')
    const prevRev = monthRevenue(prevMonthStr)
    const momGrowth = prevRev > 0 ? Math.round(((totalRev - prevRev) / prevRev) * 100) : null

    // Outstanding DP
    const outstanding = bookings.filter(b => b.dp_amount > 0 && b.status !== 'completed' && b.status !== 'cancelled')
    const outstandingTotal = outstanding.reduce((sum, b) => sum + (bookingTotal(b) - b.dp_amount), 0)

    // Service breakdown
    const svcMap: Record<string, { name: string; count: number; revenue: number }> = {}
    for (const b of completed) {
      const svcList = b.services?.length ? b.services : b.service ? [b.service] : []
      for (const s of svcList) {
        if (!svcMap[s.id]) svcMap[s.id] = { name: s.name, count: 0, revenue: 0 }
        svcMap[s.id].count++
        svcMap[s.id].revenue += s.price
      }
    }
    const svcBreakdown = Object.values(svcMap).sort((a, b) => b.count - a.count)
    const maxSvcCount = Math.max(...svcBreakdown.map(s => s.count), 1)

    return {
      totalRev, bookingRev, pkgRev, avg,
      completedCount: completed.length,
      confirmedCount: confirmed.length,
      cancelledCount: cancelled.length,
      cancelRate,
      pkgCount: monthPkgs.length,
      outstanding, outstandingTotal,
      svcBreakdown, maxSvcCount,
      momGrowth, prevRev,
    }
  }, [bookings, pkgPurchases, selectedMonth])

  // Combined transaction list for selected month, newest first
  const transactions = useMemo(() => {
    const bookingTxns = bookings
      .filter(b => b.status === 'completed' && b.date?.startsWith(selectedMonth))
      .map(b => ({
        id: b.id,
        type: 'booking' as const,
        customerName: b.customer?.name ?? '—',
        label: (b.services?.length ? b.services.map(s => s.name).join(', ') : b.service?.name) ?? 'Layanan',
        amount: bookingTotal(b),
        date: b.date!,
        sortKey: b.date! + (b.time ?? '99:99'),
      }))
    const pkgTxns = pkgPurchases
      .filter(p => p.purchased_at.startsWith(selectedMonth) && p.status !== 'cancelled')
      .map(p => ({
        id: p.id,
        type: 'package' as const,
        customerName: p.customer?.name ?? '—',
        label: p.package_name,
        amount: p.paid_price,
        date: p.purchased_at.slice(0, 10),
        sortKey: p.purchased_at,
      }))
    return [...bookingTxns, ...pkgTxns].sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  }, [bookings, pkgPurchases, selectedMonth])

  const TXN_PREVIEW = 5
  const visibleTxns = txnExpanded ? transactions : transactions.slice(0, TXN_PREVIEW)

  const monthLabel = format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: id })

  // ── PIN screen ──────────────────────────────────────────────────────────────
  if (!unlocked) {
    const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#1a3528]">
        <div className="flex flex-col items-center gap-8 w-full max-w-xs px-6">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-white text-xl font-bold">Ringkasan Bisnis</h1>
            <p className="text-white/50 text-sm mt-1">Masukkan PIN untuk melanjutkan</p>
          </div>
          <div className={`flex gap-4 ${shake ? 'animate-bounce' : ''}`}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="w-3.5 h-3.5 rounded-full transition-all duration-150"
                style={{ background: i < pin.length ? '#ffffff' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 w-full">
            {keys.map((k, i) => {
              if (k === '') return <div key={i} />
              if (k === '⌫') return (
                <button key={i} onClick={handleDelete}
                  className="h-16 rounded-2xl bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                  </svg>
                </button>
              )
              return (
                <button key={i} onClick={() => handleDigit(k)}
                  className="h-16 rounded-2xl bg-white/10 text-white text-2xl font-light active:bg-white/25 transition-colors">
                  {k}
                </button>
              )
            })}
          </div>
          <button onClick={() => router.back()} className="text-white/40 text-sm active:text-white/70">Kembali</button>
        </div>
      </div>
    )
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Ringkasan</h1>
          <button onClick={() => setUnlocked(false)} className="p-2 text-gray-400 active:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <button onClick={prevMonth} className="p-2 text-gray-500 active:text-[#2D5A3D]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-base font-semibold text-gray-900 capitalize">{monthLabel}</span>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="p-2 text-gray-500 active:text-[#2D5A3D] disabled:opacity-25">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-[#2D5A3D] border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-24">

          {/* Hero revenue card */}
          <div className="mx-4 mt-4 rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #2D5A3D 0%, #1a3528 100%)' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-widest">Pendapatan {format(new Date(selectedMonth + '-01'), 'MMM yyyy', { locale: id })}</p>
                <p className="text-3xl font-bold mt-1">{formatShort(metrics.totalRev)}</p>
                <p className="text-white/50 text-xs mt-0.5">{formatPrice(metrics.totalRev)}</p>
              </div>
              {metrics.momGrowth !== null && (
                <span className="text-xs font-bold px-2 py-1 rounded-full mt-1 flex-shrink-0"
                  style={{
                    background: metrics.momGrowth >= 0 ? 'rgba(74,220,128,0.2)' : 'rgba(248,113,113,0.2)',
                    color: metrics.momGrowth >= 0 ? '#4ade80' : '#f87171',
                  }}>
                  {metrics.momGrowth >= 0 ? '+' : ''}{metrics.momGrowth}% vs {format(subMonths(new Date(selectedMonth + '-01'), 1), 'MMM', { locale: id })}
                </span>
              )}
            </div>

            {/* All-time total */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <p className="text-white/50 text-xs">Total Semua Waktu</p>
                <p className="text-white/90 text-sm font-bold">{formatShort(allTimeRev)}</p>
              </div>
            </div>

            {/* Revenue split */}
            {metrics.totalRev > 0 && (
              <div className="mt-2">
                <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                  <div className="rounded-full bg-white/70 transition-all"
                    style={{ width: `${Math.round((metrics.bookingRev / metrics.totalRev) * 100)}%` }} />
                  <div className="rounded-full bg-purple-400/70 transition-all"
                    style={{ width: `${Math.round((metrics.pkgRev / metrics.totalRev) * 100)}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-white/50 text-[10px]">Kunjungan {Math.round((metrics.bookingRev / metrics.totalRev) * 100)}%</p>
                  <p className="text-purple-300/70 text-[10px]">Paket {Math.round((metrics.pkgRev / metrics.totalRev) * 100)}%</p>
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-3 pt-3 border-t border-white/15">
              <div>
                <p className="text-white/60 text-xs">Kunjungan</p>
                <p className="text-white font-semibold text-sm">{formatShort(metrics.bookingRev)}</p>
              </div>
              <div className="w-px bg-white/15" />
              <div>
                <p className="text-white/60 text-xs">Paket</p>
                <p className="text-white font-semibold text-sm">{formatShort(metrics.pkgRev)}</p>
              </div>
              <div className="w-px bg-white/15" />
              <div>
                <p className="text-white/60 text-xs">Rata-rata</p>
                <p className="text-white font-semibold text-sm">{formatShort(metrics.avg)}</p>
              </div>
            </div>
          </div>

          {/* Stat tiles — 2x2 */}
          <div className="grid grid-cols-2 gap-3 mx-4 mt-3">
            <div className="bg-white rounded-2xl p-4">
              <p className="text-2xl font-bold text-[#2D5A3D]">{metrics.completedCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Kunjungan Selesai</p>
            </div>
            <div className="bg-white rounded-2xl p-4">
              <p className="text-2xl font-bold text-blue-600">{metrics.confirmedCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Mendatang</p>
            </div>
            <div className="bg-white rounded-2xl p-4">
              <div className="flex items-end gap-1.5">
                <p className="text-2xl font-bold text-red-500">{metrics.cancelledCount}</p>
                {metrics.cancelRate > 0 && (
                  <p className="text-xs text-red-400 mb-0.5">{metrics.cancelRate}%</p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Dibatalkan</p>
            </div>
            <div className="bg-white rounded-2xl p-4">
              <p className="text-2xl font-bold text-purple-600">{metrics.pkgCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Paket Terjual</p>
            </div>
          </div>

          {/* Outstanding DP alert */}
          {metrics.outstanding.length > 0 && (
            <div className="mx-4 mt-3 p-4 rounded-2xl bg-orange-50 border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-orange-800">
                  {metrics.outstanding.length} tagihan sisa · {formatShort(metrics.outstandingTotal)}
                </p>
              </div>
              <div className="space-y-1.5">
                {metrics.outstanding.slice(0, 3).map(b => (
                  <div key={b.id} className="flex justify-between items-center text-xs">
                    <span className="text-orange-700 font-medium">{b.customer?.name}</span>
                    <span className="text-orange-600 font-semibold">{formatPrice(bookingTotal(b) - b.dp_amount)}</span>
                  </div>
                ))}
                {metrics.outstanding.length > 3 && (
                  <p className="text-xs text-orange-500">+{metrics.outstanding.length - 3} lainnya</p>
                )}
              </div>
            </div>
          )}

          {/* 6-month trend */}
          <div className="mx-4 mt-4 bg-white rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-gray-900">Tren 6 Bulan</p>
              <p className="text-xs text-gray-400">Total: {formatShort(trendData.reduce((s, d) => s + d.revenue, 0))}</p>
            </div>
            <div className="flex items-end gap-1.5 h-28">
              {trendData.map(({ month, revenue }) => {
                const heightPct = revenue > 0 ? Math.max((revenue / maxTrend) * 100, 4) : 4
                const isSelected = month === selectedMonth
                const label = format(new Date(month + '-01'), 'MMM', { locale: id })
                return (
                  <button key={month} onClick={() => { setSelectedMonth(month); setTxnExpanded(false) }}
                    className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-semibold" style={{ color: isSelected ? '#2D5A3D' : 'transparent' }}>
                      {formatShort(revenue)}
                    </span>
                    <div className="w-full rounded-t-lg transition-all"
                      style={{ height: `${heightPct}%`, background: isSelected ? '#2D5A3D' : '#E8F0EA', minHeight: '4px' }} />
                    <span className="text-[10px] font-medium capitalize"
                      style={{ color: isSelected ? '#2D5A3D' : '#9ca3af' }}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Service breakdown */}
          {metrics.svcBreakdown.length > 0 && (
            <div className="mx-4 mt-3 bg-white rounded-2xl p-4">
              <p className="text-sm font-bold text-gray-900 mb-3">Per Layanan</p>
              <div className="space-y-3">
                {metrics.svcBreakdown.map((s, i) => {
                  const barWidth = Math.round((s.count / metrics.maxSvcCount) * 100)
                  const colors = ['#2D5A3D', '#4a7c5e', '#6a9e80', '#8ebfa3', '#b0d8c0']
                  const color = colors[Math.min(i, colors.length - 1)]
                  return (
                    <div key={s.name}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-800">{s.name}</span>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-gray-600">{s.count}x</span>
                          <span className="text-xs text-gray-400 ml-2">{formatShort(s.revenue)}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, background: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Combined transaction list */}
          {transactions.length > 0 && (
            <div className="mx-4 mt-3 bg-white rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-900">Riwayat Transaksi</p>
                <span className="text-xs text-gray-400">{transactions.length} transaksi</span>
              </div>
              <div className="space-y-0">
                {visibleTxns.map((txn, i) => (
                  <div key={txn.id}
                    className={`flex items-start gap-3 py-3 ${i < visibleTxns.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                        style={txn.type === 'booking'
                          ? { background: '#E8F0EA', color: '#2D5A3D' }
                          : { background: '#f3e8ff', color: '#7c3aed' }}>
                        {txn.type === 'booking' ? 'Janji' : 'Paket'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{txn.customerName}</p>
                      <p className="text-xs text-gray-500 truncate">{txn.label}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-bold text-[#2D5A3D]">{formatShort(txn.amount)}</p>
                      <p className="text-[10px] text-gray-400">
                        {format(parseISO(txn.date), 'd MMM', { locale: id })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {transactions.length > TXN_PREVIEW && (
                <button
                  onClick={() => setTxnExpanded(v => !v)}
                  className="mt-2 w-full py-2 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500 font-medium active:bg-gray-50 flex items-center justify-center gap-1"
                >
                  {txnExpanded
                    ? <>Sembunyikan <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></>
                    : <>+{transactions.length - TXN_PREVIEW} transaksi lainnya <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></>
                  }
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {metrics.completedCount === 0 && metrics.pkgCount === 0 && (
            <div className="flex flex-col items-center py-16 text-gray-400 gap-2">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm">Belum ada data untuk {monthLabel}</p>
            </div>
          )}
        </div>
      )}

      <BottomNav active="dashboard" />
    </div>
  )
}
