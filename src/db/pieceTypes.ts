import db from './schema';

export interface PieceType {
  id: number;
  name_en: string;
  name_ar: string;
  category: string;
  active: number;
  sort_order: number;
  base_price: number;
}

export function getPieceTypes(): PieceType[] {
  return db.prepare('SELECT * FROM piece_types WHERE active = 1 ORDER BY sort_order').all() as PieceType[];
}

export function updateBasePrice(pieceTypeName: string, basePrice: number): void {
  db.prepare('UPDATE piece_types SET base_price = ? WHERE name_en = ?').run(basePrice, pieceTypeName);
}

export function getBasePrice(pieceTypeName: string): number {
  const row = db.prepare('SELECT base_price FROM piece_types WHERE name_en = ?').get(pieceTypeName) as { base_price: number } | undefined;
  return row?.base_price || 0;
}

export function createPieceType(data: Omit<PieceType, 'id' | 'active' | 'sort_order'>): number {
  const stmt = db.prepare(`
    INSERT INTO piece_types (name_en, name_ar, category, base_price)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(data.name_en, data.name_ar, data.category, data.base_price);
  return Number(result.lastInsertRowid);
}

export function updatePieceType(id: number, data: Partial<Omit<PieceType, 'id'>>): void {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name_en !== undefined) {
    updates.push('name_en = ?');
    params.push(data.name_en);
  }
  if (data.name_ar !== undefined) {
    updates.push('name_ar = ?');
    params.push(data.name_ar);
  }
  if (data.category !== undefined) {
    updates.push('category = ?');
    params.push(data.category);
  }
  if (data.base_price !== undefined) {
    updates.push('base_price = ?');
    params.push(data.base_price);
  }
  if (data.active !== undefined) {
    updates.push('active = ?');
    params.push(data.active ? 1 : 0);
  }
  if (data.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(data.sort_order);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE piece_types SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }
}

export function deletePieceType(id: number): void {
  db.prepare('UPDATE piece_types SET active = 0 WHERE id = ?').run(id);
}
