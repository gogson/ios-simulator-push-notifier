import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSchedule: (type: 'once' | 'recurring', delaySeconds?: number, cronExpression?: string) => void
}

export function ScheduleDialog({ open, onOpenChange, onSchedule }: ScheduleDialogProps) {
  const [mode, setMode] = useState<'once' | 'recurring'>('once')
  const [delayValue, setDelayValue] = useState('5')
  const [delayUnit, setDelayUnit] = useState<'seconds' | 'minutes' | 'hours'>('minutes')
  const [cronExpression, setCronExpression] = useState('*/5 * * * *')

  const handleSubmit = () => {
    if (mode === 'once') {
      let seconds = Number(delayValue)
      if (delayUnit === 'minutes') seconds *= 60
      if (delayUnit === 'hours') seconds *= 3600
      if (seconds > 0) {
        onSchedule('once', seconds)
        onOpenChange(false)
      }
    } else {
      if (cronExpression.trim()) {
        onSchedule('recurring', undefined, cronExpression.trim())
        onOpenChange(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Notification</DialogTitle>
          <DialogDescription>
            Send this notification on a delay or recurring schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs">Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as 'once' | 'recurring')}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Send once (delayed)</SelectItem>
                <SelectItem value="recurring">Send recurring (cron)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'once' ? (
            <div className="space-y-2">
              <Label className="text-xs">Send in</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={delayValue}
                  onChange={(e) => setDelayValue(e.target.value)}
                  className="h-8 text-sm flex-1"
                />
                <Select
                  value={delayUnit}
                  onValueChange={(v) =>
                    setDelayUnit(v as 'seconds' | 'minutes' | 'hours')
                  }
                >
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">seconds</SelectItem>
                    <SelectItem value="minutes">minutes</SelectItem>
                    <SelectItem value="hours">hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">Cron Expression</Label>
              <Input
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="*/5 * * * *"
                className="h-8 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Examples: <code>*/5 * * * *</code> (every 5 min), <code>0 * * * *</code> (every
                hour), <code>*/30 * * * * *</code> (every 30 sec)
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
