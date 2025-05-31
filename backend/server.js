const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; // Use Render's port or 3000 for local

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// SQLite DB
// SQLite DB
// For Render, data is persisted in a disk mounted at RENDER_DISK_MOUNT_PATH
const dbPath = process.env.RENDER_DISK_MOUNT_PATH ? path.join(process.env.RENDER_DISK_MOUNT_PATH, 'database.sqlite') : './database.sqlite';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database " + err.message);
  } else {
    console.log("Database connected at " + dbPath);
  }
});

// In-memory store for shared lists
// For a production app, you'd use a database for this.
let sharedLists = {};

// Initialize table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      category TEXT,
      quantity INTEGER,
      price REAL DEFAULT 0
    )
  `);
});

// Seed sample data if table is empty
db.get("SELECT COUNT(*) as count FROM items", (_, row) => {
  if (row.count === 0) {
    const stmt = db.prepare("INSERT INTO items (name, category, quantity) VALUES (?, ?, ?)");
    const sampleData = [
      ["Apples", "Fruits", 2],
      ["Bananas", "Fruits", 6],
      ["Carrots", "Vegetables", 4],
      ["Broccoli", "Vegetables", 1],
      ["Chicken Breast", "Meat", 2],
      ["Salmon Fillet", "Meat", 1],
      ["Milk", "Dairy", 3],
      ["Cheese", "Dairy", 1],
      ["Bread", "Bakery", 2],
      ["Croissants", "Bakery", 5],
    ];
    sampleData.forEach(item => stmt.run(...item));
    stmt.finalize();
  }
});

// Get all items
app.get('/api/items', (req, res) => {
  db.all("SELECT * FROM items", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add a new item
app.post('/api/items', (req, res) => {
  try {
    const { name, category, quantity } = req.body;

    if (!name || !category) {
      console.error("POST /api/items - Bad Request: Name or category missing.", req.body);
      return res.status(400).json({ error: 'Name and category are required.' });
    }
    const itemQuantity = quantity || 1; // Default quantity to 1 if not provided

    const stmt = db.prepare("INSERT INTO items (name, category, quantity) VALUES (?, ?, ?)");
    stmt.run(name, category, itemQuantity, function(err) {
      if (err) {
        console.error("DB Error inserting item in POST /api/items:", err.message);
        return res.status(500).json({ error: `Database error: ${err.message}` });
      }
      // Return the newly created item, including its ID
      const newItem = {
        id: this.lastID,
        name: name,
        category: category,
        quantity: itemQuantity,
        price: 0 // Default price
      };
      console.log("POST /api/items - Successfully added item:", newItem);
      res.status(201).json(newItem);
    });
    stmt.finalize(err => {
      if (err) {
        // This error is for finalize, if stmt.run had an error, it's handled above.
        // It's less common for finalize to error if prepare/run were ok.
        console.error("Error finalizing statement in POST /api/items:", err.message);
        // Avoid sending another response if one was already sent by stmt.run's callback
      }
    });
  } catch (e) {
    console.error("Unexpected synchronous error in POST /api/items route:", e.message, e.stack);
    // Ensure a response is sent if not already
    if (!res.headersSent) {
      res.status(500).json({ error: "Server error processing request." });
    }
  }
});

// Update prices
app.post('/api/update', (req, res) => {
  const updates = req.body;
  const stmt = db.prepare("UPDATE items SET price = ? WHERE id = ?");
  updates.forEach(item => stmt.run(item.price, item.id));
  stmt.finalize(() => res.json({ status: "Updated" }));
});

// Endpoint to create a new shared list
app.post('/api/share', (req, res) => {
  const itemsToShare = req.body;
  if (!Array.isArray(itemsToShare) || itemsToShare.length === 0) {
    return res.status(400).json({ error: 'No items provided to share or invalid format.' });
  }

  const listId = Date.now().toString(); // Simple unique ID
  sharedLists[listId] = itemsToShare;

  console.log(`Created shared list with ID: ${listId}, items:`, itemsToShare.length);
  res.status(201).json({ id: listId });
});

// Get a specific shared list by ID
app.get('/api/share/:listId', (req, res) => {
  const { listId } = req.params;
  const list = sharedLists[listId];

  if (list) {
    console.log(`Serving shared list ID: ${listId}`);
    res.json(list);
  } else {
    console.log(`Shared list ID: ${listId} not found.`);
    res.status(404).json({ error: 'Shared list not found.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
