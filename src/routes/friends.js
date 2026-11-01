const express = require("express");
const routes = express();
const prisma = require("../../lib/prisma");

routes.get("/allusers", async(req, res)=>{
    try{
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const username = req.query.username;

        const skip = (page - 1) * limit;
        
        const allusers = await prisma.user.findMany({
            where: username ? {
                username: {
                    contains: username,
                    mode: "insensitive"
                },
            } : {},
            skip,
            take: limit
        });
        
        const totalusers = await prisma.user.count({
            where: username ? {
                username : {
                    contains: username,
                    mode: "insensitive"
                }
            } : {}
        });

        return res.json({
            message: "Users fetched successfully",
            users: allusers,
            currentPage: page,
            totalPages: Math.ceil(totalusers / limit),
            totalusers
        })
    }catch(err){
        return res.status(500).json({
             message: err.message
        })
    }  
});



module.exports = routes;