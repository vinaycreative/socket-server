const express = require("express")
const bodyParser = require("body-parser")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)

// Parse JSON body in POST requests
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

let io // Declare `io` here, but don't initialize it yet

app.get("/", (req, res) => {
  // Send response back to the client
  res.status(200).json({ success: true, message: "Server running.." })
})

// POST route that triggers the Socket.io connection
app.post("/auphoic-enhance-audio", async (req, res) => {
  const payload = req.body // Parse the payload from the request body

  console.log("Payload received:", payload)

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
