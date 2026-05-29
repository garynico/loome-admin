'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import type { Customer, BookingWithRelations, CustomerPackage, Package } from '@/types'

function formatPrice(price: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price)
}

const WA_ICON = (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

export default function CustomerProfilePage() {
  const router = useRouter()
  const { id: customerId } = useParams<{ id: string }>()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editGender, setEditGender] = useState<'male' | 'female' | ''>('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [editingNotes, setEditingNotes] = useState(false)
  const [notesInput, setNotesInput] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([])
  const [showBuyPackage, setShowBuyPackage] = useState(false)
  const [availablePackages, setAvailablePackages] = useState<Package[]>([])
  const [buyPackageId, setBuyPackageId] = useState('')
  const [buyPriceRaw, setBuyPriceRaw] = useState('')
  const [buyNotes, setBuyNotes] = useState('')
  const [buyingSaving, setBuyingSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [custRes, pkgRes] = await Promise.all([
        fetch(`/api/customers/${customerId}`),
        fetch(`/api/customer-packages?customer_id=${customerId}`),
      ])
      if (custRes.ok) {
        const data = await custRes.json()
        setCustomer(data.customer)
        setBookings(data.bookings)
      }
      if (pkgRes.ok) setCustomerPackages(await pkgRes.json())
      setLoading(false)
    }
    load()
  }, [customerId])

  async function openBuyPackage() {
    const res = await fetch('/api/packages')
    if (res.ok) setAvailablePackages(await res.json())
    setBuyPackageId('')
    setBuyPriceRaw('')
    setBuyNotes('')
    setShowBuyPackage(true)
  }

  function selectBuyPackage(pkg: Package) {
    setBuyPackageId(pkg.id)
    setBuyPriceRaw(String(pkg.price))
  }

  async function handleBuyPackage() {
    if (!buyPackageId) return
    setBuyingSaving(true)
    const res = await fetch('/api/customer-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        package_id: buyPackageId,
        paid_price: Number(buyPriceRaw) || undefined,
        notes: buyNotes || null,
      }),
    })
    if (res.ok) {
      const newPkg = await res.json()
      setCustomerPackages(prev => [...prev, newPkg])
      setShowBuyPackage(false)
    }
    setBuyingSaving(false)
  }

  const completedBookings = bookings.filter(b => b.status === 'completed')
  const serviceCount: Record<string, number> = {}
  completedBookings.forEach(b => {
    if (b.service?.name) serviceCount[b.service.name] = (serviceCount[b.service.name] ?? 0) + 1
  })
  const topService = Object.entries(serviceCount).sort((a, b) => b[1] - a[1])[0]?.[0]

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const upcomingBookings = bookings.filter(b => b.status === 'confirmed' && !!b.date && b.date >= todayStr)
  const nextBooking = upcomingBookings
    .slice()
    .sort((a, b) => a.date!.localeCompare(b.date!) || (a.time ?? '').localeCompare(b.time ?? ''))[0]

  function startEdit() {
    if (!customer) return
    setEditName(customer.name)
    setEditPhone(customer.phone)
    setEditGender(customer.gender ?? '')
    setEditError('')
    setIsEditing(true)
  }

  async function handleSaveEdit() {
    if (!editName.trim()) { setEditError('Nama tidak boleh kosong'); return }
    setSaving(true)
    setEditError('')
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), phone: editPhone.trim(), gender: editGender || null }),
    })
    if (res.ok) {
      setCustomer(await res.json())
      setIsEditing(false)
    } else {
      setEditError('Gagal menyimpan perubahan')
    }
    setSaving(false)
  }

  async function saveNotes() {
    setNotesSaving(true)
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesInput.trim() || null }),
    })
    if (res.ok) {
      setCustomer(await res.json())
      setEditingNotes(false)
    }
    setNotesSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`Hapus pelanggan "${customer?.name}"? Data tetap tersimpan dan bisa dipulihkan.`)) return
    setDeleting(true)
    await fetch(`/api/customers/${customerId}`, { method: 'DELETE' })
    router.push('/customers')
  }

  async function handleRestore() {
    setDeleting(true)
    await fetch(`/api/customers/${customerId}`, { method: 'POST' })
    const res = await fetch(`/api/customers/${customerId}`)
    if (res.ok) { const data = await res.json(); setCustomer(data.customer) }
    setDeleting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-6 h-6 rounded-full border-2 border-[#2D5A3D] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white gap-3">
        <p className="text-gray-500">Pelanggan tidak ditemukan</p>
        <button onClick={() => router.push('/customers')} className="text-sm text-[#2D5A3D]">Kembali</button>
      </div>
    )
  }

  const waPhone = customer.phone.replace(/^0/, '62').replace(/[^0-9]/g, '')

  const nextBookingSvcNames = nextBooking
    ? (nextBooking.services?.length ? nextBooking.services.map(s => s.name).join(', ') : nextBooking.service?.name ?? 'Layanan')
    : null

  const waReminderMsg = nextBooking ? encodeURIComponent(
    `Halo ${customer.name},\n` +
    `Kami ingin mengingatkan jadwal treatment kakak pada:\n\n` +
    `📋 Layanan: ${nextBookingSvcNames}\n` +
    (nextBooking.date ? `📅 Tanggal: ${format(parseISO(nextBooking.date), 'EEEE, d MMMM yyyy', { locale: id })}\n` : '') +
    (nextBooking.time ? `⏰ Waktu: ${nextBooking.time.slice(0, 5)}\n` : '') +
    `\n` +
    `Lokasi:\n📍Loome Hair Removal\nhttps://maps.app.goo.gl/ZAgDR6Ewjppjf5JP7?g_st=ic\n\n` +
    `Mohon dibantu konfirmasi dengan memilih salah satu jawaban: Hadir, Batal, Reschedule.\n` +
    `Terimakasih banyak kak! 💚`
  ) : null

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500 active:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Profil Pelanggan</h1>
        {customer.is_deleted ? (
          <button onClick={handleRestore} disabled={deleting} className="px-3 py-1.5 text-xs font-semibold text-[#2D5A3D] bg-[#E8F0EA] rounded-lg active:opacity-80 disabled:opacity-50">
            Pulihkan
          </button>
        ) : (
          <>
            <button onClick={startEdit} className="p-2 text-gray-400 active:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={handleDelete} disabled={deleting} className="p-2 text-red-400 active:bg-red-50 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </header>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Profile card */}
        <div className="px-4 py-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#E8F0EA] flex items-center justify-center">
              <span className="text-2xl font-bold text-[#2D5A3D]">{customer.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
                {customer.is_deleted && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-500">Dihapus</span>
                )}
                {customer.gender && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: customer.gender === 'female' ? '#fce7f3' : '#eff6ff', color: customer.gender === 'female' ? '#be185d' : '#1d4ed8' }}>
                    {customer.gender === 'female' ? '♀ Wanita' : '♂ Pria'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{customer.phone}</p>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <a
              href={waReminderMsg ? `https://wa.me/${waPhone}?text=${waReminderMsg}` : `https://wa.me/${waPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold active:opacity-80"
            >
              {WA_ICON}
              {waReminderMsg ? 'Reminder WA' : 'WhatsApp'}
            </a>
            <button
              onClick={() => router.push(`/bookings/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.name)}`)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2D5A3D] text-white text-sm font-semibold active:opacity-80"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Janji Baru
            </button>
          </div>

          {nextBooking && (
            <div className="mt-3 p-3 rounded-xl bg-[#E8F0EA] flex items-center gap-2">
              <svg className="w-4 h-4 text-[#2D5A3D] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#2D5A3D]">Janji mendatang</p>
                <p className="text-xs text-[#2D5A3D] truncate">
                  {nextBooking.date ? format(parseISO(nextBooking.date), 'd MMM yyyy', { locale: id }) : 'Jadwal TBD'}{nextBooking.time ? ` · ${nextBooking.time.slice(0, 5)}` : ''} · {nextBooking.services?.length ? nextBooking.services.map(s => s.name).join(', ') : nextBooking.service?.name}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 px-4 py-4 border-b border-gray-100">
          <div className="bg-[#E8F0EA] rounded-2xl p-3">
            <p className="text-2xl font-bold text-[#2D5A3D]">{completedBookings.length}</p>
            <p className="text-xs text-[#2D5A3D] font-medium mt-0.5">Kunjungan</p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-3">
            <p className="text-2xl font-bold text-blue-600">{upcomingBookings.length}</p>
            <p className="text-xs text-blue-500 font-medium mt-0.5">Mendatang</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3">
            <p className="text-sm font-bold text-gray-900 leading-tight">{topService ?? '—'}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Favorit</p>
          </div>
        </div>

        {/* Admin notes */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Catatan Admin</h3>
            {!editingNotes && (
              <button
                onClick={() => { setNotesInput(customer.notes ?? ''); setEditingNotes(true) }}
                className="text-xs text-[#2D5A3D] font-semibold active:opacity-70"
              >
                {customer.notes ? 'Edit' : '+ Tambah'}
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notesInput}
                onChange={e => setNotesInput(e.target.value)}
                rows={3}
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl border border-[#2D5A3D] bg-gray-50 text-sm text-gray-900 focus:outline-none resize-none"
                placeholder="Contoh: kulit sensitif, alergi X, referral dari Y..."
              />
              <div className="flex gap-2">
                <button
                  onClick={saveNotes}
                  disabled={notesSaving}
                  className="flex-1 py-2 rounded-xl bg-[#2D5A3D] text-white text-sm font-semibold disabled:opacity-50 active:opacity-80"
                >
                  {notesSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  onClick={() => setEditingNotes(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 active:bg-gray-50"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : customer.notes ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{customer.notes}</p>
          ) : (
            <p className="text-sm text-gray-400">Belum ada catatan</p>
          )}
        </div>

        {/* Active packages */}
        {customerPackages.filter(cp => cp.status === 'active').length > 0 && (
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Paket Aktif</h3>
              <button onClick={openBuyPackage} className="text-xs text-[#2D5A3D] font-semibold active:opacity-70">+ Beli Paket</button>
            </div>
            <div className="space-y-2">
              {customerPackages.filter(cp => cp.status === 'active').map(cp => {
                const remaining = cp.sessions_total - cp.sessions_used
                const pct = Math.round((cp.sessions_used / cp.sessions_total) * 100)
                return (
                  <div key={cp.id} className="p-3.5 rounded-2xl border border-gray-100 bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{cp.package_name}</p>
                        {cp.service?.name && <p className="text-xs text-gray-500 mt-0.5">{cp.service.name}</p>}
                      </div>
                      <span className="text-sm font-bold text-[#2D5A3D] flex-shrink-0">{remaining} sesi</span>
                    </div>
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                        <span>{cp.sessions_used} digunakan</span>
                        <span>{cp.sessions_total} total</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full bg-[#2D5A3D]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {customerPackages.filter(cp => cp.status === 'active').length === 0 && (
          <div className="px-4 pt-4 border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-700">Paket</h3>
              <button onClick={openBuyPackage} className="text-xs text-[#2D5A3D] font-semibold active:opacity-70">+ Beli Paket</button>
            </div>
            <p className="text-xs text-gray-400 py-2">Tidak ada paket aktif</p>
          </div>
        )}

        {/* Session history */}
        <div className="px-4 py-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Riwayat Kunjungan</h3>
          {bookings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada kunjungan</p>
          ) : (
            <div className="space-y-2">
              {bookings.map(b => (
                <button
                  key={b.id}
                  onClick={() => router.push(`/bookings/${b.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 active:bg-gray-50 text-left"
                >
                  <div className="flex flex-col items-center w-10 flex-shrink-0">
                    {b.date ? (
                      <>
                        <span className="text-[11px] font-bold text-[#2D5A3D]">
                          {format(parseISO(b.date), 'MMM', { locale: id }).toUpperCase()}
                        </span>
                        <span className="text-lg font-bold text-gray-900 leading-none">
                          {format(parseISO(b.date), 'd')}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {format(parseISO(b.date), 'yyyy')}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-semibold text-orange-400 text-center leading-tight">TBD</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.service?.name ?? 'Layanan dihapus'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {b.time?.slice(0, 5) ?? 'Jadwal TBD'}
                      {b.custom_price != null ? ` · ${formatPrice(b.custom_price)}` : b.service?.price ? ` · ${formatPrice(b.service.price)}` : ''}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-medium px-2 py-1 rounded-full flex-shrink-0"
                    style={{
                      background: b.status === 'confirmed' ? '#E8F0EA' : b.status === 'completed' ? '#f0fdf4' : '#fef2f2',
                      color: b.status === 'confirmed' ? '#2D5A3D' : b.status === 'completed' ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {b.status === 'confirmed' ? 'Konfirmasi' : b.status === 'completed' ? 'Selesai' : 'Batal'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Beli Paket bottom sheet */}
      {showBuyPackage && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowBuyPackage(false)} />
          <div className="relative bg-white rounded-t-3xl px-4 pt-5 pb-8 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Beli Paket</h2>
              <button onClick={() => setShowBuyPackage(false)} className="p-1 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Pilih Paket</p>
              <div className="space-y-2">
                {availablePackages.map(pkg => {
                  const selected = buyPackageId === pkg.id
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => selectBuyPackage(pkg)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border text-left"
                      style={{ borderColor: selected ? '#2D5A3D' : '#e5e7eb', background: selected ? '#E8F0EA' : '#fff' }}
                    >
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: selected ? '#2D5A3D' : '#d1d5db' }}>
                        {selected && <div className="w-2.5 h-2.5 rounded-full bg-[#2D5A3D]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{pkg.name}</p>
                        <p className="text-xs text-gray-500">{pkg.service?.name ?? 'Umum'} · {pkg.sessions}x sesi</p>
                      </div>
                      <span className="text-sm font-semibold text-[#2D5A3D]">
                        {formatPrice(pkg.price)}
                      </span>
                    </button>
                  )
                })}
                {availablePackages.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Belum ada paket tersedia</p>
                )}
              </div>
            </div>

            {buyPackageId && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Harga Dibayar (IDR)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={buyPriceRaw ? new Intl.NumberFormat('id-ID').format(Number(buyPriceRaw)) : ''}
                      onChange={e => setBuyPriceRaw(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan (opsional)</label>
                  <input
                    type="text"
                    value={buyNotes}
                    onChange={e => setBuyNotes(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
                    placeholder="Diskon, referral, dll..."
                  />
                </div>
              </>
            )}

            <button
              onClick={handleBuyPackage}
              disabled={buyingSaving || !buyPackageId}
              className="w-full py-3.5 rounded-xl bg-[#2D5A3D] text-white font-semibold text-base disabled:opacity-40 active:opacity-80"
            >
              {buyingSaving ? 'Menyimpan...' : 'Konfirmasi Pembelian'}
            </button>
          </div>
        </div>
      )}

      {/* Edit drawer */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-t-3xl px-4 pt-5 pb-8 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-900">Edit Profil</h2>
              <button onClick={() => setIsEditing(false)} className="p-2 text-gray-400 active:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
                placeholder="Nama pelanggan"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">No. HP</label>
              <input
                type="tel"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Kelamin</label>
              <div className="grid grid-cols-2 gap-2">
                {(['female', 'male'] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setEditGender(editGender === g ? '' : g)}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all active:opacity-80"
                    style={{
                      borderColor: editGender === g ? '#2D5A3D' : '#e5e7eb',
                      background: editGender === g ? '#E8F0EA' : '#fff',
                      color: editGender === g ? '#2D5A3D' : '#6b7280',
                    }}
                  >
                    <span>{g === 'female' ? '♀' : '♂'}</span>
                    {g === 'female' ? 'Wanita' : 'Pria'}
                  </button>
                ))}
              </div>
            </div>
            {editError && <p className="text-sm text-red-500">{editError}</p>}
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-[#2D5A3D] text-white font-semibold text-base disabled:opacity-60 active:opacity-80"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
