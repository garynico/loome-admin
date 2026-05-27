'use client'

import { useRouter } from 'next/navigation'

export default function BottomNav({ active }: { active: string }) {
  const router = useRouter()

  const sw = (key: string) => active === key ? 2.2 : 1.8

  const items = [
    {
      key: 'orders', label: 'Pesanan', path: '/orders',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw('orders')} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    },
    {
      key: 'calendar', label: 'Kalender', path: '/calendar',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw('calendar')} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    },
    { key: 'new', label: '', path: '/bookings/new', icon: null },
    {
      key: 'customers', label: 'Pelanggan', path: '/customers',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw('customers')} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      key: 'services', label: 'Layanan', path: '/services',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw('services')} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
    },
  ]

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-100 z-30">
      <div className="flex items-center justify-around h-16 px-1">
        {items.map(item => {
          if (item.key === 'new') {
            return (
              <button
                key="new"
                onClick={() => router.push('/bookings/new')}
                className="w-12 h-12 rounded-full bg-[#2D5A3D] flex items-center justify-center shadow-lg active:opacity-80 -mt-6 flex-shrink-0"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )
          }
          const isActive = active === item.key
          return (
            <button
              key={item.key}
              onClick={() => router.push(item.path)}
              className="flex flex-col items-center gap-0.5 px-1 py-1 flex-shrink-0"
            >
              <span style={{ color: isActive ? '#2D5A3D' : '#9ca3af' }}>{item.icon}</span>
              <span className="text-[9px] font-medium" style={{ color: isActive ? '#2D5A3D' : '#9ca3af' }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
