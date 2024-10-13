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
        // Extract the socketId from the publisher field in the metadata
        const socketId = metadata?.publisher

        if (socketId) {
          // Download the audio file from Auphonic
          const audioFileUrl = output_files[0].download_url
          const audioFileResponse = await axios.get(audioFileUrl, {
            responseType: "arraybuffer",
            auth: { username: API_USERNAME, password: API_PASSWORD },
          })

          const audioFileBuffer = audioFileResponse.data
          const audioFileBlob = new Blob([audioFileBuffer], { type: "audio/mp3" })

          // Emit the completion event with the downloaded audio file
          io.to(socketId).emit("enhanceAudioComplete", {
            productionId,
            audioFile: audioFileBlob,
          })
          // // Emit the completion event only to the specific client using socketId
          // io.to(socketId).emit("enhanceAudioComplete", {
          //   productionId,
          //   output_file: output_files[0], // Send the first output file
          // })

          // Success Respond
          return res.status(200).json({
            success: true,
            data: {
              productionId,
              audioFile: audioFileBlob,
            },
          })
        } else {
          // Handle cases where socketId is missing
          return res.status(400).json({
            success: false,
            message: "Invalid request: socketId is missing.",
          })
        }

        // // Success Respond
        // return res.status(200).json({
        //   success: true,
        //   data: {
        //     productionId,
        //     output_file: output_files[0],
        //   },
        // })
      } else {
        // Handle cases where the Auphonic API response is not successful
        return res.status(500).json({
          success: false,
          message: "Failed to fetch production details from Auphonic.",
        })
      }
    } else {
      // Handle cases where status_string is not "Done" or productionId is missing
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

const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
