import * as SQLite from 'expo-sqlite';

export async function getDatabase() {
  const db = await SQLite.openDatabaseAsync('whatdocs.db');
  return db;
}

export async function initializeDatabase() {
  const db = await getDatabase();
  // SILENT UPGRADE: Add new columns to existing databases safely
  try {
    await db.execAsync(`ALTER TABLE patients ADD COLUMN mother_name TEXT;`);
  } catch (error) {}
  
  try {
    await db.execAsync(`ALTER TABLE patients ADD COLUMN prescription TEXT;`);
  } catch (error) {}
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mother name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      phone TEXT,
      diagnosis TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  
  console.log("Local database upgraded with full patient fields!");
}