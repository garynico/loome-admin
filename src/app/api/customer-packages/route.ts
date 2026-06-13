export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customer_id')
  const status = req.nextUrl.searchParams.get('status')

  let query = supabase
    .from('customer_packages')
    .select('*, service:services(*), customer:customers(*), package:packages(gender_target)')
    .order('purchased_at', { ascending: true })

  if (customerId) query = query.eq('customer_id', customerId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach last confirmed booking date per customer_package
  const ids = (data ?? []).map((cp: Record<string, unknown>) => cp.id as string)
  let lastUsedMap: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('customer_package_id, date')
      .in('customer_package_id', ids)
      .neq('status', 'cancelled')
      .not('date', 'is', null)
      .order('date', { ascending: false })
    for (const b of bookings ?? []) {
      if (b.customer_package_id && !lastUsedMap[b.customer_package_id]) {
        lastUsedMap[b.customer_package_id] = b.date
      }
    }
  }

  const enriched = (data ?? []).map((cp: Record<string, unknown>) => ({
    ...cp,
    last_booking_date: lastUsedMap[cp.id as string] ?? null,
  }))
  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const { customer_id, package_id, paid_price, notes } = await req.json()
  if (!customer_id || !package_id) {
    return NextResponse.json({ error: 'customer_id and package_id are required' }, { status: 400 })
  }

  const { data: pkg, error: pkgErr } = await supabase
    .from('packages')
    .select('*')
    .eq('id', package_id)
    .single()

  if (pkgErr || !pkg) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('customer_packages')
    .insert({
      customer_id,
      package_id,
      package_name: pkg.name,
      service_id: pkg.service_id,
      sessions_total: pkg.sessions,
      sessions_used: 0,
      paid_price: paid_price ?? pkg.price,
      notes: notes || null,
    })
    .select('*, service:services(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
