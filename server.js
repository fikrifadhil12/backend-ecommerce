require("dotenv").config();
console.log("PGUSER:", process.env.PGUSER);
console.log("PGPASSWORD:", process.env.PGPASSWORD ? "***hidden***" : "EMPTY");
console.log("SECRET_KEY:", process.env.SECRET_KEY ? "***hidden***" : "EMPTY");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();

const SECRET_KEY = process.env.SECRET_KEY;
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.stack);
  } else {
    console.log("✅ Connected to PostgreSQL database.");
  }
});

// Middleware: Auth Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

// ✅ REGISTER
app.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const checkUserQuery = "SELECT * FROM users WHERE email = $1";
    const userResult = await pool.query(checkUserQuery, [email]);

    if (userResult.rows.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertQuery =
      "INSERT INTO users (name, email, phone, password_hash) VALUES ($1, $2, $3, $4)";
    await pool.query(insertQuery, [name, email, phone, hashedPassword]);

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
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
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ VERIFY TOKEN
app.get("/verify-token", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      console.error("JWT Error:", err.message);
      return res.status(401).json({ message: "Invalid token" });
    }
    res.json({ valid: true, userId: decoded.id });
  });
});

// ✅ GET ALL PRODUCTS
app.get("/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products");
    res.json(result.rows);
  } catch (err) {
    console.error("Error retrieving products:", err.message);
    res.status(500).json({ message: "Failed to retrieve products" });
  }
});

// ✅ GET PRODUCT BY ID
app.get("/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM products WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error retrieving product:", err.message);
    res.status(500).json({ message: "Failed to retrieve product" });
  }
});

// ✅ CHECKOUT
app.post("/checkout", authenticateToken, async (req, res) => {
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

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ message: "Cart is empty." });
  }

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

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

      const orderItemsQuery = `
        INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
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
        message: "Pesanan berhasil disimpan.",
        orderId,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Checkout failed:", err.message);
      res.status(500).json({ message: "Gagal menyimpan pesanan." });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Database connection error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Start Server
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
