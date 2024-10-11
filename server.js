// // server.js
// const express = require("express")
// const http = require("http")
// const { Server } = require("socket.io")
// const bodyParser = require("body-parser")

// const app = express()
// const server = http.createServer(app)

// // Initialize Socket.io
// const io = new Server(server, {
//   cors: {
//     origin: "http://localhost:3000", // Frontend URL
//     methods: ["GET", "POST"],
//   },
// })

// // Middleware to parse JSON request bodies
// app.use(bodyParser.json())

// let frontendSocket = null

// // Socket connection
// io.on("connection", (socket) => {
//   console.log("A user connected")
//   frontendSocket = socket // Save the connected socket to send messages later

//   // Handle disconnection
//   socket.on("disconnect", () => {
//     console.log("User disconnected")
//     frontendSocket = null
//   })
// })

// // POST route for /auphoic-enhance-audio
// app.post("/auphoic-enhance-audio", (req, res) => {
//   const payload = req.body
//   console.log(`Received POST request with payload:`, payload)

//   // Check if there's a connected frontend socket
//   if (frontendSocket) {
//     console.log("Sending payload to frontend via socket")
//     frontendSocket.emit("enhanceAudio", payload) // Send the payload to the frontend
//   } else {
//     console.log("No connected frontend socket to send the message.")
//   }

//   // Respond to the POST request
//   res.status(200).send("Message sent to frontend via Socket.io")
// })

// // Start the server
// server.listen(3001, () => {
//   console.log("Server is running on http://localhost:3001")
// })

const express = require("express")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)

// Parse JSON body in POST requests
app.use(express.json())

let io // Declare `io` here, but don't initialize it yet

app.get("/", (req, res) => {
  // Send response back to the client
  res.status(200).json({ success: true, message: "Server running.." })
})

// POST route that triggers the Socket.io connection
app.post("/auphoic-enhance-audio", (req, res) => {
  const payload = req.body // Parse the payload from the request body

  console.log("Payload received at /auphoic-enhance-audio:", payload)

  // Initialize the Socket.io connection (only if not already initialized)
  if (!io) {
    io = new Server(server, {
      cors: {
        origin: "*", // Adjust based on your CORS policy
        methods: ["GET", "POST"],
      },
    })

    // Setup connection listener
    io.on("connection", (socket) => {
      console.log("A client connected")

      // Handle client disconnection
      socket.on("disconnect", () => {
        console.log("A client disconnected")
      })
    })
  }

  // Emit the payload to all connected clients via Socket.io
  io.emit("enhanceAudio", payload)
  console.log("Payload emitted to clients via Socket.io")

  // Send response back to the client
  res.status(200).json({ success: true, payload })
})

const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
