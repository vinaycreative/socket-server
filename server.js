const axios = require("axios")
const bodyParser = require("body-parser")
const express = require("express")
const http = require("http")
const { Server } = require("socket.io")

const API_USERNAME = process.env.API_USERNAME
const API_PASSWORD = process.env.API_PASSWORD

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

/**
 * Fetches detailed production data from Auphonic's API.
 * @param {string} productionId - The unique ID of the Auphonic production.
 * @returns {Promise} - Axios response containing production data.
 */

const fetchAuphonicData = async (productionId) => {
  const config = {
    auth: { username: API_USERNAME, password: API_PASSWORD },
  }
  return await axios.get(`https://auphonic.com/api/production/${productionId}.json`, config)
}

/**
 * Downloads the audio file from a given URL.
 * @param {string} url - URL of the audio file to download.
 * @returns {Promise} - Axios response containing the audio file as a buffer.
 */
const downloadAudioFile = async (url) => {
  const config = {
    responseType: "arraybuffer",
    auth: { username: API_USERNAME, password: API_PASSWORD },
  }
  return await axios.get(url, config)
}

// Webhook endpoint that Auphonic calls when processing is complete
app.post("/auphonic-enhance-audio", async (req, res) => {
  try {
    const { uuid: productionId, status, status_string } = req.body

    // Validate the incoming webhook payload to ensure it's a successful production
    if (status_string !== "Done" || !productionId) {
      return res.status(400).json({
        success: false,
        message: "Invalid request: production ID or status is missing.",
      })
    }

    console.log(`Processing complete for production ID: ${productionId}`)

    // Fetch additional metadata and output file info from Auphonic
    const { data } = await fetchAuphonicData(productionId)
    if (data.status_code !== 200) {
      throw new Error("Failed to fetch production details from Auphonic.")
    }

    const { metadata, output_files } = data.data
    const socketId = metadata?.publisher // Retrieve the socket ID from metadata to identify the user session

    // If socketId is missing in metadata, return an error
    if (!socketId) {
      return res.status(400).json({
        success: false,
        message: "Invalid request: socketId is missing in metadata.",
      })
    }

    // Retrieve the download URL for the audio file
    const audioFileUrl = output_files[0]?.download_url
    if (!audioFileUrl) {
      return res.status(500).json({
        success: false,
        message: "Audio file URL is missing.",
      })
    }

    // Download the audio file as a buffer
    const audioFileResponse = await downloadAudioFile(audioFileUrl)

    // Emit an event to the specific client (socket ID) with the downloaded audio file
    io.to(socketId).emit("enhanceAudioComplete", {
      productionId,
      audioFile: audioFileResponse.data, // Sending audio as binary data buffer
    })

    console.log(`Emitted 'enhanceAudioComplete' to socket ID ${socketId}`)

    // Respond to Auphonic that the webhook was processed successfully
    res.status(200).json({
      success: true,
      data: { productionId },
    })
  } catch (error) {
    // Handle errors during the webhook processing
    console.error("Error processing Auphonic webhook:", error.message)
    res.status(500).json({
      success: false,
      message: "An error occurred while processing the Auphonic webhook.",
      error: error.message, // Send error details for debugging
    })
  }
})

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`Client connected with socket ID: ${socket.id}`)

  // Log a message when a client disconnects
  socket.on("disconnect", () => {
    console.log(`Client disconnected with socket ID: ${socket.id}`)
  })
})

const PORT = process.env.PORT || 3000

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
