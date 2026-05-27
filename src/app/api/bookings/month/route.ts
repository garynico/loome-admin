export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const [year, mon] = month.split('-')
  const start = `${year}-${mon.padStart(2, '0')}-01`
  const lastDay = new Date(Number(year), Number(mon), 0).getDate()
  const end = `${year}-${mon.padStart(2, '0')}-${lastDay}`

  const { data, error } = await supabase
    .from('bookings')
    .select('date')
    .gte('date', start)
    .lte('date', end)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

