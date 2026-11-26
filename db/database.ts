import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }
  dbInstance = await SQLite.openDatabaseAsync('whatdocs.db');
  return dbInstance;
}

export async function initializeDatabase() {
  const db = await getDatabase();
  
  await db.execAsync(`PRAGMA journal_mode = WAL;`);

  // DEVELOPMENT FIX: Drop the old table schema with the mismatched 'mother' column
  // (Remove this drop line later when in production so patient data persists across updates)
  // await db.execAsync(`DROP TABLE IF EXISTS patients;`);

  // Create the table fresh with the exact correct schema
  await db.execAsync(`
    CREATE TABLE patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mother_name TEXT,
      age INTEGER,
      gender TEXT,
      phone TEXT,
      diagnosis TEXT,
      prescription TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Local database force-reset and initialized successfully!");
}