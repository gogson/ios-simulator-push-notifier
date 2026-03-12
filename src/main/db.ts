import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

let db: Database.Database

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
  payload: string // JSON string
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

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'data.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      bundle_id TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL DEFAULT '{}',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('once', 'recurring')),
      delay_seconds INTEGER,
      cron_expression TEXT,
      next_run_at INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Ensure a "Default" folder always exists
  const hasDefault = db.prepare("SELECT id FROM folders WHERE name = 'Default' LIMIT 1").get()
  if (!hasDefault) {
    const id = uuidv4()
    db.prepare('INSERT INTO folders (id, name, position) VALUES (?, ?, 0)').run(id, 'Default')
  }
}

// ─── Folders ───

export function getFolders(): Folder[] {
  return db.prepare('SELECT * FROM folders ORDER BY position ASC, created_at ASC').all() as Folder[]
}

export function createFolder(name: string): Folder {
  const id = uuidv4()
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) as max FROM folders').get() as {
    max: number
  }
  db.prepare('INSERT INTO folders (id, name, position) VALUES (?, ?, ?)').run(
    id,
    name,
    maxPos.max + 1
  )
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Folder
}

export function renameFolder(id: string, name: string): Folder {
  db.prepare("UPDATE folders SET name = ?, updated_at = datetime('now') WHERE id = ?").run(
    name,
    id
  )
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Folder
}

export function deleteFolder(id: string): void {
  db.prepare('DELETE FROM folders WHERE id = ?').run(id)
}

export function reorderFolders(ids: string[]): void {
  const stmt = db.prepare('UPDATE folders SET position = ? WHERE id = ?')
  const transaction = db.transaction(() => {
    ids.forEach((id, index) => stmt.run(index, id))
  })
  transaction()
}

// ─── Notifications ───

export function getNotifications(folderId?: string): Notification[] {
  if (folderId) {
    return db
      .prepare(
        'SELECT * FROM notifications WHERE folder_id = ? ORDER BY position ASC, created_at ASC'
      )
      .all(folderId) as Notification[]
  }
  return db
    .prepare('SELECT * FROM notifications ORDER BY position ASC, created_at ASC')
    .all() as Notification[]
}

export function getNotification(id: string): Notification | undefined {
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as
    | Notification
    | undefined
}

export function createNotification(
  folderId: string,
  name: string,
  bundleId: string = '',
  payload: string = '{}'
): Notification {
  const id = uuidv4()
  const maxPos = db
    .prepare(
      'SELECT COALESCE(MAX(position), -1) as max FROM notifications WHERE folder_id = ?'
    )
    .get(folderId) as { max: number }

  db.prepare(
    'INSERT INTO notifications (id, folder_id, name, bundle_id, payload, position) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, folderId, name, bundleId, payload, maxPos.max + 1)

  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Notification
}

export function updateNotification(
  id: string,
  data: { name?: string; bundle_id?: string; payload?: string; folder_id?: string }
): Notification {
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.bundle_id !== undefined) {
    fields.push('bundle_id = ?')
    values.push(data.bundle_id)
  }
  if (data.payload !== undefined) {
    fields.push('payload = ?')
    values.push(data.payload)
  }
  if (data.folder_id !== undefined) {
    fields.push('folder_id = ?')
    values.push(data.folder_id)
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')")
    values.push(id)
    db.prepare(`UPDATE notifications SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Notification
}

export function deleteNotification(id: string): void {
  db.prepare('DELETE FROM notifications WHERE id = ?').run(id)
}

export function duplicateNotification(id: string): Notification | undefined {
  const original = getNotification(id)
  if (!original) return undefined
  return createNotification(
    original.folder_id,
    `${original.name} (copy)`,
    original.bundle_id,
    original.payload
  )
}

// ─── Schedules ───

export function getSchedules(notificationId?: string): Schedule[] {
  if (notificationId) {
    return db
      .prepare('SELECT * FROM schedules WHERE notification_id = ? ORDER BY created_at ASC')
      .all(notificationId) as Schedule[]
  }
  return db.prepare('SELECT * FROM schedules ORDER BY created_at ASC').all() as Schedule[]
}

export function getActiveSchedules(): Schedule[] {
  return db.prepare('SELECT * FROM schedules WHERE active = 1').all() as Schedule[]
}

export function createSchedule(
  notificationId: string,
  type: 'once' | 'recurring',
  delaySeconds?: number,
  cronExpression?: string
): Schedule {
  const id = uuidv4()
  const nextRunAt = type === 'once' && delaySeconds ? Date.now() + delaySeconds * 1000 : null

  db.prepare(
    'INSERT INTO schedules (id, notification_id, type, delay_seconds, cron_expression, next_run_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, notificationId, type, delaySeconds ?? null, cronExpression ?? null, nextRunAt)

  return db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as Schedule
}

export function deactivateSchedule(id: string): void {
  db.prepare('UPDATE schedules SET active = 0 WHERE id = ?').run(id)
}

export function deleteSchedule(id: string): void {
  db.prepare('DELETE FROM schedules WHERE id = ?').run(id)
}

export function moveNotificationsToFolder(fromFolderId: string, toFolderId: string): void {
  db.prepare('UPDATE notifications SET folder_id = ? WHERE folder_id = ?').run(toFolderId, fromFolderId)
}

export function closeDatabase(): void {
  if (db) db.close()
}
