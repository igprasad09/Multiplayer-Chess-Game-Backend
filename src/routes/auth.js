const express = require("express");
const prisma = require("../../lib/prisma");
const { UserSchema } = require("../validations/userValidation");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { success } = require("zod");
const authMiddleware = require("../middleware/authMiddleware");
require("dotenv").config();

const routes = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

routes.post("/login", authMiddleware, async(req, res)=>{
    const {username, password} = req.body;
    const result = UserSchema.safeParse({username, password});

    if(!result.success){
        return res.status(400).json({
            success: false,
            errors: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
        })),
      })
    }

    try{
        const user = await prisma.user.findUnique({
              where: {
                 username
              }
        })
    
        if(!user){
             return res.status(400).json({
                success: false,
                field: "username",
                message: "Username Not Found"
            });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            user.password);
    
        if(!isPasswordValid){
            return res.status(401).json({
                success: false,
                field: "password",
                message: "Password is not correct"
            });
        }

        const token = jwt.sign(
            { userId: user.id,  username: user.username },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.cookie("token", token,{
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 60 * 60 * 1000
        });

        return res.json({
            success: true,
            message: "Login Successful",
            username: user.username,
            token
        });
        
    }catch(err){
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }

})

routes.post("/signup", async (req, res)=>{
    const { username, password } = req.body;
    const result = UserSchema.safeParse({username, password});

    if(!result.success){
        return res.status(400).json({
            success: false,
            errors: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
        })),
      })
    }

    try{
        const user = await prisma.user.findUnique({
            where: {
                username: username
            }
        });

        if(!user){
            const hashPassword = await bcrypt.hash(password, 12);
            const newUser = await prisma.user.create({
                data: {
                    username,
                    password : hashPassword
                },
            })

            const token = jwt.sign(
                { userId: newUser.id,  username: newUser.username },
                JWT_SECRET,
                { expiresIn: "1h" }
            );

            res.cookie("token", token, {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
                maxAge: 60 * 60 * 1000
            });

            return res.json({
                success: true,
                user: newUser,
                username: newUser.username,
                message: "New User Created Successfully",
                token
            });
        }

       if(user){
            const isPasswordValid = await bcrypt.compare(
                password,
                user.password
            )
            if(isPasswordValid){

                const token = jwt.sign(
                    { userId: user.id,  username: user.username },
                    JWT_SECRET,
                    { expiresIn: "1h" }
                );

                res.cookie("token", token, {
                    httpOnly: true,
                    secure: false,
                    sameSite: "lax",
                    maxAge: 60 * 60 * 1000
                });

                 return res.json({
                    success: true,
                    message: "Login Success",
                    username: user.username,
                    token
                });

            }else{
                return res.json({
                    success: false,
                    message: "This Username is already exists"
                });
            }
       }

    }catch(err){
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

routes.post("/logout", (req, res)=>{
    res.clearCookie("token");
    
    return res.json({
        success: true,
        message: "Logout successful",
        relogin: true
    })
})

module.exports = routes;