const express = require("express");
const cors = require("cors");
const http = require("http");
const {Server} = require("socket.io");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {cors: {origin: "*"}})

require("./sockets/gameSockets")(io);

app.use(express.json());

httpServer.listen(3000, ()=>{
       console.log("Server running on 3000");
})