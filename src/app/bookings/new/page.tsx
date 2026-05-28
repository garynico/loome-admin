'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import type { Customer, Service, CustomerPackage } from '@/types'
import TimePicker from '@/components/TimePicker'

function formatPrice(price: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price)
}

function formatPriceInput(val: string) {
  const n = Number(val.replace(/\D/g, ''))
  if (!n) return ''
  return new Intl.NumberFormat('id-ID').format(n)
}

function NewBookingForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const preCustomerId = searchParams.get('customer_id')
  const preCustomerName = searchParams.get('customer_name')
  const preDate = searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd')
  const preTime = searchParams.get('time') ?? '09:00'
  const preEndTime = searchParams.get('endtime') ?? null

  function calcDuration(start: string, end: string): number | null {
    if (!end) return null
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const dur = (eh * 60 + em) - (sh * 60 + sm)
    return dur > 0 ? dur : null
  }

  const [customerId, setCustomerId] = useState(preCustomerId ?? '')
  const [customerName, setCustomerName] = useState(preCustomerName ?? '')
  const [customerGender, setCustomerGender] = useState<'male' | 'female' | null>(null)
  const [customerSearch, setCustomerSearch] = useState(preCustomerName ?? '')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [showSearch, setShowSearch] = useState(!preCustomerId)
  const [showCustomerList, setShowCustomerList] = useState(false)
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [customerListSearch, setCustomerListSearch] = useState('')

  const [services, setServices] = useState<Service[]>([])
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [servicesExpanded, setServicesExpanded] = useState(false)
  const SERVICES_PREVIEW = 4

  // package
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([])
  const [usePackageId, setUsePackageId] = useState<string | null>(null)

  // price override
  const [priceEditing, setPriceEditing] = useState(false)
  const [customPriceRaw, setCustomPriceRaw] = useState('')

  // down payment
  const [hasDp, setHasDp] = useState(false)
  const [dpRaw, setDpRaw] = useState('')

  const [date, setDate] = useState(preDate)
  const [time, setTime] = useState(preTime)
  const [endTime, setEndTime] = useState(preEndTime ?? '')
  const [editingDateTime, setEditingDateTime] = useState(false)
  const [edDate, setEdDate] = useState(preDate)
  const [edStart, setEdStart] = useState(preTime)
  const [edEnd, setEdEnd] = useState(preEndTime ?? '')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedBooking, setSavedBooking] = useState<{
    id: string; customerName: string; customerPhone: string
    serviceNames: string[]; totalPrice: number; date: string; time: string
  } | null>(null)

  const selectedServices = services.filter(s => serviceIds.includes(s.id))
  const activePackage = usePackageId ? customerPackages.find(cp => cp.id === usePackageId) : null
  const coveredServiceId = activePackage?.service_id ?? null
  const calculatedTotal = selectedServices.reduce((sum, s) => sum + (s.id === coveredServiceId ? 0 : s.price), 0)

  // Filter by customer gender, then collapse to preview count
  const relevantServices = customerGender
    ? services.filter(s => s.gender_target === 'all' || s.gender_target === customerGender)
    : services
  // Always include already-selected services even if filtered out
  const visibleServices = servicesExpanded
    ? relevantServices
    : relevantServices.slice(0, SERVICES_PREVIEW)
  const hiddenCount = relevantServices.length - SERVICES_PREVIEW

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(setServices)
  }, [])

  useEffect(() => {
    if (!customerId) { setCustomerPackages([]); setUsePackageId(null); return }
    fetch(`/api/customer-packages?customer_id=${customerId}&status=active`)
      .then(r => r.ok ? r.json() : [])
      .then(setCustomerPackages)
  }, [customerId])

  useEffect(() => {
    if (!priceEditing) setCustomPriceRaw(String(calculatedTotal))
  }, [calculatedTotal, priceEditing])

  useEffect(() => {
    if (!customerSearch.trim() || !showSearch) return
    const t = setTimeout(async () => {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(customerSearch)}`)
      if (res.ok) setCustomerResults(await res.json())
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch, showSearch])

  function toggleService(id: string) {
    setServiceIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      // deselect package if its covered service is removed
      if (activePackage && coveredServiceId && !next.includes(coveredServiceId)) {
        setUsePackageId(null)
      }
      return next
    })
    setPriceEditing(false)
  }

  function selectCustomer(c: Customer) {
    setCustomerId(c.id)
    setCustomerName(c.name)
    setCustomerGender(c.gender ?? null)
    setCustomerSearch(c.name)
    setShowSearch(false)
    setCustomerResults([])
    setShowCustomerList(false)
    setCustomerListSearch('')
    setServicesExpanded(false)
    setServiceIds([])
    setUsePackageId(null)
    setPriceEditing(false)
  }

  async function openCustomerList() {
    setShowCustomerList(true)
    setCustomerListSearch('')
    if (allCustomers.length === 0) {
      const res = await fetch('/api/customers')
      if (res.ok) setAllCustomers(await res.json())
    }
  }

  const filteredAllCustomers = customerListSearch.trim()
    ? allCustomers.filter(c =>
        c.name.toLowerCase().includes(customerListSearch.toLowerCase()) ||
        c.phone.includes(customerListSearch)
      )
    : allCustomers

  function startEditPrice() {
    setCustomPriceRaw(String(calculatedTotal))
    setPriceEditing(true)
  }

  function resetPrice() {
    setPriceEditing(false)
    setCustomPriceRaw(String(calculatedTotal))
  }

  const finalPrice = priceEditing && Number(customPriceRaw) > 0 ? Number(customPriceRaw) : null
  const displayTotal = finalPrice ?? calculatedTotal

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) { setError('Pilih pelanggan terlebih dahulu'); return }
    if (serviceIds.length === 0) { setError('Pilih minimal satu layanan'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        service_ids: serviceIds,
        date,
        time,
        duration_minutes: calcDuration(time, endTime),
        notes,
        custom_price: displayTotal,
        dp_amount: hasDp && Number(dpRaw) > 0 ? Number(dpRaw) : 0,
        customer_package_id: usePackageId ?? null,
      }),
    })

    if (res.ok) {
      const booking = await res.json()
      setSavedBooking({
        id: booking.id,
        customerName: booking.customer?.name ?? customerName,
        customerPhone: booking.customer?.phone ?? '',
        serviceNames: (booking.services as Service[])?.map((s: Service) => s.name) ?? selectedServices.map(s => s.name),
        totalPrice: booking.custom_price ?? (booking.services as Service[])?.reduce((s: number, x: Service) => s + x.price, 0) ?? calculatedTotal,
        date: booking.date,
        time: booking.time,
      })
    } else {
      const data = await res.json()
      setError(data.error ?? 'Terjadi kesalahan')
      setLoading(false)
    }
  }

  if (savedBooking) {
    const waPhone = savedBooking.customerPhone.replace(/^0/, '62').replace(/[^0-9]/g, '')
    const dateFormatted = format(parseISO(savedBooking.date), 'EEEE, d MMMM yyyy', { locale: id })
    const svcLine = savedBooking.serviceNames.map(n => `• ${n}`).join('\n')
    const waMsg = encodeURIComponent(
      `Halo ${savedBooking.customerName},\n\n` +
      `Berikut konfirmasi janji Anda di Loome Hair Removal:\n\n` +
      `📋 Layanan: ${savedBooking.serviceNames.join(', ')}\n` +
      `📅 Tanggal: ${dateFormatted}\n` +
      `⏰ Waktu: ${savedBooking.time.slice(0, 5)}\n\n` +
      `Lokasi:\n📍Loome Hair Removal\nhttps://maps.app.goo.gl/ZAgDR6Ewjppjf5JP7?g_st=ic\n\n` +
      `Ditunggu kedatangannya! 💚`
    )

    return (
      <div className="flex flex-col h-screen bg-white">
        <header className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Janji Tersimpan!</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="w-20 h-20 rounded-full bg-[#E8F0EA] flex items-center justify-center">
            <svg className="w-10 h-10 text-[#2D5A3D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">{savedBooking.customerName}</p>
            <p className="text-sm text-gray-500 mt-1">{savedBooking.serviceNames.join(', ')}</p>
            <p className="text-sm font-semibold text-[#2D5A3D] mt-0.5">{formatPrice(savedBooking.totalPrice)}</p>
            <p className="text-sm text-[#2D5A3D] mt-0.5">{dateFormatted} · {savedBooking.time.slice(0, 5)}</p>
          </div>
          <div className="w-full space-y-3">
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
            <button
              onClick={() => router.push('/calendar')}
              className="w-full py-3.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-base active:bg-gray-50"
            >
              Kembali ke Kalender
            </button>
          </div>
        </div>
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
        <h1 className="text-lg font-bold text-gray-900">Buat Janji</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 space-y-5">
          {/* Customer selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Pelanggan</label>
            {customerId && !showSearch ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#E8F0EA]">
                <div className="w-9 h-9 rounded-full bg-[#2D5A3D] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">{customerName.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 flex-1">{customerName}</span>
                <button type="button" onClick={() => { setShowSearch(true); setCustomerId(''); setCustomerName(''); setCustomerSearch('') }} className="text-xs text-[#2D5A3D] font-medium">Ganti</button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowSearch(true) }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
                      placeholder="Cari nama pelanggan..."
                    />
                    {customerResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {customerResults.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectCustomer(c)}
                            className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 active:bg-gray-50 text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-[#E8F0EA] flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-[#2D5A3D]">{c.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                              <p className="text-xs text-gray-500">{c.phone}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={openCustomerList}
                    className="flex-shrink-0 px-3 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 active:bg-gray-100"
                    title="Lihat semua pelanggan"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h10M4 18h7" />
                    </svg>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/customers/new?redirect=booking')}
                  className="mt-2 text-sm text-[#2D5A3D] font-medium"
                >
                  + Tambah pelanggan baru
                </button>
              </div>
            )}
          </div>

          {/* Active packages — shown as soon as a customer with packages is selected */}
          {customerId && customerPackages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Paket Aktif</label>
              <div className="space-y-2">
                {customerPackages.map(cp => {
                  const remaining = cp.sessions_total - cp.sessions_used
                  const selected = usePackageId === cp.id
                  return (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          setUsePackageId(null)
                        } else {
                          setUsePackageId(cp.id)
                          if (cp.service_id && !serviceIds.includes(cp.service_id)) {
                            setServiceIds(prev => [...prev, cp.service_id!])
                            setPriceEditing(false)
                          }
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:opacity-80"
                      style={{
                        borderColor: selected ? '#2D5A3D' : '#e5e7eb',
                        background: selected ? '#2D5A3D' : '#fff',
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: selected ? 'rgba(255,255,255,0.2)' : '#E8F0EA' }}>
                        <svg className="w-4 h-4" style={{ color: selected ? '#fff' : '#2D5A3D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: selected ? '#fff' : '#111827' }}>
                          {cp.package_name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: selected ? 'rgba(255,255,255,0.75)' : '#6b7280' }}>
                          {remaining} sesi tersisa · {cp.service?.name ?? 'Semua layanan'}
                        </p>
                      </div>
                      {selected ? (
                        <span className="text-[10px] font-bold text-[#2D5A3D] bg-white px-2 py-1 rounded-full flex-shrink-0">Aktif</span>
                      ) : (
                        <span className="text-[10px] font-medium text-gray-400 flex-shrink-0">Gunakan</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Service multi-select */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Layanan</label>
              {customerGender && (
                <span className="text-xs text-gray-400">
                  {customerGender === 'female' ? '♀ Wanita' : '♂ Pria'} · {relevantServices.length} layanan
                </span>
              )}
            </div>
            <div className="space-y-2">
              {visibleServices.map(s => {
                const selected = serviceIds.includes(s.id)
                const isCovered = !!(activePackage && s.id === coveredServiceId)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:opacity-80"
                    style={{
                      borderColor: selected ? '#2D5A3D' : '#e5e7eb',
                      background: selected ? '#E8F0EA' : '#fff',
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2"
                      style={{ borderColor: selected ? '#2D5A3D' : '#d1d5db', background: selected ? '#2D5A3D' : 'transparent' }}
                    >
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 flex-1">{s.name}</span>
                    {isCovered ? (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">GRATIS</span>
                    ) : (
                      <span className="text-sm font-semibold" style={{ color: selected ? '#2D5A3D' : '#6b7280' }}>
                        {formatPrice(s.price)}
                      </span>
                    )}
                  </button>
                )
              })}
              {relevantServices.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  {services.length === 0 ? (
                    <>Belum ada layanan.{' '}<button type="button" onClick={() => router.push('/services/new')} className="text-[#2D5A3D] font-medium">Tambah dulu</button></>
                  ) : 'Tidak ada layanan untuk gender ini.'}
                </p>
              )}
            </div>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setServicesExpanded(v => !v)}
                className="mt-2 w-full py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 font-medium active:bg-gray-50 flex items-center justify-center gap-1.5"
              >
                {servicesExpanded ? (
                  <>Sembunyikan <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></>
                ) : (
                  <>+{hiddenCount} layanan lainnya <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></>
                )}
              </button>
            )}

            {/* Price total */}
            {serviceIds.length > 0 && (
              <div className="mt-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Total</span>
                  {!priceEditing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-[#2D5A3D]">{formatPrice(calculatedTotal)}</span>
                      <button
                        type="button"
                        onClick={startEditPrice}
                        className="text-xs text-gray-400 underline active:text-gray-600"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatPriceInput(customPriceRaw)}
                        onChange={e => setCustomPriceRaw(e.target.value.replace(/\D/g, ''))}
                        className="w-32 text-right px-2 py-1 rounded-lg border border-[#2D5A3D] text-base font-bold text-[#2D5A3D] bg-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={resetPrice}
                        className="text-xs text-gray-400 underline active:text-gray-600"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
                {priceEditing && displayTotal !== calculatedTotal && (
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    Harga normal: {formatPrice(calculatedTotal)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Down Payment */}
          {serviceIds.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => { setHasDp(v => !v); setDpRaw('') }}
                className="flex items-center gap-2.5 w-full"
              >
                <div
                  className="w-10 h-6 rounded-full transition-colors flex-shrink-0 relative"
                  style={{ background: hasDp ? '#2D5A3D' : '#d1d5db' }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all"
                    style={{ left: hasDp ? '18px' : '2px' }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700">Uang Muka (DP)</span>
              </button>
              {hasDp && (
                <div className="mt-2.5 space-y-2">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={dpRaw ? formatPriceInput(dpRaw) : ''}
                      onChange={e => setDpRaw(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
                      placeholder="500.000"
                      autoFocus
                    />
                  </div>
                  {Number(dpRaw) > 0 && (
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs text-gray-500">Sisa pembayaran saat selesai</span>
                      <span className="text-xs font-bold text-orange-600">{formatPrice(displayTotal - Number(dpRaw))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Date & Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal &amp; Waktu</label>
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#E8F0EA]">
              <svg className="w-5 h-5 text-[#2D5A3D] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {format(parseISO(date), 'EEEE, d MMMM yyyy', { locale: id })}
                </p>
                <p className="text-sm font-bold text-[#2D5A3D] mt-0.5">
                  {time.slice(0, 5)}{endTime ? ` → ${endTime.slice(0, 5)}` : ''}
                  {(() => { const d = calcDuration(time, endTime); return d ? ` · ${d < 60 ? `${d} mnt` : d % 60 === 0 ? `${d / 60} jam` : `${Math.floor(d / 60)} jam ${d % 60} mnt`}` : '' })()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setEdDate(date); setEdStart(time); setEdEnd(endTime); setEditingDateTime(true) }}
                className="text-xs text-[#2D5A3D] font-medium"
              >Ubah</button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan (opsional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] resize-none"
              placeholder="Catatan tambahan..."
            />
          </div>

          {/* Summary */}
          {customerId && serviceIds.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#E8F0EA]">
              <p className="text-xs font-semibold text-[#2D5A3D] uppercase tracking-wide mb-2">Ringkasan</p>
              <p className="text-sm font-semibold text-gray-900">{customerName}</p>
              {selectedServices.map(s => (
                <div key={s.id} className="flex justify-between text-sm text-gray-700 mt-0.5">
                  <span>{s.name}</span>
                  <span>{formatPrice(s.price)}</span>
                </div>
              ))}
              {priceEditing && displayTotal !== calculatedTotal && (
                <div className="flex justify-between text-sm font-semibold text-[#2D5A3D] mt-1 pt-1 border-t border-[#2D5A3D]/20">
                  <span>Total (diedit)</span>
                  <span>{formatPrice(displayTotal)}</span>
                </div>
              )}
              {(!priceEditing || displayTotal === calculatedTotal) && selectedServices.length > 1 && (
                <div className="flex justify-between text-sm font-semibold text-[#2D5A3D] mt-1 pt-1 border-t border-[#2D5A3D]/20">
                  <span>Total</span>
                  <span>{formatPrice(calculatedTotal)}</span>
                </div>
              )}
              <p className="text-sm text-gray-700 mt-1">
                {format(parseISO(date), 'EEEE, d MMMM yyyy', { locale: id })} · {time.slice(0, 5)}{endTime ? ` → ${endTime.slice(0, 5)}` : ''}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !customerId || serviceIds.length === 0}
            className="w-full py-3.5 rounded-xl bg-[#2D5A3D] text-white font-semibold text-base disabled:opacity-40 active:opacity-80"
          >
            {loading ? 'Menyimpan...' : 'Simpan Janji'}
          </button>

          <div style={{ height: 24 }} />
        </div>
      </form>

      {/* Date & Time edit bottom sheet */}
      {editingDateTime && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingDateTime(false)} />
          <div className="relative bg-white rounded-t-3xl px-4 pt-5 pb-8 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-900">Ubah Tanggal &amp; Waktu</h2>
              <button type="button" onClick={() => setEditingDateTime(false)} className="p-1 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Baru</label>
              <input
                type="date"
                value={edDate}
                onChange={e => setEdDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jam Mulai</label>
              <TimePicker value={edStart} onChange={setEdStart} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jam Selesai</label>
              <TimePicker value={edEnd || edStart} onChange={setEdEnd} />
            </div>

            {edDate && edStart && (
              <div className="px-4 py-3 rounded-xl bg-[#E8F0EA]">
                <p className="text-sm font-semibold text-[#2D5A3D]">
                  {format(parseISO(edDate), 'EEEE, d MMMM yyyy', { locale: id })}
                </p>
                <p className="text-sm text-[#2D5A3D] mt-0.5">
                  {edStart}{edEnd ? ` → ${edEnd}` : ''}
                  {(() => {
                    const d = calcDuration(edStart, edEnd)
                    if (!d) return ''
                    return ` · ${d < 60 ? `${d} mnt` : d % 60 === 0 ? `${d / 60} jam` : `${Math.floor(d / 60)} jam ${d % 60} mnt`}`
                  })()}
                </p>
              </div>
            )}

            <button
              type="button"
              disabled={!edDate || !edStart}
              onClick={() => {
                setDate(edDate)
                setTime(edStart)
                setEndTime(edEnd)
                setEditingDateTime(false)
              }}
              className="w-full py-3.5 rounded-xl bg-[#2D5A3D] text-white font-semibold text-base disabled:opacity-40 active:opacity-80"
            >
              Simpan
            </button>
          </div>
        </div>
      )}

      {/* All-customers bottom sheet */}
      {showCustomerList && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCustomerList(false)} />
          <div className="relative bg-white rounded-t-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Pilih Pelanggan</h2>
              <button type="button" onClick={() => setShowCustomerList(false)} className="p-1.5 text-gray-400 active:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-4 py-2 border-b border-gray-100">
              <input
                type="text"
                value={customerListSearch}
                onChange={e => setCustomerListSearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]"
                placeholder="Cari nama atau nomor..."
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredAllCustomers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">
                  {allCustomers.length === 0 ? 'Memuat...' : 'Tidak ada hasil'}
                </p>
              ) : (
                filteredAllCustomers.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 active:bg-gray-50 text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#E8F0EA] flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#2D5A3D]">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.phone}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewBookingPage() {
  return (
    <Suspense>
      <NewBookingForm />
    </Suspense>
  )
}
