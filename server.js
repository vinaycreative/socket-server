const express = require("express")
const bodyParser = require("body-parser")
const http = require("http")
const axios = require("axios")
const { Server } = require("socket.io")
const API_USERNAME = "hello@shanda.studio"
const API_PASSWORD = "Harare1992!"

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// Parse JSON body in POST requests
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// Webhook endpoint that Auphonic calls when processing is done
app.post("/auphonic-enhance-audio", async (req, res) => {
  try {
    const { uuid: productionId, status } = req.body

    // Check if status is "Done" and if the productionId exists
    if (status === "Done" && productionId) {
      // Fetch additional details about the production from Auphonic API
      const { data } = await axios.get(
        `https://auphonic.com/api/production/${productionId}.json`,
        {
          auth: {
            username: API_USERNAME, // Use environment variables for API credentials
            password: API_PASSWORD,
          },
        }
      )

      // Check if the API call was successful
      if (data.status_code === 200) {
        const { metadata, output_files } = data.data
        const socketId = metadata?.publisher // Get socketId from metadata if available

        if (socketId && output_files.length > 0) {
          // Get the download URL of the first output file
          const audioFileUrl = output_files[0].download_url

          // Download the audio file from Auphonic
          const audioFileResponse = await axios.get(audioFileUrl, {
            responseType: "arraybuffer", // Get the audio file as array buffer
            auth: {
              username: API_USERNAME,
              password: API_PASSWORD,
            },
          })

          const audioFileBuffer = Buffer.from(audioFileResponse.data)

          // Emit the audio file buffer to the client via socket.io
          const socket = io.sockets.sockets.get(socketId) // Fetch the socket by ID
          if (socket) {
            socket.emit("enhanceAudioComplete", {
              productionId,
              audioFile: audioFileBuffer, // Send the audio file buffer
            })
            console.log(`Audio sent via socket`)
            return res.status(200).json({
              success: true,
              data: {
                productionId,
                audioFile: "Audio sent via socket", // Indicate the audio was sent via socket
              },
            })
          } else {
            // Handle cases where the socket is not found (client may have disconnected)
            console.log(`Client with socketId ${socketId} not found.`)
            return res.status(404).json({
              success: false,
              message: `Client with socketId ${socketId} not found.`,
            })
          }
        } else {
          // Handle missing socketId or output files
          return res.status(400).json({
            success: false,
            message: "Invalid request: socketId is missing or no output files.",
          })
        }
      } else {
        // Handle cases where the Auphonic API response is not successful
        return res.status(500).json({
          success: false,
          message: "Failed to fetch production details from Auphonic.",
        })
      }
    } else {
      // Handle cases where status is not "Done" or productionId is missing
      return res.status(400).json({
        success: false,
        message: "Invalid request: production ID or status is missing.",
      })
    }
  } catch (error) {
    // Catch and handle any errors during the process
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing the Auphonic webhook.",
      error: error.message, // Send error details for debugging
    })
  }
})

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log("A client connected:", socket.id)

  socket.on("disconnect", () => {
    console.log("A client disconnected:", socket.id)
  })
})

const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
