import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Play,
  Clock,
  Download,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { Separator } from '@renderer/components/ui/separator'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { ScheduleDialog } from './ScheduleDialog'
import { buildAPNSPayload, formDataFromPayload, type NotificationFormData } from '@renderer/lib/apns'
import { useSimulators, useInstalledApps, useSchedules } from '@renderer/hooks/useData'
import type { Notification } from '../../../preload/index.d'

interface NotificationFormProps {
  notification: Notification
  onUpdate: (
    id: string,
    data: { name?: string; bundle_id?: string; payload?: string }
  ) => void
}

export function NotificationForm({ notification, onUpdate }: NotificationFormProps) {
  const { devices, xcodeInstalled } = useSimulators()
  const [selectedUdid, setSelectedUdid] = useState<string>('')
  const installedApps = useInstalledApps(selectedUdid || null)
  const { schedules, create: createSchedule, cancel: cancelSchedule, remove: removeSchedule } = useSchedules(notification.id)

  const [form, setForm] = useState<NotificationFormData>(() =>
    formDataFromPayload(notification.name, notification.bundle_id, notification.payload)
  )
  const [showJson, setShowJson] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Reset form when notification changes
  useEffect(() => {
    setForm(formDataFromPayload(notification.name, notification.bundle_id, notification.payload))
    setSendStatus(null)
  }, [notification.id])

  // Auto-select first booted simulator
  useEffect(() => {
    if (devices.length > 0 && !selectedUdid) {
      setSelectedUdid(devices[0].udid)
    }
  }, [devices, selectedUdid])

  const generatedPayload = useMemo(() => {
    return buildAPNSPayload(
      form.bundleId,
      form.alert,
      {
        badge: form.badge,
        sound: form.sound || undefined,
        category: form.category || undefined,
        threadId: form.threadId || undefined,
        contentAvailable: form.contentAvailable,
        mutableContent: form.mutableContent
      },
      Object.fromEntries(form.customData.filter((d) => d.key).map((d) => [d.key, d.value]))
    )
  }, [form])

  // Debounced save
  useEffect(() => {
    const timeout = setTimeout(() => {
      onUpdate(notification.id, {
        name: form.name,
        bundle_id: form.bundleId,
        payload: generatedPayload
      })
    }, 500)
    return () => clearTimeout(timeout)
  }, [form.name, form.bundleId, generatedPayload])

  const updateField = useCallback(<K extends keyof NotificationFormData>(
    key: K,
    value: NotificationFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateAlert = useCallback((key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      alert: { ...prev.alert, [key]: value }
    }))
  }, [])

  const handleSend = useCallback(async () => {
    setSendStatus(null)

    if (!xcodeInstalled) {
      setSendStatus({ type: 'error', message: 'Xcode CLI tools not installed. Run: xcode-select --install' })
      return
    }

    if (devices.length === 0) {
      setSendStatus({ type: 'error', message: 'No iOS Simulator is running. Open Simulator.app first.' })
      return
    }

    if (!form.bundleId) {
      setSendStatus({ type: 'error', message: 'Bundle ID is required.' })
      return
    }

    const udid = selectedUdid || devices[0].udid
    const result = await window.api.sendPush(udid, form.bundleId, generatedPayload)

    if (result.success) {
      const device = devices.find((d) => d.udid === udid)
      setSendStatus({
        type: 'success',
        message: `Sent to ${device?.name || 'simulator'}`
      })
      setTimeout(() => setSendStatus(null), 3000)
    } else {
      setSendStatus({ type: 'error', message: result.error || 'Failed to send' })
    }
  }, [xcodeInstalled, devices, form.bundleId, selectedUdid, generatedPayload])

  // Cmd+Enter shortcut & menu trigger-run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'Enter') {
        e.preventDefault()
        handleSend()
      }
    }
    const handleTriggerRun = () => handleSend()
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('trigger-run', handleTriggerRun)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('trigger-run', handleTriggerRun)
    }
  }, [handleSend])

  const handleDownload = async () => {
    const sanitizedName = form.name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'notification'
    await window.api.saveApnsFile(`${sanitizedName}.apns`, generatedPayload)
  }

  const addCustomField = () => {
    setForm((prev) => ({
      ...prev,
      customData: [...prev.customData, { key: '', value: '' }]
    }))
  }

  const removeCustomField = (index: number) => {
    setForm((prev) => ({
      ...prev,
      customData: prev.customData.filter((_, i) => i !== index)
    }))
  }

  const updateCustomField = (index: number, key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      customData: prev.customData.map((d, i) => (i === index ? { key, value } : d))
    }))
  }

  const activeSchedules = schedules.filter((s) => s.active)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Input
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
          placeholder="Notification name"
        />
        <div className="flex items-center gap-1 shrink-0">
          <Button onClick={handleSend} size="sm" className="gap-1.5">
            <Play className="h-3.5 w-3.5" />
            Run
            <kbd className="ml-1 text-[10px] opacity-60 font-normal">⌘↵</kbd>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setScheduleOpen(true)}
          >
            <Clock className="h-3.5 w-3.5" />
            Schedule
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" />
            .apns
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {sendStatus && (
        <div
          className={`px-4 py-2 text-sm ${
            sendStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
          }`}
        >
          {sendStatus.message}
        </div>
      )}

      {/* Active schedules banner */}
      {activeSchedules.length > 0 && (
        <div className="px-4 py-2 text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          {activeSchedules.length} active schedule{activeSchedules.length > 1 ? 's' : ''}
          <div className="flex gap-1 ml-auto">
            {activeSchedules.map((s) => (
              <Button
                key={s.id}
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-2"
                onClick={() => cancelSchedule(s.id)}
              >
                Cancel {s.type === 'recurring' ? s.cron_expression : `${s.delay_seconds}s`}
              </Button>
            ))}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6 max-w-2xl">
          {/* Target section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Target
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Simulator</Label>
                {!xcodeInstalled ? (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Xcode CLI tools not installed
                  </div>
                ) : devices.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    No simulator running
                  </div>
                ) : (
                  <Select value={selectedUdid} onValueChange={setSelectedUdid}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select simulator" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((d) => (
                        <SelectItem key={d.udid} value={d.udid}>
                          {d.name} — {d.runtime}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bundle Identifier</Label>
                <div className="relative">
                  <Input
                    value={form.bundleId}
                    onChange={(e) => updateField('bundleId', e.target.value)}
                    placeholder="com.example.app"
                    list="bundle-ids"
                    className="h-8 text-xs"
                  />
                  {installedApps.length > 0 && (
                    <datalist id="bundle-ids">
                      {installedApps.map((id) => (
                        <option key={id} value={id} />
                      ))}
                    </datalist>
                  )}
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Alert section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Alert
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input
                  value={form.alert.title}
                  onChange={(e) => updateAlert('title', e.target.value)}
                  placeholder="Notification title"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subtitle</Label>
                <Input
                  value={form.alert.subtitle || ''}
                  onChange={(e) => updateAlert('subtitle', e.target.value)}
                  placeholder="Optional subtitle"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Body</Label>
                <Textarea
                  value={form.alert.body}
                  onChange={(e) => updateAlert('body', e.target.value)}
                  placeholder="Notification body text"
                  className="text-sm min-h-[60px]"
                  rows={2}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Options section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Options
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Badge</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.badge ?? ''}
                  onChange={(e) =>
                    updateField('badge', e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="Badge count"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sound</Label>
                <Input
                  value={form.sound}
                  onChange={(e) => updateField('sound', e.target.value)}
                  placeholder="default"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  placeholder="Action category"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Thread ID</Label>
                <Input
                  value={form.threadId}
                  onChange={(e) => updateField('threadId', e.target.value)}
                  placeholder="Thread identifier"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-6 pt-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.contentAvailable}
                  onCheckedChange={(checked) => updateField('contentAvailable', checked)}
                />
                <Label className="text-xs">Content Available</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.mutableContent}
                  onCheckedChange={(checked) => updateField('mutableContent', checked)}
                />
                <Label className="text-xs">Mutable Content</Label>
              </div>
            </div>
          </section>

          <Separator />

          {/* Custom Data section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Custom Data
              </h3>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addCustomField}>
                <Plus className="mr-1 h-3 w-3" />
                Add Field
              </Button>
            </div>
            <div className="space-y-2">
              {form.customData.map((field, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    value={field.key}
                    onChange={(e) => updateCustomField(index, e.target.value, field.value)}
                    placeholder="Key (e.g. data.deeplink)"
                    className="h-7 text-xs flex-1"
                  />
                  <Input
                    value={field.value}
                    onChange={(e) => updateCustomField(index, field.key, e.target.value)}
                    placeholder="Value"
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removeCustomField(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* JSON Preview */}
          <section className="space-y-2">
            <button
              onClick={() => setShowJson(!showJson)}
              className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              {showJson ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              JSON Preview
            </button>
            {showJson && (
              <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-auto max-h-80">
                {generatedPayload}
              </pre>
            )}
          </section>
        </div>
      </ScrollArea>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSchedule={createSchedule}
      />
    </div>
  )
}
