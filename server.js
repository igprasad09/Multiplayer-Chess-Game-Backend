
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const authRoutes = require("./src/routes/auth");
const friendRoutes = require("./src/routes/friends");

const app = express();
const httpServer = http.createServer(app);

// Allow local frontend and deployed frontend
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header (health checks, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

const io = new Server(httpServer, {
  cors: corsOptions,
});

app.set("io", io);

// Cookie parser for Socket.IO JWT authentication
function parseCookies(header = "") {
  const out = {};

  header.split(";").forEach((part) => {
    const i = part.indexOf("=");

    if (i === -1) return;

    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();

    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  });

  return out;
}

// Socket JWT authentication
io.use((socket, next) => {
  try {
    const cookies = parseCookies(
      socket.handshake.headers.cookie || ""
    );

    const token = cookies.token;

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.data.userId = decoded.userId;
    socket.data.username = decoded.username;

    next();
  } catch (err) {
    console.log("Socket auth failed:", err.message);
    next(new Error("Unauthorized"));
  }
});

// Existing socket modules
require("./src/sockets/gameSockets")(io);
require("./src/sockets/friendSockets")(io);
require("./src/sockets/messagesSocket")(io);
require("./src/sockets/liveChatSocket")(io);

app.use(cookieParser());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/api", friendRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "server is running completely fine",
  });
});

// AppSail port, fallback for local Docker
const PORT = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 9000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
