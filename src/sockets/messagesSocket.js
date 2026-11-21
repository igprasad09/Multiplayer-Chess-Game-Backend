const prisma = require("../../lib/prisma");

module.exports = (io) => {
  io.on("connection", (socket) => {

    socket.on("sendMessage", async (data, callback) => {
      const { receverId, senderId, text } = data;
      console.log({ receverId, senderId, text });

      try {
        const result = await prisma.message.create({
            data: {
              receiverId: receverId,
              senderId,
              content: text,
            },
            include: {
              receiver: true,
            },
          });

        io.to(`user:${receverId}`).emit("gotMessage", {
               message: text,
               username: result.receiver.username
        });

        callback({
          success: true,
          message: "i got the message",
        });
      } catch (error) {
        callback({
          success: false,
          message: "not receved the message",
        });
      }
    });

    socket.on("allMessagesOfThisUser", async (data, callback) => {
      const { friendId, myId } = data;

      try {
        const allMessages = await prisma.message.findMany({
          where: {
            OR: [
              {
                senderId: myId,
                receiverId: friendId,
              },
              {
                senderId: friendId,
                receiverId: myId,
              },
            ],
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        callback({
          success: true,
          messages: allMessages,
        });
      } catch (error) {
        callback({
          success: false,
          messages: "not receved the message",
        });
      }
    });

    
    socket.on("sendMessageToUnknown", async (body, callback)=>{
         const {receverUsername, composeText} = body;
         const senderId = socket.data.userId;

         try {
            
            const receiver = await prisma.user.findUnique({
               where: {
                  username: receverUsername
               },
               select: {
                  id: true,
                  username: true
               }
            });

            if(!receiver){
              return callback({
                success: false,
                message: "User not found"
              });
            }

            if(receiver.id === senderId){
               return callback({
                  success: false,
                  message: "You cannot message yourself"
               });
            }

            const newMessage = await prisma.message.create({
                data: {
                  senderId: senderId,
                  receiverId: receiver.id,
                  content: composeText
                },
            });

            io.to(`user:${receiver.id}`).emit("gotMessage", {
                  message: newMessage.content
            });

            callback({
               success: true,
               message: "message sended👍"
            });
         } catch (error) {
            callback({
                success: false,
                message: "not able to send the message"
             });
         }

    });

    socket.on("allUnknownUsers", async (data, callback) => {
        const myId = socket.data.userId;
        const { friendIds } = data; // ids of my friends, sent from the frontend

        try {
          // all messages where I am sender or receiver
          const messages = await prisma.message.findMany({
            where: {
              OR: [{ senderId: myId }, { receiverId: myId }],
            },
            select: { senderId: true, receiverId: true },
          });

          // collect the other person's id from each message
          const otherIds = new Set();
          messages.forEach((msg) => {
            otherIds.add(msg.senderId === myId ? msg.receiverId : msg.senderId);
          });

          // remove my friends, so only unknown users are left
          friendIds.forEach((id) => otherIds.delete(Number(id)));

          const users = await prisma.user.findMany({
            where: { id: { in: [...otherIds] } },
            select: { id: true, username: true },
          });

          callback({
            success: true,
            users: users.map((user) => ({ userId: user.id, username: user.username })),
          });
        } catch (error) {
          callback({ success: false, users: [] });
        }
      });

      socket.on("unreadCounts", async(data, callback)=>{
          const myId = socket.data.userId;

          try {
            const result = await prisma.message.groupBy({
                by: ["senderId"],
                where: { receiverId: myId, isRead: false },
                _count: {id: true}
            });

            const counts = {};
            result.forEach((row) => {
               counts[row.senderId] = row._count.id;
            });

            callback({success: true, counts});
          } catch (error) {
            callback({ success: false, counts: {} });
          }
      });


      socket.on("markAsRead", async (data, callback)=>{
          const myId = socket.data.userId;
          const { friendId } = data;

          try {
            await prisma.message.updateMany({
              where: {senderId: friendId, receiverId: myId, isRead: false},
              data: { isRead: true }
            });

            callback({success: true});
          } catch (error) {
            callback({success: false})
          }
      });
    

  });
};
