#!/usr/bin/env ts-node
/**
 * License Key Generator with Hardware ID Binding
 *
 * The client needs to provide their Hardware ID (shown in the License page)
 *
 * Usage:
 *   npm run generate-license -- --hwid "HWID-1234567890ABCDEF" --name "Client Name" --email "client@example.com" --type trial --days 30
 *   npm run generate-license -- --hwid "HWID-1234567890ABCDEF" --name "Client Name" --email "client@example.com" --type full
 */

import { generateLicenseKey } from '../src/db/license';

interface Args {
  hwid: string;
  name: string;
  email: string;
  type: 'trial' | 'full';
  days?: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: any = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        result[key] = value;
        i++;
      } else {
        result[key] = true;
      }
    }
  }

  if (!result.hwid || !result.name || !result.email || !result.type) {
    console.error('Usage: npm run generate-license -- --hwid "HWID-XXXX" --name "Client Name" --email "client@example.com" --type [trial|full] [--days 30]');
    console.error('\nTo get the Hardware ID:');
    console.error('  1. Ask the client to open the License page in the app');
    console.error('  2. Their Hardware ID will be displayed there');
    console.error('  3. Copy that ID and use it in this command\n');
    process.exit(1);
  }

  if (result.type !== 'trial' && result.type !== 'full') {
    console.error('Type must be either "trial" or "full"');
    process.exit(1);
  }

  return {
    hwid: result.hwid,
    name: result.name,
    email: result.email,
    type: result.type,
    days: result.days ? parseInt(result.days) : undefined,
  };
}

function main() {
  const args = parseArgs();

  const licenseKey = generateLicenseKey({
    clientName: args.name,
    clientEmail: args.email,
    licenseType: args.type,
    hardwareId: args.hwid,
    expiryDays: args.days,
  });

  console.log('\n' + '='.repeat(60));
  console.log('           LICENSE KEY GENERATED (Hardware Locked)');
  console.log('='.repeat(60) + '\n');
  console.log(`Client Name:     ${args.name}`);
  console.log(`Client Email:    ${args.email}`);
  console.log(`Hardware ID:     ${args.hwid}`);
  console.log(`License Type:    ${args.type.toUpperCase()}`);
  console.log(`Expiry:          ${args.type === 'full' ? 'Never' : `${args.days || 30} days`}`);
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`\n  License Key:\n`);
  console.log(`     ${licenseKey}\n`);
  console.log('='.repeat(60) + '\n');
  console.log('⚠️  IMPORTANT: This license is locked to the Hardware ID above.');
  console.log('    It will ONLY work on that specific device.\n');
  console.log('    Send the client BOTH the License Key AND remind them');
  console.log('    that it must be activated on the same device used to');
  console.log('    generate the Hardware ID.\n');
}

main();
