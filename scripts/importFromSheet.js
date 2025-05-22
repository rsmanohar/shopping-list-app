// scripts/importFromSheet.js
const sqlite3 = require('sqlite3').verbose();
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

// IMPORTANT: Store sensitive information like API keys in environment variables
// or a secure configuration management system, not directly in code.
// Example: const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
const CONFIG = {
  SPREADSHEET_ID: '1Gk8K76m_LpIPgd5nZ-SB5ZWx2mJ4gRCgE3tOyC4Z78o', // Consider making this configurable too
  SHEET_NAME: 'shopping', // And this
  API_KEY: 'AIzaSyCsBBcFZHbFQBD22Rz9ISHwfWHfDm989pM' // <<< SECURITY RISK: Hardcoded API Key
};

const DB_PATH = './database.sqlite'; // Define DB path

async function fetchSheetData() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${CONFIG.SHEET_NAME}?key=${CONFIG.API_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Google Sheets API request failed with status ${res.status}: ${errorText}`);
    }
    const json = await res.json();

    if (!json.values || json.values.length < 1) {
      console.warn("⚠️ No data found in the sheet or sheet is empty.");
      return [];
    }

    const [headers, ...rows] = json.values;
    return rows.map(row => {
      const obj = {};
      headers.forEach((key, i) => {
        // Ensure key is a string and trim it, then convert to lowercase
        const cleanKey = String(key || '').trim().toLowerCase();
        if (cleanKey) {
          obj[cleanKey] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
        }
      });
      return obj;
    });
  } catch (error) {
    console.error("❌ Error fetching or parsing sheet data:", error);
    throw error; // Re-throw to be caught by the caller
  }
}

async function importToDB() {
  let db; // Declare db here to be accessible in finally
  try {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("❌ Could not connect to database:", err.message);
        throw err; // Propagate error
      }
      console.log("🗄️ Connected to the SQLite database.");
    });

    const items = await fetchSheetData();
    if (!items || items.length === 0) {
      console.log("ℹ️ No items to import.");
      return; // Exit if no items
    }
    console.log(`📥 Importing ${items.length} items...`);

    // Promisify db operations for cleaner async/await usage
    const run = (sql, params = []) => new Promise((resolve, reject) => {
      db.run(sql, params, function(err) { // Use function for `this`
        if (err) reject(err);
        else resolve(this);
      });
    });

    const prepare = (sql) => new Promise((resolve, reject) => {
        const stmt = db.prepare(sql, (err) => {
            if (err) reject(err);
            else resolve(stmt);
        });
    });

    await run(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        subcategory TEXT,
        quantity INTEGER DEFAULT 0,
        price REAL DEFAULT 0
      )
    `);
    console.log("✔️ Table 'items' ensured.");

    await run("BEGIN TRANSACTION");
    console.log("🔄 Started transaction.");

    await run("DELETE FROM items");
    console.log("🗑️ Cleared existing items from table.");

    const insertStmt = await prepare(`
      INSERT INTO items (name, category, subcategory, quantity) 
      VALUES (?, ?, ?, ?)
    `);
    // Note: The 'price' column will use its default value (0) as it's not in the INSERT.
    // If your sheet has a 'price' column, you should map it and include it in the INSERT.
    // Example header: 'name', 'category', 'subcategory', 'quantity', 'price'
    // Example obj: { name: 'Apple', category: 'Fruit', quantity: '10', price: '0.5' }
    // Then, the INSERT would be:
    // INSERT INTO items (name, category, subcategory, quantity, price) VALUES (?, ?, ?, ?, ?)
    // And insertStmt.run(item.name, item.category, item.subcategory, qty, item.price ? parseFloat(item.price) : 0);

    for (const item of items) {
      const name = item.name || 'Unnamed Item'; // Ensure name is not null/undefined
      const category = item.category || '';
      const subcategory = item.subcategory || '';
      
      let quantity = parseInt(item.quantity, 10);
      if (isNaN(quantity) || quantity < 0) {
        quantity = 0; // Default to 0 if not a valid non-negative number
      }

      // Check for expected properties (name, category, subcategory, quantity)
      // This depends on your sheet's headers.
      // The current fetchSheetData normalizes headers to lowercase.
      if (item.name === undefined) console.warn(`⚠️ Item missing 'name' property:`, item);


      await new Promise((resolve, reject) => {
        insertStmt.run(name, category, subcategory, quantity, function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    await new Promise((resolve, reject) => {
        insertStmt.finalize((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    console.log("✔️ Items inserted.");

    await run("COMMIT");
    console.log("✅ Import complete. Transaction committed.");

  } catch (error) {
    console.error("❌ Error during database import process:", error.message);
    if (db) {
      // Attempt to rollback if an error occurred during the transaction
      try {
        await new Promise((resolve, reject) => {
            db.run("ROLLBACK", (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log("↩️ Transaction rolled back due to error.");
      } catch (rollbackError) {
        console.error("❌ Error rolling back transaction:", rollbackError.message);
      }
    }
    throw error; // Re-throw to be caught by the final .catch
  } finally {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error("❌ Error closing database:", err.message);
        } else {
          console.log("🚪 Database connection closed.");
        }
      });
    }
  }
}

importToDB()
  .then(() => console.log("🚀 Script finished successfully."))
  .catch(err => {
    // console.error is already done inside importToDB for specific errors
    // This final catch is for any unhandled promise rejections from importToDB
    console.error("💥 Unrecoverable error in import script:", err.message);
    process.exitCode = 1; // Indicate failure
  });
