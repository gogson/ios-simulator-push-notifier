import { ElectronAPI } from '@electron-toolkit/preload'

export interface Folder {
  id: string
  name: string
  position: number
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  folder_id: string
  name: string
  bundle_id: string
  payload: string
  position: number
  created_at: string
  updated_at: string
}

export interface Schedule {
  id: string
  notification_id: string
  type: 'once' | 'recurring'
  delay_seconds: number | null
  cron_expression: string | null
  next_run_at: number | null
  active: number
  created_at: string
}

export interface SimulatorDevice {
  udid: string
  name: string
  state: string
  runtime: string
}

export interface SendPushResult {
  success: boolean
  error?: string
}

export interface SaveFileResult {
  success: boolean
  filePath?: string
  error?: string
}

export interface ImportApnsResult {
  success: boolean
  files?: { name: string; payload: string }[]
  error?: string
}

export interface AppAPI {
  listFolders: () => Promise<Folder[]>
  createFolder: (name: string) => Promise<Folder>
  renameFolder: (id: string, name: string) => Promise<Folder>
  deleteFolder: (id: string) => Promise<void>
  reorderFolders: (ids: string[]) => Promise<void>
  moveNotificationsToFolder: (fromFolderId: string, toFolderId: string) => Promise<void>

  listNotifications: (folderId?: string) => Promise<Notification[]>
  getNotification: (id: string) => Promise<Notification | undefined>
  createNotification: (
    folderId: string,
    name: string,
    bundleId?: string,
    payload?: string
  ) => Promise<Notification>
  updateNotification: (
    id: string,
    data: { name?: string; bundle_id?: string; payload?: string; folder_id?: string }
  ) => Promise<Notification>
  deleteNotification: (id: string) => Promise<void>
  duplicateNotification: (id: string) => Promise<Notification | undefined>

  checkXcode: () => Promise<boolean>
  listDevices: () => Promise<SimulatorDevice[]>
  listApps: (udid: string) => Promise<string[]>
  sendPush: (udid: string, bundleId: string, payload: string) => Promise<SendPushResult>

  listSchedules: (notificationId?: string) => Promise<Schedule[]>
  createSchedule: (
    notificationId: string,
    type: 'once' | 'recurring',
    delaySeconds?: number,
    cronExpression?: string
  ) => Promise<Schedule>
  cancelSchedule: (id: string) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>

  saveApnsFile: (defaultName: string, content: string) => Promise<SaveFileResult>
  importApnsFile: () => Promise<ImportApnsResult>

  onMenuEvent: (channel: string, callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
