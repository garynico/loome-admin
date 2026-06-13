export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { name, service_id, sessions, price, is_active, gender_target } = body
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name.trim()
  if (service_id !== undefined) updates.service_id = service_id || null
  if (sessions !== undefined) updates.sessions = Number(sessions)
  if (price !== undefined) updates.price = Number(price)
  if (is_active !== undefined) updates.is_active = is_active
  if (gender_target !== undefined) updates.gender_target = gender_target || 'all'

  const { data, error } = await supabase
    .from('packages')
    .update(updates)
    .eq('id', params.id)
    .select('*, service:services(*)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabase.from('packages').update({ is_active: false }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
