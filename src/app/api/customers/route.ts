export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  const followup = req.nextUrl.searchParams.get('followup')

  if (followup === 'true') {
    const [custRes, bookingRes, svcRes] = await Promise.all([
      supabase.from('customers').select('*').eq('is_deleted', false).order('name'),
      supabase.from('bookings').select('customer_id, date, service_ids, service_id').neq('status', 'cancelled').not('date', 'is', null).order('date', { ascending: false }),
      supabase.from('services').select('id, name'),
    ])
    if (custRes.error) return NextResponse.json({ error: custRes.error.message }, { status: 500 })

    const serviceMap = new Map((svcRes.data ?? []).map(s => [s.id, s.name]))

    // Last non-cancelled booking per customer
    const lastBooking = new Map<string, { date: string; service_ids: string[] | null; service_id: string | null }>()
    for (const b of bookingRes.data ?? []) {
      if (!lastBooking.has(b.customer_id)) lastBooking.set(b.customer_id, b)
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    const result = (custRes.data ?? [])
      .filter(c => {
        const lb = lastBooking.get(c.id)
        return !lb || lb.date < cutoffStr
      })
      .map(c => {
        const lb = lastBooking.get(c.id)
        const ids = lb?.service_ids?.length ? lb.service_ids : lb?.service_id ? [lb.service_id] : []
        return {
          ...c,
          last_booking_date: lb?.date ?? null,
          last_service: ids.map(id => serviceMap.get(id)).filter(Boolean).join(', ') || null,
        }
      })
      .sort((a, b) => {
        if (!a.last_booking_date) return -1
        if (!b.last_booking_date) return 1
        return a.last_booking_date.localeCompare(b.last_booking_date)
      })

    return NextResponse.json(result)
  }

  let query = supabase.from('customers').select('*').eq('is_deleted', false).order('name')

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, phone, gender } = body

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({ name: name.trim(), phone: phone.trim(), gender: gender ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

