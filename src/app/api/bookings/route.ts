export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

async function attachServices(bookings: Record<string, unknown>[]) {
  const allIds = Array.from(new Set(bookings.flatMap(b => (b.service_ids as string[] | null) ?? [])))
  const serviceMap: Record<string, unknown> = {}
  if (allIds.length > 0) {
    const { data } = await supabase.from('services').select('*').in('id', allIds)
    for (const s of data ?? []) serviceMap[(s as { id: string }).id] = s
  }
  return bookings.map(b => {
    const ids = (b.service_ids as string[] | null) ?? (b.service_id ? [b.service_id as string] : [])
    const services = ids.map(id => serviceMap[id]).filter(Boolean)
    return { ...b, services: services.length ? services : (b.service ? [b.service] : []) }
  })
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  const month = req.nextUrl.searchParams.get('month')
  const customerId = req.nextUrl.searchParams.get('customer_id')

  let query = supabase
    .from('bookings')
    .select('*, customer:customers(*), service:services(*)')
    .order('date')
    .order('time')

  if (date) {
    query = query.eq('date', date)
  } else if (month) {
    const [year, mon] = month.split('-')
    const start = `${year}-${mon}-01`
    const end = new Date(Number(year), Number(mon), 0).toISOString().split('T')[0]
    query = query.gte('date', start).lte('date', end)
  }

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(await attachServices(data as Record<string, unknown>[]))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { customer_id, service_ids, date, time, duration_minutes, notes, custom_price, dp_amount } = body

  const ids: string[] = Array.isArray(service_ids) && service_ids.length > 0 ? service_ids : []
  if (!customer_id || ids.length === 0) {
    return NextResponse.json({ error: 'customer_id and at least one service are required' }, { status: 400 })
  }

  const { customer_package_id } = body

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id,
      service_id: ids[0],
      service_ids: ids,
      date: date || null,
      time: time || null,
      duration_minutes: duration_minutes || null,
      notes: notes || null,
      custom_price: custom_price ?? null,
      dp_amount: dp_amount ?? 0,
      customer_package_id: customer_package_id || null,
    })
    .select('*, customer:customers(*), service:services(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Atomically deduct one session from the package
  if (customer_package_id) {
    await supabase.rpc('adjust_package_sessions', { pkg_id: customer_package_id, delta: 1 })
  }

  const [enriched] = await attachServices([data as Record<string, unknown>])
  return NextResponse.json(enriched, { status: 201 })
}

