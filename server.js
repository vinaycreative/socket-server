const { default: axios } = require("axios")
const bodyParser = require("body-parser")
const express = require("express")
const http = require("http")
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
    const { uuid: productionId, status, status_string } = req.body

    console.log("Received webhook from Auphonic:", req.body)

    // Check if status is "Done" and if the productionId exists
    if (status_string === "Done" && productionId) {
      console.log(`Processing complete for production ID: ${productionId}`)

      // Fetch additional details about the production from Auphonic API
      const { data } = await axios.get(
        `https://auphonic.com/api/production/${productionId}.json`,
        {
          auth: { username: API_USERNAME, password: API_PASSWORD },
        }
      )

      console.log("Auphonic production data fetched:", data)

      // Check if the API call was successful
      if (data.status_code === 200) {
        const { metadata, output_files } = data.data

        // Extract the socketId from the publisher field in the metadata
        const socketId = metadata?.publisher
        console.log("Socket ID from metadata:", socketId)

        if (socketId) {
          // Download the audio file from Auphonic
          const audioFileUrl = output_files[0].download_url
          console.log("Audio file URL:", audioFileUrl)

          const audioFileResponse = await axios.get(audioFileUrl, {
            responseType: "arraybuffer",
            auth: { username: API_USERNAME, password: API_PASSWORD },
          })

          const audioFileBuffer = audioFileResponse.data

          // Emit the completion event with the downloaded audio file
          io.to(socketId).emit("enhanceAudioComplete", {
            productionId,
            audioFile: audioFileBuffer, // Sending the audio buffer
          })

          console.log(`Emitted 'enhanceAudioComplete' event to socket ID ${socketId}`)

          // Success response
          return res.status(200).json({
            success: true,
            data: {
              productionId,
            },
          })
        } else {
          console.error("Socket ID is missing in metadata")
          return res.status(400).json({
            success: false,
            message: "Invalid request: socketId is missing.",
          })
        }
      } else {
        console.error("Failed to fetch production details from Auphonic.")
        return res.status(500).json({
          success: false,
          message: "Failed to fetch production details from Auphonic.",
        })
      }
    } else {
      console.error("Invalid request: production ID or status is missing.")
      return res.status(400).json({
        success: false,
        message: "Invalid request: production ID or status is missing.",
      })
    }
  } catch (error) {
    console.error("Error processing Auphonic webhook:", error)
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing the Auphonic webhook.",
      error: error.message, // Send error details for debugging
    })
  }
})

io.on("connection", (socket) => {
  console.log(`New client connected with socket ID: ${socket.id}`)

  socket.on("disconnect", () => {
    console.log(`Client disconnected with socket ID: ${socket.id}`)
  })
})

const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
