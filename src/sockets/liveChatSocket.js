module.exports = (io) => {
   io.on("connection", (socket)=>{
       
       socket.on("liveGameChatForOpponent", (data)=>{
           const {text, opponentUserId, username} = data;
           console.log(data);

           io.to(`user:${opponentUserId}`).emit("liveGameChatMsgGot", {
               text,
               username
           });
       });

   });
}