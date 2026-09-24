import path from 'node:path'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const [interFile, fndFile] = process.argv.slice(2)

if (!interFile || !fndFile) {
  console.error('Usage: npm run import:students -- "INTER.xlsx" "FND.xlsx"')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

if (!url || !secret) {
  throw new Error(
    'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first.'
  )
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false },
})

function text(value) {
  if (value === null || value === undefined) return null
  const s = String(value).trim().replace(/^'/, '')
  return s || null
}

function excelDate(value) {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value)
    if (!d) return null
    return `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function mobile(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length > 10 && digits.startsWith('91')
    ? digits.slice(-10)
    : digits || null
}

function readWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: true,
  })

  const mapped = rows
    .map(row => ({
      registration_number: text(row['REGISTRATION NUMBER']),
      student_name: text(row['STUDENT NAME']),
      father_husband_name: text(row['FATHER/HUSBAND NAME']),
      date_of_birth: excelDate(row['DATE OF BIRTH']),
      address_1: text(row['ADDRESS 1']),
      address_2: text(row['ADDRESS 2']),
      address_3: text(row['ADDRESS 3']),
      city: text(row['CITY']),
      pin_code: text(row['PIN CODE'] ?? row['PINCODE']),
      email: text(row['EMAIL ID'] ?? row['EMAILID']),
      mobile: mobile(row['MOBILE NO'] ?? row['MOBILENO']),
    }))
    .filter(row => row.registration_number && row.student_name)

  const deduped = new Map()
  for (const row of mapped) {
    deduped.set(row.registration_number, row)
  }

  return Array.from(deduped.values())
}

async function importInto(table, records) {
  for (let i = 0; i < records.length; i += 200) {
    const batch = records.slice(i, i + 200)
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: 'registration_number' })

    if (error) throw error

    console.log(
      `${table}: ${Math.min(i + batch.length, records.length)} / ${records.length}`
    )
  }
}

const intermediate = readWorkbook(path.resolve(interFile))
const foundation = readWorkbook(path.resolve(fndFile))

await importInto('intermediate_students', intermediate)
await importInto('foundation_students', foundation)

console.log(
  `Done. Foundation: ${foundation.length}, Intermediate: ${intermediate.length}`
)
