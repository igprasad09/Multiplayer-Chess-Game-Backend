const jwt = require("jsonwebtoken");
const { success } = require("zod");
require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;

async function authMiddleware(req, res, next){
    const token = req.cookies?.token;
    const {username, password} = req.body;
     if(token){
        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            return res.json({
                success: true,
                message: "Token is valid",
                user: decoded
            });

        } catch (err) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token"
            });
        }
    }else{
        if(!username && !password){
            return res.json({
                relogin: true,
                message: "invalid Credentials"
            });
        }else{
            next();
        }
    }
}

module.exports = authMiddleware;
