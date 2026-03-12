import { Plus, Search, Copy, Trash2, FileDown, FilePlus } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@renderer/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@renderer/components/ui/dropdown-menu'
import { cn } from '@renderer/lib/utils'
import { useState } from 'react'
import type { Notification } from '../../../preload/index.d'

interface NotificationListProps {
  notifications: Notification[]
  selectedId: string | null
  folderId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onImport: () => void
}

export function NotificationList({
  notifications,
  selectedId,
  folderId,
  onSelect,
  onCreate,
  onDelete,
  onDuplicate,
  onImport
}: NotificationListProps) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? notifications.filter(
        (n) =>
          n.name.toLowerCase().includes(search.toLowerCase()) ||
          n.bundle_id.toLowerCase().includes(search.toLowerCase())
      )
    : notifications

  return (
    <div className="flex flex-col h-full border-r">
      <div className="flex items-center gap-2 px-3 py-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-7 pl-7 text-xs"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              disabled={!folderId}
              title={!folderId ? 'Select a folder first' : 'Add notification'}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCreate}>
              <FilePlus className="mr-2 h-4 w-4" />
              Create
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onImport}>
              <FileDown className="mr-2 h-4 w-4" />
              Import .apns
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-xs">
              {notifications.length === 0 ? (
                <>
                  <p>No notifications yet</p>
                  {folderId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={onCreate}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Create one
                    </Button>
                  )}
                </>
              ) : (
                <p>No match found</p>
              )}
            </div>
          )}

          {filtered.map((notification) => (
            <ContextMenu key={notification.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => onSelect(notification.id)}
                  className={cn(
                    'flex flex-col gap-0.5 w-full rounded-md px-3 py-2 text-left transition-colors',
                    selectedId === notification.id
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  )}
                >
                  <span className="text-sm font-medium truncate">{notification.name}</span>
                  {notification.bundle_id && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      {notification.bundle_id}
                    </span>
                  )}
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => onDuplicate(notification.id)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(notification.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
