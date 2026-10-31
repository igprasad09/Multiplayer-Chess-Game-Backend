const express = require("express");
const routes = express();

routes.get("/allusers", async(req, res)=>{
    return res.json({
        message: allusers,
        users: []
    })
});

module.exports = routes;