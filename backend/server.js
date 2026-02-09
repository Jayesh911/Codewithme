require("dotenv").config();
//imp
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const axios = require("axios");
const cors = require("cors");
// intialize app instance
const app = express();
app.use(cors());
//Enables CORS for all routes http ones
app.use(express.json());
// create http server and integrate with SocketIo
//Required for Socket.IO integration
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
// This is Socket.IO’s own CORS layer

// WebSockets do not use Express middleware

// Socket.IO has a separate server
// Initializes Socket.IO on the HTTP server

// Allows only requests from frontend (localhost:3000)

// Prevents unauthorized socket connections

// // store room information
const rooms = {};
// in-memory data store

// Structure example:

// rooms = {
//   room123: {
//     language: "javascript",
//     code: "...",
//     users: {
//       socketId: { username, isTyping }
//     },
//     messages: []
//   }
// }
//  Piston API configuration for code execution
const PISTON_API_URL = "https://emkc.org/api/v2/piston";

// socket.IO connection handling
//Runs every time a user connects
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle joining a room
  socket.on("join-room", (roomId, username) => {
    // Join the specified room
    socket.join(roomId);

    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {
        language: "javascript",
        code: "// Welcome to the collaborative editor!\n",
        users: {},
        messages: [],
      };
    }

    // Add user to the room
    rooms[roomId].users[socket.id] = {
      id: socket.id,
      username: username || "Anonymous",
      isTyping: false,
    };
    // Notify client that they've joined successfully
    socket.emit("room-joined", {
      roomId,
      language: rooms[roomId].language,
      code: rooms[roomId].code,
      users: Object.values(rooms[roomId].users), //cleint to baaki users bhejna
      messages: rooms[roomId].messages,
    });
    //  2️⃣ Why Object.values(rooms[roomId].users) ?
    // First look at users
    // rooms[roomId].users = {
    //   "socketId1": { username: "Jayesh", isTyping: false },
    //   "socketId2": { username: "Amit", isTyping: true }
    // };
    //};
    //This is an object, not an array.

    // Notify other users in the room that a new user has joined
    socket.to(roomId).emit("user-joined", {
      id: socket.id,
      username: rooms[roomId].users[socket.id].username,
    });

    // Send updated user list to everyone in the room
    io.to(roomId).emit("users-updated", Object.values(rooms[roomId].users));
    console.log(`User ${username} ${socket.id} joined room ${roomId}`);
  });
  // Handle code changes
  socket.on("code-change", (roomId, newCode) => {
    if (rooms[roomId]) {
      // Update the code in the room
      rooms[roomId].code = newCode;

      // Broadcast the code change to all other users in the room
      socket.to(roomId).emit("code-update", newCode);
    }
  });
  // Handle Language change
  socket.on("language-change", (roomId, newLanguage) => {
    if (rooms[roomId]) {
      // Update the language in the room
      rooms[roomId].language = newLanguage; // code remains same

      // Broadcast the language change to all users in the room
      io.to(roomId).emit("language-update", newLanguage);
    }
  });
  // Handle code execution requests
  socket.on("execute-code", async (roomId, code, language, input) => {
    console.log("code", code, language, "input", input);
    try {
      const languageMap = {
        javascript: "javascript",
        python: "python3",
        java: "java",
        c: "c",
        cpp: "c++",
        csharp: "csharp",
        php: "php",
        ruby: "ruby",
        go: "go",
        rust: "rust",
      };

      const pistonlanguage = language || "javascript";
      console.log(pistonlanguage);

      // Prepare the request to Piston API
      const response = await axios.post(`${PISTON_API_URL}/execute`, {
        language: pistonlanguage,
        version: "*",
        files: [
          {
            name: `main.${pistonlanguage}`,
            content: code,
          },
        ],
        stdin: input || "",
      });

      // Send the execution result back to the requesting client
      socket.emit("execution-result", {
        success: true,
        output: response.data.run.output,
        error: null,
      });
    } catch (error) {
      console.log(error);
      socket.emit("execution-result", {
        success: false,
        output: null,
        error:
          error.response?.data?.message ||
          error.message ||
          "Unknown error occurred",
      });
    }
  });
  //   Where did success, output, error come from?
  // Short answer

  // 👉 YOU defined them.
  // They are not built-in, not from Socket.IO, and not from the API automatically.

  // They are a custom payload structure that you chose.

  // Let’s look at the code again
  // socket.emit("execution-result", {
  //   success: true,
  //   output: response.data.run.output,
  //   error: null,
  // });

  // This object has three fields:

  // {
  //   success: true,
  //   output: "...",
  //   error: null
  // }

  // These fields are:

  // application-level data

  // your design choice

  // just a plain JavaScript object

  // 2️⃣ Why do we create fields like success, output, error?

  // Because raw API responses are messy and frontend-friendly data matters.

  // Example: API response (Judge0 / execution API)
  // {
  //   "run": {
  //     "stdout": "Hello\n",
  //     "stderr": null,
  //     "status": "Accepted"
  //   }
  // }

  // If you sent this directly:

  // Frontend must understand API internals

  // UI logic becomes complicated

  // Error handling is unclear

  // So instead, we normalize the response

  // We create a clean contract between backend and frontend:

  // {
  //   success: true,        // did execution succeed?
  //   output: "Hello",      // what to show in output panel
  //   error: null           // error message (if any)
  // }

  // This is called a DTO (Data Transfer Object) in backend design.

  // 3️⃣ Where does output come from?
  // output: response.data.run.output

  // That comes from the execution API response, for example:

  // response.data.run.output

  // You extracted:

  // Only what you need

  // In a frontend-friendly format

  // 4️⃣ Where does success come from?

  // This is your interpretation of the API result.

  // Example logic:

  // if (response.data.run.stderr) {
  //   success = false;
  // } else {
  //   success = true;
  // }

  // So:

  // success is derived, not returned

  // Makes frontend logic simpler

  // 5️⃣ Where does error come from?

  // Same idea.

  // error: null

  // or

  // error: response.data.run.stderr

  // Instead of throwing exceptions, you:

  // Send structured errors

  // Let frontend decide how to display them

  // 6️⃣ Why are we emitting the API response to a single client?

  // This is the most important part of your question.

  // Handle chat messages
  socket.on("send-message", (roomId, message) => {
    if (rooms[roomId] && rooms[roomId].users[socket.id]) {
      const username = rooms[roomId].users[socket.id].username;
      const messageData = {
        id: Date.now(),
        userId: socket.id,
        username,
        message,
        timestamp: new Date().toISOString(),
      };
      // Add message to room history
      rooms[roomId].messages.push(messageData);
      // Broadcast the message to all user in the room
      //Only users currently online would see messages

      //Anyone who joins later would see an empty chat
      io.to(roomId).emit("new-message", messageData);
    }
  });
  //   new Date().toISOString();
  // What it returns
  // "2026-01-21T08:15:23.123Z"
  // Meaning of ISO string
  // ISO 8601 format:

  // YYYY-MM-DDTHH:mm:ss.sssZ
  //   1️⃣ Do we need to specify data types when creating this object?
  // Short answer

  // 👉 No. JavaScript is dynamically typed, so you never specify types when creating objects.
  //   Why an id is needed

  // React needs a key when rendering lists

  // Helps with:

  // deleting messages

  // updating messages

  // ordering messages

  // Why Date.now() specifically?

  // Very fast

  // No extra libraries

  // Good enough for in-memory chat

  // Handle typing indicators
  socket.on("typing", (roomId, isTyping) => {
    if (rooms[roomId] && rooms[roomId].users[socket.id]) {
      // Update user's typing status
      rooms[roomId].users[socket.id].isTyping = isTyping;

      // Notify other users in the room
      socket.to(roomId).emit("user-typing", {
        userId: socket.id,
        username: rooms[roomId].users[socket.id].username,
        isTyping,
      });
    }
  }); //How do you “retrieve” it in your code?

  // You don’t fetch it from anywhere.

  // You simply access:

  // socket.id

  // Because:

  // You’re already inside the socket’s context

  // Socket.IO injected it

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    // Find which rooms the user was in iske zaroot nhi nhi hai map bana le userid-roomid
    for (const roomId in rooms) {
      if (rooms[roomId].users[socket.id]) {
        const username = rooms[roomId].users[socket.id].username;

        // Remove user from the room
        delete rooms[roomId].users[socket.id];

        // Notify other users in the room
        socket.to(roomId).emit("user-left", {
          id: socket.id,
          username,
        });

        // Send updated user list to everyone in the room
        io.to(roomId).emit("users-updated", Object.values(rooms[roomId].users));

        // Clean up empty rooms
        if (Object.keys(rooms[roomId].users).length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
