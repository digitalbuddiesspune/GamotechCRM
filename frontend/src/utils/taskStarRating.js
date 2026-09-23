/**
 * Auto star rating bands (same % rules for any estimate; 60‑min example in comments).
 *   ≤75% (≥25% left) → 5 | ≤100% → 4 | ≤125% → 3 | ≤150% → 2 | >150% → 1
 *   Not completed → null (UI: ❌)
 */

export const TASK_STAR_BANDS = [
  { maxRatio: 0.75, score: 5, label: 'Finished with ≥25% time left' },
  { maxRatio: 1.0, score: 4, label: 'Finished with <25% time left' },
  { maxRatio: 1.25, score: 3, label: 'Late by up to 25%' },
  { maxRatio: 1.5, score: 2, label: 'Late by up to 50%' },
  { maxRatio: Infinity, score: 1, label: 'More than 50% late' },
]

const toValidDate = (value) => {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export const getActualTaskDurationMinutes = (task) => {
  if (String(task?.status || '').trim() !== 'Completed' || !task?.completedAt) return null
  const end = toValidDate(task.completedAt)
  if (!end) return null

  const candidates = [task.startedAt, task.scheduledStartAt, task.createdAt]
    .map(toValidDate)
    .filter(Boolean)
  const start =
    candidates.filter((d) => d.getTime() <= end.getTime()).sort((a, b) => b - a)[0] ||
    candidates[0] ||
    end

  if (end.getTime() < start.getTime()) return null
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

export const computeTaskStarScore = (estimatedDurationMinutes, actualDurationMinutes) => {
  const estimated = Number(estimatedDurationMinutes)
  const actual = Number(actualDurationMinutes)
  if (!Number.isFinite(estimated) || estimated <= 0) return null
  if (!Number.isFinite(actual) || actual < 0) return null
  const ratio = actual / estimated
  const band = TASK_STAR_BANDS.find((b) => ratio <= b.maxRatio) || TASK_STAR_BANDS.at(-1)
  return band.score
}

export const formatTaskStarDisplay = (task) => {
  const status = String(task?.status || '').trim()
  if (status !== 'Completed') return { kind: 'incomplete', label: 'Not completed' }
  const score = Number(task?.rating?.score)
  if (Number.isFinite(score) && score >= 1) {
    return {
      kind: 'score',
      score,
      auto: Boolean(task?.rating?.auto),
      label: task?.rating?.auto ? 'Auto-rated from completion time' : 'Manager rating',
    }
  }
  return { kind: 'none', label: 'No rating' }
}
