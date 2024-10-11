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
    console.log("req.body: ", req.body)

    // Check if status is "Done" and if the productionId exists
    if (status_string === "Done" && productionId) {
      // Fetch additional details about the production from Auphonic API
      const { data } = await axios.get(
        `https://auphonic.com/api/production/${productionId}.json`,
        {
          auth: { username: API_USERNAME, password: API_PASSWORD },
        }
      )

      // Check if the API call was successful
      if (data.status_code === 200) {
        const { metadata, output_files } = data.data

        console.log("metadata ", metadata)
        console.log("output_files ", output_files)

        // Extract the socketId from the publisher field in the metadata
        const socketId = metadata?.publisher

        if (socketId) {
          // Emit the completion event only to the specific client using socketId
          io.to(socketId).emit("enhanceAudioComplete", {
            productionId,
            output_file: output_files[0], // Send the first output file
          })
          console.log(`Sent enhanceAudioComplete event to socket ID: ${socketId}`)
        }

        // Respond to Auphonic webhook
        return res.status(200).json({
          success: true,
          data: {
            productionId,
            output_file: output_files[0], // Send the first output file in the response
          },
        })
      } else {
        // Handle cases where the Auphonic API response is not successful
        console.error("Failed to fetch production details from Auphonic", data)
        return res.status(500).json({
          success: false,
          message: "Failed to fetch production details from Auphonic.",
        })
      }
    } else {
      // Handle cases where status_string is not "Done" or productionId is missing
      console.error("Invalid request data", req.body)
      return res.status(400).json({
        success: false,
        message: "Invalid request: production ID or status is missing.",
      })
    }
  } catch (error) {
    // Catch and handle any errors during the process
    console.error("Error in /auphonic-enhance-audio route:", error)
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
