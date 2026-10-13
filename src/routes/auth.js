const express = require("express");
const prisma = require("../../lib/prisma");
const { UserSchema } = require("../validations/userValidation");
const { success } = require("zod");

const routes = express.Router();

routes.get("/login", (req, res)=>{
    return res.json({
         message: "login"
    })
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
            const newUser = await prisma.user.create({
                data: {
                    username,
                    password
                },
            })
            return res.json({
                success: true,
                user: newUser
            })
        }

       if(user){
            if(user.password === password){
                 return res.json({
                    success: true,
                    message: "Login Success"
                });
            }else{
                return res.json({
                    success: false,
                    message: "This Username is already exists"
                });
            }
       }

    }catch(err){
        return res.json({
             err
        });
    }
})

module.exports = routes;