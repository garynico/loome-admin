export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

function bookingTotal(b: Record<string, unknown>): number {
  const services = (b.services as { price: number }[] | null) ?? []
  const service = b.service as { price: number } | null
  const svcList = services.length ? services : service ? [service] : []
  return (b.custom_price as number | null) ?? svcList.reduce((s, x) => s + x.price, 0)
}

function formatIDR(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  const [year, mon] = month.split('-')
  const startDate = `${year}-${mon}-01`
  const endDate = new Date(Number(year), Number(mon), 0).toISOString().split('T')[0]

  // Fetch completed bookings for the month
  const { data: rawBookings, error: bErr } = await supabase
    .from('bookings')
    .select('*, customer:customers(*), service:services(*)')
    .eq('status', 'completed')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('time')

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })

  // Attach multi-services
  const allIds = Array.from(new Set((rawBookings ?? []).flatMap((b: Record<string, unknown>) => (b.service_ids as string[] | null) ?? [])))
  const serviceMap: Record<string, { id: string; name: string; price: number }> = {}
  if (allIds.length > 0) {
    const { data: svcs } = await supabase.from('services').select('*').in('id', allIds)
    for (const s of svcs ?? []) serviceMap[s.id] = s as { id: string; name: string; price: number }
  }

  const bookings = (rawBookings ?? []).map((b: Record<string, unknown>) => {
    const ids = (b.service_ids as string[] | null) ?? (b.service_id ? [b.service_id as string] : [])
    const services = ids.map(id => serviceMap[id]).filter(Boolean)
    return { ...b, services: services.length ? services : (b.service ? [b.service] : []) }
  })

  // Fetch non-cancelled package purchases for the month
  const { data: pkgs, error: pErr } = await supabase
    .from('customer_packages')
    .select('*, customer:customers(*)')
    .neq('status', 'cancelled')
    .gte('purchased_at', startDate)
    .lte('purchased_at', endDate + 'T23:59:59')
    .order('purchased_at')

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  // Build rows
  const rows: (string | number)[][] = []

  let no = 1

  for (const b of bookings) {
    const bk = b as Record<string, unknown>
    const services = bk.services as { name: string }[] | undefined
    const service = bk.service as { name: string } | null
    const svcLabel = services?.length
      ? services.map(s => s.name).join(', ')
      : (service?.name ?? 'Layanan')
    const customer = bk.customer as { name: string } | null
    const total = bookingTotal(bk)
    rows.push([
      no++,
      bk.date as string,
      bk.time ? (bk.time as string).slice(0, 5) : '',
      customer?.name ?? '—',
      svcLabel,
      'Kunjungan',
      total,
      formatIDR(total),
    ])
  }

  for (const p of pkgs ?? []) {
    const pkg = p as Record<string, unknown>
    const customer = pkg.customer as { name: string } | null
    const purchasedAt = (pkg.purchased_at as string).slice(0, 10)
    const amount = pkg.paid_price as number
    rows.push([
      no++,
      purchasedAt,
      '',
      customer?.name ?? '—',
      pkg.package_name as string,
      'Paket',
      amount,
      formatIDR(amount),
    ])
  }

  // Sort all rows by date then time
  rows.sort((a, b) => {
    const dateA = `${a[1]}${a[2]}`
    const dateB = `${b[1]}${b[2]}`
    return dateA.localeCompare(dateB)
  })

  // Re-number after sort
  rows.forEach((r, i) => { r[0] = i + 1 })

  const totalRevenue = rows.reduce((sum, r) => sum + (r[6] as number), 0)

  const headers = ['No', 'Tanggal', 'Waktu', 'Pelanggan', 'Layanan / Paket', 'Tipe', 'Harga (IDR)', 'Harga (Format)']

  const wsData = [headers, ...rows]

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 12 },  // Tanggal
    { wch: 8 },   // Waktu
    { wch: 25 },  // Pelanggan
    { wch: 35 },  // Layanan
    { wch: 12 },  // Tipe
    { wch: 15 },  // Harga IDR
    { wch: 20 },  // Harga Format
  ]

  // Total row
  const totalRow = ['', '', '', '', '', 'TOTAL', totalRevenue, formatIDR(totalRevenue)]
  XLSX.utils.sheet_add_aoa(ws, [totalRow], { origin: -1 })

  const wb = XLSX.utils.book_new()
  const sheetName = `Revenue ${month}`
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const monthLabel = new Date(Number(year), Number(mon) - 1, 1)
    .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Revenue ${monthLabel}.xlsx"`,
    },
  })
}
