export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { sessions_used, status, notes } = await req.json()
  const updates: Record<string, unknown> = {}
  if (sessions_used !== undefined) updates.sessions_used = sessions_used
  if (status !== undefined) updates.status = status
  if (notes !== undefined) updates.notes = notes

  const { data, error } = await supabase
    .from('customer_packages')
    .update(updates)
    .eq('id', params.id)
    .select('*, service:services(*)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabase.from('customer_packages').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
