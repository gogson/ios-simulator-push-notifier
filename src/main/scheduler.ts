import cron from 'node-cron'
import { getActiveSchedules, getNotification, deactivateSchedule } from './db'
import { sendPush, listBootedSimulators } from './simulator'
import { BrowserWindow } from 'electron'

interface ActiveJob {
  scheduleId: string
  type: 'once' | 'recurring'
  timeout?: ReturnType<typeof setTimeout>
  cronTask?: cron.ScheduledTask
}

const activeJobs = new Map<string, ActiveJob>()

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

async function executeScheduledPush(notificationId: string, scheduleId: string): Promise<void> {
  const notification = getNotification(notificationId)
  if (!notification) return

  const simulators = await listBootedSimulators()
  if (simulators.length === 0) {
    getMainWindow()?.webContents.send('schedule:error', {
      scheduleId,
      error: 'No booted simulator found'
    })
    return
  }

  const payload = notification.payload
  const bundleId = notification.bundle_id
  const result = await sendPush(simulators[0].udid, bundleId, payload)

  getMainWindow()?.webContents.send('schedule:executed', {
    scheduleId,
    notificationId,
    success: result.success,
    error: result.error
  })
}

export function startSchedule(
  scheduleId: string,
  notificationId: string,
  type: 'once' | 'recurring',
  delaySeconds?: number,
  cronExpression?: string
): void {
  // Cancel existing job if any
  cancelSchedule(scheduleId)

  if (type === 'once' && delaySeconds) {
    const timeout = setTimeout(async () => {
      await executeScheduledPush(notificationId, scheduleId)
      deactivateSchedule(scheduleId)
      activeJobs.delete(scheduleId)
      getMainWindow()?.webContents.send('schedule:completed', { scheduleId })
    }, delaySeconds * 1000)

    activeJobs.set(scheduleId, { scheduleId, type: 'once', timeout })
  } else if (type === 'recurring' && cronExpression) {
    const cronTask = cron.schedule(cronExpression, async () => {
      await executeScheduledPush(notificationId, scheduleId)
    })
    activeJobs.set(scheduleId, { scheduleId, type: 'recurring', cronTask })
  }
}

export function cancelSchedule(scheduleId: string): void {
  const job = activeJobs.get(scheduleId)
  if (!job) return

  if (job.timeout) clearTimeout(job.timeout)
  if (job.cronTask) job.cronTask.stop()
  activeJobs.delete(scheduleId)
}

export function hydrateSchedules(): void {
  const schedules = getActiveSchedules()
  for (const schedule of schedules) {
    if (schedule.type === 'once' && schedule.next_run_at) {
      const remaining = schedule.next_run_at - Date.now()
      if (remaining <= 0) {
        // Already past due, execute immediately
        executeScheduledPush(schedule.notification_id, schedule.id).then(() => {
          deactivateSchedule(schedule.id)
        })
      } else {
        startSchedule(
          schedule.id,
          schedule.notification_id,
          'once',
          Math.ceil(remaining / 1000)
        )
      }
    } else if (schedule.type === 'recurring' && schedule.cron_expression) {
      startSchedule(
        schedule.id,
        schedule.notification_id,
        'recurring',
        undefined,
        schedule.cron_expression
      )
    }
  }
}

export function cancelAllSchedules(): void {
  for (const [, job] of activeJobs) {
    if (job.timeout) clearTimeout(job.timeout)
    if (job.cronJob) job.cronJob.stop()
  }
  activeJobs.clear()
}
