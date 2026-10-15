const jwt = require("jsonwebtoken");
const { success } = require("zod");
require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;

async function authMiddleware(req, res, next){
    const token = req.cookies?.token;
    const {username, password} = req.body;

    if(username || password){
        return next();
    }

    if(token){
        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            return res.json({
                success: true,
                message: "Login Success",
                user: decoded,
                username: decoded.username,
                token
            });

        } catch (err) {
            return res.status(401).json({
                success: false,
                relogin: true,
                message: "Invalid or expired token"
            });
        }
    }

    return res.status(401).json({
        success: false,
        relogin: true,
        message: "Not logged in"
    });
}

module.exports = authMiddleware;
