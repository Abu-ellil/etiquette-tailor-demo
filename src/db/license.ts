import db from './connection';
import crypto from 'crypto';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// License key format: ETIK-XXXX-XXXX-XXXX-XXXX (16 chars hex)
const LICENSE_PREFIX = 'ETIK';
const LICENSE_VERSION = '2'; // Updated for Hardware ID

export interface License {
  id: number;
  license_key: string;
  client_name: string;
  client_email: string;
  license_type: 'trial' | 'full' | 'demo';
  expiry_date: string | null;
  max_branches: number;
  hardware_id: string | null;
  is_active: number;
  activated_at: string;
  created_at: string;
}

export interface LicenseStatus {
  status: 'none' | 'trial' | 'full' | 'demo' | 'expired' | 'hw_mismatch';
  key: string;
  clientName?: string;
  clientEmail?: string;
  expiryDate?: string;
  maxBranches: number;
  daysRemaining?: number;
  isDemo: boolean;
  hardwareId?: string;
}

/**
 * Get a unique Hardware ID for this machine
 * Combines multiple hardware identifiers to create a unique fingerprint
 */
export async function getHardwareId(): Promise<string> {
  const identifiers: string[] = [];

  try {
    // 1. Get Machine GUID (Windows) or Hardware UUID (Mac/Linux)
    const platform = os.platform();

    if (platform === 'win32') {
      // Windows: Get MachineGUID from registry
      try {
        const { stdout } = await execAsync(
          'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid'
        );
        const match = stdout.match(/MachineGuid\s+REG_SZ\s+([A-F0-9-]+)/i);
        if (match && match[1]) {
          identifiers.push(match[1]);
        }
      } catch {
        // Fallback to volume serial
        try {
          const { stdout } = await execAsync('vol c:');
          const volMatch = stdout.match(/Volume Serial Number is ([A-F0-9]+)/i);
          if (volMatch && volMatch[1]) {
            identifiers.push(volMatch[1]);
          }
        } catch {}
      }
    } else if (platform === 'darwin') {
      // macOS: Get hardware UUID
      try {
        const { stdout } = await execAsync('ioreg -rd1 -c IOPlatformExpertDevice | grep UUID');
        const match = stdout.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
        if (match && match[1]) {
          identifiers.push(match[1]);
        }
      } catch {}
    } else {
      // Linux: Get machine-id
      try {
        const { stdout } = await execAsync('cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id 2>/dev/null || echo ""');
        if (stdout.trim()) {
          identifiers.push(stdout.trim());
        }
      } catch {}
    }

    // 2. Get first MAC address (physical adapter preferred)
    const networkInterfaces = os.networkInterfaces();
    for (const name of Object.keys(networkInterfaces)) {
      const interfaces = networkInterfaces[name];
      if (interfaces) {
        for (const iface of interfaces) {
          // Use physical adapters (not virtual)
          if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
            // Skip virtual adapters
            if (name.toLowerCase().includes('vmware') ||
                name.toLowerCase().includes('virtual') ||
                name.toLowerCase().includes('vbox')) {
              continue;
            }
            identifiers.push(iface.mac);
            break; // Use first physical adapter
          }
        }
        if (identifiers.length >= 2) break;
      }
    }

    // 3. CPU info
    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
      identifiers.push(cpus[0].model);
    }

    // 4. Hostname (as fallback)
    identifiers.push(os.hostname());

    // 5. Total memory
    identifiers.push(Math.floor(os.totalmem() / (1024 * 1024 * 1024)).toString());

    // 6. Number of CPUs
    identifiers.push(os.cpus().length.toString());

  } catch (error) {
    console.error('Error getting hardware ID:', error);
  }

  // If we couldn't get any identifiers, generate a fallback
  if (identifiers.length === 0) {
    identifiers.push(os.hostname());
    identifiers.push(os.platform());
    identifiers.push(os.arch());
  }

  // Create a hash from all identifiers
  const combined = identifiers.join('|');
  const hash = crypto.createHash('sha256').update(combined).digest('hex');

  // Return first 16 characters as Hardware ID
  return `HWID-${hash.substring(0, 16).toUpperCase()}`;
}

/**
 * Get Hardware ID synchronously (cached version for quick access)
 */
let cachedHardwareId: string | null = null;
export function getCachedHardwareId(): string {
  if (cachedHardwareId) return cachedHardwareId;

  // Generate a simple synchronous version for caching
  const identifiers: string[] = [];

  // Synchronous fallback identifiers
  identifiers.push(os.hostname());
  identifiers.push(os.platform());
  identifiers.push(os.arch());
  identifiers.push(os.cpus().length.toString());
  identifiers.push(Math.floor(os.totalmem() / (1024 * 1024 * 1024)).toString());

  const networkInterfaces = os.networkInterfaces();
  for (const name of Object.keys(networkInterfaces)) {
    const interfaces = networkInterfaces[name];
    if (interfaces) {
      for (const iface of interfaces) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          if (name.toLowerCase().includes('vmware') ||
              name.toLowerCase().includes('virtual') ||
              name.toLowerCase().includes('vbox')) {
            continue;
          }
          identifiers.push(iface.mac);
          break;
        }
      }
      if (identifiers.length >= 6) break;
    }
  }

  const combined = identifiers.join('|');
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  cachedHardwareId = `HWID-${hash.substring(0, 16).toUpperCase()}`;

  return cachedHardwareId;
}

/**
 * Generate a license key that is bound to a specific Hardware ID
 */
export function generateLicenseKey(params: {
  clientName: string;
  clientEmail: string;
  licenseType: 'trial' | 'full';
  hardwareId: string;
  expiryDays?: number;
  maxBranches?: number;
}): string {
  // Include Hardware ID in the signature
  const data = `${params.clientName}|${params.clientEmail}|${params.licenseType}|${params.hardwareId}|${params.expiryDays || 365}|${LICENSE_VERSION}`;
  const hash = crypto.createHash('sha256').update(data + 'etiquette-secret-salt-2024-hwid-v2').digest('hex');
  const keyPart = hash.substring(0, 16).toUpperCase();
  return `${LICENSE_PREFIX}-${keyPart.substring(0, 4)}-${keyPart.substring(4, 8)}-${keyPart.substring(8, 12)}-${keyPart.substring(12, 16)}`;
}

/**
 * Validate a license key and check Hardware ID match
 */
export function validateLicenseKey(key: string, hardwareId: string): { valid: boolean; license?: License; error?: string } {
  if (!key || key.trim() === '') {
    return { valid: false, error: 'License key is required' };
  }

  // Check format
  const keyFormat = /^ETIK-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
  if (!keyFormat.test(key)) {
    return { valid: false, error: 'Invalid license key format' };
  }

  const license = db.prepare('SELECT * FROM licenses WHERE license_key = ? AND is_active = 1').get(key) as License | undefined;

  if (!license) {
    return { valid: false, error: 'License key not found or inactive' };
  }

  // Check Hardware ID match (if license has one)
  if (license.hardware_id && license.hardware_id !== hardwareId) {
    console.error('Hardware ID mismatch:', {
      expected: license.hardware_id,
      got: hardwareId,
    });
    return {
      valid: false,
      error: 'License is locked to a different device',
      license,
    };
  }

  // Check expiry
  if (license.expiry_date) {
    const expiry = new Date(license.expiry_date);
    if (expiry < new Date()) {
      return { valid: false, error: 'License has expired', license };
    }
  }

  return { valid: true, license };
}

/**
 * Activate a license key with Hardware ID binding
 */
export function activateLicense(key: string, hardwareId: string): { success: boolean; error?: string; license?: License } {
  const validation = validateLicenseKey(key, hardwareId);

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  if (!validation.license) {
    return { success: false, error: 'License not found' };
  }

  // Bind the license to this hardware ID if not already bound
  const license = validation.license;
  if (!license.hardware_id) {
    db.prepare('UPDATE licenses SET hardware_id = ? WHERE license_key = ?').run(hardwareId, key);
  }

  // Save to settings
  setSetting('license_key', key);
  setSetting('license_status', license.license_type);
  setSetting('license_expiry', license.expiry_date || '');
  setSetting('license_hwid', hardwareId);
  setSetting('demo_mode', '0');

  return { success: true, license };
}

/**
 * Get current license status with Hardware ID verification
 */
export function getLicenseStatus(): LicenseStatus {
  const licenseKey = getSetting('license_key') || '';
  const savedStatus = getSetting('license_status') || 'none';
  const expiryDate = getSetting('license_expiry') || '';
  const savedHwid = getSetting('license_hwid') || '';
  const demoMode = getSetting('demo_mode') === '1';

  if (demoMode) {
    return {
      status: 'demo',
      key: 'DEMO-MODE',
      maxBranches: 2,
      isDemo: true,
    };
  }

  if (!licenseKey || savedStatus === 'none') {
    return {
      status: 'none',
      key: '',
      maxBranches: 1,
      isDemo: false,
    };
  }

  // Verify Hardware ID still matches
  const currentHwid = getCachedHardwareId();
  if (savedHwid && savedHwid !== currentHwid) {
    // Hardware ID changed - license invalid
    return {
      status: 'hw_mismatch',
      key: licenseKey,
      maxBranches: 1,
      isDemo: false,
      hardwareId: currentHwid,
    };
  }

  // Check if expired
  if (expiryDate) {
    const expiry = new Date(expiryDate);
    if (expiry < new Date()) {
      return {
        status: 'expired',
        key: licenseKey,
        expiryDate,
        maxBranches: 1,
        daysRemaining: 0,
        isDemo: false,
        hardwareId: currentHwid,
      };
    }

    const daysRemaining = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Get license details
    const license = db.prepare('SELECT * FROM licenses WHERE license_key = ?').get(licenseKey) as License | undefined;

    return {
      status: savedStatus as 'trial' | 'full',
      key: licenseKey,
      clientName: license?.client_name,
      clientEmail: license?.client_email,
      expiryDate,
      maxBranches: license?.max_branches || 2,
      daysRemaining,
      isDemo: false,
      hardwareId: currentHwid,
    };
  }

  // No expiry (full license)
  const license = db.prepare('SELECT * FROM licenses WHERE license_key = ?').get(licenseKey) as License | undefined;

  return {
    status: savedStatus as 'trial' | 'full',
    key: licenseKey,
    clientName: license?.client_name,
    clientEmail: license?.client_email,
    maxBranches: license?.max_branches || 2,
    isDemo: false,
    hardwareId: currentHwid,
  };
}

// Check if demo mode is active
export function isDemoMode(): boolean {
  return getSetting('demo_mode') === '1';
}

// Enable demo mode
export function enableDemoMode(): void {
  setSetting('demo_mode', '1');
  setSetting('license_status', 'demo');
  setSetting('license_key', '');
  setSetting('license_hwid', '');
}

// Disable demo mode
export function disableDemoMode(): void {
  setSetting('demo_mode', '0');
}

// Check demo restrictions
export function checkDemoRestrictions(): { allowed: boolean; reason?: string; remaining?: number } {
  const status = getLicenseStatus();

  if (!status.isDemo) {
    return { allowed: true };
  }

  // Check order count
  const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
  const maxOrders = parseInt(getSetting('demo_max_orders') || '50');

  if (orderCount.count >= maxOrders) {
    return {
      allowed: false,
      reason: 'demo_order_limit',
      remaining: 0,
    };
  }

  // Check days
  const demoActivated = getSetting('demo_activated_at');
  const maxDays = parseInt(getSetting('demo_expiry_days') || '30');

  if (demoActivated) {
    const activated = new Date(demoActivated);
    const daysPassed = Math.floor((Date.now() - activated.getTime()) / (1000 * 60 * 60 * 24));

    if (daysPassed >= maxDays) {
      return {
        allowed: false,
        reason: 'demo_expired',
        remaining: 0,
      };
    }

    return {
      allowed: true,
      remaining: maxDays - daysPassed,
    };
  }

  // First time demo activation
  setSetting('demo_activated_at', new Date().toISOString());

  return {
    allowed: true,
    remaining: maxDays,
  };
}

// Get demo usage info
export function getDemoUsage(): {
  ordersUsed: number;
  ordersMax: number;
  daysUsed: number;
  daysMax: number;
  daysRemaining: number;
} {
  const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
  const ordersMax = parseInt(getSetting('demo_max_orders') || '50');
  const daysMax = parseInt(getSetting('demo_expiry_days') || '30');

  const demoActivated = getSetting('demo_activated_at');
  let daysUsed = 0;
  let daysRemaining = daysMax;

  if (demoActivated) {
    const activated = new Date(demoActivated);
    daysUsed = Math.floor((Date.now() - activated.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = Math.max(0, daysMax - daysUsed);
  }

  return {
    ordersUsed: orderCount.count,
    ordersMax,
    daysUsed,
    daysMax,
    daysRemaining,
  };
}

// Create a demo license (for portfolio showcase)
export function createDemoLicense(): void {
  enableDemoMode();

  // Add demo watermark notice
  setSetting('demo_watermark', '1');
}

// Clear license (for testing)
export function clearLicense(): void {
  setSetting('license_key', '');
  setSetting('license_status', 'none');
  setSetting('license_expiry', '');
  setSetting('license_hwid', '');
  setSetting('demo_mode', '0');
}

// Import helpers
import { getSetting, setSetting } from './settings';
