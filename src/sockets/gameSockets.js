const { Chess } = require("chess.js");
const crypto = require("crypto");

const games = new Map();      // gameId -> { chess, white, black }
const userGame = new Map();   // userId -> gameId
const onlineUsers = new Map(); // userId -> socket.id

let pendingPlayer = null;     // the socket waiting for an opponent

function buildState(chess) {
  const isCheckmate = chess.isCheckmate();
  return {
    fen: chess.fen(),
    turn: chess.turn(), // "w" or "b"
    isGameOver: chess.isGameOver(),
    isDraw: chess.isDraw(),
    winner: isCheckmate ? (chess.turn() === "w" ? "black" : "white") : null,
  };
}

module.exports = (io) => {
  io.on("connection", (socket) => {
    const { userId, username } = socket.data;
    console.log("Socket connected:", socket.id, username);

    onlineUsers.set(userId, socket.id);
    socket.join(`user:${userId}`); // for friend requests / messages later

    // ---------- MATCHMAKING ----------
    socket.on("findMatch", () => {
      console.log("finding match", username);

      // already in a game (refresh / StrictMode double emit): resend the info
      const existingId = userGame.get(userId);
      if (existingId && games.has(existingId)) {
        const game = games.get(existingId);
        const isWhite = game.white.userId === userId;
        const opponent = isWhite ? game.black : game.white;
        socket.join(existingId);
        socket.emit("matched", {
          gameId: existingId,
          color: isWhite ? "white" : "black",
          opponentUsername: opponent.username,
        });
        socket.emit("gameState", buildState(game.chess));
        return;
      }

      // drop a stale waiting player
      if (pendingPlayer && !pendingPlayer.connected) pendingPlayer = null;

      // same player emitted twice
      if (pendingPlayer && pendingPlayer.data.userId === userId) {
        pendingPlayer = socket;
        socket.emit("waitingForOpponent");
        return;
      }

      // nobody waiting: wait
      if (!pendingPlayer) {
        pendingPlayer = socket;
        socket.emit("waitingForOpponent");
        return;
      }

      // someone is waiting: create the game
      const opponentSocket = pendingPlayer;
      pendingPlayer = null;

      const gameId = crypto.randomUUID();
      const chess = new Chess();
      const white = {
        userId: opponentSocket.data.userId,
        username: opponentSocket.data.username,
      };
      const black = { userId, username };

      games.set(gameId, { chess, white, black });
      userGame.set(white.userId, gameId);
      userGame.set(black.userId, gameId);

      opponentSocket.join(gameId);
      socket.join(gameId);

      opponentSocket.emit("matched", {
        gameId,
        color: "white",
        opponentUsername: black.username,
      });
      socket.emit("matched", {
        gameId,
        color: "black",
        opponentUsername: white.username,
      });

      io.to(gameId).emit("gameState", buildState(chess));
    });

    // ---------- MOVES ----------
    socket.on("gameMove", ({ from, to }, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      const gameId = userGame.get(userId);
      const game = games.get(gameId);
      if (!game) return reply({ valid: false, reason: "No active game" });

      const { chess } = game;
      const myColor = game.white.userId === userId ? "w" : "b";
      if (chess.turn() !== myColor) {
        return reply({ valid: false, reason: "Not your turn" });
      }

      let move;
      try {
        move = chess.move({ from, to, promotion: "q" });
      } catch (e) {
        return reply({ valid: false, reason: "Illegal move" });
      }

      const state = buildState(chess);

      reply({
        valid: true,
        fen: state.fen,
        turn: state.turn,
        isCheckmate: chess.isCheckmate(),
        check: chess.inCheck(),
        captured: !!move.captured,
      });

      io.to(gameId).emit("gameState", state);

      if (state.isGameOver) {
        userGame.delete(game.white.userId);
        userGame.delete(game.black.userId);
        games.delete(gameId);
      }
    });

    // ---------- DISCONNECT ----------
    socket.on("disconnect", () => {
      if (onlineUsers.get(userId) === socket.id) onlineUsers.delete(userId);
      if (pendingPlayer && pendingPlayer.id === socket.id) pendingPlayer = null;

      const gameId = userGame.get(userId);
      const game = games.get(gameId);
      if (game) {
        socket.to(gameId).emit("opponentLeft");
        userGame.delete(game.white.userId);
        userGame.delete(game.black.userId);
        games.delete(gameId);
      }
    });
  });
};

module.exports.onlineUsers = onlineUsers;