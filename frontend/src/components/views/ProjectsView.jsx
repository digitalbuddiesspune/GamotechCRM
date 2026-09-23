import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ProjectDetailModal } from '../ProjectDetailModal'
import ProjectsDashboardLayout from './projects/ProjectsDashboardLayout'

const ProjectsView = () => {
  const { canAddProject, canEditProject, canAssignTask } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusId = (searchParams.get('focus') || '').trim()
  const detailParam = (searchParams.get('detail') || '').trim()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detailProject, setDetailProject] = useState(null)
  const navigate = useNavigate()

  const replaceSearchWithoutDetail = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('detail')
        return next
      },
      { replace: true },
    )
  }

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const res = await api.get('/projects')
      const payload = res.data
      const list = Array.isArray(payload) ? payload : payload?.data || payload?.projects || []
      setProjects(Array.isArray(list) ? list : [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Error fetching projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleDelete = async (project) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return
    try {
      await api.delete(`/projects/${project._id}`)
      fetchProjects()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error deleting project')
    }
  }

  useEffect(() => {
    if (!detailParam || loading) return
    const match = projects.find((p) => String(p._id) === detailParam)
    if (match) {
      setDetailProject(match)
      replaceSearchWithoutDetail()
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get(`/projects/${detailParam}`)
        if (!cancelled && res.data) setDetailProject(res.data)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Could not load project')
      } finally {
        if (!cancelled) replaceSearchWithoutDetail()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailParam, loading, projects])

  return (
    <>
      <ProjectsDashboardLayout
        projects={projects}
        loading={loading}
        error={error}
        focusId={focusId}
        canAddProject={canAddProject()}
        canAssignTask={canAssignTask()}
        canEditProject={canEditProject()}
        onAddProject={() => navigate('/add-project')}
        onOpenProject={setDetailProject}
        onEditProject={(p) => navigate(`/projects/edit/${p._id}`)}
        onDeleteProject={handleDelete}
        onDashboard={(p) => navigate(`/projects/${p._id}/dashboard`)}
        onAssignTask={(p) => navigate(`/assign-task?projectId=${p._id}`)}
      />
      <ProjectDetailModal project={detailProject} onClose={() => setDetailProject(null)} />
    </>
  )
}

export default ProjectsView
