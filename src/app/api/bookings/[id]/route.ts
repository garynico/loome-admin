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
  const { status, notes, date, time, service_ids, service_id, duration_minutes, custom_price, dp_amount, customer_package_id } = body

  const updates: Record<string, unknown> = {}
  if (status !== undefined) updates.status = status
  if (notes !== undefined) updates.notes = notes
  if (date !== undefined) updates.date = date
  if (time !== undefined) updates.time = time
  if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes
  if (custom_price !== undefined) updates.custom_price = custom_price
  if (dp_amount !== undefined) updates.dp_amount = dp_amount
  if (customer_package_id !== undefined) updates.customer_package_id = customer_package_id || null
  if (service_ids !== undefined) {
    const ids: string[] = Array.isArray(service_ids) ? service_ids : []
    updates.service_ids = ids
    updates.service_id = ids[0] ?? null
  } else if (service_id !== undefined) {
    updates.service_id = service_id
  }

  // Fetch current booking before updating
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

  // Handle package session changes
  if (current) {
    const oldPkgId = current.customer_package_id as string | null
    const newPkgId = customer_package_id !== undefined ? (customer_package_id || null) : oldPkgId
    const justCancelled = status === 'cancelled' && current.status !== 'cancelled'
    const justReconfirmed = status === 'confirmed' && current.status === 'cancelled'
    const pkgChanged = customer_package_id !== undefined && newPkgId !== oldPkgId

    const adjustSessions = async (pkgId: string, delta: number) => {
      await supabase.rpc('adjust_package_sessions', { pkg_id: pkgId, delta })
    }

    if (pkgChanged) {
      // Restore session on old package (if booking was active/confirmed)
      if (oldPkgId && current.status !== 'cancelled') await adjustSessions(oldPkgId, -1)
      // Deduct session on new package
      if (newPkgId && current.status !== 'cancelled') await adjustSessions(newPkgId, 1)
    } else if (oldPkgId) {
      if (justCancelled) await adjustSessions(oldPkgId, -1)
      else if (justReconfirmed) await adjustSessions(oldPkgId, 1)
    }
  }

  return NextResponse.json(await attachServices(data as Record<string, unknown>))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: current } = await supabase
    .from('bookings')
    .select('status, customer_package_id')
    .eq('id', params.id)
    .single()

  const { error } = await supabase.from('bookings').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Restore package session unless booking was already cancelled (cancel already restored it)
  if (current && current.customer_package_id && current.status !== 'cancelled') {
    await supabase.rpc('adjust_package_sessions', { pkg_id: current.customer_package_id, delta: -1 })
  }

  return NextResponse.json({ ok: true })
}
