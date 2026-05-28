'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import {
  format, addDays, subDays, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameDay,
  isSameMonth, addMonths, subMonths, parseISO, isToday, isTomorrow,
} from 'date-fns'
import { id } from 'date-fns/locale'
import type { BookingWithRelations } from '@/types'

const HOUR_HEIGHT = 72
const HOUR_START = 9
const HOUR_END = 20
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const TIMELINE_HEIGHT = (HOUR_END - HOUR_START) * HOUR_HEIGHT

function snapMinutes(m: number, snap = 15): number {
  return Math.round(m / snap) * snap
}

function yToTime(y: number): string {
  const rawMin = (y / HOUR_HEIGHT) * 60
  const clamped = Math.max(0, Math.min((HOUR_END - HOUR_START) * 60 - 1, rawMin))
  const snapped = snapMinutes(clamped)
  const total = HOUR_START * 60 + snapped
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function timeToY(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return ((h - HOUR_START) + m / 60) * HOUR_HEIGHT
}

function durationToHeight(minutes: number): number {
  return (minutes / 60) * HOUR_HEIGHT
}

type DragState = { startY: number; endY: number; startTime: string } | null

function computeLayout(bookings: BookingWithRelations[]): Map<string, { col: number; total: number }> {
  const result = new Map<string, { col: number; total: number }>()
  if (!bookings.length) return result

  const events = bookings.map(b => {
    const [h, m] = b.time.slice(0, 5).split(':').map(Number)
    const startMin = h * 60 + m
    const endMin = startMin + (b.duration_minutes ?? 60)
    return { id: b.id, startMin, endMin }
  }).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  // Build overlap groups via sweep
  const groups: { ids: Set<string>; maxEnd: number }[] = []
  for (const ev of events) {
    const overlapping = groups.filter(g => g.maxEnd > ev.startMin)
    if (overlapping.length === 0) {
      groups.push({ ids: new Set([ev.id]), maxEnd: ev.endMin })
    } else {
      const merged = new Set<string>([ev.id])
      let maxEnd = ev.endMin
      const remaining: typeof groups = []
      for (const g of groups) {
        if (g.maxEnd > ev.startMin) {
          g.ids.forEach(id => merged.add(id))
          maxEnd = Math.max(maxEnd, g.maxEnd)
        } else {
          remaining.push(g)
        }
      }
      groups.length = 0
      groups.push(...remaining, { ids: merged, maxEnd })
    }
  }

  // Assign columns within each group
  for (const group of groups) {
    const groupEvents = events.filter(e => group.ids.has(e.id))
    const colEnds: number[] = []
    for (const ev of groupEvents) {
      let col = colEnds.findIndex(end => end <= ev.startMin)
      if (col === -1) { col = colEnds.length; colEnds.push(ev.endMin) }
      else colEnds[col] = ev.endMin
      result.set(ev.id, { col, total: 0 })
    }
    const total = colEnds.length
    for (const ev of groupEvents) {
      const entry = result.get(ev.id)!
      result.set(ev.id, { col: entry.col, total })
    }
  }

  // Fallback for any booking not assigned (shouldn't happen)
  for (const b of bookings) {
    if (!result.has(b.id)) result.set(b.id, { col: 0, total: 1 })
  }

  return result
}

export default function CalendarPage() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [view, setView] = useState<'day' | 'month'>('day')
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [monthBookingDates, setMonthBookingDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [dragState, setDragState] = useState<DragState>(null)

  const stripRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const stripTouchStartX = useRef(0)
  const stripTouchStartY = useRef(0)
  const tsTouchY = useRef(0)
  const dragStarted = useRef(false)
  const touchDragActive = useRef(false)
  const touchLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartY = useRef(0)
  const touchStartTime = useRef('')
  const selectedFormattedRef = useRef(format(new Date(), 'yyyy-MM-dd'))

  const stripDays = eachDayOfInterval({
    start: subDays(new Date(), 14),
    end: addDays(new Date(), 45),
  })

  const fetchDayBookings = useCallback(async (date: Date) => {
    setLoading(true)
    const dateStr = format(date, 'yyyy-MM-dd')
    const res = await fetch(`/api/bookings?date=${dateStr}`)
    if (res.ok) setBookings(await res.json())
    setLoading(false)
  }, [])

  const fetchMonthDates = useCallback(async (month: Date) => {
    const monthStr = format(month, 'yyyy-MM')
    const res = await fetch(`/api/bookings?month=${monthStr}`)
    if (res.ok) {
      const data: BookingWithRelations[] = await res.json()
      setMonthBookingDates(new Set(data.map(b => b.date)))
    }
  }, [])

  useEffect(() => { fetchDayBookings(selectedDate) }, [selectedDate, fetchDayBookings])
  useEffect(() => { if (view === 'month') fetchMonthDates(currentMonth) }, [view, currentMonth, fetchMonthDates])

  useEffect(() => {
    if (stripRef.current) {
      const idx = stripDays.findIndex(d => isSameDay(d, selectedDate))
      if (idx >= 0) {
        const itemWidth = 52
        const scrollPos = idx * itemWidth - stripRef.current.clientWidth / 2 + itemWidth / 2
        stripRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' })
      }
    }
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleStripTouchStart(e: React.TouchEvent) {
    stripTouchStartX.current = e.touches[0].clientX
    stripTouchStartY.current = e.touches[0].clientY
  }
  function handleStripTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - stripTouchStartX.current
    const dy = e.changedTouches[0].clientY - stripTouchStartY.current
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      setSelectedDate(prev => dx < 0 ? addDays(prev, 1) : subDays(prev, 1))
    }
  }

  const selectedFormatted = format(selectedDate, 'yyyy-MM-dd')
  // Keep ref in sync so global mouse handlers always have the current date
  useEffect(() => { selectedFormattedRef.current = selectedFormatted }, [selectedFormatted])

  function getTimelineY(clientY: number): number {
    if (!timelineRef.current) return 0
    const rect = timelineRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(TIMELINE_HEIGHT, clientY - rect.top))
  }

  function handleMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-booking]')) return
    const y = getTimelineY(e.clientY)
    dragStarted.current = true
    setDragState({ startY: y, endY: y, startTime: yToTime(y) })
  }

  // Global mouse handlers so drag works even when cursor leaves the timeline
  useEffect(() => {
    function onGlobalMouseMove(e: MouseEvent) {
      if (!dragStarted.current) return
      const y = getTimelineY(e.clientY)
      setDragState(prev => prev ? { ...prev, endY: Math.max(y, prev.startY + 2) } : null)
    }
    function onGlobalMouseUp() {
      if (!dragStarted.current) return
      dragStarted.current = false
      setDragState(current => {
        if (current) {
          const endTime = yToTime(current.endY)
          router.push(`/bookings/new?date=${selectedFormattedRef.current}&time=${current.startTime}&endtime=${endTime}`)
        }
        return null
      })
    }
    window.addEventListener('mousemove', onGlobalMouseMove)
    window.addEventListener('mouseup', onGlobalMouseUp)
    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove)
      window.removeEventListener('mouseup', onGlobalMouseUp)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Attach touchmove with passive:false so we can preventDefault during drag
  useEffect(() => {
    const el = timelineRef.current
    if (!el) return
    function onTouchMove(e: TouchEvent) {
      const touch = e.touches[0]
      // If long press hasn't fired yet, cancel it if user scrolled
      if (!touchDragActive.current) {
        if (Math.abs(touch.clientY - touchStartY.current) > 8 && touchLongPressTimer.current) {
          clearTimeout(touchLongPressTimer.current)
          touchLongPressTimer.current = null
        }
        return
      }
      // In drag mode — block scroll and update selection
      e.preventDefault()
      const rect = (el as HTMLDivElement).getBoundingClientRect()
      const y = Math.max(0, Math.min(TIMELINE_HEIGHT, touch.clientY - rect.top))
      setDragState(prev => prev ? { ...prev, endY: Math.max(y, prev.startY + 2) } : null)
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTimelineTouchStart(e: React.TouchEvent) {
    if ((e.target as HTMLElement).closest('[data-booking]')) return
    const touch = e.touches[0]
    tsTouchY.current = touch.clientY
    touchStartY.current = touch.clientY
    touchDragActive.current = false

    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const y = Math.max(0, Math.min(TIMELINE_HEIGHT, touch.clientY - rect.top))
    touchStartTime.current = yToTime(y)

    // Long press (200ms) activates drag mode
    touchLongPressTimer.current = setTimeout(() => {
      touchDragActive.current = true
      dragStarted.current = true
      setDragState({ startY: y, endY: y, startTime: touchStartTime.current })
    }, 200)
  }

  function handleTimelineTouchEnd(e: React.TouchEvent) {
    if ((e.target as HTMLElement).closest('[data-booking]')) return

    if (touchLongPressTimer.current) {
      clearTimeout(touchLongPressTimer.current)
      touchLongPressTimer.current = null
    }

    if (touchDragActive.current) {
      touchDragActive.current = false
      dragStarted.current = false
      setDragState(current => {
        if (current) {
          const endTime = yToTime(current.endY)
          router.push(`/bookings/new?date=${selectedFormatted}&time=${current.startTime}&endtime=${endTime}`)
        }
        return null
      })
    } else {
      // Simple tap — navigate with just the tapped time
      const touch = e.changedTouches[0]
      if (Math.abs(touch.clientY - tsTouchY.current) < 15) {
        if (!timelineRef.current) return
        const rect = timelineRef.current.getBoundingClientRect()
        const y = Math.max(0, Math.min(TIMELINE_HEIGHT, touch.clientY - rect.top))
        router.push(`/bookings/new?date=${selectedFormatted}&time=${yToTime(y)}`)
      }
    }
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const dragHeight = dragState ? Math.max(dragState.endY - dragState.startY, 0) : 0
  const bookingLayout = useMemo(() => computeLayout(bookings), [bookings])

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
        <span className="font-semibold text-gray-900 text-base">Kalender</span>
        <button
          onClick={() => setView(v => v === 'day' ? 'month' : 'day')}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 active:bg-gray-50"
        >
          {view === 'day' ? 'Bulan' : 'Hari'}
        </button>
      </header>

      {view === 'day' ? (
        <>
          {/* Month label + week nav */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-sm font-semibold text-gray-900">
              {format(selectedDate, 'MMMM yyyy', { locale: id })}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setSelectedDate(d => subDays(d, 7))} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 active:bg-gray-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={() => setSelectedDate(new Date())} className="px-2 h-7 text-xs font-medium text-[#2D5A3D] active:bg-[#E8F0EA] rounded-lg">
                Hari ini
              </button>
              <button onClick={() => setSelectedDate(d => addDays(d, 7))} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 active:bg-gray-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 px-2 pb-1">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-0.5">{d}</div>
            ))}
          </div>

          {/* Date strip */}
          <div
            ref={stripRef}
            className="flex overflow-x-auto no-scrollbar px-2 pb-2 gap-0.5 date-strip"
            onTouchStart={handleStripTouchStart}
            onTouchEnd={handleStripTouchEnd}
          >
            {stripDays.map(day => {
              const isSelected = isSameDay(day, selectedDate)
              const isTodayDay = isToday(day)
              const isTomorrowDay = isTomorrow(day)
              const isPast = day < new Date() && !isTodayDay
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className="date-item flex-shrink-0 w-[52px] flex flex-col items-center py-1.5 rounded-xl transition-all"
                  style={{
                    background: isSelected && !isTodayDay && !isTomorrowDay
                      ? '#111827'
                      : (isTodayDay || isTomorrowDay) && isSelected
                      ? '#2D5A3D'
                      : 'transparent',
                  }}
                >
                  <span className="text-[10px] font-medium" style={{
                    color: isSelected ? '#fff' : isPast ? '#d1d5db' : isTodayDay ? '#2D5A3D' : isTomorrowDay ? '#2D5A3D' : '#6b7280',
                  }}>
                    {format(day, 'EEE', { locale: id }).slice(0, 3)}
                  </span>
                  <span className="text-base font-bold mt-0.5 w-9 h-9 flex items-center justify-center rounded-full" style={{
                    background: isSelected ? 'transparent' : isTodayDay ? '#2D5A3D' : isTomorrowDay ? '#E8F0EA' : 'transparent',
                    color: isSelected ? '#fff' : isTodayDay ? '#fff' : isTomorrowDay ? '#2D5A3D' : isPast ? '#d1d5db' : '#111827',
                  }}>
                    {format(day, 'd')}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Selected day label */}
          <div className="px-4 py-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-900">
                  {format(selectedDate, 'EEEE, d MMMM', { locale: id })}
                </span>
                {isToday(selectedDate) && (
                  <span className="ml-2 text-xs font-medium text-[#2D5A3D] bg-[#E8F0EA] px-2 py-0.5 rounded-full">Hari ini</span>
                )}
                {isTomorrow(selectedDate) && (
                  <span className="ml-2 text-xs font-medium text-[#2D5A3D] bg-[#E8F0EA] px-2 py-0.5 rounded-full">Besok</span>
                )}
              </div>
              <span className="text-xs text-gray-400">{bookings.filter(b => b.status !== 'cancelled').length} janji</span>
            </div>
          </div>

          {/* Google Calendar-style Timeline */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-5 h-5 rounded-full border-2 border-[#2D5A3D] border-t-transparent animate-spin" />
              </div>
            ) : (
              <div
                ref={timelineRef}
                className="relative select-none cursor-crosshair"
                style={{ height: TIMELINE_HEIGHT + 60 }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTimelineTouchStart}
                onTouchEnd={handleTimelineTouchEnd}
              >
                {/* Hour rows */}
                {HOURS.map(h => (
                  <div key={h} className="absolute left-0 right-0 pointer-events-none" style={{ top: (h - HOUR_START) * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                    {/* Hour label */}
                    <div className="absolute left-0 w-14 flex justify-center" style={{ top: -7 }}>
                      <span className="text-[11px] font-medium text-gray-400">{String(h).padStart(2, '0')}:00</span>
                    </div>
                    {/* Hour line */}
                    <div className="absolute left-14 right-0 border-t border-gray-150" style={{ borderColor: '#e5e7eb' }} />
                    {/* 15-min sub-lines */}
                    {[1, 2, 3].map(q => (
                      <div
                        key={q}
                        className="absolute left-14 right-0"
                        style={{
                          top: (HOUR_HEIGHT / 4) * q,
                          borderTop: q === 2 ? '1px dashed #e5e7eb' : '1px solid #f9fafb',
                        }}
                      />
                    ))}
                  </div>
                ))}
                {/* Final line */}
                <div className="absolute left-14 right-0 pointer-events-none" style={{ top: TIMELINE_HEIGHT, borderTop: '1px solid #e5e7eb' }} />

                {/* Bookings — absolutely positioned by time */}
                {bookings.map(booking => {
                  const top = timeToY(booking.time.slice(0, 5))
                  const height = Math.max(durationToHeight(booking.duration_minutes ?? 60), 28)
                  const isCancelled = booking.status === 'cancelled'
                  const isCompleted = booking.status === 'completed'
                  const { col, total } = bookingLayout.get(booking.id) ?? { col: 0, total: 1 }
                  const avail = '(100% - 68px)'
                  const leftStyle: string | number = total <= 1 ? 60 : `calc(60px + ${col / total} * ${avail}${col > 0 ? ' + 1px' : ''})`
                  const rightStyle: string | number = total <= 1 ? 8 : `calc(8px + ${(total - col - 1) / total} * ${avail}${col < total - 1 ? ' + 1px' : ''})`
                  return (
                    <div
                      key={booking.id}
                      data-booking="true"
                      className="absolute z-10 cursor-pointer active:opacity-75"
                      style={{
                        top: top + 1,
                        height: height - 2,
                        left: leftStyle,
                        right: rightStyle,
                        background: isCancelled ? '#f3f4f6' : isCompleted ? '#f0fdf4' : '#E8F0EA',
                        borderLeft: `3px solid ${isCancelled ? '#d1d5db' : isCompleted ? '#86efac' : '#2D5A3D'}`,
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
                      onClick={() => router.push(`/bookings/${booking.id}`)}
                    >
                      <div className="px-2 py-1">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-semibold leading-tight truncate ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {booking.customer?.name}
                            </p>
                            {height > 32 && (
                              <p className={`text-[11px] truncate ${isCancelled ? 'text-gray-400' : 'text-[#2D5A3D]'}`}>
                                {booking.service?.name}
                              </p>
                            )}
                          </div>
                          {isCompleted && height > 28 && (
                            <span className="text-[9px] font-medium text-green-600 bg-green-100 px-1 py-0.5 rounded-full flex-shrink-0">Selesai</span>
                          )}
                          {isCancelled && height > 28 && (
                            <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1 py-0.5 rounded-full flex-shrink-0">Batal</span>
                          )}
                        </div>
                        {height >= 48 && (
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {booking.time.slice(0, 5)} · {booking.duration_minutes ?? 60} mnt
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Drag preview */}
                {dragState && dragHeight > 16 && (() => {
                  const endTime = yToTime(dragState.endY)
                  const [sh, sm] = dragState.startTime.split(':').map(Number)
                  const [eh, em] = endTime.split(':').map(Number)
                  const dur = (eh * 60 + em) - (sh * 60 + sm)
                  const durLabel = dur < 60 ? `${dur} mnt` : dur % 60 === 0 ? `${dur / 60} jam` : `${Math.floor(dur / 60)} jam ${dur % 60} mnt`
                  return (
                    <div
                      className="absolute z-20 pointer-events-none"
                      style={{
                        top: dragState.startY,
                        height: dragHeight,
                        left: 60,
                        right: 8,
                        background: 'rgba(45,90,61,0.12)',
                        border: '2px solid #2D5A3D',
                        borderRadius: 8,
                      }}
                    >
                      <div className="px-2 py-1">
                        <p className="text-xs font-semibold text-[#2D5A3D]">{dragState.startTime} → {endTime}</p>
                        {dragHeight > 36 && <p className="text-[10px] text-[#2D5A3D] opacity-80">{durLabel}</p>}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Month view */
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-2 text-gray-500 active:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-semibold text-gray-900 text-base">
              {format(currentMonth, 'MMMM yyyy', { locale: id })}
            </span>
            <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-2 text-gray-500 active:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 px-2">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-2">{d}</div>
            ))}
            {gridDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const hasBooking = monthBookingDates.has(dateStr)
              const isTodayDay = isToday(day)
              const isSelected = isSameDay(day, selectedDate)
              const outOfMonth = !isSameMonth(day, currentMonth)
              return (
                <button
                  key={dateStr}
                  onClick={() => { setSelectedDate(day); setView('day') }}
                  className="flex flex-col items-center py-1.5 rounded-xl active:bg-gray-50"
                >
                  <span
                    className="w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium"
                    style={{
                      background: isSelected && isTodayDay ? '#2D5A3D' : isSelected ? '#111827' : isTodayDay ? '#2D5A3D' : 'transparent',
                      color: isSelected || isTodayDay ? '#fff' : outOfMonth ? '#d1d5db' : '#111827',
                    }}
                  >
                    {format(day, 'd')}
                  </span>
                  <span className="w-1 h-1 rounded-full mt-0.5" style={{ background: hasBooking && !outOfMonth ? '#2D5A3D' : 'transparent' }} />
                </button>
              )
            })}
          </div>

          <div className="mt-4 px-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {format(selectedDate, 'd MMMM yyyy', { locale: id })}
            </h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 rounded-full border-2 border-[#2D5A3D] border-t-transparent animate-spin" />
              </div>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Tidak ada janji hari ini</p>
            ) : (
              <div className="space-y-2 pb-24">
                {bookings.filter(b => b.status !== 'cancelled').map(booking => (
                  <button
                    key={booking.id}
                    onClick={() => router.push(`/bookings/${booking.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 active:bg-gray-50 text-left"
                  >
                    <div className="w-12 text-center">
                      <span className="text-xs font-semibold text-[#2D5A3D]">{booking.time.slice(0, 5)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{booking.customer?.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{booking.service?.name}{booking.duration_minutes ? ` · ${booking.duration_minutes} mnt` : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav active="calendar" />
    </div>
  )
}

