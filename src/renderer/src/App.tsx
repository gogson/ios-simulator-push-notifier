import { useState, useEffect, useCallback, useRef } from 'react'
import { FolderList } from '@renderer/components/FolderList'
import { NotificationList } from '@renderer/components/NotificationList'
import { NotificationForm } from '@renderer/components/NotificationForm'
import { useFolders, useNotifications } from '@renderer/hooks/useData'
import { Bell } from 'lucide-react'

function App(): React.JSX.Element {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [folderWidth, setFolderWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width')
    return saved ? Math.min(Math.max(Number(saved), 140), 400) : 200
  })
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const isResizing = useRef(false)

  const toggleTheme = useCallback(() => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }, [isDark])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    const startX = e.clientX
    const startWidth = folderWidth

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const newWidth = Math.min(Math.max(startWidth + ev.clientX - startX, 140), 400)
      setFolderWidth(newWidth)
    }
    const onMouseUp = () => {
      isResizing.current = false
      const currentWidth = document.querySelector<HTMLElement>('[data-folder-panel]')?.offsetWidth
      if (currentWidth) localStorage.setItem('sidebar-width', String(currentWidth))
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [folderWidth])

  const {
    folders,
    create: createFolder,
    rename: renameFolder,
    remove: deleteFolder,
    refresh: refreshFolders
  } = useFolders()
  const {
    notifications,
    create: createNotification,
    update: updateNotification,
    remove: deleteNotification,
    duplicate: duplicateNotification,
    refresh: refreshNotifications
  } = useNotifications(selectedFolderId)

  const selectedNotification = notifications.find((n) => n.id === selectedNotificationId) ?? null

  // Auto-select first notification when folder changes
  useEffect(() => {
    if (notifications.length > 0 && !notifications.find((n) => n.id === selectedNotificationId)) {
      setSelectedNotificationId(notifications[0].id)
    } else if (notifications.length === 0) {
      setSelectedNotificationId(null)
    }
  }, [notifications, selectedNotificationId])

  // Auto-select first folder if none selected
  useEffect(() => {
    if (folders.length > 0 && selectedFolderId && !folders.find((f) => f.id === selectedFolderId)) {
      setSelectedFolderId(folders[0]?.id ?? null)
    }
    if (folders.length > 0 && !selectedFolderId) {
      setSelectedFolderId(folders[0].id)
    }
  }, [folders, selectedFolderId])

  const handleCreateNotification = useCallback(async () => {
    if (!selectedFolderId) return
    const n = await createNotification('New Notification')
    if (n) setSelectedNotificationId(n.id)
  }, [selectedFolderId, createNotification])

  const handleDeleteNotification = useCallback(
    async (id: string) => {
      await deleteNotification(id)
      if (selectedNotificationId === id) {
        setSelectedNotificationId(null)
      }
    },
    [deleteNotification, selectedNotificationId]
  )

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      await deleteFolder(id)
      if (selectedFolderId === id) {
        setSelectedFolderId(null)
        setSelectedNotificationId(null)
      }
    },
    [deleteFolder, selectedFolderId]
  )

  const handleMoveNotifications = useCallback(
    async (fromFolderId: string, toFolderId: string) => {
      await window.api.moveNotificationsToFolder(fromFolderId, toFolderId)
      await refreshNotifications()
    },
    [refreshNotifications]
  )

  const handleImport = useCallback(async () => {
    if (!selectedFolderId) return
    const result = await window.api.importApnsFile()
    if (result.success && result.files) {
      for (const file of result.files) {
        const parsed = (() => {
          try {
            const p = JSON.parse(file.payload)
            return { bundleId: p['Simulator Target Bundle'] || '', payload: file.payload }
          } catch {
            return { bundleId: '', payload: file.payload }
          }
        })()
        await createNotification(file.name, parsed.bundleId, parsed.payload)
      }
    }
  }, [selectedFolderId, createNotification])

  const handleImportToFolder = useCallback(
    async (folderId: string, files: { name: string; payload: string }[]) => {
      for (const file of files) {
        const parsed = (() => {
          try {
            const p = JSON.parse(file.payload)
            return { bundleId: p['Simulator Target Bundle'] || '', payload: file.payload }
          } catch {
            return { bundleId: '', payload: file.payload }
          }
        })()
        await window.api.createNotification(folderId, file.name, parsed.bundleId, parsed.payload)
      }
      await refreshNotifications()
    },
    [refreshNotifications]
  )

  // Global drag-drop for .apns files
  const handleGlobalDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      setIsDraggingOver(false)
      if (!selectedFolderId) return

      const files = Array.from(e.dataTransfer?.files || []).filter(
        (f) => f.name.endsWith('.apns') || f.name.endsWith('.json')
      )
      if (files.length === 0) return

      const parsed = await Promise.all(
        files.map(async (file) => {
          const raw = await file.text()
          const text = raw.replace(/,\s*([\]}])/g, '$1')
          try {
            JSON.parse(text)
            return { name: file.name.replace(/\.(apns|json)$/, ''), payload: text }
          } catch {
            return null
          }
        })
      )
      const valid = parsed.filter(Boolean) as { name: string; payload: string }[]
      if (valid.length > 0) handleImportToFolder(selectedFolderId, valid)
    },
    [selectedFolderId, handleImportToFolder]
  )

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      setIsDraggingOver(true)
    }
    const handleDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setIsDraggingOver(false)
    }
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleGlobalDrop)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleGlobalDrop)
    }
  }, [handleGlobalDrop])

  // Menu events from main process
  useEffect(() => {
    const cleanups = [
      window.api.onMenuEvent('menu:new-notification', handleCreateNotification),
      window.api.onMenuEvent('menu:new-folder', () => createFolder('New Folder')),
      window.api.onMenuEvent('menu:delete', () => {
        if (selectedNotificationId) handleDeleteNotification(selectedNotificationId)
      }),
      window.api.onMenuEvent('menu:run', () => {
        // Trigger run via custom event — the form will handle it
        window.dispatchEvent(new Event('trigger-run'))
      })
    ]
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [handleCreateNotification, createFolder, handleDeleteNotification, selectedNotificationId])

  return (
    <div className="flex h-screen relative">
      {/* Draggable titlebar region */}
      <div className="absolute top-0 left-0 right-0 h-[38px] drag-region z-10" />

      {/* Drop overlay */}
      {isDraggingOver && selectedFolderId && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 border-2 border-dashed border-primary rounded-lg pointer-events-none">
          <p className="text-lg font-medium text-primary">Drop .apns files to import</p>
        </div>
      )}

      {/* Folder panel */}
      <div data-folder-panel className="shrink-0 border-r bg-sidebar-background relative" style={{ width: folderWidth, paddingTop: 38 }}>
        <FolderList
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onCreate={createFolder}
          onRename={renameFolder}
          onDelete={handleDeleteFolder}
          onMoveNotifications={handleMoveNotifications}
          onImportToFolder={handleImportToFolder}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-border active:bg-primary z-20"
        />
      </div>

      {/* Notification list panel */}
      <div className="w-[260px] shrink-0" style={{ paddingTop: 38 }}>
        <NotificationList
          notifications={notifications}
          selectedId={selectedNotificationId}
          folderId={selectedFolderId}
          onSelect={setSelectedNotificationId}
          onCreate={handleCreateNotification}
          onDelete={handleDeleteNotification}
          onDuplicate={duplicateNotification}
          onImport={handleImport}
        />
      </div>

      {/* Editor panel */}
      <div className="flex-1 min-w-0" style={{ paddingTop: 38 }}>
        {selectedNotification ? (
          <NotificationForm
            key={selectedNotification.id}
            notification={selectedNotification}
            onUpdate={updateNotification}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Bell className="h-12 w-12 opacity-20" />
            <p className="text-sm">
              {notifications.length === 0
                ? selectedFolderId
                  ? 'Create a notification to get started'
                  : 'Select or create a folder'
                : 'Select a notification'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
