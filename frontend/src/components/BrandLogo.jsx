import React, { useEffect, useState } from 'react'
import api from '../api/axios'
import fallbackLogo from '../assets/gamotech-Photoroom.png'

const BrandLogo = ({ logoUrl = '', alt = 'Logo', className = '' }) => {
  const [companyLogo, setCompanyLogo] = useState('')
  const [clientFailed, setClientFailed] = useState(false)
  const [companyFailed, setCompanyFailed] = useState(false)
  const clientLogo = String(logoUrl || '').trim()

  useEffect(() => {
    setClientFailed(false)
  }, [clientLogo])

  useEffect(() => {
    let cancelled = false
    api.get('/company-profile')
      .then((res) => {
        if (!cancelled) setCompanyLogo(String(res.data?.companyLogo || '').trim())
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const usingClient = Boolean(clientLogo) && !clientFailed
  const usingCompany = !usingClient && Boolean(companyLogo) && !companyFailed
  const src = usingClient ? clientLogo : usingCompany ? companyLogo : fallbackLogo

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        if (usingClient) setClientFailed(true)
        else if (usingCompany) setCompanyFailed(true)
      }}
    />
  )
}

export default BrandLogo
