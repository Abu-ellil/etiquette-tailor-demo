import db from './connection';

export interface Branch {
  id?: number;
  name_ar: string;
  name_en: string;
  prefix: string;
  last_sequence: number;
  address?: string;
  phone?: string;
  created_at?: string;
}

export function getAllBranches(): Branch[] {
  const stmt = db.prepare('SELECT * FROM branches ORDER BY id');
  return stmt.all() as Branch[];
}

export function getBranchById(id: number): Branch | undefined {
  const stmt = db.prepare('SELECT * FROM branches WHERE id = ?');
  return stmt.get(id) as Branch | undefined;
}

export function createBranch(data: { name_ar: string; name_en: string; prefix: string; address?: string | null; phone?: string | null }): Branch {
  const stmt = db.prepare(`
    INSERT INTO branches (name_ar, name_en, prefix, address, phone)
    VALUES (@name_ar, @name_en, @prefix, @address, @phone)
  `);
  const result = stmt.run({
    name_ar: data.name_ar,
    name_en: data.name_en,
    prefix: data.prefix,
    address: data.address || null,
    phone: data.phone || null,
  });
  return getBranchById(result.lastInsertRowid as number) as Branch;
}

export function updateBranch(id: number, data: { name_ar?: string; name_en?: string; prefix?: string; address?: string | null; phone?: string | null }): Branch | undefined {
  const current = getBranchById(id);
  if (!current) return undefined;
  
  const stmt = db.prepare(`
    UPDATE branches
    SET name_ar = @name_ar, name_en = @name_en, prefix = @prefix, address = @address, phone = @phone
    WHERE id = @id
  `);
  stmt.run({
    id,
    name_ar: data.name_ar ?? current.name_ar,
    name_en: data.name_en ?? current.name_en,
    prefix: data.prefix ?? current.prefix,
    address: data.address !== undefined ? data.address : current.address,
    phone: data.phone !== undefined ? data.phone : current.phone,
  });
  return getBranchById(id);
}
