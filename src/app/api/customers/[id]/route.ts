export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

  return NextResponse.json({ customer, bookings: bookings ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { name, phone, gender } = body

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (phone !== undefined) updates.phone = phone
  if (gender !== undefined) updates.gender = gender

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
  const { error } = await supabase.from('customers').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
