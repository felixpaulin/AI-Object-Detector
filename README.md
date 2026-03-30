This is a browser-based AI object detector that uses a webcam to classify objects to send them to a ESP32, This is for a AI sorting system made for the Vienna International Science and Engineering Fair.

The AI object detector runs entirely on the client side using JavaScript and TensorFlow.js and only requires the user to launch the start-server.bat file to open the browser in localhost.

---

Note: the esp32_sim.py file is for testing, if you want to use it then launch it using python from the folder in file explorer. The console in the browser will show error if the esp32_sim isnt running but it will not cause errors with the detection or the model itself.

Features

- Live webcam object classification
- Click-to-connect webSerial connection system
- Visual sidebar showing names of detected objects
- Fully client-side (no backend)
- Low resource usage

---

## Technologies Used

- HTML5 & CSS
- JavaScript
- TensorFlow.js
- Teachable Machine image classification
- Browser APIs (Webcam, Canvas, WebSerial)

---

## How It Works

1. The browser accesses the webcam and displays the video feed.
2. A custom-trained AI model (Teachable Machine) classifies objects in each video frame.
3. To connect to the ESP32 via Webserial click on the screen to open your browsers serial port connect menu, connect from there.
---

## How to Run the Project Locally

Due to browser security restrictions, the project must be run using a local HTTP server.

1: Run the start-server.bat file to launch a browser window in localhost
2: The batch file will also automatically start the ai detector
3: Enjoy (Note: Model is a custom trained clasification model that is trained under certain conditions, it will not correctyl classify objects that it is not trained on.
