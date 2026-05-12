const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'app.db');
const db = new Database(dbPath);

const crypto = require('crypto');
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Update admin password
const hashedPassword = hashPassword('admin123');
const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?');
const result = stmt.run(hashedPassword, 'admin');

console.log('Password updated successfully!');
console.log('Username: admin');
console.log('Password: admin123');

db.close();
