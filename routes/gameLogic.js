const express = require("express");
const { Chess } = require("chess.js");

const routes = express();
const game = new Chess();

routes.get("/game", (req, res)=>{
    res.json({
        fen: game.fen(),
        turn: game.turn(),
        isGameOver: game.isGameOver(),
    })
});

routes.post("/move", (req, res)=>{
    const {from, to} = req.body;
    
    try{
        const move = game.move({from, to, promotion: "q"});
        res.json({
            valid: true,
            fen: game.fen(),
            turn: game.turn(),
            captured: !!move.captured,
            check: game.inCheck(),
            isCheckmate: game.isCheckmate(),
            isGameOver: game.isGameOver()
        })
    }catch(err){
        res.json({
            valid: false,
            fen: game.fen()
        })
    }
})

routes.post("/resetgame", (req, res)=>{
   try{
      return res.json({
          reset: game.reset(),
          fen: game.fen(),
          turn: game.turn()
       });
   }catch(err){
        res.json({
             err
        });
   }
})

module.exports = routes;