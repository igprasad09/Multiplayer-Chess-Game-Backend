const prisma = require("../../lib/prisma");

module.exports = (io) => {
  io.on("connection", (socket) => {

    socket.on("sendMessage", async (data, callback) => {
      const { receverId, senderId, text } = data;
      console.log({ receverId, senderId, text });

      try {
        await prisma.message.create({
          data: {
            receiverId: receverId,
            senderId,
            content: text,
          },
        });

        io.to(`user:${receverId}`).emit("gotMessage", {
               message: text
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

    

  });
};
