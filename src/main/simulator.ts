import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'

const execFileAsync = promisify(execFile)

export interface SimulatorDevice {
  udid: string
  name: string
  state: string
  runtime: string
}

interface SimctlDeviceEntry {
  udid: string
  name: string
  state: string
  isAvailable: boolean
}

export async function checkXcodeInstalled(): Promise<boolean> {
  try {
    await execFileAsync('xcrun', ['--version'], { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export async function listBootedSimulators(): Promise<SimulatorDevice[]> {
  try {
    const { stdout } = await execFileAsync('xcrun', ['simctl', 'list', '-j', 'devices'], {
      timeout: 10000
    })
    const data = JSON.parse(stdout)
    const devices: SimulatorDevice[] = []

    for (const [runtime, deviceList] of Object.entries(data.devices)) {
      for (const device of deviceList as SimctlDeviceEntry[]) {
        if (device.state === 'Booted' && device.isAvailable) {
          const runtimeName = runtime
            .replace('com.apple.CoreSimulator.SimRuntime.', '')
            .replace('-', ' ')
            .replace(/(\d+)/, ' $1')
            .trim()
          devices.push({
            udid: device.udid,
            name: device.name,
            state: device.state,
            runtime: runtimeName
          })
        }
      }
    }

    return devices
  } catch {
    return []
  }
}

export async function listInstalledApps(udid: string): Promise<string[]> {
  try {
    // Validate UDID format to prevent injection
    if (!/^[0-9A-F-]{36}$/i.test(udid)) {
      return []
    }
    const { stdout } = await execFileAsync(
      'xcrun',
      ['simctl', 'listapps', udid],
      { timeout: 10000 }
    )
    // Parse plist-like output for bundle identifiers
    const bundleIds: string[] = []
    const regex = /CFBundleIdentifier\s*=\s*"([^"]+)"/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(stdout)) !== null) {
      const bid = match[1]
      // Filter out Apple system apps
      if (!bid.startsWith('com.apple.')) {
        bundleIds.push(bid)
      }
    }
    return [...new Set(bundleIds)].sort()
  } catch {
    return []
  }
}

export interface SendPushResult {
  success: boolean
  error?: string
}

export async function sendPush(
  udid: string,
  bundleId: string,
  payloadJson: string
): Promise<SendPushResult> {
  // Validate UDID format
  if (!/^[0-9A-F-]{36}$/i.test(udid)) {
    return { success: false, error: 'Invalid simulator UDID' }
  }

  // Validate bundle ID format
  if (!/^[a-zA-Z0-9.-]+$/.test(bundleId)) {
    return { success: false, error: 'Invalid bundle identifier' }
  }

  // Validate JSON
  try {
    JSON.parse(payloadJson)
  } catch {
    return { success: false, error: 'Invalid JSON payload' }
  }

  const tmpFile = join(app.getPath('temp'), `push-${uuidv4()}.json`)

  try {
    await writeFile(tmpFile, payloadJson, 'utf-8')
    await execFileAsync('xcrun', ['simctl', 'push', udid, bundleId, tmpFile], {
      timeout: 10000
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error sending push notification'
    return { success: false, error: message }
  } finally {
    try {
      await unlink(tmpFile)
    } catch {
      // Ignore cleanup errors
    }
  }
}
