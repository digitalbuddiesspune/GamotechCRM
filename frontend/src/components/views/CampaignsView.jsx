import React from 'react'

const CampaignsView = () => {
  const campaigns = [
    { id: 1, name: 'Q1 Digital Marketing Push', client: 'Tech Corp Inc', type: 'Multi-Channel', status: 'Active', progress: 65, startDate: 'Jan 1, 2026', endDate: 'Mar 31, 2026', budget: '$50K', roi: '+245%' },
    { id: 2, name: 'SEO Optimization Q1', client: 'Digital Solutions', type: 'SEO', status: 'Active', progress: 80, startDate: 'Jan 15, 2026', endDate: 'Apr 15, 2026', budget: '$25K', roi: '+185%' },
    { id: 3, name: 'Social Media Engagement', client: 'E-Commerce Hub', type: 'Social Media', status: 'Planning', progress: 20, startDate: 'Mar 1, 2026', endDate: 'May 31, 2026', budget: '$35K', roi: 'TBD' },
    { id: 4, name: 'Content Marketing Series', client: 'Marketing Plus', type: 'Content', status: 'Completed', progress: 100, startDate: 'Nov 1, 2025', endDate: 'Feb 28, 2026', budget: '$20K', roi: '+320%' },
  ]

  return (
    <div className='p-8'>
      <div className='mb-8 flex justify-between items-center'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900'>Campaigns</h1>
          <p className='text-gray-600 mt-2'>Track and manage all marketing campaigns.</p>
        </div>
        <button className='bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors'>
          + New Campaign
        </button>
      </div>

      <div className='grid grid-cols-1 gap-6'>
        {campaigns.map((campaign) => (
          <div key={campaign.id} className='bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500'>
            <div className='flex justify-between items-start mb-4'>
              <div>
                <h3 className='text-xl font-bold text-gray-900'>{campaign.name}</h3>
                <p className='text-sm text-gray-600'>{campaign.client} • {campaign.type}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                campaign.status === 'Active' ? 'bg-green-100 text-green-800' :
                campaign.status === 'Planning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {campaign.status}
              </span>
            </div>

            <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
              <div>
                <p className='text-xs text-gray-600'>Budget</p>
                <p className='text-lg font-bold text-gray-900'>{campaign.budget}</p>
              </div>
              <div>
                <p className='text-xs text-gray-600'>ROI</p>
                <p className='text-lg font-bold text-green-600'>{campaign.roi}</p>
              </div>
              <div>
                <p className='text-xs text-gray-600'>Start Date</p>
                <p className='text-sm font-medium text-gray-900'>{campaign.startDate}</p>
              </div>
              <div>
                <p className='text-xs text-gray-600'>End Date</p>
                <p className='text-sm font-medium text-gray-900'>{campaign.endDate}</p>
              </div>
            </div>

            <div>
              <div className='flex justify-between mb-1'>
                <span className='text-xs font-semibold text-gray-700'>Progress</span>
                <span className='text-xs font-bold text-gray-900'>{campaign.progress}%</span>
              </div>
              <div className='w-full bg-gray-200 rounded-full h-2'>
                <div
                  className='bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all'
                  style={{ width: `${campaign.progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CampaignsView
