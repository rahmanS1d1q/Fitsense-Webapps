import { BleManager, Device, State } from "react-native-ble-plx";

/** Supported Coospo HR sensor name prefixes */
const COOSPO_PREFIXES = ["Coospo", "COOSPO", "H6", "HW706"];

/** HR Measurement characteristic UUID (standard BLE Heart Rate Service) */
const HR_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
const HR_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb";

/** Max reconnect delay: 30 seconds */
const MAX_RECONNECT_DELAY_MS = 30_000;

type HRCallback = (hr: number, rr?: number) => void;

/**
 * Manages BLE scanning and connection to registered Coospo HR sensors.
 * Auto-connects when sensor detected, auto-reconnects with exponential backoff (max 30s).
 * Requirements: 5.1, 5.4
 */
export class BLEManager {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private scanning = false;
  private destroyed = false;
  private onHRData: HRCallback;
  /** MAC addresses of registered sensors for this member */
  private registeredMacs: Set<string>;

  constructor(registeredMacs: string[], onHRData: HRCallback) {
    this.manager = new BleManager();
    this.registeredMacs = new Set(registeredMacs.map((m) => m.toUpperCase()));
    this.onHRData = onHRData;
  }

  /** Start scanning for registered Coospo sensors */
  startScan(): void {
    if (this.scanning || this.destroyed) return;

    this.manager.onStateChange((state) => {
      if (state === State.PoweredOn) {
        this.scan();
      }
    }, true);
  }

  private scan(): void {
    if (this.scanning || this.destroyed) return;
    this.scanning = true;

    this.manager.startDeviceScan(
      [HR_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error || !device) return;

        const isCoospo = COOSPO_PREFIXES.some(
          (p) => device.name?.startsWith(p) || device.localName?.startsWith(p),
        );
        const isRegistered =
          this.registeredMacs.size === 0 ||
          (device.id && this.registeredMacs.has(device.id.toUpperCase()));

        if (isCoospo && isRegistered) {
          this.manager.stopDeviceScan();
          this.scanning = false;
          this.connectDevice(device.id);
        }
      },
    );
  }

  private async connectDevice(deviceId: string): Promise<void> {
    if (this.destroyed) return;

    try {
      const device = await this.manager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();

      this.connectedDevice = device;
      this.reconnectAttempt = 0;

      // Monitor HR characteristic
      device.monitorCharacteristicForService(
        HR_SERVICE_UUID,
        HR_MEASUREMENT_UUID,
        (error, characteristic) => {
          if (error || !characteristic?.value) return;
          const { hr, rr } = parseHRMeasurement(characteristic.value);
          this.onHRData(hr, rr);
        },
      );

      // Handle disconnection
      device.onDisconnected(() => {
        this.connectedDevice = null;
        if (!this.destroyed) {
          this.scheduleReconnect(deviceId);
        }
      });
    } catch {
      this.scheduleReconnect(deviceId);
    }
  }

  private scheduleReconnect(deviceId: string): void {
    if (this.destroyed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    // Exponential backoff: 1s, 2s, 4s, ... max 30s
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempt += 1;

    this.reconnectTimer = setTimeout(() => {
      this.connectDevice(deviceId);
    }, delay);
  }

  /** Stop scanning and disconnect */
  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.manager.stopDeviceScan();
    this.connectedDevice?.cancelConnection().catch(() => {});
    this.manager.destroy();
  }

  get isConnected(): boolean {
    return this.connectedDevice !== null;
  }
}

/**
 * Parse BLE HR Measurement characteristic value (base64 encoded).
 * Byte 0: flags, Byte 1 (or 1-2): HR value, optional RR intervals follow.
 */
function parseHRMeasurement(base64Value: string): { hr: number; rr?: number } {
  const bytes = Buffer.from(base64Value, "base64");
  const flags = bytes[0];
  const hrFormat16bit = (flags & 0x01) !== 0;

  let hr: number;
  let offset: number;

  if (hrFormat16bit) {
    hr = bytes.readUInt16LE(1);
    offset = 3;
  } else {
    hr = bytes[1];
    offset = 2;
  }

  // RR interval (optional, 16-bit, 1/1024 second units)
  let rr: number | undefined;
  if (offset < bytes.length) {
    const rrRaw = bytes.readUInt16LE(offset);
    rr = (rrRaw / 1024) * 1000; // Convert to ms
  }

  return { hr, rr };
}
