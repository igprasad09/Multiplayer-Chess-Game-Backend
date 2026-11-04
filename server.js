const express = require("express");
const cors = require("cors");
const http = require("http");
const {Server} = require("socket.io");
const jwt = require("jsonwebtoken");

const authRoutes = require("./src/routes/auth");
const friendRoutes = require("./src/routes/friends");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
       cors: {
              origin: "*",
              credentials: true
       }
});

app.set("io", io);

io.use((socket, next)=>{
       const token = socket.handshake.auth?.token;

       if(!token){
              return next(new Error("Unauthorized"));
       }

       try{
              const decoded = jwt.verify(token, process.env.JWT_SECRET);

              socket.data.userId = decoded.userId;
              socket.data.username = decoded.username;

              next();
       }catch(err){
              next(new Error("Unauthorized"));
       }
});

require("./src/sockets/gameSockets")(io);
require("./src/sockets/friendSockets")(io);

app.use(express.json());
app.use(cors({
       origin: "http://localhost:5173",
       credentials: true
}));

app.use("/auth", authRoutes);
app.use("/api", friendRoutes);

httpServer.listen(3000, ()=>{
       console.log("Server running on 3000");
})