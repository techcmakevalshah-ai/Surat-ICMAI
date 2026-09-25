'use client'

import { FormEvent, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  PlusCircle,
  Save,
  Upload,
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { createBrowserSupabase } from '@/lib/supabase-browser'

type Course = 'foundation' | 'intermediate'
type Mode = 'manual' | 'excel'

type StudentPayload = {
  registration_number: string
  student_name: string
  father_husband_name: string | null
  date_of_birth: string | null
  address_1: string | null
  address_2: string | null
  address_3: string | null
  city: string | null
  pin_code: string | null
  email: string | null
  mobile: string | null
}

const HEADERS = [
  'S NO',
  'REGISTRATION NUMBER',
  'STUDENT NAME',
  'FATHER/HUSBAND NAME',
  'DATE OF BIRTH',
  'ADDRESS 1',
  'ADDRESS 2',
  'ADDRESS 3',
  'CITY',
  'PIN CODE',
  'EMAIL ID',
  'MOBILE NO',
]

const emptyForm = {
  registrationNumber: '',
  studentName: '',
  fatherHusbandName: '',
  dateOfBirth: '',
  address1: '',
  address2: '',
  address3: '',
  city: '',
  pinCode: '',
  email: '',
  mobile: '',
}

function tableFor(course: Course) {
  return course === 'foundation'
    ? 'foundation_students'
    : 'intermediate_students'
}

function courseLabel(course: Course) {
  return course === 'foundation' ? 'Foundation' : 'Intermediate'
}

function confirmationWord(course: Course) {
  return course === 'foundation' ? 'FOUNDATION' : 'INTERMEDIATE'
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return null
  const cleaned = String(value).trim().replace(/^'/, '')
  return cleaned || null
}

function cleanMobile(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  return digits.length > 10 && digits.startsWith('91')
    ? digits.slice(-10)
    : digits
}

function normalizeDate(value: unknown) {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }

  const raw = String(value).trim()
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  }

  const indian = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (indian) {
    return `${indian[3]}-${indian[2].padStart(2, '0')}-${indian[1].padStart(2, '0')}`
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

export default function AddStudents({ onChanged }: { onChanged?: () => void }) {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [course, setCourse] = useState<Course | null>(null)
  const [mode, setMode] = useState<Mode>('manual')
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [pendingRecords, setPendingRecords] = useState<StudentPayload[]>([])

  function chooseCourse(next: Course) {
    setCourse(next)
    setMessage(null)
    setConfirmOpen(false)
    setConfirmText('')
    setPendingRecords([])
  }

  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([HEADERS])
    sheet['!cols'] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 28 },
      { wch: 28 },
      { wch: 16 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 20 },
      { wch: 12 },
      { wch: 30 },
      { wch: 16 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Students')
    XLSX.writeFile(workbook, 'Surat-ICMAI-Student-Import-Template.xlsx')
  }

  async function saveManual(event: FormEvent) {
    event.preventDefault()
    setMessage(null)

    if (!course) {
      setMessage({
        type: 'error',
        text: 'Please select Foundation or Intermediate first.',
      })
      return
    }

    const registration = cleanText(form.registrationNumber)
    const studentName = cleanText(form.studentName)

    if (!registration || !studentName) {
      setMessage({
        type: 'error',
        text: 'Registration number and student name are required.',
      })
      return
    }

    const payload: StudentPayload = {
      registration_number: registration,
      student_name: studentName,
      father_husband_name: cleanText(form.fatherHusbandName),
      date_of_birth: form.dateOfBirth || null,
      address_1: cleanText(form.address1),
      address_2: cleanText(form.address2),
      address_3: cleanText(form.address3),
      city: cleanText(form.city),
      pin_code: cleanText(form.pinCode),
      email: cleanText(form.email)?.toLowerCase() || null,
      mobile: cleanMobile(form.mobile),
    }

    setBusy(true)
    const { error } = await supabase
      .from(tableFor(course))
      .upsert(payload, { onConflict: 'registration_number' })
    setBusy(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setForm(emptyForm)
    setMessage({
      type: 'success',
      text: `Student saved successfully in ${courseLabel(course)}.`,
    })
    onChanged?.()
  }

  async function prepareExcelUpload(event: FormEvent) {
    event.preventDefault()
    setMessage(null)

    if (!course) {
      setMessage({
        type: 'error',
        text: 'Please choose where you want to upload: Foundation or Intermediate.',
      })
      return
    }

    if (!file) {
      setMessage({ type: 'error', text: 'Choose an Excel file first.' })
      return
    }

    setBusy(true)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { cellDates: false })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

      if (!firstSheet) {
        throw new Error('The Excel file does not contain a worksheet.')
      }

      const headerRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
        header: 1,
        range: 0,
        blankrows: false,
      })

      const actualHeaders = (headerRows[0] || []).map(value =>
        String(value ?? '').trim().toUpperCase()
      )

      for (const required of ['REGISTRATION NUMBER', 'STUDENT NAME']) {
        if (!actualHeaders.includes(required)) {
          throw new Error(
            `Missing required column: ${required}. Please use the blank template downloaded from this website.`
          )
        }
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: null,
        raw: true,
      })

      const mapped: StudentPayload[] = rows
        .map(row => ({
          registration_number: cleanText(row['REGISTRATION NUMBER']) || '',
          student_name: cleanText(row['STUDENT NAME']) || '',
          father_husband_name: cleanText(row['FATHER/HUSBAND NAME']),
          date_of_birth: normalizeDate(row['DATE OF BIRTH']),
          address_1: cleanText(row['ADDRESS 1']),
          address_2: cleanText(row['ADDRESS 2']),
          address_3: cleanText(row['ADDRESS 3']),
          city: cleanText(row['CITY']),
          pin_code: cleanText(row['PIN CODE'] ?? row['PINCODE']),
          email:
            cleanText(row['EMAIL ID'] ?? row['EMAILID'])?.toLowerCase() || null,
          mobile: cleanMobile(row['MOBILE NO'] ?? row['MOBILENO']),
        }))
        .filter(row => row.registration_number && row.student_name)

      const unique = new Map<string, StudentPayload>()
      for (const row of mapped) unique.set(row.registration_number, row)
      const records = Array.from(unique.values())

      if (!records.length) {
        throw new Error(
          'No valid students found. Registration number and student name are required.'
        )
      }

      setPendingRecords(records)
      setConfirmText('')
      setConfirmOpen(true)
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Excel import failed.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function confirmExcelUpload() {
    if (!course || !pendingRecords.length) return

    const expected = confirmationWord(course)
    if (confirmText.trim().toUpperCase() !== expected) {
      setMessage({
        type: 'error',
        text: `Type ${expected} exactly to confirm the upload.`,
      })
      return
    }

    setBusy(true)
    setMessage(null)

    try {
      for (let i = 0; i < pendingRecords.length; i += 100) {
        const batch = pendingRecords.slice(i, i + 100)
        const { error } = await supabase
          .from(tableFor(course))
          .upsert(batch, { onConflict: 'registration_number' })

        if (error) throw error
      }

      const importedCount = pendingRecords.length
      setFile(null)
      setPendingRecords([])
      setConfirmOpen(false)
      setConfirmText('')

      const input = document.getElementById('student-excel-file') as HTMLInputElement | null
      if (input) input.value = ''

      setMessage({
        type: 'success',
        text: `${importedCount} student${importedCount === 1 ? '' : 's'} imported successfully into ${courseLabel(course)}.`,
      })
      onChanged?.()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Excel import failed.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="manage-card">
      <div className="add-course-row">
        <div className="destination-block">
          <span className="section-kicker">Where do you want to upload?</span>
          <div className="course-selector">
            <button
              type="button"
              className={course === 'foundation' ? 'active' : ''}
              onClick={() => chooseCourse('foundation')}
            >
              Foundation
            </button>
            <button
              type="button"
              className={course === 'intermediate' ? 'active' : ''}
              onClick={() => chooseCourse('intermediate')}
            >
              Intermediate
            </button>
          </div>
          {!course && (
            <span className="destination-warning">
              Select a destination before adding students.
            </span>
          )}
        </div>

        <div className="add-method-tabs">
          <button
            type="button"
            className={mode === 'manual' ? 'active' : ''}
            onClick={() => {
              setMode('manual')
              setMessage(null)
              setConfirmOpen(false)
            }}
          >
            <PlusCircle size={16} />
            Manual
          </button>
          <button
            type="button"
            className={mode === 'excel' ? 'active' : ''}
            onClick={() => {
              setMode('excel')
              setMessage(null)
            }}
          >
            <FileSpreadsheet size={16} />
            Excel Upload
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.type} add-message`}>
          {message.type === 'success'
            ? <CheckCircle2 size={17} />
            : <AlertCircle size={17} />}
          {message.text}
        </div>
      )}

      {mode === 'manual' ? (
        <form className="student-form" onSubmit={saveManual}>
          <div className="form-section-title">
            <h2>Add student manually</h2>
            <p>
              {course
                ? `This student will be saved in ${courseLabel(course)}.`
                : 'First select Foundation or Intermediate above.'}
              {' '}Saving an existing registration number updates that student's details.
            </p>
          </div>

          <div className="student-form-grid">
            <Field
              label="Registration Number *"
              value={form.registrationNumber}
              onChange={value => setForm({ ...form, registrationNumber: value })}
              required
            />
            <Field
              label="Student Name *"
              value={form.studentName}
              onChange={value => setForm({ ...form, studentName: value })}
              required
            />
            <Field
              label="Father / Husband Name"
              value={form.fatherHusbandName}
              onChange={value => setForm({ ...form, fatherHusbandName: value })}
            />
            <label className="field">
              <span>Date of Birth</span>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={event =>
                  setForm({ ...form, dateOfBirth: event.target.value })
                }
              />
            </label>
            <Field
              label="Mobile Number"
              value={form.mobile}
              onChange={value => setForm({ ...form, mobile: value })}
              inputMode="numeric"
            />
            <Field
              label="Email ID"
              value={form.email}
              onChange={value => setForm({ ...form, email: value })}
              type="email"
            />
            <Field
              label="Address 1"
              value={form.address1}
              onChange={value => setForm({ ...form, address1: value })}
            />
            <Field
              label="Address 2"
              value={form.address2}
              onChange={value => setForm({ ...form, address2: value })}
            />
            <Field
              label="Address 3"
              value={form.address3}
              onChange={value => setForm({ ...form, address3: value })}
            />
            <Field
              label="City"
              value={form.city}
              onChange={value => setForm({ ...form, city: value })}
            />
            <Field
              label="PIN Code"
              value={form.pinCode}
              onChange={value => setForm({ ...form, pinCode: value })}
              inputMode="numeric"
            />
          </div>

          <div className="form-actions">
            <button
              className="primary-button action-button"
              disabled={busy || !course}
            >
              <Save size={17} />
              {busy ? 'Saving...' : 'Save Student'}
            </button>
          </div>
        </form>
      ) : (
        <div className="excel-panel">
          <div className="template-box">
            <div>
              <span className="section-kicker">Step 1</span>
              <h2>Download blank Excel format</h2>
              <p>
                The column headings are already prepared. Add student
                information below the headings without changing the column names.
              </p>
            </div>
            <button
              type="button"
              className="secondary-button template-button"
              onClick={downloadTemplate}
            >
              <Download size={17} />
              Download Blank Format
            </button>
          </div>

          <form className="upload-box" onSubmit={prepareExcelUpload}>
            <div>
              <span className="section-kicker">Step 2</span>
              <h2>Upload completed Excel</h2>
              <p>
                {course
                  ? <>Selected destination: <strong>{courseLabel(course)}</strong>.</>
                  : <><strong>No destination selected.</strong> Choose Foundation or Intermediate above.</>}
              </p>
            </div>

            <label className="file-drop">
              <Upload size={22} />
              <strong>{file ? file.name : 'Choose Excel file'}</strong>
              <span>.xlsx or .xls</span>
              <input
                id="student-excel-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={event => {
                  setFile(event.target.files?.[0] || null)
                  setConfirmOpen(false)
                  setPendingRecords([])
                  setConfirmText('')
                }}
              />
            </label>

            <button
              className="primary-button action-button"
              disabled={busy || !file || !course}
            >
              <Upload size={17} />
              {busy ? 'Checking File...' : 'Continue to Confirmation'}
            </button>
          </form>
        </div>
      )}

      {confirmOpen && course && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="confirm-dialog">
            <button
              type="button"
              className="confirm-close"
              onClick={() => {
                setConfirmOpen(false)
                setConfirmText('')
              }}
              aria-label="Close confirmation"
            >
              <X size={18} />
            </button>

            <span className="section-kicker">Final confirmation</span>
            <h2>Are you sure you want to upload in {courseLabel(course)}?</h2>
            <p>
              The file contains <strong>{pendingRecords.length}</strong> valid student
              record{pendingRecords.length === 1 ? '' : 's'}. Existing registration
              numbers will be updated.
            </p>

            <div className="confirm-destination">
              Destination: <strong>{courseLabel(course)}</strong>
            </div>

            <label className="field confirm-field">
              <span>
                Type <strong>{confirmationWord(course)}</strong> to confirm
              </span>
              <input
                value={confirmText}
                onChange={event => setConfirmText(event.target.value)}
                placeholder={confirmationWord(course)}
                autoComplete="off"
              />
            </label>

            <div className="confirm-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setConfirmOpen(false)
                  setConfirmText('')
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button confirm-upload-button"
                onClick={confirmExcelUpload}
                disabled={
                  busy ||
                  confirmText.trim().toUpperCase() !== confirmationWord(course)
                }
              >
                <Upload size={17} />
                {busy ? 'Uploading...' : `Upload to ${courseLabel(course)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search' | 'none'
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        onChange={event => onChange(event.target.value)}
        required={required}
      />
    </label>
  )
}
