export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, price, gender_target } = body

  if (!name?.trim() || !price) {
    return NextResponse.json({ error: 'Name and price are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('services')
    .insert({ name: name.trim(), price: Number(price), gender_target: gender_target ?? 'all' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

