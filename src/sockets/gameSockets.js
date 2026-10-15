const {Chess} = require("chess.js");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

const games = new Map();        // gameId -> {chess, white: userId, black: userId}
const userGame = new Map();     // userId -> gameId
const userSocket = new Map();   // userId -> this user's current socket.id
const userUsername = new Map(); // userId -> username
let pendingPlayer = null;       // userId waiting for an opponent (or null)


module.exports = (io) => {
     io.use((socket, next)=>{
          const token = socket.handshake.auth?.token;
          if(!token){
               return next(new Error("unauthorized"));
          }
          try{
             const decoded = jwt.verify(token, JWT_SECRET);
             socket.data.userId = decoded.userId;
             socket.data.username = decoded.username;
             next();
          }catch(err){
               next(new Error("unauthorized"));
          }
     });

     io.on("connection", (socket)=>{
        const userId = socket.data.userId;
        console.log("New connection: ", socket.id, "user: ", userId);

        userSocket.set(userId, socket.id);
        userUsername.set(userId, socket.data.username);

        const existingGameId = userGame.get(userId);
        if(existingGameId){
          const entry = games.get(existingGameId);
          if(entry){
               const color = entry.white === userId ? "white" : "black";
               const opponentId = entry.white === userId ? entry.black : entry.white;
               const state = { fen: entry.chess.fen(), turn: entry.chess.turn(), isGameOver: entry.chess.isGameOver() };
               socket.emit("matched", {
                    gameId: existingGameId,
                    color,
                    username: userUsername.get(userId),
                    opponentUsername: userUsername.get(opponentId)
               });
               socket.emit("gameState", state);
               return;
          }
          userGame.delete(userId);
        }
        
        if(pendingPlayer === null || pendingPlayer === userId){
           pendingPlayer = userId;
           socket.emit("waitingForOpponent");
        }else{
           const gameId = crypto.randomUUID();
           const whiteId = pendingPlayer;
           const blackId = userId;

           games.set(gameId, {chess: new Chess(), white: whiteId, black: blackId});
           userGame.set(whiteId, gameId);
           userGame.set(blackId, gameId);
           pendingPlayer = null;

           const {chess} = games.get(gameId);
           const initialState = {fen: chess.fen(), turn: chess.turn(), isGameOver: chess.isGameOver() };
           
           const whiteSocketId = userSocket.get(whiteId);
           const blackSocketId = userSocket.get(blackId);

           io.to(whiteSocketId).emit("matched", {
                gameId,
                color: "white",
                username: userUsername.get(whiteId),
                opponentUsername: userUsername.get(blackId)
           });
           io.to(blackSocketId).emit("matched", {
                gameId,
                color: "black",
                username: userUsername.get(blackId),
                opponentUsername: userUsername.get(whiteId)
           });
           io.to(whiteSocketId).emit("gameState", initialState);
           io.to(blackSocketId).emit("gameState", initialState);
        }

        socket.on("disconnect", ()=>{
           console.log("Disconnected:", socket.id, "user:", userId);
           
           if(userSocket.get(userId) !== socket.id){
               return; // a stale/old tab closing — this user has a newer live socket elsewhere
           }

           if(pendingPlayer === userId){
               pendingPlayer = null;
           }
           const gameId = userGame.get(userId);
           if(gameId){
               const entry = games.get(gameId);
               if(entry){
                   const opponentId = entry.white === userId ? entry.black : entry.white;
                   const opponentSocketId = userSocket.get(opponentId);
                   io.to(opponentSocketId).emit("opponentLeft");
                   userGame.delete(userId);
                   userGame.delete(opponentId);
                   games.delete(gameId);
               }
           }
        });

        socket.on("getGame", (callback)=>{
             const entry = games.get(userGame.get(userId));
             if(!entry) return callback({waiting: true});
             callback({ fen: entry.chess.fen(), turn: entry.chess.turn(), isGameOver: entry.chess.isGameOver() });
        });

        socket.on("gameMove", ({from, to}, callback)=>{
          const entry = games.get(userGame.get(userId));
          if(!entry) return callback({valid: false, reason: "no active game"});

          const myColor = userId === entry.white ? "w" : "b";
          if(entry.chess.turn() !== myColor){
               return callback({ valid : false, reason : "not your turn" });
          }
          try{
               const move = entry.chess.move({from, to, promotion: "q"});
               const winner = entry.chess.isCheckmate()
                    ? (entry.chess.turn() === "w" ? "black" : "white")
                    : null;

               const state = {
                    valid: true,
                    fen: entry.chess.fen(),
                    turn: entry.chess.turn(),
                    captured: !!move.captured,
                    check: entry.chess.inCheck(),
                    isCheckmate: entry.chess.isCheckmate(),
                    isGameOver: entry.chess.isGameOver(),
                    isDraw: entry.chess.isDraw(),
                    winner
               };
               io.to(userSocket.get(entry.white)).emit("gameState", state);
               io.to(userSocket.get(entry.black)).emit("gameState", state);
               callback(state);
          }catch(err){
               callback({ valid: false, fen: entry.chess.fen(), turn: entry.chess.turn() });
          }
        });

        socket.on("resetGame", (callback)=>{
               const entry = games.get(userGame.get(userId));
               if(!entry) return callback({});
               entry.chess.reset();
               const state = {fen: entry.chess.fen(), turn: entry.chess.turn()};
               io.to(userSocket.get(entry.white)).emit("gameState", state);
               io.to(userSocket.get(entry.black)).emit("gameState", state);
               callback(state);
           });
     })
};