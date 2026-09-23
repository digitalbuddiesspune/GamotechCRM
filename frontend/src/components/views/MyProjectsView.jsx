import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import ProjectsDashboardLayout from './projects/ProjectsDashboardLayout'

const MyProjectsView = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProjects = async () => {
    if (!user?._id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await api.get('/projects/my-projects', { params: { employeeId: user._id } })
      const list = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.projects || []
      setProjects(Array.isArray(list) ? list : [])
      setError(null)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error fetching projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [user?._id])

  return (
    <ProjectsDashboardLayout
      title='My Projects'
      subtitle='Projects where you are assigned as project manager or team member.'
      projects={projects}
      loading={loading}
      error={error}
      showExport={false}
      canAddProject={false}
      canAssignTask={Boolean(user?._id)}
      canEditProject={false}
      onAddProject={() => navigate('/my-projects')}
      onOpenProject={(p) => navigate(`/my-projects/${p._id}/dashboard`)}
      onEditProject={() => {}}
      onDeleteProject={() => {}}
      onDashboard={(p) => navigate(`/my-projects/${p._id}/dashboard`)}
      onAssignTask={(p) => navigate(`/assign-task?projectId=${p._id}&scope=my-projects`)}
    />
  )
}

export default MyProjectsView
