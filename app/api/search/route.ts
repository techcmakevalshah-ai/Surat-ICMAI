import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createVerificationClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Level = 'foundation' | 'intermediate' | 'all'

function normalizeDigits(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits
}

function normalizeLevel(value: string | null): Level {
  if (value === 'foundation' || value === 'intermediate' || value === 'all') return value
  return 'all'
}

async function searchTable(
  admin: ReturnType<typeof createAdminClient>,
  table: 'foundation_students' | 'intermediate_students',
  source: 'FOUNDATION' | 'INTERMEDIATE',
  query: string,
  digits: string,
) {
  const columns = 'id,registration_number,student_name,father_husband_name,date_of_birth,address_1,address_2,address_3,city,pin_code,email,mobile'

  const searches = [
    admin.from(table).select(columns).ilike('student_name', `%${query}%`).limit(20),
    admin.from(table).select(columns).ilike('registration_number', `%${query}%`).limit(20),
  ]

  if (digits.length >= 4) {
    searches.push(
      admin.from(table).select(columns).ilike('mobile', `%${digits}%`).limit(20)
    )
  }

  const responses = await Promise.all(searches)
  const error = responses.find(item => item.error)?.error
  if (error) throw error

  const byId = new Map<number, any>()
  for (const response of responses) {
    for (const row of response.data || []) byId.set(row.id, row)
  }

  return Array.from(byId.values()).map(row => ({
    id: row.id,
    source,
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
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : ''

  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const verifier = createVerificationClient()
  const { data: authData, error: authError } = await verifier.auth.getUser(token)

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: 'Invalid or expired login session.' },
      { status: 401 }
    )
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('team_profiles')
    .select('active')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError || !profile?.active) {
    return NextResponse.json(
      { error: 'This account is not authorized.' },
      { status: 403 }
    )
  }

  const query = (request.nextUrl.searchParams.get('q') || '').trim()
  const level = normalizeLevel(request.nextUrl.searchParams.get('level'))

  if (query.length < 2 || query.length > 120) {
    return NextResponse.json(
      { error: 'Enter at least 2 characters.' },
      { status: 400 }
    )
  }

  const digits = normalizeDigits(query)

  try {
    const tasks = []

    if (level === 'foundation' || level === 'all') {
      tasks.push(
        searchTable(admin, 'foundation_students', 'FOUNDATION', query, digits)
      )
    }

    if (level === 'intermediate' || level === 'all') {
      tasks.push(
        searchTable(admin, 'intermediate_students', 'INTERMEDIATE', query, digits)
      )
    }

    const groups = await Promise.all(tasks)
    const students = groups
      .flat()
      .sort((a, b) => a.studentName.localeCompare(b.studentName))
      .slice(0, 40)

    return NextResponse.json({
      students,
      count: students.length,
      level,
    })
  } catch (error) {
    console.error('Student search error:', error)
    return NextResponse.json(
      { error: 'Unable to search student records.' },
      { status: 500 }
    )
  }
}
