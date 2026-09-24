import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createVerificationClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeDigits(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''

  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const verifier = createVerificationClient()
  const { data: authData, error: authError } = await verifier.auth.getUser(token)
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Invalid or expired login session.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('team_profiles')
    .select('active')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError || !profile?.active) {
    return NextResponse.json({ error: 'This account is not authorized.' }, { status: 403 })
  }

  const query = (request.nextUrl.searchParams.get('q') || '').trim()
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json({ error: 'Enter at least 2 characters.' }, { status: 400 })
  }

  const columns = 'id,source,registration_number,student_name,father_husband_name,date_of_birth,address_1,address_2,address_3,city,pin_code,email,mobile'
  const digits = normalizeDigits(query)

  const searches = [
    admin.from('students').select(columns).ilike('student_name', `%${query}%`).limit(20),
    admin.from('students').select(columns).ilike('registration_number', `%${query}%`).limit(20),
  ]

  if (digits.length >= 4) {
    searches.push(admin.from('students').select(columns).ilike('mobile', `%${digits}%`).limit(20))
  }

  const responses = await Promise.all(searches)
  const error = responses.find(item => item.error)?.error
  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'Unable to search student records.' }, { status: 500 })
  }

  const byId = new Map<number, any>()
  for (const response of responses) {
    for (const row of response.data || []) byId.set(row.id, row)
  }

  const students = Array.from(byId.values())
    .sort((a,b) => String(a.student_name).localeCompare(String(b.student_name)))
    .slice(0,30)
    .map(row => ({
      id: row.id,
      source: row.source,
      registrationNumber: row.registration_number,
      studentName: row.student_name,
      fatherHusbandName: row.father_husband_name,
      dateOfBirth: row.date_of_birth,
      address1: row.address_1,
      address2: row.address_2,
      address3: row.address_3,
      city: row.city,
      pinCode: row.pin_code,
      email: row.email,
      mobile: row.mobile,
    }))

  return NextResponse.json({ students, count: students.length })
}
