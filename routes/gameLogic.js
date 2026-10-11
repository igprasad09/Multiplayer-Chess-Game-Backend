const express = require("express");
const { Chess } = require("chess.js");

const routes = express();
const game = new Chess();

routes.post("/resetgame", (req, res)=>{
   
})

module.exports = routes;