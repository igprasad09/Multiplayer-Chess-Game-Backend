const express = require("express");
const prisma = require("../../lib/prisma");
const { UserSchema } = require("../validations/userValidation");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");
require("dotenv").config();

const routes = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const cookieOptions = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 1000,
};

function signToken(user){
    return jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "1h" }
    );
}

function validationErrors(result){
    return result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
    }));
}

// ---------- LOGIN ----------
routes.post("/login", authMiddleware, async (req, res) => {
    const { username, password } = req.body;
    const result = UserSchema.safeParse({ username, password });

    if(!result.success){
        return res.status(400).json({ success: false, errors: validationErrors(result) });
    }

    try{
        const user = await prisma.user.findUnique({ where: { username } });

        if(!user){
            return res.status(400).json({
                success: false,
                field: "username",
                message: "Username Not Found",
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if(!isPasswordValid){
            return res.status(401).json({
                success: false,
                field: "password",
                message: "Password is not correct",
            });
        }

        const token = signToken(user);
        res.cookie("token", token, cookieOptions);

        return res.json({
            success: true,
            message: "Login Successful",
            username: user.username,
            token,
        });
    }catch(err){
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ---------- SIGNUP ----------
routes.post("/signup", async (req, res) => {
    const { username, password } = req.body;
    const result = UserSchema.safeParse({ username, password });

    if(!result.success){
        return res.status(400).json({ success: false, errors: validationErrors(result) });
    }

    try{
        const user = await prisma.user.findUnique({ where: { username } });

        if(!user){
            const hashPassword = await bcrypt.hash(password, 12);
            const newUser = await prisma.user.create({
                data: { username, password: hashPassword },
            });

            const token = signToken(newUser);
            res.cookie("token", token, cookieOptions);

            return res.json({
                success: true,
                username: newUser.username,
                message: "New User Created Successfully",
                token,
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if(isPasswordValid){
            const token = signToken(user);
            res.cookie("token", token, cookieOptions);

            return res.json({
                success: true,
                message: "Login Success",
                username: user.username,
                token,
            });
        }

        return res.json({
            success: false,
            message: "This Username already exists",
        });
    }catch(err){
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ---------- WHO AM I (used by App.jsx on page load) ----------
routes.get("/me", (req, res) => {
    const token = req.cookies?.token;
    if(!token) return res.status(401).json({ success: false });

    try{
        const decoded = jwt.verify(token, JWT_SECRET);
        return res.json({
            success: true,
            userId: decoded.userId,
            username: decoded.username,
        });
    }catch(err){
        return res.status(401).json({ success: false });
    }
});

// ---------- LOGOUT ----------
routes.post("/logout", (req, res) => {
    res.clearCookie("token", { httpOnly: true, secure: false, sameSite: "lax" });

    return res.json({
        success: true,
        message: "Logout successful",
        relogin: true,
    });
});

module.exports = routes;