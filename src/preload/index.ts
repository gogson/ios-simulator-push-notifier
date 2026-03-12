import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Folders
  listFolders: () => ipcRenderer.invoke('folders:list'),
  createFolder: (name: string) => ipcRenderer.invoke('folders:create', name),
  renameFolder: (id: string, name: string) => ipcRenderer.invoke('folders:rename', id, name),
  deleteFolder: (id: string) => ipcRenderer.invoke('folders:delete', id),
  reorderFolders: (ids: string[]) => ipcRenderer.invoke('folders:reorder', ids),
  moveNotificationsToFolder: (fromFolderId: string, toFolderId: string) =>
    ipcRenderer.invoke('folders:move-notifications', fromFolderId, toFolderId),

  // Notifications
  listNotifications: (folderId?: string) => ipcRenderer.invoke('notifications:list', folderId),
  getNotification: (id: string) => ipcRenderer.invoke('notifications:get', id),
  createNotification: (folderId: string, name: string, bundleId?: string, payload?: string) =>
    ipcRenderer.invoke('notifications:create', folderId, name, bundleId, payload),
  updateNotification: (
    id: string,
    data: { name?: string; bundle_id?: string; payload?: string; folder_id?: string }
  ) => ipcRenderer.invoke('notifications:update', id, data),
  deleteNotification: (id: string) => ipcRenderer.invoke('notifications:delete', id),
  duplicateNotification: (id: string) => ipcRenderer.invoke('notifications:duplicate', id),

  // Simulator
  checkXcode: () => ipcRenderer.invoke('simulator:check-xcode'),
  listDevices: () => ipcRenderer.invoke('simulator:list-devices'),
  listApps: (udid: string) => ipcRenderer.invoke('simulator:list-apps', udid),
  sendPush: (udid: string, bundleId: string, payload: string) =>
    ipcRenderer.invoke('simulator:send-push', udid, bundleId, payload),

  // Schedules
  listSchedules: (notificationId?: string) =>
    ipcRenderer.invoke('schedules:list', notificationId),
  createSchedule: (
    notificationId: string,
    type: 'once' | 'recurring',
    delaySeconds?: number,
    cronExpression?: string
  ) => ipcRenderer.invoke('schedules:create', notificationId, type, delaySeconds, cronExpression),
  cancelSchedule: (id: string) => ipcRenderer.invoke('schedules:cancel', id),
  deleteSchedule: (id: string) => ipcRenderer.invoke('schedules:delete', id),

  // File
  saveApnsFile: (defaultName: string, content: string) =>
    ipcRenderer.invoke('file:save-apns', defaultName, content),
  importApnsFile: () => ipcRenderer.invoke('file:import-apns'),

  // Menu events
  onMenuEvent: (channel: string, callback: () => void) => {
    ipcRenderer.on(channel, callback)
    return () => ipcRenderer.removeListener(channel, callback)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
