export interface APNSAlert {
  title: string
  subtitle?: string
  body: string
  'launch-image'?: string
}

export interface APNSPayload {
  aps: {
    alert: APNSAlert
    badge?: number
    sound?: string
    category?: string
    'thread-id'?: string
    'content-available'?: number
    'mutable-content'?: number
  }
  [key: string]: unknown
}

export function buildAPNSPayload(
  bundleId: string,
  alert: APNSAlert,
  options: {
    badge?: number
    sound?: string
    category?: string
    threadId?: string
    contentAvailable?: boolean
    mutableContent?: boolean
  },
  customData: Record<string, string>
): string {
  const payload: Record<string, unknown> = {
    'Simulator Target Bundle': bundleId,
    aps: {
      alert: {
        title: alert.title,
        ...(alert.subtitle ? { subtitle: alert.subtitle } : {}),
        body: alert.body
      },
      ...(options.badge !== undefined ? { badge: options.badge } : {}),
      ...(options.sound ? { sound: options.sound } : {}),
      ...(options.category ? { category: options.category } : {}),
      ...(options.threadId ? { 'thread-id': options.threadId } : {}),
      ...(options.contentAvailable ? { 'content-available': 1 } : {}),
      ...(options.mutableContent ? { 'mutable-content': 1 } : {})
    }
  }

  // Add custom data fields (support nested keys like "data.deeplink")
  for (const [key, value] of Object.entries(customData)) {
    if (!key) continue
    const parts = key.split('.')
    if (parts.length === 1) {
      payload[key] = value
    } else {
      let current = payload
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
          current[parts[i]] = {}
        }
        current = current[parts[i]] as Record<string, unknown>
      }
      current[parts[parts.length - 1]] = value
    }
  }

  return JSON.stringify(payload, null, 2)
}

export interface NotificationFormData {
  name: string
  bundleId: string
  alert: APNSAlert
  badge?: number
  sound: string
  category: string
  threadId: string
  contentAvailable: boolean
  mutableContent: boolean
  customData: { key: string; value: string }[]
}

export function formDataFromPayload(
  name: string,
  bundleId: string,
  payloadStr: string
): NotificationFormData {
  try {
    const payload = JSON.parse(payloadStr)
    const aps = payload.aps || {}
    const alert = typeof aps.alert === 'string' ? { title: '', body: aps.alert } : aps.alert || {}

    // Collect custom data (anything not "aps" or "Simulator Target Bundle")
    const customData: { key: string; value: string }[] = []
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'aps' || key === 'Simulator Target Bundle') continue
      if (typeof value === 'object' && value !== null) {
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          customData.push({ key: `${key}.${subKey}`, value: String(subValue) })
        }
      } else {
        customData.push({ key, value: String(value) })
      }
    }

    return {
      name,
      bundleId: bundleId || payload['Simulator Target Bundle'] || '',
      alert: {
        title: alert.title || '',
        subtitle: alert.subtitle || '',
        body: alert.body || ''
      },
      badge: aps.badge,
      sound: aps.sound || 'default',
      category: aps.category || '',
      threadId: aps['thread-id'] || '',
      contentAvailable: aps['content-available'] === 1,
      mutableContent: aps['mutable-content'] === 1,
      customData: customData.length > 0 ? customData : [{ key: '', value: '' }]
    }
  } catch {
    return {
      name,
      bundleId,
      alert: { title: '', body: '' },
      sound: 'default',
      category: '',
      threadId: '',
      contentAvailable: false,
      mutableContent: false,
      customData: [{ key: '', value: '' }]
    }
  }
}
