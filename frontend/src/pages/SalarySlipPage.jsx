import React, { useEffect, useState, useRef } from 'react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { getSalaryStructure } from '../utils/salaryCalculator'

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const SalarySlipPage = () => {
  const { user } = useAuth()
  const printRef = useRef(null)
  const slipRef = useRef(null)

  const [company, setCompany] = useState(null)
  const [salaries, setSalaries] = useState([])
  const [designations, setDesignations] = useState([])
  const [selectedSalary, setSelectedSalary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const compRes = await api.get('/company-profile').catch(() => ({ data: {} }))
        setCompany(compRes.data || {})

        const desigRes = await api.get('/designations').catch(() => ({ data: [] }))
        const desigList = Array.isArray(desigRes.data)
          ? desigRes.data
          : desigRes.data?.designations || desigRes.data?.data || []
        setDesignations(desigList)

        const empId = user?._id || user?.id
        const endpoint = empId ? `/salaries?employee=${empId}` : '/salaries'
        const salRes = await api.get(endpoint).catch(() => ({ data: [] }))
        const list = Array.isArray(salRes.data)
          ? salRes.data
          : salRes.data?.data || salRes.data?.salaries || []
        
        const sorted = (Array.isArray(list) ? list : []).sort((a, b) => {
          if (b.year !== a.year) return b.year - a.year
          return b.month - a.month
        })
        
        setSalaries(sorted)
        const firstPaid = sorted.find((s) => s.status === 'Paid')
        if (firstPaid) setSelectedSalary(firstPaid)
        else if (sorted.length > 0) setSelectedSalary(sorted[0])
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Error loading salary slips')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const getDesignationTitle = (desig) => {
    if (!desig) return '—'
    if (typeof desig === 'object') {
      return desig.title || desig.designationName || desig.name || '—'
    }
    if (typeof desig === 'string') {
      if (/^[0-9a-fA-F]{24}$/.test(desig)) {
        const found = designations.find((d) => String(d._id) === desig || String(d.id) === desig)
        if (found) return found.title || found.designationName || found.name || '—'
        return '—'
      }
      return desig
    }
    return '—'
  }

  const handlePrint = () => {
    window.print()
  }

  const stripUnsupportedColors = (cssText) => {
    if (!cssText || typeof cssText !== 'string') return cssText
    let out = cssText
    const replaceParenFunc = (name, replacement) => {
      const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(', 'gi')
      let match
      while ((match = re.exec(out)) !== null) {
        const idx = match.index
        const start = out.indexOf('(', idx)
        let depth = 1
        let end = start + 1
        while (depth > 0 && end < out.length) {
          if (out[end] === '(') depth++
          else if (out[end] === ')') depth--
          end++
        }
        out = out.slice(0, idx) + replacement + out.slice(end)
        re.lastIndex = 0
      }
    }
    replaceParenFunc('oklch', 'transparent')
    replaceParenFunc('oklab', 'transparent')
    replaceParenFunc('color-mix', 'transparent')
    return out
  }

  const handleDownload = async () => {
    const element = slipRef.current || printRef.current
    if (!element) return
    setDownloading(true)
    setDownloadError(null)
    try {
      let strippedLinkedCss = ''
      const links = document.querySelectorAll('link[rel="stylesheet"]')
      if (links.length > 0) {
        const hrefs = Array.from(links).map((l) => l.href).filter(Boolean)
        const texts = await Promise.all(
          hrefs.map((h) => fetch(h).then((r) => r.text()).catch(() => ''))
        )
        strippedLinkedCss = texts.map(stripUnsupportedColors).join('\n')
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc, clonedElement) => {
          clonedDoc.querySelectorAll('style').forEach((style) => {
            if (style.textContent) {
              style.textContent = stripUnsupportedColors(style.textContent)
            }
          })
          clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => l.remove())
          if (strippedLinkedCss) {
            const style = clonedDoc.createElement('style')
            style.textContent = strippedLinkedCss
            clonedDoc.head.appendChild(style)
          }
          clonedElement.querySelectorAll('[style]').forEach((el) => {
            const s = el.getAttribute('style')
            if (s && /oklch/i.test(s)) {
              el.setAttribute('style', stripUnsupportedColors(s))
            }
          })
        },
      })

      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgData = canvas.toDataURL('image/jpeg', 0.95)

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight))
      const empName = selectedSalary?.employee?.name || user?.name || 'Employee'
      const monthLabel = MONTH_NAMES[selectedSalary?.month] || 'Salary'
      const filename = `SalarySlip-${empName.replace(/\s+/g, '_')}-${monthLabel}_${selectedSalary?.year}.pdf`
      pdf.save(filename)
    } catch (err) {
      console.error('Salary slip PDF download failed:', err)
      setDownloadError(err?.message || 'Download failed. Try Print then Save as PDF.')
    } finally {
      setDownloading(false)
    }
  }

  const formatINR = (num) => {
    if (num == null || num === '' || isNaN(num)) return '₹0'
    const n = Number(num)
    return `₹${Math.round(n).toLocaleString('en-IN')}`
  }

  if (loading) {
    return <div className='p-8 text-sm text-gray-600'>Loading salary slips...</div>
  }

  const emp = selectedSalary?.employee || user || {}
  const isPaid = selectedSalary?.status === 'Paid'
  const structure = getSalaryStructure(selectedSalary)

  return (
    <div className='p-4 md:p-8 bg-gray-50 min-h-full'>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #salary-slip-printable, #salary-slip-printable * {
            visibility: visible !important;
          }
          #salary-slip-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background-color: #ffffff !important;
            border: 1px solid #e5e7eb !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      <div className='max-w-6xl mx-auto'>
        {/* Header */}
        <div className='mb-6 print:hidden'>
          <nav className='text-sm text-gray-500 mb-2'>
            <span className='text-gray-900 font-medium'>My Workspace</span>
            <span className='mx-2 text-gray-300'>›</span>
            <span className='text-gray-900 font-medium'>Salary Slips</span>
          </nav>
          <h1 className='text-2xl font-bold text-gray-900'>Salary Slips</h1>
          <p className='text-sm text-gray-500 mt-1'>
            View and download your monthly salary slips once approved and marked as paid by HR.
          </p>
        </div>

        {error && (
          <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm print:hidden'>
            {error}
          </div>
        )}

        <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
          {/* Left Column: Month Selector List */}
          <div className='lg:col-span-4 print:hidden space-y-4'>
            <div className='bg-white rounded-xl shadow-sm border border-gray-200 p-5'>
              <h2 className='text-base font-semibold text-gray-800 mb-3'>Payment Records</h2>
              {salaries.length === 0 ? (
                <p className='text-sm text-gray-500 py-4 text-center'>No salary records found.</p>
              ) : (
                <div className='space-y-2 max-h-[500px] overflow-y-auto pr-1'>
                  {salaries.map((s) => {
                    const isSelected = selectedSalary?._id === s._id
                    const sPaid = s.status === 'Paid'
                    return (
                      <button
                        key={s._id}
                        onClick={() => setSelectedSalary(s)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div>
                          <p className='font-semibold text-gray-900 text-sm'>
                            {MONTH_NAMES[s.month]} {s.year}
                          </p>
                          <p className='text-xs text-gray-500 mt-0.5'>
                            {s.employee?.name || user?.name || 'Employee'}
                          </p>
                          <p className='text-sm font-bold text-gray-800 mt-1'>
                            {formatINR(s.grossSalary || s.amount)}
                          </p>
                        </div>
                        <div className='text-right'>
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                              sPaid
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {s.status || 'Unpaid'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Salary Slip Preview & Download */}
          <div className='lg:col-span-8'>
            {!selectedSalary ? (
              <div className='bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500 print:hidden'>
                Select a salary record to view the salary slip.
              </div>
            ) : !isPaid ? (
              <div className='bg-amber-50 border border-amber-200 rounded-xl p-8 text-center print:hidden'>
                <div className='w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-700 text-xl font-bold'>
                  ⏳
                </div>
                <h3 className='text-lg font-semibold text-amber-900'>Salary Payment Pending</h3>
                <p className='text-sm text-amber-700 mt-1 max-w-md mx-auto'>
                  Your salary slip for {MONTH_NAMES[selectedSalary.month]} {selectedSalary.year} will become available for view and download once HR marks the payment status as <strong>Paid</strong>.
                </p>
              </div>
            ) : (
              <div>
                {/* Actions Toolbar */}
                <div className='print:hidden bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-sm'>
                  <div>
                    <h3 className='font-semibold text-gray-900 text-sm'>
                      Salary Slip — {MONTH_NAMES[selectedSalary.month]} {selectedSalary.year}
                    </h3>
                    <p className='text-xs text-green-700 font-medium mt-0.5 flex items-center gap-1'>
                      <span>✓</span> Status: Paid
                    </p>
                  </div>
                  <div className='flex gap-2'>
                    <button
                      onClick={handlePrint}
                      className='bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-1.5'
                    >
                      <span>🖨</span> Print
                    </button>
                    <button
                      onClick={handleDownload}
                      disabled={downloading}
                      className='bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5'
                    >
                      <span>📥</span> {downloading ? 'Downloading...' : 'Download PDF'}
                    </button>
                  </div>
                </div>

                {downloadError && (
                  <div className='print:hidden mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800'>
                    {downloadError}
                  </div>
                )}

                {/* Printable Salary Slip Container */}
                <div
                  id='salary-slip-printable'
                  ref={printRef}
                  className='bg-white border border-gray-300 rounded-xl shadow-md overflow-hidden p-6 md:p-10 text-black'
                  style={{ backgroundColor: '#ffffff', color: '#000000' }}
                >
                  <div ref={slipRef} className='space-y-6'>
                    {/* Header: Company Info */}
                    <div className='border-b pb-6 flex flex-wrap items-center justify-between gap-4' style={{ borderColor: '#d1d5db' }}>
                      <div>
                        {company?.companyLogo && (
                          <img
                            src={company.companyLogo}
                            alt='Company Logo'
                            className='h-14 w-auto max-w-[180px] object-contain mb-2'
                          />
                        )}
                        <h2 className='text-xl font-bold uppercase tracking-wide' style={{ color: '#000000' }}>
                          {company?.companyName || 'Organization Name'}
                        </h2>
                        {company?.address && <p className='text-xs mt-1 max-w-sm' style={{ color: '#374151' }}>{company.address}</p>}
                        <div className='text-xs mt-1 space-x-3' style={{ color: '#4b5563' }}>
                          {company?.email && <span>Email: {company.email}</span>}
                          {company?.phone && <span>Phone: {company.phone}</span>}
                        </div>
                        {company?.gstin && <p className='text-xs' style={{ color: '#4b5563' }}>GSTIN: {company.gstin}</p>}
                        {company?.pan && <p className='text-xs' style={{ color: '#4b5563' }}>Company PAN: {company.pan}</p>}
                      </div>
                      <div className='text-right border-l-2 pl-4 py-1' style={{ borderColor: '#2563eb' }}>
                        <span className='text-xs font-semibold uppercase tracking-widest block' style={{ color: '#2563eb' }}>Official Document</span>
                        <h3 className='text-lg font-bold mt-0.5' style={{ color: '#111827' }}>PAYSLIP</h3>
                        <p className='text-xs font-medium mt-0.5' style={{ color: '#4b5563' }}>
                          {MONTH_NAMES[selectedSalary.month]} {selectedSalary.year}
                        </p>
                      </div>
                    </div>

                    {/* Employee & Payment Meta Grid */}
                    <div
                      className='rounded-lg p-4 text-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4'
                      style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
                    >
                      <div>
                        <span className='font-medium block' style={{ color: '#6b7280' }}>Employee Name</span>
                        <span className='font-bold text-sm' style={{ color: '#111827' }}>{emp.name || user?.name || '—'}</span>
                      </div>
                      <div>
                        <span className='font-medium block' style={{ color: '#6b7280' }}>Employee Code / ID</span>
                        <span className='font-semibold' style={{ color: '#1f2937' }}>{emp.employeeCode || emp._id || emp.id || '—'}</span>
                      </div>
                      <div>
                        <span className='font-medium block' style={{ color: '#6b7280' }}>Designation</span>
                        <span className='font-semibold' style={{ color: '#1f2937' }}>{getDesignationTitle(emp.designation)}</span>
                      </div>
                      <div>
                        <span className='font-medium block' style={{ color: '#6b7280' }}>Department</span>
                        <span className='font-semibold' style={{ color: '#1f2937' }}>{emp.department || '—'}</span>
                      </div>
                      <div>
                        <span className='font-medium block' style={{ color: '#6b7280' }}>Date of Joining</span>
                        <span className='font-semibold' style={{ color: '#1f2937' }}>
                          {emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-IN') : '—'}
                        </span>
                      </div>
                      <div>
                        <span className='font-medium block' style={{ color: '#6b7280' }}>Employee PAN</span>
                        <span className='font-semibold' style={{ color: '#1f2937' }}>
                          {emp.salaryPayroll?.panNumber || emp.panNumber || emp.documents?.panCard || '—'}
                        </span>
                      </div>
                      <div>
                        <span className='font-medium block' style={{ color: '#6b7280' }}>Bank Account Details</span>
                        <span className='font-semibold' style={{ color: '#1f2937' }}>{emp.salaryPayroll?.bankAccountDetails || emp.bankAccountNumber || '—'}</span>
                      </div>
                      <div>
                        <span className='font-medium block' style={{ color: '#6b7280' }}>Payment Method</span>
                        <span className='font-semibold' style={{ color: '#1f2937' }}>{selectedSalary.paymentMode || 'Bank Transfer'}</span>
                      </div>
                      <div>
                        <span className='font-medium block' style={{ color: '#6b7280' }}>Payment Status</span>
                        <span className='font-bold uppercase' style={{ color: '#15803d' }}>PAID</span>
                      </div>
                      <div>
                        <span className='font-medium block' style={{ color: '#6b7280' }}>Payment Date</span>
                        <span className='font-semibold' style={{ color: '#1f2937' }}>
                          {selectedSalary.paymentDate
                            ? new Date(selectedSalary.paymentDate).toLocaleDateString('en-IN')
                            : new Date(selectedSalary.updatedAt || Date.now()).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Salary Breakdown Table */}
                    <div>
                      <h4 className='text-xs font-bold uppercase tracking-wider mb-2' style={{ color: '#1f2937' }}>Earnings & Employee Deductions</h4>
                      <table className='w-full text-xs rounded-lg overflow-hidden' style={{ border: '1px solid #d1d5db' }}>
                        <thead>
                          <tr className='font-bold' style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #d1d5db', color: '#1f2937' }}>
                            <th className='py-2.5 px-3 text-left w-1/2' style={{ borderRight: '1px solid #d1d5db' }}>EARNINGS COMPONENT</th>
                            <th className='py-2.5 px-3 text-right' style={{ borderRight: '1px solid #d1d5db' }}>AMOUNT</th>
                            <th className='py-2.5 px-3 text-left w-1/3' style={{ borderRight: '1px solid #d1d5db' }}>DEDUCTION COMPONENT</th>
                            <th className='py-2.5 px-3 text-right'>AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: Math.max(structure.components.length, structure.deductions.length) }).map((_, idx) => {
                            const comp = structure.components[idx]
                            const ded = structure.deductions[idx]
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td className='py-2 px-3' style={{ borderRight: '1px solid #e5e7eb' }}>
                                  {comp ? comp.name : '—'}
                                </td>
                                <td className='py-2 px-3 text-right font-medium' style={{ borderRight: '1px solid #e5e7eb' }}>
                                  {comp ? formatINR(comp.amount) : '—'}
                                </td>
                                <td className='py-2 px-3' style={{ borderRight: '1px solid #e5e7eb' }}>
                                  {ded ? ded.name : '—'}
                                </td>
                                <td className='py-2 px-3 text-right font-medium'>
                                  {ded ? formatINR(ded.amount) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                          <tr className='font-bold' style={{ backgroundColor: '#f9fafb', borderTop: '1px solid #d1d5db', color: '#111827' }}>
                            <td className='py-2.5 px-3' style={{ borderRight: '1px solid #d1d5db' }}>GROSS SALARY (TOTAL EARNINGS)</td>
                            <td className='py-2.5 px-3 text-right' style={{ borderRight: '1px solid #d1d5db' }}>{formatINR(structure.grossSalary)}</td>
                            <td className='py-2.5 px-3' style={{ borderRight: '1px solid #d1d5db' }}>TOTAL DEDUCTIONS</td>
                            <td className='py-2.5 px-3 text-right'>{formatINR(structure.totalDeductions)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Employer Contributions & CTC Details */}
                    <div>
                      <h4 className='text-xs font-bold uppercase tracking-wider mb-2' style={{ color: '#1f2937' }}>Employer Contributions</h4>
                      <table className='w-full text-xs rounded-lg overflow-hidden' style={{ border: '1px solid #d1d5db' }}>
                        <thead>
                          <tr className='font-bold' style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #d1d5db', color: '#1f2937' }}>
                            <th className='py-2 px-3 text-left'>CONTRIBUTION TYPE</th>
                            <th className='py-2 px-3 text-right'>AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {structure.employerContributions.map((empContrib, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td className='py-2 px-3'>{empContrib.name}</td>
                              <td className='py-2 px-3 text-right font-medium'>{formatINR(empContrib.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Net Pay & CTC Summary Cards */}
                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                      <div
                        className='rounded-lg p-3 text-center'
                        style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}
                      >
                        <span className='text-[11px] font-bold uppercase tracking-wide block' style={{ color: '#166534' }}>Net Salary</span>
                        <span className='text-lg font-extrabold block mt-0.5' style={{ color: '#15803d' }}>{formatINR(structure.netSalary)}</span>
                      </div>
                      <div
                        className='rounded-lg p-3 text-center'
                        style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}
                      >
                        <span className='text-[11px] font-bold uppercase tracking-wide block' style={{ color: '#1e40af' }}>Monthly CTC</span>
                        <span className='text-lg font-extrabold block mt-0.5' style={{ color: '#1d4ed8' }}>{formatINR(structure.monthlyCTC)}</span>
                      </div>
                      <div
                        className='rounded-lg p-3 text-center'
                        style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}
                      >
                        <span className='text-[11px] font-bold uppercase tracking-wide block' style={{ color: '#6b21a8' }}>Annual CTC</span>
                        <span className='text-lg font-extrabold block mt-0.5' style={{ color: '#7e22ce' }}>{formatINR(structure.annualCTC)}</span>
                      </div>
                    </div>

                    {/* Footer: Stamp & Authorized Signature */}
                    <div className='pt-6 flex items-end justify-between gap-6' style={{ borderTop: '1px solid #e5e7eb' }}>
                      {/* Stamp Column */}
                      <div className='text-center min-w-[140px]'>
                        {company?.companyStamp ? (
                          <img
                            src={company.companyStamp}
                            alt='Company Stamp'
                            className='h-16 w-auto max-w-[140px] object-contain mx-auto'
                          />
                        ) : (
                          <div className='h-16 flex items-center justify-center text-xs border border-dashed rounded-lg px-2' style={{ color: '#9ca3af', borderColor: '#d1d5db' }}>
                            Company Stamp
                          </div>
                        )}
                        <p className='text-xs font-semibold mt-1' style={{ color: '#374151' }}>Company Stamp</p>
                      </div>

                      {/* Disclaimer Note */}
                      <div className='text-center flex-1 text-[11px] italic max-w-xs mx-auto' style={{ color: '#6b7280' }}>
                        This is a computer-generated payslip issued by {company?.companyName || 'the organization'} and does not require a physical ink signature.
                      </div>

                      {/* Authorized Signature Column */}
                      <div className='text-center min-w-[140px]'>
                        {company?.authorizedSignature ? (
                          <img
                            src={company.authorizedSignature}
                            alt='Authorized Signature'
                            className='h-16 w-auto max-w-[140px] object-contain mx-auto'
                          />
                        ) : (
                          <div className='border-t-2 w-32 mt-12 mb-1 mx-auto' style={{ borderColor: '#1f2937' }} />
                        )}
                        <p className='text-xs font-semibold mt-1' style={{ color: '#1f2937' }}>Authorized Signature</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SalarySlipPage
