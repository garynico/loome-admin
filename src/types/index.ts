export interface Customer {
  id: string
  name: string
  phone: string
  gender: 'male' | 'female' | null
  created_at: string
}

export interface Service {
  id: string
  name: string
  price: number
  gender_target: 'male' | 'female' | 'all'
  is_active: boolean
  created_at: string
}

export interface Package {
  id: string
  name: string
  service_id: string | null
  sessions: number
  price: number
  is_active: boolean
  created_at: string
  service?: Service
}

export interface CustomerPackage {
  id: string
  customer_id: string
  package_id: string | null
  package_name: string
  service_id: string | null
  sessions_total: number
  sessions_used: number
  paid_price: number
  status: 'active' | 'completed'
  purchased_at: string
  notes: string | null
  service?: Service
  customer?: Customer
}

export interface Booking {
  id: string
  customer_id: string
  service_id: string | null
  service_ids: string[] | null
  custom_price: number | null
  dp_amount: number
  customer_package_id: string | null
  date: string
  time: string
  duration_minutes: number | null
  notes: string | null
  status: 'confirmed' | 'cancelled' | 'completed'
  created_at: string
}

export interface BookingWithRelations extends Booking {
  customer: Customer
  service: Service | null
  services: Service[]
}
