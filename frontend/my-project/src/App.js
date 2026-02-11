//require("dotenv").config();
import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { Editor } from "@monaco-editor/react";
import "./App.css";

// Initialize socket connection to the backend
//const PORT = process.env.REACT_APP_PORT;
const socket = io(process.env.REACT_APP_BACKEND_URL || "/");

function App() {
  // State for room and user information
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  //   Controls whether to show:

  // join screen ❌

  // editor UI ✅
  // State for editor and language
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [executionResult, setExecutionResult] = useState(null);
  const [userInput, setUserInput] = useState("");

  // State for chat
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]); //list of messages
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); //object Object form: { socketId: username }
  const [users, setUsers] = useState([]);
  //   🔹 1️⃣ users → useState([]) (ARRAY)
  // What users represents
  // users = [
  //   { id: "socket1", username: "Jayesh" },
  //   { id: "socket2", username: "Amit" }
  // ];

  // Why an array?

  // Because you:

  // Render a list

  // Use .map()

  // Care about order

  // Reference for the messages container
  //   What typingUsers represents
  // typingUsers = {
  //   "socket1": "Jayesh",
  //   "socket2": "Amit"
  // };

  // Meaning:

  // “These users are currently typing”

  // Why an object?

  // Because you need:

  // Fast lookup

  // Easy add/remove

  // No ordering requirement
  const messagesEndRef = useRef(null);
  //   Reference to invisible div at bottom of chat

  // Used to auto-scroll when messages change
  // Available programming languages
  const languages = [
    { value: "javascript", label: "JavaScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "c", label: "C" },
    { value: "cpp", label: "C++" },
    { value: "csharp", label: "C#" },
    { value: "php", label: "PHP" },
    { value: "ruby", label: "Ruby" },
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
  ];

  // Set up socket event listeners
  useEffect(() => {
    // Handle successful room joining
    socket.on("room-joined", (data) => {
      setCode(data.code);
      setLanguage(data.language);
      setMessages(data.messages);
      setUsers(data.users);
      setIsJoined(true);
    });

    // Handle new user joining
    socket.on("user-joined", (user) => {
      setUsers((prevUsers) => [...prevUsers, user]);
    });

    // Handle user leaving
    socket.on("user-left", (user) => {
      setUsers((prevUsers) => prevUsers.filter((u) => u.id !== user.id));
      setTypingUsers((prev) => {
        const newTypingUsers = { ...prev };
        delete newTypingUsers[user.id];
        return newTypingUsers;
      });
    });

    // Handle users list update
    socket.on("users-updated", (updatedUsers) => {
      setUsers(updatedUsers);
    });

    // Handle code updates from other users
    socket.on("code-update", (newCode) => {
      setCode(newCode);
    });

    // Handle language updates
    socket.on("language-update", (newLanguage) => {
      setLanguage(newLanguage);
    });

    // Handle code execution results
    socket.on("execution-result", (result) => {
      setExecutionResult(result);
    });

    //Handle new chat messages
    socket.on("new-message", (messageData) => {
      setMessages((prevMessages) => [...prevMessages, messageData]);
    });

    // Handle typing indicators
    socket.on("user-typing", ({ userId, isTyping: typing }) => {
      setTypingUsers((prev) => {
        if (typing) {
          return {
            ...prev,
            [userId]: users.find((u) => u.id === userId)?.username || "Unknown",
          };
        } else {
          const newTypingUsers = { ...prev };
          delete newTypingUsers[userId];
          return newTypingUsers;
        }
      });
    });

    // Clean up event listeners on unmount
    return () => {
      socket.off("room-joined");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("users-updated");
      socket.off("code-update");
      socket.off("language-update");
      socket.off("execution-result");
      socket.off("new-message");
      socket.off("user-typing");
    };
  }, [users]);

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Handle joining a room
  const handleJoinRoom = () => {
    if (roomId.trim() && username.trim()) {
      socket.emit("join-room", roomId.trim(), username.trim());
    }
  }; //Sends roomId & username to backend
  //It removes whitespace from:

  // the start

  // and the end of a string
  // this ensures:
  // The input is not empty
  // User cannot join with invalid input.
  // Handle code changes
  //   socket.emit("join-room", roomId.trim(), username.trim()); does "join  room" has to be same in backend and frontend

  // Yes — 100% yes 👍
  // The event name must be exactly the same on frontend and backend.

  // 🔹 Why this is required

  // Socket.IO works on an event-based system, like this:

  // emit(eventName, data)  →  on(eventName, handler)

  // If the names don’t match, the event is simply never received.

  const handleCodeChange = (value) => {
    setCode(value);
    socket.emit("code-change", roomId, value);
  };

  // Handle language changes
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    console.log(newLanguage);
    setLanguage(newLanguage);
    socket.emit("language-change", roomId, newLanguage);
  };

  // Handle code execution
  const handleExecuteCode = () => {
    socket.emit("execute-code", roomId, code, language, userInput);
  };

  // Handle sending chat messages
  const handleSendMessage = () => {
    if (message.trim()) {
      socket.emit("send-message", roomId, message.trim());
      setMessage("");
      //Clears input
      setIsTyping(false);
      socket.emit("typing", roomId, false);
    }
  };
  // Handle typing indicators
  const handleMessageChange = (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    // Send typing indicator if user starts typing
    if (!isTyping && newMessage.trim()) {
      setIsTyping(true);
      socket.emit("typing", roomId, true);
    }

    // Send typing indicator if user stops typing
    if (isTyping && !newMessage.trim()) {
      setIsTyping(false);
      socket.emit("typing", roomId, false);
    }
  };

  // Handle Enter key press in message input
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
      //Shift+Enter → new line
    }
  };

  // Render room joining form
  if (!isJoined) {
    return (
      <div className="join-container">
        <div className="join-card">
          <h1>Collaborative Code Editor</h1>
          <div className="form-group">
            {/* <label> is an HTML element used to describe an input field.  React uses htmlFor instead of for because: for in html but for is reserved in js*/}
            <label htmlFor="roomId">Room ID</label>
            <input
              id="roomId"
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID"
            />
          </div>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>
          <button
            onClick={handleJoinRoom}
            disabled={!roomId.trim() || !username.trim()}
            // So the expression inside disabled={...} decides whether the button should be usable.
          >
            Join Room
          </button>
        </div>
      </div>
    );
  }

  // Render the main editor interface
  return (
    <div className="app-container">
      <div className="editor-container">
        <div className="editor-header">
          <div className="room-info">
            <h2>Room: {roomId}</h2>
            <div className="users-count">
              {users.length} user{users.length !== 1 ? "s" : ""} online
            </div>
          </div>
          <div className="editor-controls">
            <select value={language} onChange={handleLanguageChange}>
              {languages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                  {/* //uppar key-label bana rakhe hai */}
                </option>
              ))}
            </select>
            <button onClick={handleExecuteCode}>Run Code</button>
          </div>
        </div>

        <div className="editor-wrapper">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleCodeChange} //bcz of monaco
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        {executionResult && (
          <div
            className={`execution-result ${executionResult.success ? "success" : "error"}`}
          >
            <pre>{executionResult.output || executionResult.error}</pre>
          </div>
        )}
        {/* //shows output or error after execution */}

        <div className="input-section">
          <label htmlFor="codeInput">Input (if needed):</label>
          <textarea
            id="codeInput"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Enter input for your code (if needed)"
            rows={3}
          />
        </div>
      </div>
      {/* <pre> is an HTML tag specifically meant for displaying pre-formatted text, which is exactly why it’s used here.
        It tells the browser:

“Show this text exactly as it is written” */}

      <div className="chat-container">
        <div className="chat-header">
          <h3>Chat</h3>
          <div className="users-list">
            {users.map((user) => (
              <div key={user.id} className="user-item">
                <span
                  className={`user-status ${typingUsers[user.id] ? "typing" : ""}`}
                ></span>
                {user.username}
              </div>
            ))}
          </div>
        </div>

        <div className="messages-container">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.userId === socket.id ? "own-message" : ""}`}
            >
              <div className="message-header">
                <span className="message-username">{msg.username}</span>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="message-content">{msg.message}</div>
            </div>
          ))}

          {Object.values(typingUsers).length > 0 && (
            <div className="typing-indicator">
              {Object.values(typingUsers).join(", ")}{" "}
              {Object.values(typingUsers).length === 1 ? "is" : "are"} typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="message-input-container">
          <textarea
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            rows={2}
            //Show this textarea with space for 2 lines of text by default”
          />
          <button onClick={handleSendMessage} disabled={!message.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
