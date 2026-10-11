const {Chess} = require("chess.js");
const rooms = new Map();

const game = new Chess();

module.exports = (io) => {
     io.on("connection", (socket)=>{
        console.log("New connection: ", socket.id);
        //socket disconnect
        socket.on("disconnect", ()=>{
           console.log("Disconnected:", socket.id);
        });
        socket.on("getGame", (callback)=>{
             callback({
                 fen: game.fen(),
                 turn: game.turn(),
                 isGameOver: game.isGameOver(),
             });
        });

        socket.on("gameMove", (data, callback)=>{
          const {from, to} = data;
          try{
               const move = game.move({from, to, promotion: "q"});
               const state = {
                    valid: true,
                    fen: game.fen(),
                    turn: game.turn(),
                    captured: !!move.captured,
                    check: game.inCheck(),
                    isCheckmate: game.isCheckmate(),
                    isGameOver: game.isGameOver(),
               };
               io.emit("gameState", state);
               callback(state);
          }catch(err){
               callback({
                    valid: false,
                    fen: game.fen(),
                    turn: game.turn(),
               });
          }
        });

        socket.on("resetGame", (callback)=>{
               try{
                    callback({
                         reset: game.reset(),
                         fen: game.fen(),
                         turn: game.turn()
                    });
               }catch(err){
                    callback({
                         err
                    });
               }
           });

     })
};