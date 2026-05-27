'use client'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 07–21
const MINUTES = [0, 15, 30, 45]

interface Props {
  value: string        // "HH:MM"
  onChange: (v: string) => void
}

export default function TimePicker({ value, onChange }: Props) {
  const parts = value ? value.split(':').map(Number) : [9, 0]
  const selH = parts[0]
  const selM = parts[1]

  function set(h: number, m: number) {
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }

  return (
    <div className="space-y-2">
      {/* Hour row */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {HOURS.map(h => (
          <button
            key={h}
            type="button"
            onClick={() => set(h, selM)}
            className="flex-shrink-0 w-10 h-10 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{
              background: selH === h ? '#2D5A3D' : '#f3f4f6',
              color: selH === h ? '#fff' : '#374151',
            }}
          >
            {String(h).padStart(2, '0')}
          </button>
        ))}
      </div>

      {/* Minute row */}
      <div className="grid grid-cols-4 gap-2">
        {MINUTES.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => set(selH, m)}
            className="py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{
              background: selM === m ? '#2D5A3D' : '#f3f4f6',
              color: selM === m ? '#fff' : '#374151',
            }}
          >
            :{String(m).padStart(2, '0')}
          </button>
        ))}
      </div>

      {/* Live display */}
      <p className="text-center text-2xl font-bold text-[#2D5A3D] tracking-widest pt-1">
        {String(selH).padStart(2, '0')}:{String(selM).padStart(2, '0')}
      </p>
    </div>
  )
}
