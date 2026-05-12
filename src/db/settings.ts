import db from './connection';

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function setSettings(settings: Record<string, string>): void {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, value);
    }
  });
  transaction();
}

export function updateBranch(id: number, data: { name_ar?: string; name_en?: string; prefix?: string; address?: string; phone?: string }): void {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name_ar !== undefined) { fields.push('name_ar = ?'); values.push(data.name_ar); }
  if (data.name_en !== undefined) { fields.push('name_en = ?'); values.push(data.name_en); }
  if (data.prefix !== undefined) { fields.push('prefix = ?'); values.push(data.prefix); }
  if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address); }
  if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE branches SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function createBranch(data: { name_ar: string; name_en: string; prefix: string; address?: string; phone?: string }): { id: number } {
  const stmt = db.prepare('INSERT INTO branches (name_ar, name_en, prefix, last_sequence, address, phone) VALUES (?, ?, ?, 0, ?, ?)');
  const result = stmt.run(data.name_ar, data.name_en, data.prefix, data.address || null, data.phone || null);
  return { id: result.lastInsertRowid as number };
}
