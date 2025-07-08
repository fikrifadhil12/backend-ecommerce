require("dotenv").config();
console.log("PGUSER:", process.env.PGUSER);
console.log("PGHOST:", process.env.PGHOST);
console.log("PGDATABASE:", process.env.PGDATABASE);
console.log("PGPASSWORD:", process.env.PGPASSWORD ? "***hidden***" : "EMPTY");
console.log("SECRET_KEY:", process.env.SECRET_KEY ? "***hidden***" : "EMPTY");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();

const SECRET_KEY = process.env.SECRET_KEY || "supersecretkey123";

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "https://reactjs-ecommerce1.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Database connection with better error handling
const poolConfig = {
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
  ssl: {
    rejectUnauthorized: false
  }
};

const pool = new Pool(poolConfig);

// Test database connection on startuprequire("dotenv").config();
console.log("PGUSER:", process.env.PGUSER);
console.log("PGHOST:", process.env.PGHOST);
console.log("PGDATABASE:", process.env.PGDATABASE);
console.log("PGPASSWORD:", process.env.PGPASSWORD ? "***hidden***" : "EMPTY");
console.log("SECRET_KEY:", process.env.SECRET_KEY ? "***hidden***" : "EMPTY");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();

const SECRET_KEY = process.env.SECRET_KEY || "supersecretkey123";

// CORS setup
app.use(cors({
  origin: process.env.FRONTEND_URL || "https://reactjs-ecommerce1.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// PostgreSQL connection
const poolConfig = {
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
  ssl: {
    rejectUnauthorized: false
  }
};

const pool = new Pool(poolConfig);

// Test DB connection
pool.query("SELECT NOW()")
  .then(() => console.log("✅ Connected to PostgreSQL database"))
  .catch(err => console.error("❌ Database connection error:", err));

// Middleware untuk verifikasi JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  });
}

// ============================
// ✅ FUNGSI TAMBAH USER DEFAULT
// ============================
async function insertDefaultUsers() {
  try {
    const adminCheck = await pool.query("SELECT * FROM users WHERE email = $1", ["admin@gmail.com"]);

    if (adminCheck.rows.length > 0) {
      console.log("🔹 Default users already exist.");
      return;
    }

    const users = [
      { name: "Admin", email: "admin@gmail.com", phone: "08123456789", password: "123456789", role: "admin" },
      { name: "Kurir1", email: "kurir@gmail.com", phone: "08121234567", password: "kurirpassword", role: "courier" }
    ];

    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await pool.query(
        "INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
        [user.name, user.email, user.phone, hashedPassword, user.role]
      );
      console.log(`✅ User ${user.email} inserted.`);
    }

  } catch (error) {
    console.error("❌ Error inserting default users:", error.message);
  }
}

// ============================
// ✅ ENDPOINT UNTUK SEED USERS
// ============================
app.get("/seed-users", async (req, res) => {
  try {
    await insertDefaultUsers();
    res.status(200).json({ message: "✅ Default users inserted (if not exist)" });
  } catch (err) {
    res.status(500).json({ message: "❌ Error seeding users", error: err.message });
  }
});

// =======================================
// ✅ AUTH ROUTES: REGISTER & LOGIN
// =======================================
app.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      "INSERT INTO users (name, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email",
      [name, email, phone, hashed]
    );

    res.status(201).json({ message: "User registered", user: newUser.rows[0] });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0) return res.status(400).json({ message: "User not found" });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "1h" });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =======================================
// ✅ VERIFY TOKEN
// =======================================
app.get("/verify-token", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ valid: false, message: "No token provided" });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ valid: false, message: "Invalid token" });
    res.json({ valid: true, userId: decoded.id });
  });
});

// =======================================
// ✅ PRODUCTS
// =======================================
app.get("/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to retrieve products" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Product not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Failed to retrieve product" });
  }
});

// =======================================
// ✅ CHECKOUT
// =======================================
app.post("/checkout", authenticateToken, async (req, res) => {
  try {
    const {
      name, email, address, city, postalCode, phone,
      paymentMethod, cartItems, totalAmount
    } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0)
      return res.status(400).json({ message: "Cart is empty" });

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const order = await client.query(`
        INSERT INTO list_order 
        (user_id, name, email, address, city, postal_code, phone, payment_method, total_amount, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING id`,
        [req.user.id, name, email, address, city, postalCode, phone, paymentMethod, totalAmount]);

      const orderId = order.rows[0].id;

      for (const item of cartItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, item.id, item.name, item.quantity, item.price]
        );
      }

      await client.query("COMMIT");
      res.status(200).json({ success: true, message: "Order created", orderId });

    } catch (err) {
      await client.query("ROLLBACK");
      res.status(500).json({ message: "Transaction failed", error: err.message });
    } finally {
      client.release();
    }

  } catch (err) {
    res.status(500).json({ message: "Checkout error", error: err.message });
  }
});

// =======================================
// ✅ HEALTH CHECK & TEST
// =======================================
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", time: new Date().toISOString() });
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "success", time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// =======================================
// ✅ START SERVER
// =======================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

pool.query('SELECT NOW()')
  .then(() => console.log('✅ Connected to PostgreSQL database'))
  .catch(err => console.error('❌ Database connection error:', err));

// Enhanced authenticateToken middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) {
    console.log("No token provided");
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.log("Invalid token:", err.message);
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  });
}

// ✅ REGISTER endpoint
app.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validate input
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const checkUserQuery = "SELECT * FROM users WHERE email = $1";
    const userResult = await pool.query(checkUserQuery, [email]);

    if (userResult.rows.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertQuery = `
      INSERT INTO users (name, email, phone, password_hash) 
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email
    `;
    
    const newUser = await pool.query(insertQuery, [name, email, phone, hashedPassword]);
    
    res.status(201).json({ 
      message: "User registered successfully",
      user: newUser.rows[0]
    });
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ LOGIN endpoint
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const query = "SELECT * FROM users WHERE email = $1";
    const result = await pool.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "1h" });

    res.json({
      token,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        phone: user.phone,
        role: user.role // ⬅️ peran user (admin, buyer, seller, dst.)
      },
    });

  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});


// ✅ VERIFY TOKEN endpoint
app.get("/verify-token", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ 
      valid: false, 
      message: "No token provided" 
    });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      console.error("JWT Error:", err.message);
      return res.status(401).json({ 
        valid: false, 
        message: "Invalid token" 
      });
    }
    
    res.json({ 
      valid: true, 
      userId: decoded.id 
    });
  });
});

// ✅ PRODUCTS endpoints
app.get("/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products");
    res.json(result.rows);
  } catch (err) {
    console.error("Error retrieving products:", err.message);
    res.status(500).json({ message: "Failed to retrieve products" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM products WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error retrieving product:", err.message);
    res.status(500).json({ message: "Failed to retrieve product" });
  }
});

// ✅ CHECKOUT endpoint with enhanced error handling
app.post("/checkout", authenticateToken, async (req, res) => {
  console.log("Checkout request received:", req.body);
  
  try {
    const {
      name,
      email,
      address,
      city,
      postalCode,
      phone,
      paymentMethod,
      cartItems,
      totalAmount,
    } = req.body;

    const userId = req.user.id;

    // Validate input
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    if (!name || !email || !address || !city || !postalCode || !phone || !paymentMethod) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Insert order
      const orderQuery = `
        INSERT INTO list_order 
        (user_id, name, email, address, city, postal_code, phone, payment_method, total_amount, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `;

      const orderResult = await client.query(orderQuery, [
        userId,
        name,
        email,
        address,
        city,
        postalCode,
        phone,
        paymentMethod,
        totalAmount,
      ]);

      const orderId = orderResult.rows[0].id;

      // Insert order items
      const orderItemsQuery = `
        INSERT INTO order_items 
        (order_id, product_id, product_name, quantity, price)
        VALUES ($1, $2, $3, $4, $5)
      `;

      for (const item of cartItems) {
        await client.query(orderItemsQuery, [
          orderId,
          item.id,
          item.name,
          item.quantity,
          item.price,
        ]);
      }

      await client.query("COMMIT");

      res.status(200).json({
        success: true,
        message: "Order successfully created",
        orderId,
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Transaction error:", err.message);
      res.status(500).json({ 
        success: false,
        message: "Failed to process order",
        error: err.message
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Checkout error:", err.message);
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: err.message
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Database test endpoint
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ 
      status: "success", 
      time: result.rows[0].now,
      db: process.env.PGDATABASE,
      user: process.env.PGUSER
    });
  } catch (error) {
    res.status(500).json({ 
      status: "error", 
      message: error.message,
      config: poolConfig
    });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Endpoint: http://localhost:${PORT}`);
});