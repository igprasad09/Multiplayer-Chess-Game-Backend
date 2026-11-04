
const { Chess } = require("chess.js");
const crypto = require("crypto");

const games = new Map(); // gameId -> chess game and players
const userGame = new Map(); // userId -> gameId
let pendingPlayer = null; // player waiting for an opponent

module.exports = (io) => {

    io.on("connection", (socket) => {

        const userId = socket.data.userId;
        const username = socket.data.username;
        const room = `user_${userId}`;

        // 1. Join personal room
        socket.join(room);


        // 2. Restore existing game after reconnecting
        const gameId = userGame.get(userId);
        const game = games.get(gameId);

        if (game) {
            const isWhite = game.white === userId;

            socket.emit("matched", {
                gameId,
                color: isWhite ? "white" : "black",
                username,
                opponentUsername: isWhite
                    ? game.blackUsername
                    : game.whiteUsername
            });

            socket.emit("gameState", {
                fen: game.chess.fen(),
                turn: game.chess.turn(),
                isGameOver: game.chess.isGameOver()
            });
        }


        // 3. Find an opponent
        socket.on("findGame", () => {

            if (userGame.has(userId)) {
                socket.emit("alreadyInGame");
                return;
            }

            if (pendingPlayer?.id === userId) {
                socket.emit("waitingForOpponent");
                return;
            }

            // Nobody is waiting
            if (!pendingPlayer) {
                pendingPlayer = { id: userId, username };

                socket.emit("waitingForOpponent");
                return;
            }

            // Create a game with the waiting player
            const opponent = pendingPlayer;
            const gameId = crypto.randomUUID();
            const chess = new Chess();

            const game = {
                chess,
                white: opponent.id,
                black: userId,
                whiteUsername: opponent.username,
                blackUsername: username
            };

            games.set(gameId, game);

            userGame.set(opponent.id, gameId);
            userGame.set(userId, gameId);

            pendingPlayer = null;

            // Notify both players
            io.to(`user_${opponent.id}`).emit("matched", {
                gameId,
                color: "white",
                username: opponent.username,
                opponentUsername: username
            });

            io.to(room).emit("matched", {
                gameId,
                color: "black",
                username,
                opponentUsername: opponent.username
            });

            // Send initial board
            const state = {
                fen: chess.fen(),
                turn: chess.turn(),
                isGameOver: false
            };

            io.to(`user_${opponent.id}`).emit("gameState", state);
            io.to(room).emit("gameState", state);

        });


        // 4. Make a chess move
        socket.on("gameMove", ({ from, to }, callback) => {

            const game = games.get(userGame.get(userId));

            if (!game) {
                return callback?.({ valid: false });
            }

            const myColor = game.white === userId ? "w" : "b";

            if (game.chess.turn() !== myColor) {
                return callback?.({
                    valid: false,
                    reason: "Not your turn"
                });
            }

            try {

                const move = game.chess.move({
                    from,
                    to,
                    promotion: "q"
                });

                const state = {
                    valid: true,
                    fen: game.chess.fen(),
                    turn: game.chess.turn(),
                    captured: !!move.captured,
                    check: game.chess.inCheck(),
                    isCheckmate: game.chess.isCheckmate(),
                    isDraw: game.chess.isDraw(),
                    isGameOver: game.chess.isGameOver()
                };

                // Update both players
                io.to(`user_${game.white}`).emit("gameState", state);
                io.to(`user_${game.black}`).emit("gameState", state);

                callback?.(state);

            } catch (err) {
                callback?.({ valid: false });
            }

        });


        // 5. Get current game state
        socket.on("getGame", (callback) => {

            const game = games.get(userGame.get(userId));

            if (!game) {
                return callback?.({ waiting: true });
            }

            callback?.({
                fen: game.chess.fen(),
                turn: game.chess.turn(),
                isGameOver: game.chess.isGameOver()
            });

        });


        // 6. Reset game
        socket.on("resetGame", (callback) => {

            const game = games.get(userGame.get(userId));

            if (!game) {
                return callback?.({});
            }

            game.chess.reset();

            const state = {
                fen: game.chess.fen(),
                turn: game.chess.turn()
            };

            io.to(`user_${game.white}`).emit("gameState", state);
            io.to(`user_${game.black}`).emit("gameState", state);

            callback?.(state);

        });


        // 7. Handle disconnect
        socket.on("disconnect", async () => {

            // Check whether another device is still connected
            const remaining = await io.in(room).fetchSockets();

            if (remaining.length > 0) return;

            // Remove from waiting queue
            if (pendingPlayer?.id === userId) {
                pendingPlayer = null;
            }

            // End the current game
            const gameId = userGame.get(userId);
            const game = games.get(gameId);

            if (game) {

                const opponentId =
                    game.white === userId ? game.black : game.white;

                io.to(`user_${opponentId}`).emit("opponentLeft");

                userGame.delete(userId);
                userGame.delete(opponentId);

                games.delete(gameId);
            }

        });

    });

};
