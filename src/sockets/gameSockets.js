
const { Chess } = require("chess.js");
const crypto = require("crypto");

const games = new Map();
const userGame = new Map();
const onlineUsers = new Map();

let pendingPlayer = null;

module.exports = (io) => {

    io.on("connection", (socket) => {

        const userId = String(socket.data.userId);
        const username = socket.data.username;

        const room = `user_${userId}`;

        // Join personal room
        socket.join(room);

        onlineUsers.set(userId, username);

        console.log(username, "connected");


        // 1. Restore existing game

        const gameId = userGame.get(userId);
        const game = games.get(gameId);

        if (game) {

            let color = "white";
            let opponentUsername = game.blackUsername;

            if (game.black === userId) {
                color = "black";
                opponentUsername = game.whiteUsername;
            }

            socket.emit("matched", {
                gameId,
                color,
                opponentUsername
            });

            const isCheckmate = game.chess.isCheckmate();

            let winner = null;

            if (isCheckmate) {
                winner = game.chess.turn() === "w"
                    ? "black"
                    : "white";
            }

            socket.emit("gameState", {
                fen: game.chess.fen(),
                turn: game.chess.turn(),
                isCheckmate,
                isDraw: game.chess.isDraw(),
                isGameOver: game.chess.isGameOver(),
                winner
            });

        }


        // 2. Find opponent

        socket.on("findGame", () => {

            if (userGame.has(userId)) {
                socket.emit("alreadyInGame");
                return;
            }

            if (pendingPlayer && pendingPlayer.id === userId) {
                socket.emit("waitingForOpponent");
                return;
            }

            // Nobody is waiting

            if (!pendingPlayer) {

                pendingPlayer = {
                    id: userId,
                    username: username
                };

                socket.emit("waitingForOpponent");

                console.log(username, "is waiting");

                return;
            }

            // Get waiting player

            const opponent = pendingPlayer;

            // Create new chess game

            const gameId = crypto.randomUUID();
            const chess = new Chess();

            const newGame = {
                chess,
                white: opponent.id,
                black: userId,
                whiteUsername: opponent.username,
                blackUsername: username
            };

            games.set(gameId, newGame);

            userGame.set(opponent.id, gameId);
            userGame.set(userId, gameId);

            pendingPlayer = null;


            // Notify first player

            io.to(`user_${opponent.id}`).emit("matched", {
                gameId,
                color: "white",
                opponentUsername: username
            });


            // Notify second player

            io.to(room).emit("matched", {
                gameId,
                color: "black",
                opponentUsername: opponent.username
            });


            // Send initial board

            const state = {
                fen: chess.fen(),
                turn: chess.turn(),
                isCheckmate: false,
                isDraw: false,
                isGameOver: false,
                winner: null
            };

            io.to(`user_${opponent.id}`).emit("gameState", state);
            io.to(room).emit("gameState", state);

            console.log("Game created:", gameId);

        });


        // 3. Make chess move

        socket.on("gameMove", ({ from, to }, callback) => {

            const gameId = userGame.get(userId);
            const game = games.get(gameId);

            if (!game) {
                return callback?.({
                    valid: false,
                    reason: "Game not found"
                });
            }

            // Check player

            if (game.white !== userId && game.black !== userId) {
                return callback?.({
                    valid: false,
                    reason: "You are not in this game"
                });
            }

            // Check whose turn

            let myColor = "w";

            if (game.black === userId) {
                myColor = "b";
            }

            if (game.chess.turn() !== myColor) {
                return callback?.({
                    valid: false,
                    reason: "Not your turn"
                });
            }

            // Check game over

            if (game.chess.isGameOver()) {
                return callback?.({
                    valid: false,
                    reason: "Game is over"
                });
            }

            try {

                const move = game.chess.move({
                    from,
                    to,
                    promotion: "q"
                });

                const isCheckmate = game.chess.isCheckmate();

                let winner = null;

                if (isCheckmate) {
                    winner = game.chess.turn() === "w"
                        ? "black"
                        : "white";
                }

                const state = {
                    valid: true,
                    fen: game.chess.fen(),
                    turn: game.chess.turn(),
                    captured: !!move.captured,
                    check: game.chess.inCheck(),
                    isCheckmate,
                    isDraw: game.chess.isDraw(),
                    isGameOver: game.chess.isGameOver(),
                    winner
                };

                // Send updated board to both players

                io.to(`user_${game.white}`).emit("gameState", state);
                io.to(`user_${game.black}`).emit("gameState", state);

                callback?.(state);

            } catch (err) {

                callback?.({
                    valid: false,
                    reason: "Invalid move"
                });

            }

        });


        // 4. Get current game

        socket.on("getGame", (callback) => {

            const gameId = userGame.get(userId);
            const game = games.get(gameId);

            if (!game) {
                return callback?.({
                    waiting: true
                });
            }

            const isCheckmate = game.chess.isCheckmate();

            let winner = null;

            if (isCheckmate) {
                winner = game.chess.turn() === "w"
                    ? "black"
                    : "white";
            }

            callback?.({
                fen: game.chess.fen(),
                turn: game.chess.turn(),
                isCheckmate,
                isDraw: game.chess.isDraw(),
                isGameOver: game.chess.isGameOver(),
                winner
            });

        });


        // 5. Reset game

        socket.on("resetGame", (callback) => {

            const gameId = userGame.get(userId);
            const game = games.get(gameId);

            if (!game) {
                return callback?.({});
            }

            if (game.white !== userId && game.black !== userId) {
                return callback?.({});
            }

            game.chess.reset();

            const state = {
                fen: game.chess.fen(),
                turn: game.chess.turn(),
                isCheckmate: false,
                isDraw: false,
                isGameOver: false,
                winner: null
            };

            io.to(`user_${game.white}`).emit("gameState", state);
            io.to(`user_${game.black}`).emit("gameState", state);

            callback?.(state);

        });


        // 6. Disconnect

        socket.on("disconnect", async () => {

            // Check other connected devices

            const remainingSockets = await io.in(room).fetchSockets();

            if (remainingSockets.length > 0) {
                return;
            }

            onlineUsers.delete(userId);

            // Remove from waiting queue

            if (pendingPlayer && pendingPlayer.id === userId) {
                pendingPlayer = null;
            }

            // Find active game

            const gameId = userGame.get(userId);
            const game = games.get(gameId);

            if (game) {

                let opponentId = game.white;

                if (game.white === userId) {
                    opponentId = game.black;
                }

                io.to(`user_${opponentId}`).emit("opponentLeft");

                userGame.delete(userId);
            userGame.delete(opponentId);

                games.delete(gameId);

            }

            console.log(username, "disconnected");

        });

    });

};

module.exports.onlineUsers = onlineUsers;
