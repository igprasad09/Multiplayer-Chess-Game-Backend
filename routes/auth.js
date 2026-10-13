const express = require("express");
const routes = express.Router();

routes.get("/login", (req, res)=>{
    return res.json({
         message: "login"
    })
})

routes.post("/signup", (req, res)=>{
    return res.json({
        message: "signup"
    })
})

module.exports = routes;