'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns'
import { id } from 'date-fns/locale'
import { toPng } from 'html-to-image'
import type { BookingWithRelations, CustomerPackage } from '@/types'
import BottomNav from '@/components/BottomNav'
import Image from 'next/image'

type Tab = 'all' | 'upcoming' | 'unscheduled' | 'completed' | 'cancelled' | 'packages'

function formatPrice(price: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price)
}

const statusLabels: Record<string, string> = {
  confirmed: 'Konfirmasi',
  completed: 'Selesai',
  cancelled: 'Batal',
}

const statusColors: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: '#E8F0EA', text: '#2D5A3D' },
  completed: { bg: '#f0fdf4', text: '#16a34a' },
  cancelled: { bg: '#fef2f2', text: '#dc2626' },
}

export default function OrdersPage() {
  const router = useRouter()
  const [allBookings, setAllBookings] = useState<BookingWithRelations[]>([])
  const [allPurchases, setAllPurchases] = useState<CustomerPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [riwayatExpanded, setRiwayatExpanded] = useState(false)
  const [pkgHistoryExpanded, setPkgHistoryExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [showNotaPkg, setShowNotaPkg] = useState(false)
  const [notaPkg, setNotaPkg] = useState<CustomerPackage | null>(null)
  const [savingNotaPkg, setSavingNotaPkg] = useState(false)

  async function sendNotaPkgImage() {
    const node = document.getElementById('nota-pkg-print')
    if (!node || !notaPkg) return
    setSavingNotaPkg(true)
    try {
      const dataUrl = await toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2 })
      const fileName = `nota-paket-${notaPkg.id.slice(-8).toUpperCase()}.png`
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Nota Pembelian Paket',
          text: `Nota pembelian paket untuk ${notaPkg.customer?.name ?? ''}`,
        })
      } else {
        const link = document.createElement('a')
        link.download = fileName
        link.href = dataUrl
        link.click()
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      alert('Gagal mengirim nota: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSavingNotaPkg(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const nowTimeStr = format(new Date(), 'HH:mm')

  async function cancelPackage(cpId: string, name: string) {
    if (!confirm(`Batalkan paket "${name}"? Paket akan dikeluarkan dari revenue.`)) return
    setAllPurchases(prev => prev.map(cp => cp.id === cpId ? { ...cp, status: 'cancelled' } : cp))
    const res = await fetch(`/api/customer-packages/${cpId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (!res.ok) {
      // Rollback optimistic update
      setAllPurchases(prev => prev.map(cp => cp.id === cpId ? { ...cp, status: 'active' } : cp))
      alert('Gagal membatalkan paket. Coba lagi.')
    }
  }

  async function deletePackage(cpId: string, name: string) {
    if (!confirm(`Hapus riwayat paket "${name}"? Data tidak bisa dikembalikan dan akan hilang dari revenue.`)) return
    const snapshot = allPurchases.find(cp => cp.id === cpId)
    setAllPurchases(prev => prev.filter(cp => cp.id !== cpId))
    const res = await fetch(`/api/customer-packages/${cpId}`, { method: 'DELETE' })
    if (!res.ok) {
      if (snapshot) setAllPurchases(prev => [...prev, snapshot].sort((a, b) => b.purchased_at.localeCompare(a.purchased_at)))
      alert('Gagal menghapus paket. Coba lagi.')
    }
  }

  async function deleteBooking(bookingId: string, customerName: string) {
    if (!confirm(`Hapus janji "${customerName}"? Data tidak bisa dikembalikan.`)) return
    const snapshot = allBookings.find(b => b.id === bookingId)
    setAllBookings(prev => prev.filter(b => b.id !== bookingId))
    const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' })
    if (!res.ok) {
      if (snapshot) setAllBookings(prev => [...prev, snapshot])
      alert('Gagal menghapus janji. Coba lagi.')
    }
  }

  async function markCompleted(bookingId: string) {
    setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'completed' } : b))
    await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
  }

  function buildReminderMsg(booking: BookingWithRelations) {
    const svcNames = booking.services?.length
      ? booking.services.map(s => s.name).join(', ')
      : (booking.service?.name ?? 'Layanan')
    const dateStr = booking.date ? format(parseISO(booking.date), 'EEEE, d MMMM yyyy', { locale: id }) : null
    return encodeURIComponent(
      `Halo ${booking.customer?.name},\n` +
      `Kami ingin mengingatkan jadwal treatment kakak pada:\n\n` +
      `📋 Layanan: ${svcNames}\n` +
      (dateStr ? `📅 Tanggal: ${dateStr}\n` : '') +
      (booking.time ? `⏰ Waktu: ${booking.time.slice(0, 5)}\n` : '') +
      `\n` +
      `Lokasi:\n📍Loome Hair Removal\nmaps.app.goo.gl/ZAgDR6Ewjppjf5JP7?g_st=ic\n\n` +
      `Mohon dibantu konfirmasi dengan memilih salah satu jawaban: Hadir, Batal, Reschedule.\n` +
      `Terimakasih banyak kak! 💚`
    )
  }

  useEffect(() => {
    async function load() {
      const [bookRes, pkgRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/customer-packages'),
      ])
      if (bookRes.ok) setAllBookings(await bookRes.json())
      if (pkgRes.ok) setAllPurchases(await pkgRes.json())
      setLoading(false)
    }
    load()
  }, [])

  const searchedBookings = search.trim()
    ? allBookings.filter(b => {
        const q = search.toLowerCase()
        const customerMatch = b.customer?.name.toLowerCase().includes(q)
        const svcList = b.services?.length ? b.services : b.service ? [b.service] : []
        const serviceMatch = svcList.some(s => s.name.toLowerCase().includes(q))
        return customerMatch || serviceMatch
      })
    : allBookings

  const unscheduledBookings = searchedBookings
    .filter(b => !b.date && b.status !== 'cancelled')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const scheduledBookings = searchedBookings.filter(b => !!b.date)

  function getFiltered(): BookingWithRelations[] {
    switch (tab) {
      case 'upcoming':
        return scheduledBookings
          .filter(b => b.status === 'confirmed' && b.date! >= todayStr)
          .sort((a, b) => a.date!.localeCompare(b.date!) || (a.time ?? '').localeCompare(b.time ?? ''))
      case 'completed':
        return scheduledBookings
          .filter(b => b.status === 'completed')
          .sort((a, b) => b.date!.localeCompare(a.date!) || (b.time ?? '').localeCompare(a.time ?? ''))
      case 'cancelled':
        return searchedBookings
          .filter(b => b.status === 'cancelled')
          .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.time ?? '').localeCompare(a.time ?? ''))
      default: {
        const upcoming = scheduledBookings
          .filter(b => b.status === 'confirmed' && b.date! >= todayStr)
          .sort((a, b) => a.date!.localeCompare(b.date!) || (a.time ?? '').localeCompare(b.time ?? ''))
        const past = scheduledBookings
          .filter(b => !(b.status === 'confirmed' && b.date! >= todayStr))
          .sort((a, b) => b.date!.localeCompare(a.date!) || (b.time ?? '').localeCompare(a.time ?? ''))
        return [...upcoming, ...past]
      }
    }
  }

  const filtered = getFiltered()

  function groupByDate(list: BookingWithRelations[]) {
    const result: { dateStr: string; bookings: BookingWithRelations[] }[] = []
    const seen = new Set<string>()
    for (const b of list) {
      const d = b.date ?? ''
      if (!seen.has(d)) {
        seen.add(d)
        result.push({ dateStr: d, bookings: list.filter(x => x.date === b.date) })
      }
    }
    return result
  }

  // For "all" tab: three sections
  const upcomingBookings = scheduledBookings
    .filter(b => b.status === 'confirmed' && b.date! >= todayStr)
    .sort((a, b) => a.date!.localeCompare(b.date!) || (a.time ?? '').localeCompare(b.time ?? ''))
  const unprocessedBookings = scheduledBookings
    .filter(b => b.status === 'confirmed' && b.date! < todayStr)
    .sort((a, b) => b.date!.localeCompare(a.date!) || (b.time ?? '').localeCompare(a.time ?? ''))
  const historyBookings = scheduledBookings
    .filter(b => b.status !== 'confirmed')
    .sort((a, b) => b.date!.localeCompare(a.date!) || (b.time ?? '').localeCompare(a.time ?? ''))

  const upcomingGrouped = groupByDate(upcomingBookings)
  const unprocessedGrouped = groupByDate(unprocessedBookings)
  const historyGrouped = groupByDate(historyBookings)
  const grouped = groupByDate(filtered)

  function formatDateLabel(dateStr: string) {
    if (!dateStr) return 'Tanpa Jadwal'
    const d = parseISO(dateStr)
    if (isToday(d)) return `Hari ini · ${format(d, 'd MMMM yyyy', { locale: id })}`
    if (isTomorrow(d)) return `Besok · ${format(d, 'd MMMM yyyy', { locale: id })}`
    return format(d, 'EEEE, d MMMM yyyy', { locale: id })
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'upcoming', label: 'Mendatang' },
    { key: 'unscheduled', label: 'Belum Jadwal' },
    { key: 'completed', label: 'Selesai' },
    { key: 'cancelled', label: 'Batal' },
    { key: 'packages', label: 'Paket' },
  ]

  const tabCounts = {
    all: allBookings.length,
    upcoming: allBookings.filter(b => b.status === 'confirmed' && !!b.date && b.date >= todayStr).length,
    unscheduled: allBookings.filter(b => !b.date && b.status !== 'cancelled').length,
    completed: allBookings.filter(b => b.status === 'completed').length,
    cancelled: allBookings.filter(b => b.status === 'cancelled').length,
    packages: allPurchases.length,
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#2D5A3D]">
              <Image src="/logo.jpeg" alt="Loome" width={32} height={32} className="w-full h-full object-cover" />
            </div>
            <span className="font-semibold text-gray-900 text-base">Loome Admin</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => router.push('/dashboard')} className="p-2 text-gray-400 active:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
            <button onClick={handleLogout} className="p-2 text-gray-400 active:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
        {!loading && tab !== 'packages' && (
          <div className="relative mb-3">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari pelanggan atau layanan..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
            />
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: tab === t.key ? '#2D5A3D' : '#f3f4f6',
                color: tab === t.key ? '#fff' : '#6b7280',
              }}
            >
              {t.label}
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  background: tab === t.key ? 'rgba(255,255,255,0.25)' : '#e5e7eb',
                  color: tab === t.key ? '#fff' : '#9ca3af',
                }}
              >
                {tabCounts[t.key]}
              </span>
            </button>
          ))}
        </div>
      </header>


      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-[#2D5A3D] border-t-transparent animate-spin" />
          </div>
        ) : tab === 'packages' ? (
          <div className="px-4 pt-3 pb-4">
            {allPurchases.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-sm">Belum ada pembelian paket</p>
              </div>
            ) : (() => {
              const unused = allPurchases.filter(cp => cp.status === 'active' && cp.sessions_used === 0).sort((a, b) => b.purchased_at.localeCompare(a.purchased_at))
              const inProgress = allPurchases.filter(cp => cp.status === 'active' && cp.sessions_used > 0).sort((a, b) => (a.sessions_total - a.sessions_used) - (b.sessions_total - b.sessions_used))
              const history = allPurchases.filter(cp => cp.status !== 'active').sort((a, b) => b.purchased_at.localeCompare(a.purchased_at))

              const PkgCard = ({ cp }: { cp: CustomerPackage }) => {
                const remaining = cp.sessions_total - cp.sessions_used
                const pct = cp.sessions_total > 0 ? (cp.sessions_used / cp.sessions_total) * 100 : 0
                return (
                  <div
                    key={cp.id}
                    onClick={() => router.push(`/customers/${cp.customer_id}`)}
                    className="p-4 rounded-2xl border cursor-pointer active:opacity-80"
                    style={{ borderColor: cp.status === 'cancelled' ? '#fecaca' : cp.status === 'completed' ? '#e5e7eb' : '#d1fae5' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{cp.customer?.name ?? '—'}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{cp.package_name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: cp.status === 'active' ? '#dcfce7' : cp.status === 'cancelled' ? '#fee2e2' : '#f3f4f6',
                            color: cp.status === 'active' ? '#16a34a' : cp.status === 'cancelled' ? '#ef4444' : '#9ca3af',
                          }}>
                          {cp.status === 'active' ? (cp.sessions_used === 0 ? 'Belum Dipakai' : 'Aktif') : cp.status === 'cancelled' ? 'Dibatalkan' : 'Selesai'}
                        </span>
                        {cp.status !== 'cancelled' && (
                          <button
                            onClick={e => { e.stopPropagation(); setNotaPkg(cp); setShowNotaPkg(true) }}
                            className="text-[10px] text-[#2D5A3D] font-medium active:opacity-60"
                          >
                            Cetak Nota
                          </button>
                        )}
                        {cp.status === 'active' && cp.sessions_used === 0 && (
                          <button
                            onClick={e => { e.stopPropagation(); cancelPackage(cp.id, cp.package_name) }}
                            className="text-[10px] text-red-400 font-medium active:text-red-600"
                          >
                            Batalkan
                          </button>
                        )}
                        {cp.status !== 'active' && (
                          <button
                            onClick={e => { e.stopPropagation(); deletePackage(cp.id, cp.package_name) }}
                            className="text-[10px] text-red-400 font-medium active:text-red-600"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>

                    {cp.status !== 'cancelled' && (
                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] text-gray-400">{cp.sessions_used} dari {cp.sessions_total} sesi</span>
                          <span className="text-[11px] font-bold" style={{ color: remaining > 0 ? '#2D5A3D' : '#9ca3af' }}>
                            {remaining} tersisa
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: cp.status === 'completed' ? '#9ca3af' : pct >= 80 ? '#f97316' : '#2D5A3D',
                            }} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2.5">
                      <p className={`text-xs font-semibold ${cp.status === 'cancelled' ? 'line-through text-gray-400' : 'text-[#2D5A3D]'}`}>
                        {formatPrice(cp.paid_price)}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {cp.status !== 'active'
                          ? format(parseISO(cp.purchased_at.slice(0, 10)), 'd MMM yyyy', { locale: id })
                          : cp.last_booking_date
                            ? `Terakhir ${format(parseISO(cp.last_booking_date), 'd MMM yyyy', { locale: id })}`
                            : `Beli ${format(parseISO(cp.purchased_at.slice(0, 10)), 'd MMM yyyy', { locale: id })}`}
                      </p>
                    </div>
                  </div>
                )
              }

              return (
                <>
                  {unused.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-orange-500 uppercase tracking-wide">Belum Digunakan</span>
                        <div className="flex-1 h-px bg-orange-100" />
                        <span className="text-xs text-orange-400">{unused.length}</span>
                      </div>
                      <div className="space-y-2">{unused.map(cp => <PkgCard key={cp.id} cp={cp} />)}</div>
                    </div>
                  )}

                  {inProgress.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-[#2D5A3D] uppercase tracking-wide">Sedang Berjalan</span>
                        <div className="flex-1 h-px bg-[#E8F0EA]" />
                        <span className="text-xs text-gray-400">{inProgress.length}</span>
                      </div>
                      <div className="space-y-2">{inProgress.map(cp => <PkgCard key={cp.id} cp={cp} />)}</div>
                    </div>
                  )}

                  {history.length > 0 && (
                    <div>
                      <button
                        onClick={() => setPkgHistoryExpanded(v => !v)}
                        className="flex items-center gap-2 w-full mb-2"
                      >
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Riwayat</span>
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-xs text-gray-400">{history.length}</span>
                        <svg className="w-3.5 h-3.5 text-gray-400 transition-transform" style={{ transform: pkgHistoryExpanded ? 'rotate(180deg)' : 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {pkgHistoryExpanded && (
                        <div className="space-y-2">{history.map(cp => <PkgCard key={cp.id} cp={cp} />)}</div>
                      )}
                    </div>
                  )}

                  {unused.length === 0 && inProgress.length === 0 && (
                    <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
                      <p className="text-sm">Semua paket sudah selesai</p>
                    </div>
                  )}
                </>
              )
            })()}</div>
        ) : tab === 'unscheduled' ? (
          <div className="px-4 pt-3">
            {unscheduledBookings.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Semua pesanan sudah dijadwalkan</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-orange-500 uppercase tracking-wide">Belum Dijadwalkan</span>
                  <div className="flex-1 h-px bg-orange-100" />
                  <span className="text-xs text-orange-400">{unscheduledBookings.length} pesanan</span>
                </div>
                <div className="space-y-2">
                  {unscheduledBookings.map(booking => {
                    const svcList = booking.services?.length ? booking.services : booking.service ? [booking.service] : []
                    const total = booking.custom_price ?? (svcList.length ? svcList.reduce((s, x) => s + x.price, 0) : null)
                    return (
                      <div
                        key={booking.id}
                        onClick={() => router.push(`/bookings/${booking.id}`)}
                        className="flex items-center gap-3 p-3.5 rounded-2xl border border-orange-200 bg-orange-50 active:bg-orange-100 cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{booking.customer?.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {svcList.length ? svcList.map(s => s.name).join(', ') : 'Layanan dihapus'}
                          </p>
                          {total && <p className="text-xs font-semibold text-[#2D5A3D] mt-0.5">{formatPrice(total)}</p>}
                        </div>
                        <span className="flex-shrink-0 text-xs font-semibold text-orange-500 bg-white border border-orange-200 px-2.5 py-1 rounded-full">
                          Atur Jadwal
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="text-sm">Belum ada pesanan</p>
          </div>
        ) : (
          <div className="px-4 pt-3">
            {tab === 'all' && upcomingGrouped.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-[#2D5A3D] uppercase tracking-wide">Mendatang</span>
                <div className="flex-1 h-px bg-[#E8F0EA]" />
                <span className="text-xs text-gray-400">{upcomingBookings.length} janji</span>
              </div>
            )}

            {(tab === 'all' ? upcomingGrouped : grouped).map(({ dateStr, bookings: dayBookings }) => (
              <div key={dateStr} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-500">{formatDateLabel(dateStr)}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400">{dayBookings.length} janji</span>
                </div>
                <div className="space-y-2">
                  {dayBookings.map(booking => {
                    const sc = statusColors[booking.status]
                    return (
                      <div
                        key={booking.id}
                        onClick={() => router.push(`/bookings/${booking.id}`)}
                        className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-gray-100 active:bg-gray-50 cursor-pointer"
                      >
                        <div className="w-12 flex-shrink-0 text-center">
                          <span className="text-sm font-bold text-[#2D5A3D]">{booking.time?.slice(0, 5) ?? '—'}</span>
                          {booking.time && (() => {
                            const dur = booking.duration_minutes ?? 60
                            const [h, m] = booking.time!.slice(0, 5).split(':').map(Number)
                            const end = h * 60 + m + dur
                            return <span className="block text-[10px] text-gray-400">{String(Math.floor(end / 60)).padStart(2, '0')}:{String(end % 60).padStart(2, '0')}</span>
                          })()}
                        </div>
                        <div className="w-px h-10 bg-gray-100 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{booking.customer?.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {booking.services?.length
                              ? booking.services.map(s => s.name).join(', ')
                              : (booking.service?.name ?? 'Layanan dihapus')}
                          </p>
                          {(() => {
                            const svcList = booking.services?.length ? booking.services : booking.service ? [booking.service] : []
                            const total = booking.custom_price ?? (svcList.length ? svcList.reduce((s, x) => s + x.price, 0) : null)
                            if (!total) return null
                            const remaining = booking.dp_amount > 0 ? total - booking.dp_amount : 0
                            return (
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <p className="text-xs font-semibold text-[#2D5A3D]">{formatPrice(total)}</p>
                                {booking.dp_amount > 0 && booking.status !== 'completed' && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600">
                                    Sisa {formatPrice(remaining)}
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                        {booking.status === 'confirmed' ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {tab === 'upcoming' && booking.date && (booking.date > todayStr || (booking.date === todayStr && (booking.time?.slice(0, 5) ?? '') >= nowTimeStr)) && (
                              <a
                                href={`https://wa.me/${(booking.customer?.phone ?? '').replace(/^0/, '62').replace(/[^0-9]/g, '')}?text=${buildReminderMsg(booking)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center active:opacity-80"
                                title="Kirim pengingat WA"
                              >
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                              </a>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); markCompleted(booking.id) }}
                              className="w-8 h-8 rounded-full bg-green-50 border border-green-200 flex items-center justify-center active:bg-green-100"
                              title="Tandai selesai"
                            >
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span
                              className="text-[10px] font-semibold px-2 py-1 rounded-full"
                              style={{ background: sc.bg, color: sc.text }}
                            >
                              {statusLabels[booking.status]}
                            </span>
                            {booking.status === 'cancelled' && (
                              <button
                                onClick={e => { e.stopPropagation(); deleteBooking(booking.id, booking.customer?.name ?? '') }}
                                className="text-[10px] text-red-400 font-medium active:text-red-600"
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Belum Diproses — past confirmed bookings needing action */}
            {tab === 'all' && unprocessedGrouped.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-orange-500 uppercase tracking-wide">Belum Diproses</span>
                  <div className="flex-1 h-px bg-orange-100" />
                  <span className="text-xs text-orange-400">{unprocessedBookings.length} janji</span>
                </div>
                {unprocessedGrouped.map(({ dateStr, bookings: dayBookings }) => (
                  <div key={dateStr} className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-orange-400">{formatDateLabel(dateStr)}</span>
                      <div className="flex-1 h-px bg-orange-100" />
                    </div>
                    <div className="space-y-2">
                      {dayBookings.map(booking => {
                        const svcList = booking.services?.length ? booking.services : booking.service ? [booking.service] : []
                        const total = booking.custom_price ?? (svcList.length ? svcList.reduce((s, x) => s + x.price, 0) : null)
                        return (
                          <div
                            key={booking.id}
                            onClick={() => router.push(`/bookings/${booking.id}`)}
                            className="flex items-center gap-3 p-3.5 rounded-2xl border border-orange-200 bg-orange-50 active:bg-orange-100 cursor-pointer"
                          >
                            <div className="w-12 flex-shrink-0 text-center">
                              <span className="text-sm font-bold text-orange-500">{booking.time?.slice(0, 5) ?? '—'}</span>
                            </div>
                            <div className="w-px h-10 bg-orange-200 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{booking.customer?.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">
                                {svcList.length ? svcList.map(s => s.name).join(', ') : 'Layanan dihapus'}
                              </p>
                              {total && <p className="text-xs font-semibold text-[#2D5A3D] mt-0.5">{formatPrice(total)}</p>}
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); markCompleted(booking.id) }}
                              className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 border border-green-300 flex items-center justify-center active:bg-green-200"
                              title="Tandai selesai"
                            >
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Riwayat — completed & cancelled only */}
            {tab === 'all' && historyGrouped.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setRiwayatExpanded(v => !v)}
                  className="flex items-center gap-2 w-full mt-2 mb-3"
                >
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Riwayat</span>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400">{historyBookings.length} janji</span>
                  <svg
                    className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform"
                    style={{ transform: riwayatExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {riwayatExpanded && historyGrouped.map(({ dateStr, bookings: dayBookings }) => (
                  <div key={dateStr} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-gray-400">{formatDateLabel(dateStr)}</span>
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-xs text-gray-400">{dayBookings.length} janji</span>
                    </div>
                    <div className="space-y-2">
                      {dayBookings.map(booking => {
                        const sc = statusColors[booking.status]
                        return (
                          <div
                            key={booking.id}
                            onClick={() => router.push(`/bookings/${booking.id}`)}
                            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-gray-100 active:bg-gray-50 cursor-pointer"
                          >
                            <div className="w-12 flex-shrink-0 text-center">
                              <span className="text-sm font-bold text-gray-400">{booking.time?.slice(0, 5) ?? '—'}</span>
                              {booking.time && (() => {
                                const dur = booking.duration_minutes ?? 60
                                const [h, m] = booking.time!.slice(0, 5).split(':').map(Number)
                                const end = h * 60 + m + dur
                                return <span className="block text-[10px] text-gray-300">{String(Math.floor(end / 60)).padStart(2, '0')}:{String(end % 60).padStart(2, '0')}</span>
                              })()}
                            </div>
                            <div className="w-px h-10 bg-gray-100 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-700 truncate">{booking.customer?.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5 truncate">
                                {booking.services?.length
                                  ? booking.services.map(s => s.name).join(', ')
                                  : (booking.service?.name ?? 'Layanan dihapus')}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span
                                className="text-[10px] font-semibold px-2 py-1 rounded-full"
                                style={{ background: sc.bg, color: sc.text }}
                              >
                                {statusLabels[booking.status]}
                              </span>
                              {booking.status === 'cancelled' && (
                                <button
                                  onClick={e => { e.stopPropagation(); deleteBooking(booking.id, booking.customer?.name ?? '') }}
                                  className="text-[10px] text-red-400 font-medium active:text-red-600"
                                >
                                  Hapus
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

          </div>
        )}
      </div>

      {showNotaPkg && notaPkg && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNotaPkg(false)} />
          <div className="relative z-10 bg-white rounded-t-3xl px-4 pt-5 pb-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Nota Pembelian Paket</h2>
              <button onClick={() => setShowNotaPkg(false)} className="p-1 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div id="nota-pkg-print" className="font-mono text-sm text-gray-900 bg-white p-6">
              <div className="text-center mb-5">
                <p className="font-bold text-lg tracking-wide">LOOME HAIR REMOVAL</p>
                <p className="text-xs text-gray-500 mt-1">Nota Pembelian Paket</p>
              </div>
              <div className="border-t border-dashed border-gray-400 my-5" />
              <div className="space-y-2.5 mb-5">
                <div className="flex gap-3">
                  <span className="text-gray-500 w-24 flex-shrink-0">Nama</span>
                  <span className="flex-1">: {notaPkg.customer?.name}</span>
                </div>
                {notaPkg.customer?.phone && (
                  <div className="flex gap-3">
                    <span className="text-gray-500 w-24 flex-shrink-0">Telp</span>
                    <span className="flex-1">: {notaPkg.customer.phone}</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <span className="text-gray-500 w-24 flex-shrink-0">Tanggal</span>
                  <span className="flex-1">: {format(parseISO(notaPkg.purchased_at.slice(0, 10)), 'd MMM yyyy', { locale: id })}</span>
                </div>
              </div>
              <div className="border-t border-dashed border-gray-400 my-5" />
              <p className="text-xs text-gray-500 mb-3">PAKET</p>
              <div className="space-y-2.5 mb-5">
                <div className="flex justify-between">
                  <span className="flex-1 pr-3">{notaPkg.package_name}</span>
                  <span className="flex-shrink-0">{formatPrice(notaPkg.paid_price)}</span>
                </div>
                {notaPkg.service?.name && (
                  <div className="text-xs text-gray-500">{notaPkg.service.name}</div>
                )}
                <div className="text-xs text-gray-500">{notaPkg.sessions_total} sesi</div>
              </div>
              <div className="border-t border-dashed border-gray-400 my-5" />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatPrice(notaPkg.paid_price)}</span>
              </div>
              <div className="border-t border-dashed border-gray-400 my-5" />
              <div className="text-center text-xs text-gray-500 space-y-1.5">
                <p>Terima kasih atas kepercayaan Anda!</p>
                <p>Ref: #{notaPkg.id.slice(-8).toUpperCase()}</p>
                <p>Dicetak: {format(new Date(), 'd MMM yyyy HH:mm', { locale: id })}</p>
              </div>
            </div>

            <button
              onClick={sendNotaPkgImage}
              disabled={savingNotaPkg}
              className="mt-5 flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#2D5A3D] text-white font-semibold text-base active:opacity-80 disabled:opacity-50"
            >
              {savingNotaPkg ? (
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342a4 4 0 100-2.684m0 2.684a4 4 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a4 4 0 105.367-5.367 4 4 0 00-5.367 5.367zm0 11.316a4 4 0 105.367 5.367 4 4 0 00-5.367-5.367z" />
                </svg>
              )}
              {savingNotaPkg ? 'Mengirim...' : 'Kirim Nota'}
            </button>
          </div>
        </div>
      )}

      <BottomNav active="orders" />
    </div>
  )
}

