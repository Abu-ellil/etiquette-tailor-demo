import db from './connection';
import crypto from 'crypto';

export interface User {
  id?: number;
  name: string;
  username: string;
  password_hash: string;
  role: 'admin' | 'manager' | 'reception' | 'worker';
  worker_type?: 'tailor' | 'master_cutter' | null;
  branch_id: number;
  base_salary: number;
  default_rate: number;
  active: number;
  created_at?: string;
}

export interface Session {
  userId: number;
  username: string;
  name: string;
  role: string;
  branch_id: number;
  worker_type?: string | null;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function authenticateUser(username: string, password: string): Session | null {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1');
  const user = stmt.get(username) as User | undefined;

  if (!user) return null;
  if (user.password_hash !== hashPassword(password)) return null;

  return {
    userId: user.id!,
    username: user.username,
    name: user.name,
    role: user.role,
    branch_id: user.branch_id,
    worker_type: user.worker_type || null,
  };
}

export function getAllUsers(branchId?: number): User[] {
  if (branchId) {
    const stmt = db.prepare('SELECT * FROM users WHERE branch_id = ? AND active = 1 ORDER BY name');
    return stmt.all(branchId) as User[];
  }
  const stmt = db.prepare('SELECT * FROM users WHERE active = 1 ORDER BY name');
  return stmt.all() as User[];
}

export function getUser(id: number): User | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as User | undefined;
}

export function getUserByUsername(username: string): User | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username) as User | undefined;
}

export function createUser(user: { name: string; username: string; password: string; role: string; worker_type?: string; branch_id: number; base_salary?: number; default_rate?: number }): number {
  const stmt = db.prepare(`
    INSERT INTO users (name, username, password_hash, role, worker_type, branch_id, base_salary, default_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    user.name,
    user.username,
    hashPassword(user.password),
    user.role,
    user.worker_type || null,
    user.branch_id,
    user.base_salary || 0,
    user.default_rate || 0
  );
  return result.lastInsertRowid as number;
}

export function updateUser(id: number, user: Partial<User> & { password?: string }): void {
  if (user.password) {
    const stmt = db.prepare(`
      UPDATE users SET name = ?, username = ?, password_hash = ?, role = ?, worker_type = ?, branch_id = ?, base_salary = ?, default_rate = ?
      WHERE id = ?
    `);
    stmt.run(user.name, user.username, hashPassword(user.password), user.role, user.worker_type || null, user.branch_id, user.base_salary || 0, user.default_rate || 0, id);
  } else {
    const stmt = db.prepare(`
      UPDATE users SET name = ?, username = ?, role = ?, worker_type = ?, branch_id = ?, base_salary = ?, default_rate = ?
      WHERE id = ?
    `);
    stmt.run(user.name, user.username, user.role, user.worker_type || null, user.branch_id, user.base_salary || 0, user.default_rate || 0, id);
  }
}

export function deactivateUser(id: number): void {
  const stmt = db.prepare('UPDATE users SET active = 0 WHERE id = ?');
  stmt.run(id);
}
