export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

async function attachServices(booking: Record<string, unknown>) {
  const ids = (booking.service_ids as string[] | null) ?? (booking.service_id ? [booking.service_id as string] : [])
  if (ids.length === 0) return { ...booking, services: [] }
  const { data } = await supabase.from('services').select('*').in('id', ids)
  const serviceMap = Object.fromEntries((data ?? []).map((s: Record<string, unknown>) => [s.id as string, s]))
  return { ...booking, services: ids.map(id => serviceMap[id]).filter(Boolean) }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customer:customers(*), service:services(*)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(await attachServices(data as Record<string, unknown>))
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { status, notes, date, time, service_ids, service_id, duration_minutes, custom_price, dp_amount } = body

  const updates: Record<string, unknown> = {}
  if (status !== undefined) updates.status = status
  if (notes !== undefined) updates.notes = notes
  if (date !== undefined) updates.date = date
  if (time !== undefined) updates.time = time
  if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes
  if (custom_price !== undefined) updates.custom_price = custom_price
  if (dp_amount !== undefined) updates.dp_amount = dp_amount
  if (service_ids !== undefined) {
    const ids: string[] = Array.isArray(service_ids) ? service_ids : []
    updates.service_ids = ids
    updates.service_id = ids[0] ?? null
  } else if (service_id !== undefined) {
    updates.service_id = service_id
  }

  // Fetch current booking before updating (to detect cancellation + restore package session)
  const { data: current } = await supabase
    .from('bookings')
    .select('status, customer_package_id')
    .eq('id', params.id)
    .single()

  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', params.id)
    .select('*, customer:customers(*), service:services(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Restore package session if booking was just cancelled and had a package
  if (
    current &&
    status === 'cancelled' &&
    current.status !== 'cancelled' &&
    current.customer_package_id
  ) {
    const { data: cp } = await supabase
      .from('customer_packages')
      .select('sessions_used, sessions_total')
      .eq('id', current.customer_package_id)
      .single()
    if (cp) {
      const newUsed = Math.max(0, cp.sessions_used - 1)
      await supabase.from('customer_packages').update({
        sessions_used: newUsed,
        status: newUsed < cp.sessions_total ? 'active' : 'completed',
      }).eq('id', current.customer_package_id)
    }
  }

  return NextResponse.json(await attachServices(data as Record<string, unknown>))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabase.from('bookings').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
