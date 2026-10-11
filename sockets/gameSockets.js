const {Chess} = require("chess.js");
const crypto = require("crypto");
const game = new Chess();

const games = new Map();
const playerGame = new Map();
let pendingPlayer = null;

module.exports = (io) => {
     io.on("connection", (socket)=>{
        console.log("New connection: ", socket.id);
        
        if(pendingPlayer === null){
           pendingPlayer = socket.id;
           socket.emit("waitingForOpponent");
        }else{
           const gameId = crypto.randomUUID();
           const whiteId = pendingPlayer;
           const blackId = socket.id;

           games.set(gameId, {chess: new Chess(), white: whiteId, black: blackId});
           playerGame.set(whiteId, gameId);
           playerGame.set(blackId, gameId);
           pendingPlayer = null;

           const {chess} = games.get(gameId);
           const initialState = {fen: chess.fen(), turn: chess.turn(), isGameOver: chess.isGameOver() };

           io.to(whiteId).emit("matched", {gameId, color: "white"});
           io.to(blackId).emit("matched", {gameId, color: "black"});
           io.to(whiteId).emit("gameState", initialState);
           io.to(blackId).emit("gameState", initialState);
        }

        socket.on("disconnect", ()=>{
           console.log("Disconnected:", socket.id);
           
           if(pendingPlayer === socket.id){
               pendingPlayer = null;
           }
           const gameId = playerGame.get(socket.id);
           if(gameId){
               const entry = games.get(gameId);
               const opponentId = entry.white === socket.id ? entry.black : entry.white;
               io.to(opponentId).emit("opponentLeft");
               playerGame.delete(socket.id);
               playerGame.delete(opponentId);
               games.delete(gameId);
           }
        });

        socket.on("getGame", (callback)=>{
             const entry = games.get(playerGame.get(socket.id));
             if(!entry) return callback({waiting: true});
             callback({ fen: entry.chess.fen(), turn: entry.chess.turn(), isGameOver: entry.chess.isGameOver() });
        });

        socket.on("gameMove", ({from, to}, callback)=>{
          const entry = games.get(playerGame.get(socket.id));
          if(!entry) return callback({valid: false, reason: "no active game"});

          const myColor = socket.id === entry.white ? "w" : "b";
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
               io.to(entry.white).emit("gameState", state);
               io.to(entry.black).emit("gameState", state);
               callback(state);
          }catch(err){
               callback({ valid: false, fen: entry.chess.fen(), turn: entry.chess.turn() });
          }
        });

        socket.on("resetGame", (callback)=>{
               const entry = games.get(playerGame.get(socket.id));
               if(!entry) return callback({});
               entry.chess.reset();
               const state = {fen: entry.chess.fen(), turn: entry.chess.turn()};
               io.to(entry.white).emit("gameState", state);
               io.to(entry.black).emit("gameState", state);
               callback(state);
           });
     })
};