This is a browser-based AI object detector that uses a webcam to detect objects in real time and allows the user to teach the system new object by clicking on detected objects and entering the name of the object into the prompt box.

The application runs entirely on the client side using JavaScript and TensorFlow.js and only requires the user to launch the start server.bat file to open the browser in localhost.

---

Features

- Live webcam object detection
- Real-time bounding boxes and object IDs
- Object tracking across frames
- Click-to-label learning system
- Persistent memory using browser localStorage
- Visual sidebar showing names of detected objects
- Fully client-side (no backend)

---

## Technologies Used

- HTML5 & CSS
- JavaScript
- TensorFlow.js
- COCO-SSD object detection model
- Browser APIs (Webcam, Canvas, localStorage)

---

## How It Works

1. The browser accesses the webcam and displays the video feed.
2. A pre-trained AI model (COCO-SSD) detects objects in each video frame.
3. Detected objects are tracked across frames using position matching.
4. The user can click on an object and assign it a custom label.
5. Learned labels are stored locally in the browser and reused automatically.

---

## How to Run the Project Locally

Due to browser security restrictions, the project must be run using a local HTTP server.

1: Run the start-server.bat file to launch a browser window in localhost
2: Run the index.HTML file and it should launch in the browser window
3: Enjoy
