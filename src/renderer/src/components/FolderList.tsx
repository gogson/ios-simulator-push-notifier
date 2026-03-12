import { useState, useRef, useEffect, useCallback } from 'react'
import { Folder, FolderPlus, MoreHorizontal, Pencil, Trash2, Bell, ArrowRightLeft, Sun, Moon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Input } from '@renderer/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
} from '@renderer/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from '@renderer/components/ui/dropdown-menu'
import { cn } from '@renderer/lib/utils'
import type { Folder as FolderType } from '../../../preload/index.d'

interface FolderListProps {
  folders: FolderType[]
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onMoveNotifications: (fromFolderId: string, toFolderId: string) => void
  onImportToFolder: (folderId: string, files: { name: string; payload: string }[]) => void
  isDark: boolean
  onToggleTheme: () => void
}

export function FolderList({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreate,
  onRename,
  onDelete,
  onMoveNotifications,
  onImportToFolder,
  isDark,
  onToggleTheme
}: FolderListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const newInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus()
  }, [editingId])

  useEffect(() => {
    if (isCreating && newInputRef.current) newInputRef.current.focus()
  }, [isCreating])

  const handleStartRename = (folder: FolderType) => {
    setEditingId(folder.id)
    setEditValue(folder.name)
  }

  const handleFinishRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim())
    }
    setEditingId(null)
    setEditValue('')
  }

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreate(newFolderName.trim())
      setNewFolderName('')
      setIsCreating(false)
    }
  }

  const handleDrop = useCallback(
    (folderId: string, e: React.DragEvent) => {
      e.preventDefault()
      setDragOverFolderId(null)
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.endsWith('.apns') || f.name.endsWith('.json')
      )
      if (droppedFiles.length === 0) return

      Promise.all(
        droppedFiles.map(async (file) => {
          const raw = await file.text()
          const text = raw.replace(/,\s*([\]}])/g, '$1')
          try {
            JSON.parse(text)
            const name = file.name.replace(/\.(apns|json)$/, '')
            return { name, payload: text }
          } catch {
            return null
          }
        })
      ).then((results) => {
        const valid = results.filter(Boolean) as { name: string; payload: string }[]
        if (valid.length > 0) onImportToFolder(folderId, valid)
      })
    },
    [onImportToFolder]
  )

  const handleDragOver = useCallback((folderId: string, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverFolderId(folderId)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverFolderId(null)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b drag-region">
        <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          Folders
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 no-drag"
          onClick={() => setIsCreating(true)}
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {/* All Notifications */}
          <button
            onClick={() => onSelectFolder(null)}
            className={cn(
              'flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-sm text-left transition-colors',
              selectedFolderId === null
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50 text-foreground'
            )}
          >
            <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">All Notifications</span>
          </button>

          {/* Folder list */}
          {folders.map((folder) => (
            <ContextMenu key={folder.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => onSelectFolder(folder.id)}
                  onDoubleClick={() => handleStartRename(folder)}
                  onDragOver={(e) => handleDragOver(folder.id, e)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(folder.id, e)}
                  className={cn(
                    'flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-sm text-left transition-colors group',
                    selectedFolderId === folder.id
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50 text-foreground',
                    dragOverFolderId === folder.id && 'ring-2 ring-primary bg-accent/50'
                  )}
                >
                  <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {editingId === folder.id ? (
                    <Input
                      ref={inputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFinishRename()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="h-6 py-0 px-1 text-sm"
                    />
                  ) : (
                    <>
                      <span className="truncate flex-1">{folder.name}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 shrink-0 no-drag">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStartRename(folder)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          {folders.length > 1 && (
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                Move All Notifications to...
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {folders
                                  .filter((f) => f.id !== folder.id)
                                  .map((target) => (
                                    <DropdownMenuItem
                                      key={target.id}
                                      onClick={() => onMoveNotifications(folder.id, target.id)}
                                    >
                                      <Folder className="mr-2 h-4 w-4" />
                                      {target.name}
                                    </DropdownMenuItem>
                                  ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => onDelete(folder.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleStartRename(folder)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </ContextMenuItem>
                {folders.length > 1 && (
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Move All Notifications to...
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                      {folders
                        .filter((f) => f.id !== folder.id)
                        .map((target) => (
                          <ContextMenuItem
                            key={target.id}
                            onClick={() => onMoveNotifications(folder.id, target.id)}
                          >
                            <Folder className="mr-2 h-4 w-4" />
                            {target.name}
                          </ContextMenuItem>
                        ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(folder.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          {/* New folder inline input */}
          {isCreating && (
            <div className="flex items-center gap-2 px-3 py-1">
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                ref={newInputRef}
                value={newFolderName}
                placeholder="Folder name"
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={() => {
                  if (newFolderName.trim()) handleCreateFolder()
                  else setIsCreating(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') setIsCreating(false)
                }}
                className="h-6 py-0 px-1 text-sm"
              />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Theme toggle */}
      <div className="border-t px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs text-muted-foreground no-drag"
          onClick={onToggleTheme}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {isDark ? 'Light mode' : 'Dark mode'}
        </Button>
      </div>
    </div>
  )
}
