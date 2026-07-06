import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'paywhen.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('[Database] Connected to SQLite database at:', DB_PATH);
  }
});

export function initDb() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        amount REAL NOT NULL,
        token_symbol TEXT NOT NULL,
        token_address TEXT NOT NULL,
        execute_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      )
    `, (err) => {
      if (err) {
        console.error('Error creating orders table:', err.message);
        reject(err);
      } else {
        console.log('[Database] Orders table verified/created.');
        resolve();
      }
    });
  });
}

export function saveOrder(order) {
  return new Promise((resolve, reject) => {
    const { id, sender, receiver, amount, token_symbol, token_address, execute_at, created_at, status } = order;
    db.run(`
      INSERT OR REPLACE INTO orders (id, sender, receiver, amount, token_symbol, token_address, execute_at, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, sender.toLowerCase(), receiver.toLowerCase(), amount, token_symbol, token_address, execute_at, created_at, status], (err) => {
      if (err) {
        console.error('Error saving order:', err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function getOrders(userAddress) {
  return new Promise((resolve, reject) => {
    const addr = userAddress.toLowerCase();
    db.all(`
      SELECT * FROM orders 
      WHERE sender = ? OR receiver = ?
      ORDER BY id DESC
    `, [addr, addr], (err, rows) => {
      if (err) {
        console.error('Error getting orders:', err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

export function updateOrderStatus(id, status) {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE orders SET status = ? WHERE id = ?
    `, [status, id], (err) => {
      if (err) {
        console.error('Error updating order status:', err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
