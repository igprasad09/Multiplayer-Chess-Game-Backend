const { success, date } = require("zod");
const prisma = require("../../lib/prisma");
const { onlineUsers } = require("./gameSockets");

module.exports = (io) => {
  io.on("connection", (socket) => {
    socket.on("sendFriendRequest", async (data, callback) => {
      try {
        const senderId = data.senderId;
        const friendId = data.friendId;

        const friendRequest = await prisma.friend.upsert({
          where: {
            senderId_receiverId: { senderId, receiverId: friendId },
          },
          update: { status: "PENDING" },
          create: { senderId, receiverId: friendId, status: "PENDING" },
        });

        // emitting to an empty room is harmless, so no online check needed
        io.to(`user:${friendId}`).emit("newFriendRequest", {
          senderId,
          message: "You received a friend request",
        });

        callback({
          success: true,
          message: "Friend request sent successfully",
          friendRequest,
        });
      } catch (err) {
        console.log(err);
        callback({ success: false, message: "Failed to send friend request" });
      }
    });

    socket.on("getFriendsData", async (data, callback) => {
      try {
        const userId = data.userId;

        const rows = await prisma.friend.findMany({
          where: {
            OR: [{ senderId: userId }, { receiverId: userId }],
          },
          include: {
            sender: { select: { id: true, username: true } },
            receiver: { select: { id: true, username: true } },
          },
        });

        const friends = [];
        const requests = [];
        const rejected = [];

        for (const row of rows) {
          const isSender = row.senderId === userId;
          const other = isSender ? row.receiver : row.sender;

          const item = {
            id: row.id,
            userId: other.id,
            username: other.username,
          };

          if (row.status === "ACCEPTED") {
            friends.push(item);
          } else if (row.status === "PENDING" && !isSender) {
            requests.push(item);
          } else if (row.status === "REJECTED") {
            rejected.push(item);
          }
        }

        callback({ success: true, friends, requests, rejected });
      } catch (err) {
        console.log(err);
        callback({ success: false, message: "Failed to fetch friends data" });
      }
    });

    socket.on("acceptFriendRequest", async (data, callback) => {
      const friendId = data.userId;
      const { userId } = socket.data;

      console.log("Friend ID:", friendId);
      console.log("My user ID:", userId);

      try {
        await prisma.friend.update({
          where: {
            senderId_receiverId: {
              senderId: friendId,
              receiverId: userId,
            },
          },
          data: {
            status: "ACCEPTED",
          },
        });

        io.to(`user:${friendId}`).emit("friendRequestAccepted", {
          message: "Your friend request was accepted!",
        });

        callback({
          success: true,
          message: "accepted Successfully",
        });
      } catch (error) {
        callback({
          success: false,
          message: "not able to send",
        });
      }
    });

    socket.on("rejectFriendRequest", async (data, callback) => {
      const friendId = data.userId;
      const { userId } = socket.data;
      console.log(friendId);

      try {
        
        await prisma.friend.update({
            where: {
                senderId_receiverId:{
                    senderId: friendId,
                    receiverId: userId
                },
            },
            data:{
                status: "REJECTED"
            }
        })

        callback({
          success: true,
          message: "Rejected 👍"
        });
      } catch (err) {
        callback({
            success: false,
            message: "Failed to Reject"
        })
      }
    });
  });
};
