const express = require("express");
const cors = require("cors");
const {Chess} = require("chess.js");

const app = express();

app.use(cors());
app.use(express.json());

const game = new Chess();

app.get("/game", (req, res)=>{
    res.json({
        fen: game.fen(),
        turn: game.turn(),
    })
});

app.post("/move", (req, res)=>{
    const {from, to} = req.body;
    
    try{
        const move = game.move({from, to, promotion: "q"});
        console.log(move)
        res.json({
            valid: true,
            fen: game.fen(),
            move: move,
            turn: game.turn()
        })
    }catch(err){
        res.json({
            valid: false,
            fen: game.fen()
        })
    }
})

app.post("/resetgame", (req, res)=>{
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

app.listen(3000, ()=>{
     console.log("Server is running on 3000")
})