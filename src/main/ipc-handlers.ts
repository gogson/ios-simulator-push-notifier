import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { basename } from 'path'
import {
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  reorderFolders,
  getNotifications,
  getNotification,
  createNotification,
  updateNotification,
  deleteNotification,
  duplicateNotification,
  moveNotificationsToFolder,
  getSchedules,
  createSchedule,
  deactivateSchedule,
  deleteSchedule
} from './db'
import {
  checkXcodeInstalled,
  listBootedSimulators,
  listInstalledApps,
  sendPush
} from './simulator'
import { startSchedule, cancelSchedule } from './scheduler'

export function registerIpcHandlers(): void {
  // ─── Folders ───
  ipcMain.handle('folders:list', () => getFolders())
  ipcMain.handle('folders:create', (_, name: string) => createFolder(name))
  ipcMain.handle('folders:rename', (_, id: string, name: string) => renameFolder(id, name))
  ipcMain.handle('folders:delete', (_, id: string) => deleteFolder(id))
  ipcMain.handle('folders:reorder', (_, ids: string[]) => reorderFolders(ids))
  ipcMain.handle('folders:move-notifications', (_, fromId: string, toId: string) =>
    moveNotificationsToFolder(fromId, toId)
  )

  // ─── Notifications ───
  ipcMain.handle('notifications:list', (_, folderId?: string) => getNotifications(folderId))
  ipcMain.handle('notifications:get', (_, id: string) => getNotification(id))
  ipcMain.handle(
    'notifications:create',
    (_, folderId: string, name: string, bundleId?: string, payload?: string) =>
      createNotification(folderId, name, bundleId, payload)
  )
  ipcMain.handle(
    'notifications:update',
    (
      _,
      id: string,
      data: { name?: string; bundle_id?: string; payload?: string; folder_id?: string }
    ) => updateNotification(id, data)
  )
  ipcMain.handle('notifications:delete', (_, id: string) => deleteNotification(id))
  ipcMain.handle('notifications:duplicate', (_, id: string) => duplicateNotification(id))

  // ─── Simulator ───
  ipcMain.handle('simulator:check-xcode', () => checkXcodeInstalled())
  ipcMain.handle('simulator:list-devices', () => listBootedSimulators())
  ipcMain.handle('simulator:list-apps', (_, udid: string) => listInstalledApps(udid))
  ipcMain.handle('simulator:send-push', (_, udid: string, bundleId: string, payload: string) =>
    sendPush(udid, bundleId, payload)
  )

  // ─── Schedules ───
  ipcMain.handle('schedules:list', (_, notificationId?: string) => getSchedules(notificationId))
  ipcMain.handle(
    'schedules:create',
    (
      _,
      notificationId: string,
      type: 'once' | 'recurring',
      delaySeconds?: number,
      cronExpression?: string
    ) => {
      const schedule = createSchedule(notificationId, type, delaySeconds, cronExpression)
      startSchedule(schedule.id, notificationId, type, delaySeconds, cronExpression)
      return schedule
    }
  )
  ipcMain.handle('schedules:cancel', (_, id: string) => {
    cancelSchedule(id)
    deactivateSchedule(id)
  })
  ipcMain.handle('schedules:delete', (_, id: string) => {
    cancelSchedule(id)
    deleteSchedule(id)
  })

  // ─── File Import ───
  ipcMain.handle('file:import-apns', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'APNS File', extensions: ['apns', 'json'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Cancelled' }
    }

    const files: { name: string; payload: string }[] = []
    for (const filePath of result.filePaths) {
      try {
        const raw = await readFile(filePath, 'utf-8')
        const content = raw.replace(/,\s*([\]}])/g, '$1')
        JSON.parse(content) // validate JSON
        const name = basename(filePath, '.apns').replace(/\.json$/, '')
        files.push({ name, payload: content })
      } catch {
        // skip invalid files
      }
    }

    return { success: true, files }
  })

  // ─── File Download ───
  ipcMain.handle(
    'file:save-apns',
    async (_, defaultName: string, content: string) => {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) return { success: false, error: 'No active window' }

      const result = await dialog.showSaveDialog(win, {
        defaultPath: defaultName,
        filters: [{ name: 'APNS File', extensions: ['apns'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Cancelled' }
      }

      try {
        await writeFile(result.filePath, content, 'utf-8')
        return { success: true, filePath: result.filePath }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to save file'
        }
      }
    }
  )
}
