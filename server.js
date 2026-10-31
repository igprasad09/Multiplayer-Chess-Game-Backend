const express = require("express");
const cors = require("cors");
const http = require("http");
const {Server} = require("socket.io");
const authRoutes = require("./src/routes/auth");
const cookiParser = require("cookie-parser");
const friendRoutes = require("./src/routes/friends");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {cors: {origin: "*"}})

require("./src/sockets/gameSockets")(io);

app.use(express.json());
app.use(cookiParser());
app.use(cors({
       origin: "http://localhost:5173",
       credentials: true
}));

app.use("/auth", authRoutes);
app.use("/api", friendRoutes);

httpServer.listen(3000, ()=>{
       console.log("Server running on 3000");
})