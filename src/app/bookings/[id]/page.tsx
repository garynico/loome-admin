'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import type { BookingWithRelations, Service } from '@/types'
import TimePicker from '@/components/TimePicker'

function formatPrice(price: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price)
}

const statusLabels: Record<string, string> = {
  confirmed: 'Konfirmasi',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

const statusColors: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: '#E8F0EA', text: '#2D5A3D' },
  completed: { bg: '#f0fdf4', text: '#16a34a' },
  cancelled: { bg: '#fef2f2', text: '#dc2626' },
}

export default function BookingDetailPage() {
  const router = useRouter()
  const { id: bookingId } = useParams<{ id: string }>()
  const [booking, setBooking] = useState<BookingWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [rsDate, setRsDate] = useState('')
  const [rsStartTime, setRsStartTime] = useState('')
  const [rsEndTime, setRsEndTime] = useState('')
  const [rsSaving, setRsSaving] = useState(false)

  const [showEditServices, setShowEditServices] = useState(false)
  const [allServices, setAllServices] = useState<Service[]>([])
  const [editServiceIds, setEditServiceIds] = useState<string[]>([])
  const [savingServices, setSavingServices] = useState(false)

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setBooking(data); setLoading(false) })
  }, [bookingId])

  async function updateStatus(status: string) {
    setUpdating(true)
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setBooking(await res.json())
    setUpdating(false)
  }

  async function deleteBooking() {
    if (!confirm('Hapus janji ini?')) return
    await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' })
    router.back()
  }

  function openReschedule() {
    if (!booking) return
    setRsDate(booking.date)
    setRsStartTime(booking.time.slice(0, 5))
    if (booking.duration_minutes) {
      const [h, m] = booking.time.slice(0, 5).split(':').map(Number)
      const endTotal = h * 60 + m + booking.duration_minutes
      setRsEndTime(`${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`)
    } else {
      setRsEndTime('')
    }
    setShowReschedule(true)
  }

  async function saveReschedule() {
    if (!rsDate || !rsStartTime) return
    setRsSaving(true)
    const [sh, sm] = rsStartTime.split(':').map(Number)
    let duration: number | null = null
    if (rsEndTime) {
      const [eh, em] = rsEndTime.split(':').map(Number)
      const d = (eh * 60 + em) - (sh * 60 + sm)
      if (d > 0) duration = d
    }
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: rsDate, time: rsStartTime, duration_minutes: duration }),
    })
    if (res.ok) {
      setBooking(await res.json())
      setShowReschedule(false)
    }
    setRsSaving(false)
  }

  async function openEditServices() {
    const current = (booking?.services?.length ? booking.services : booking?.service ? [booking.service] : []).map(s => s.id)
    setEditServiceIds(current)
    if (allServices.length === 0) {
      const res = await fetch('/api/services')
      if (res.ok) setAllServices(await res.json())
    }
    setShowEditServices(true)
  }

  async function saveEditServices() {
    if (editServiceIds.length === 0) return
    setSavingServices(true)
    const newTotal = allServices.filter(s => editServiceIds.includes(s.id)).reduce((sum, s) => sum + s.price, 0)
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_ids: editServiceIds, custom_price: newTotal }),
    })
    if (res.ok) { setBooking(await res.json()); setShowEditServices(false) }
    setSavingServices(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-6 h-6 rounded-full border-2 border-[#2D5A3D] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className="text-gray-500">Janji tidak ditemukan</p>
        <button onClick={() => router.back()} className="text-sm text-[#2D5A3D]">Kembali</button>
      </div>
    )
  }

  const waPhone = (booking.customer?.phone ?? '').replace(/^0/, '62').replace(/[^0-9]/g, '')
  const dateFormatted = format(parseISO(booking.date), 'EEEE, d MMMM yyyy', { locale: id })
  const svcList = booking.services?.length ? booking.services : booking.service ? [booking.service] : []
  const svcLine = svcList.map(s => `• ${s.name}`).join('\n') || 'Layanan'
  const totalPrice = booking.custom_price ?? svcList.reduce((s, x) => s + x.price, 0)
  const svcNames = svcList.map(s => s.name).join(', ') || 'Layanan'
  const locationBlock = `Lokasi:\n📍Loome Hair Removal\nhttps://maps.app.goo.gl/ZAgDR6Ewjppjf5JP7?g_st=ic`
  const waMsg = encodeURIComponent(
    `Halo ${booking.customer?.name},\n\n` +
    `Berikut konfirmasi janji Anda di Loome Hair Removal:\n\n` +
    `📋 Layanan: ${svcNames}\n` +
    `📅 Tanggal: ${dateFormatted}\n` +
    `⏰ Waktu: ${booking.time.slice(0, 5)}\n\n` +
    `${locationBlock}\n\n` +
    `Ditunggu kedatangannya! 💚`
  )
  const waReminderMsg = encodeURIComponent(
    `Halo ${booking.customer?.name},\n` +
    `Kami ingin mengingatkan jadwal treatment kakak pada:\n\n` +
    `📋 Layanan: ${svcNames}\n` +
    `📅 Tanggal: ${dateFormatted}\n` +
    `⏰ Waktu: ${booking.time.slice(0, 5)}\n\n` +
    `${locationBlock}\n\n` +
    `Mohon dibantu konfirmasi dengan memilih salah satu jawaban: Hadir, Batal, Reschedule.\n` +
    `Terimakasih banyak kak! 💚`
  )

  const sc = statusColors[booking.status]

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500 active:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Detail Janji</h1>
        <button onClick={deleteBooking} className="p-2 text-red-400 active:bg-red-50 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Status badge */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-2 flex-wrap">
          <span
            className="inline-block px-3 py-1 rounded-full text-sm font-semibold"
            style={{ background: sc.bg, color: sc.text }}
          >
            {statusLabels[booking.status]}
          </span>
          {booking.customer_package_id && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Dari Paket
            </span>
          )}
        </div>

        {/* Main info */}
        <div className="px-4 py-4 space-y-4">
          <button
            onClick={() => router.push(`/customers/${booking.customer_id}`)}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-100 active:bg-gray-50 text-left"
          >
            <div className="w-12 h-12 rounded-full bg-[#E8F0EA] flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-[#2D5A3D]">{booking.customer?.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900">{booking.customer?.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">{booking.customer?.phone}</p>
            </div>
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="p-4 rounded-2xl bg-gray-50 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-5 pt-0.5 flex-shrink-0">
                <svg className="w-4 h-4 text-[#2D5A3D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">Layanan</p>
                  {booking.status === 'confirmed' && (
                    <button onClick={openEditServices} className="text-xs text-[#2D5A3D] font-semibold active:opacity-70">Edit</button>
                  )}
                </div>
                {(booking.services?.length ? booking.services : booking.service ? [booking.service] : []).map(s => (
                  <div key={s.id} className="flex justify-between items-center">
                    <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">{formatPrice(s.price)}</p>
                  </div>
                ))}
                {!booking.services?.length && !booking.service && <p className="text-sm text-gray-400">—</p>}
                {(() => {
                  const svcList = booking.services?.length ? booking.services : booking.service ? [booking.service] : []
                  const calcTotal = svcList.reduce((s, x) => s + x.price, 0)
                  const total = booking.custom_price ?? calcTotal
                  if (svcList.length === 0) return null
                  const priceEdited = booking.custom_price != null && booking.custom_price !== calcTotal
                  return (
                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-600">
                        Total{priceEdited ? ' (diedit)' : ''}
                      </p>
                      <p className="text-sm font-bold text-[#2D5A3D]">{formatPrice(total)}</p>
                    </div>
                  )
                })()}
                {booking.dp_amount > 0 && (() => {
                  const remaining = totalPrice - booking.dp_amount
                  return (
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">DP Diterima</span>
                        <span className="text-xs font-semibold text-green-600">+ {formatPrice(booking.dp_amount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-700">Sisa Pembayaran</span>
                        <span className="text-xs font-bold text-orange-600">{formatPrice(remaining)}</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 pt-0.5 flex-shrink-0">
                <svg className="w-4 h-4 text-[#2D5A3D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500">Tanggal & Waktu</p>
                <p className="text-sm font-semibold text-gray-900">{dateFormatted}</p>
                <p className="text-xs text-gray-500 mt-0.5">{booking.time.slice(0, 5)}</p>
              </div>
            </div>

            {booking.notes && (
              <div className="flex items-start gap-3">
                <div className="w-5 pt-0.5 flex-shrink-0">
                  <svg className="w-4 h-4 text-[#2D5A3D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Catatan</p>
                  <p className="text-sm text-gray-900">{booking.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 space-y-3">
          <a
            href={`https://wa.me/${waPhone}?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#25D366] text-white font-semibold text-base active:opacity-80"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Kirim Konfirmasi WhatsApp
          </a>
          <a
            href={`https://wa.me/${waPhone}?text=${waReminderMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-[#25D366] text-[#25D366] font-semibold text-sm active:opacity-80"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Kirim Reminder WhatsApp
          </a>

          {booking.status !== 'cancelled' && booking.status !== 'completed' && (
            <button
              onClick={openReschedule}
              className="w-full py-3 rounded-xl border border-[#2D5A3D] text-[#2D5A3D] text-sm font-semibold active:bg-[#E8F0EA]"
            >
              Jadwalkan Ulang
            </button>
          )}

          {booking.dp_amount > 0 && booking.status !== 'completed' && booking.status !== 'cancelled' && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-orange-50 border border-orange-200">
              <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-orange-800">Tagih sisa pembayaran</p>
                <p className="text-xs text-orange-600 mt-0.5">
                  {formatPrice(totalPrice - booking.dp_amount)} belum dibayar
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {booking.status !== 'completed' && (
              <button
                onClick={() => updateStatus('completed')}
                disabled={updating}
                className="py-3 rounded-xl bg-green-50 text-green-700 text-sm font-semibold active:opacity-80 disabled:opacity-50"
              >
                Tandai Selesai
              </button>
            )}
            {booking.status !== 'cancelled' && (
              <button
                onClick={() => updateStatus('cancelled')}
                disabled={updating}
                className="py-3 rounded-xl bg-red-50 text-red-600 text-sm font-semibold active:opacity-80 disabled:opacity-50"
              >
                Batalkan
              </button>
            )}
            {booking.status === 'cancelled' && (
              <button
                onClick={() => updateStatus('confirmed')}
                disabled={updating}
                className="py-3 rounded-xl bg-[#E8F0EA] text-[#2D5A3D] text-sm font-semibold active:opacity-80 disabled:opacity-50 col-span-2"
              >
                Konfirmasi Ulang
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reschedule bottom sheet */}
      {showReschedule && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowReschedule(false)} />
          <div className="relative bg-white rounded-t-3xl px-4 pt-5 pb-8 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-900">Jadwalkan Ulang</h2>
              <button onClick={() => setShowReschedule(false)} className="p-1 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Baru</label>
              <input
                type="date"
                value={rsDate}
                onChange={e => setRsDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jam Mulai</label>
              <TimePicker value={rsStartTime} onChange={setRsStartTime} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jam Selesai</label>
              <TimePicker value={rsEndTime || rsStartTime} onChange={setRsEndTime} />
            </div>

            {rsDate && rsStartTime && (
              <div className="px-4 py-3 rounded-xl bg-[#E8F0EA]">
                <p className="text-sm font-semibold text-[#2D5A3D]">
                  {format(parseISO(rsDate), 'EEEE, d MMMM yyyy', { locale: id })}
                </p>
                <p className="text-sm text-[#2D5A3D] mt-0.5">
                  {rsStartTime}{rsEndTime ? ` → ${rsEndTime}` : ''}
                  {rsEndTime && (() => {
                    const [sh, sm] = rsStartTime.split(':').map(Number)
                    const [eh, em] = rsEndTime.split(':').map(Number)
                    const dur = (eh * 60 + em) - (sh * 60 + sm)
                    if (dur <= 0) return null
                    return ` · ${dur < 60 ? `${dur} mnt` : dur % 60 === 0 ? `${dur / 60} jam` : `${Math.floor(dur / 60)} jam ${dur % 60} mnt`}`
                  })()}
                </p>
              </div>
            )}

            <button
              onClick={saveReschedule}
              disabled={rsSaving || !rsDate || !rsStartTime}
              className="w-full py-3.5 rounded-xl bg-[#2D5A3D] text-white font-semibold text-base disabled:opacity-40 active:opacity-80"
            >
              {rsSaving ? 'Menyimpan...' : 'Simpan Jadwal Baru'}
            </button>
          </div>
        </div>
      )}

      {/* Edit services bottom sheet */}
      {showEditServices && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditServices(false)} />
          <div className="relative bg-white rounded-t-3xl px-4 pt-5 pb-8 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Edit Layanan</h2>
              <button onClick={() => setShowEditServices(false)} className="p-1 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2 mb-4">
              {allServices.filter(s => s.is_active || editServiceIds.includes(s.id)).map(s => {
                const selected = editServiceIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setEditServiceIds(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border text-left active:opacity-80"
                    style={{ borderColor: selected ? '#2D5A3D' : '#e5e7eb', background: selected ? '#E8F0EA' : '#fff' }}
                  >
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2"
                      style={{ borderColor: selected ? '#2D5A3D' : '#d1d5db', background: selected ? '#2D5A3D' : 'transparent' }}>
                      {selected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 flex-1">{s.name}</span>
                    <span className="text-sm font-semibold" style={{ color: selected ? '#2D5A3D' : '#6b7280' }}>{formatPrice(s.price)}</span>
                  </button>
                )
              })}
            </div>
            {editServiceIds.length > 0 && (
              <div className="flex justify-between items-center px-1 mb-3">
                <span className="text-sm text-gray-500">Total baru</span>
                <span className="text-base font-bold text-[#2D5A3D]">
                  {formatPrice(allServices.filter(s => editServiceIds.includes(s.id)).reduce((sum, s) => sum + s.price, 0))}
                </span>
              </div>
            )}
            <button
              onClick={saveEditServices}
              disabled={savingServices || editServiceIds.length === 0}
              className="w-full py-3.5 rounded-xl bg-[#2D5A3D] text-white font-semibold text-base disabled:opacity-40 active:opacity-80"
            >
              {savingServices ? 'Menyimpan...' : 'Simpan Layanan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
