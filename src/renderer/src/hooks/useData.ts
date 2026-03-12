import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  Folder,
  Notification,
  SimulatorDevice,
  Schedule
} from '../../preload/index.d'

// ─── Folders ───

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const data = await window.api.listFolders()
    setFolders(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(
    async (name: string) => {
      await window.api.createFolder(name)
      await refresh()
    },
    [refresh]
  )

  const rename = useCallback(
    async (id: string, name: string) => {
      await window.api.renameFolder(id, name)
      await refresh()
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      await window.api.deleteFolder(id)
      await refresh()
    },
    [refresh]
  )

  return { folders, loading, refresh, create, rename, remove }
}

// ─── Notifications ───

export function useNotifications(folderId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const data = folderId
      ? await window.api.listNotifications(folderId)
      : await window.api.listNotifications()
    setNotifications(data)
    setLoading(false)
  }, [folderId])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  const create = useCallback(
    async (name: string, bundleId?: string, payload?: string) => {
      if (!folderId) return null
      const n = await window.api.createNotification(folderId, name, bundleId, payload)
      await refresh()
      return n
    },
    [folderId, refresh]
  )

  const update = useCallback(
    async (
      id: string,
      data: { name?: string; bundle_id?: string; payload?: string; folder_id?: string }
    ) => {
      await window.api.updateNotification(id, data)
      await refresh()
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      await window.api.deleteNotification(id)
      await refresh()
    },
    [refresh]
  )

  const duplicate = useCallback(
    async (id: string) => {
      await window.api.duplicateNotification(id)
      await refresh()
    },
    [refresh]
  )

  return { notifications, loading, refresh, create, update, remove, duplicate }
}

// ─── Simulators ───

export function useSimulators() {
  const [devices, setDevices] = useState<SimulatorDevice[]>([])
  const [xcodeInstalled, setXcodeInstalled] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const refresh = useCallback(async () => {
    const installed = await window.api.checkXcode()
    setXcodeInstalled(installed)
    if (installed) {
      const d = await window.api.listDevices()
      setDevices(d)
    }
  }, [])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  return { devices, xcodeInstalled, refresh }
}

// ─── Schedules ───

export function useSchedules(notificationId: string | null) {
  const [schedules, setSchedules] = useState<Schedule[]>([])

  const refresh = useCallback(async () => {
    if (!notificationId) {
      setSchedules([])
      return
    }
    const data = await window.api.listSchedules(notificationId)
    setSchedules(data)
  }, [notificationId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(
    async (
      type: 'once' | 'recurring',
      delaySeconds?: number,
      cronExpression?: string
    ) => {
      if (!notificationId) return
      await window.api.createSchedule(notificationId, type, delaySeconds, cronExpression)
      await refresh()
    },
    [notificationId, refresh]
  )

  const cancel = useCallback(
    async (id: string) => {
      await window.api.cancelSchedule(id)
      await refresh()
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      await window.api.deleteSchedule(id)
      await refresh()
    },
    [refresh]
  )

  return { schedules, refresh, create, cancel, remove }
}

// ─── Installed Apps ───

export function useInstalledApps(udid: string | null) {
  const [apps, setApps] = useState<string[]>([])

  useEffect(() => {
    if (!udid) {
      setApps([])
      return
    }
    window.api.listApps(udid).then(setApps)
  }, [udid])

  return apps
}
