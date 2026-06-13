export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('packages')
    .select('*, service:services(*)')
    .eq('is_active', true)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { name, service_id, sessions, price, gender_target } = await req.json()
  if (!name?.trim() || !sessions || !price) {
    return NextResponse.json({ error: 'Name, sessions and price are required' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('packages')
    .insert({ name: name.trim(), service_id: service_id || null, sessions: Number(sessions), price: Number(price), gender_target: gender_target || 'all' })
    .select('*, service:services(*)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
