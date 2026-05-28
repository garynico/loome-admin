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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, service:services(*)')
    .eq('customer_id', params.id)
    .order('date', { ascending: false })
    .order('time', { ascending: false })

  const enriched = await attachServices((bookings ?? []) as Record<string, unknown>[])
  return NextResponse.json({ customer, bookings: enriched })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { name, phone, gender, notes } = body

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (phone !== undefined) updates.phone = phone
  if (gender !== undefined) updates.gender = gender
  if (notes !== undefined) updates.notes = notes

  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabase
    .from('customers')
    .update({ is_deleted: true })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  // Restore a soft-deleted customer
  const { error } = await supabase
    .from('customers')
    .update({ is_deleted: false })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
