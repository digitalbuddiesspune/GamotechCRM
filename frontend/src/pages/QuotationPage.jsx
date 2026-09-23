import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import api from '../api/axios'

const formatInr = (value) =>
  Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const QuotationPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const printRef = useRef(null)
  const [quotation, setQuotation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) return
    const fetchQuotation = async () => {
      try {
        const res = await api.get(`/quotations/${id}`)
        setQuotation(res.data)
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load quotation')
      } finally {
        setLoading(false)
      }
    }
    fetchQuotation()
  }, [id])

  const handlePrint = () => window.print()

  const handleDownload = async () => {
    if (!printRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      pdf.save(`${quotation?.quotationNumber || 'quotation'}.pdf`)
    } catch (err) {
      console.error('PDF download failed', err)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return <div className='p-6 text-sm text-gray-600'>Loading quotation...</div>
  }

  if (error || !quotation) {
    return (
      <div className='p-6'>
        <p className='text-red-600 text-sm mb-3'>{error || 'Quotation not found'}</p>
        <button
          type='button'
          onClick={() => navigate('/quotations')}
          className='text-sm text-blue-600 hover:underline'
        >
          Back to quotations
        </button>
      </div>
    )
  }

  return (
    <div className='p-4 md:p-6'>
      <div className='flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Quotation</h1>
          <p className='text-sm text-gray-500'>{quotation.quotationNumber}</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={() => navigate('/quotations')}
            className='px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50'
          >
            Back
          </button>
          <button
            type='button'
            onClick={() => navigate(`/quotations/edit/${quotation._id}`)}
            className='px-3 py-2 rounded-lg border border-blue-600 text-blue-700 text-sm font-medium hover:bg-blue-50'
          >
            Edit
          </button>
          <button
            type='button'
            onClick={handlePrint}
            className='px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50'
          >
            Print
          </button>
          <button
            type='button'
            onClick={handleDownload}
            disabled={downloading}
            className='px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50'
          >
            {downloading ? 'Downloading…' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div ref={printRef} className='bg-white border border-gray-200 rounded-xl shadow-sm p-6 md:p-8 max-w-4xl mx-auto'>
        <div className='flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-4 mb-6'>
          <div>
            <p className='text-xs uppercase tracking-wide text-gray-500 font-semibold'>Quotation</p>
            <h2 className='text-2xl font-bold text-gray-900 mt-1'>{quotation.subject}</h2>
            <p className='text-sm text-gray-600 mt-1'>#{quotation.quotationNumber}</p>
          </div>
          <div className='text-sm text-gray-700 text-right'>
            <p><span className='text-gray-500'>Date:</span> {formatDate(quotation.quotationDate)}</p>
            <p><span className='text-gray-500'>Valid Until:</span> {formatDate(quotation.validUntil)}</p>
            <p><span className='text-gray-500'>Status:</span> {quotation.status}</p>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-sm'>
          <div>
            <p className='text-xs font-semibold uppercase text-gray-500 mb-2'>Bill To</p>
            <p className='font-semibold text-gray-900'>{quotation.client?.clientName || '—'}</p>
            {quotation.clientContact?.name && <p>{quotation.clientContact.name}</p>}
            {quotation.clientContact?.email && <p>{quotation.clientContact.email}</p>}
            {quotation.clientContact?.phone && <p>{quotation.clientContact.phone}</p>}
            {quotation.billingAddress && <p className='mt-2 whitespace-pre-wrap'>{quotation.billingAddress}</p>}
          </div>
          <div>
            <p className='text-xs font-semibold uppercase text-gray-500 mb-2'>Prepared By</p>
            <p className='font-semibold text-gray-900'>{quotation.preparedBy?.name || '—'}</p>
            {quotation.preparedBy?.email && <p>{quotation.preparedBy.email}</p>}
            {quotation.project?.projectName && (
              <p className='mt-2'><span className='text-gray-500'>Project:</span> {quotation.project.projectName}</p>
            )}
            {quotation.lead && (
              <p><span className='text-gray-500'>Lead:</span> {quotation.lead.businessName || quotation.lead.name}</p>
            )}
          </div>
        </div>

        <div className='overflow-x-auto mb-6'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='bg-gray-50 border-y border-gray-200'>
                <th className='px-3 py-2 text-left font-semibold text-gray-700'>Item</th>
                <th className='px-3 py-2 text-right font-semibold text-gray-700'>Qty</th>
                <th className='px-3 py-2 text-right font-semibold text-gray-700'>Unit Price</th>
                <th className='px-3 py-2 text-right font-semibold text-gray-700'>Discount</th>
                <th className='px-3 py-2 text-right font-semibold text-gray-700'>Tax %</th>
                <th className='px-3 py-2 text-right font-semibold text-gray-700'>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(quotation.lineItems || []).map((item, index) => (
                <tr key={index} className='border-b border-gray-100 align-top'>
                  <td className='px-3 py-3'>
                    <p className='font-medium text-gray-900'>{item.name || item.description}</p>
                    {item.name && item.description && item.name !== item.description && (
                      <p className='text-xs text-gray-500 mt-0.5'>{item.description}</p>
                    )}
                    <p className='text-xs text-gray-400'>{item.unit || 'Nos'}</p>
                  </td>
                  <td className='px-3 py-3 text-right'>{item.quantity}</td>
                  <td className='px-3 py-3 text-right'>₹{formatInr(item.unitPrice)}</td>
                  <td className='px-3 py-3 text-right'>₹{formatInr(item.discount)}</td>
                  <td className='px-3 py-3 text-right'>{item.taxRate}%</td>
                  <td className='px-3 py-3 text-right font-medium'>₹{formatInr(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='flex justify-end mb-6'>
          <div className='w-full max-w-xs space-y-2 text-sm'>
            <div className='flex justify-between'><span className='text-gray-500'>Subtotal</span><span>₹{formatInr(quotation.subtotal)}</span></div>
            <div className='flex justify-between'><span className='text-gray-500'>Discount</span><span>₹{formatInr(quotation.discountTotal)}</span></div>
            <div className='flex justify-between'><span className='text-gray-500'>Tax</span><span>₹{formatInr(quotation.taxTotal)}</span></div>
            <div className='flex justify-between border-t border-gray-200 pt-2 font-bold text-base'>
              <span>Grand Total</span>
              <span>₹{formatInr(quotation.grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
          {(quotation.quotationUrl || quotation.quotationFileName) && (
            <div className='md:col-span-2'>
              <p className='text-xs font-semibold uppercase text-gray-500 mb-1'>Quotation File / URL</p>
              <a
                href={quotation.quotationUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-600 hover:underline break-all'
              >
                {quotation.quotationFileName || (quotation.quotationUrl?.startsWith('data:') ? 'Open uploaded file' : quotation.quotationUrl)}
              </a>
            </div>
          )}
          {quotation.paymentTerms && (
            <div>
              <p className='text-xs font-semibold uppercase text-gray-500 mb-1'>Payment Terms</p>
              <p className='whitespace-pre-wrap text-gray-700'>{quotation.paymentTerms}</p>
            </div>
          )}
          {quotation.scopeOfWork && (
            <div>
              <p className='text-xs font-semibold uppercase text-gray-500 mb-1'>Scope of Work</p>
              <p className='whitespace-pre-wrap text-gray-700'>{quotation.scopeOfWork}</p>
            </div>
          )}
          {quotation.termsAndConditions && (
            <div>
              <p className='text-xs font-semibold uppercase text-gray-500 mb-1'>Terms & Conditions</p>
              <p className='whitespace-pre-wrap text-gray-700'>{quotation.termsAndConditions}</p>
            </div>
          )}
          {quotation.notes && (
            <div>
              <p className='text-xs font-semibold uppercase text-gray-500 mb-1'>Notes</p>
              <p className='whitespace-pre-wrap text-gray-700'>{quotation.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default QuotationPage
