/* 
  - Uses TensorFlow.js + Teachable Machine
  - No bounding box. Just classification of the whole frame.
  - Sends BIN_1 / BIN_2 / BIN_3 via Web Serial
  - Threshold = 0.7
  - Sends continuously until empty_belt is detected
*/

// ---------- DOM ----------
const video = document.getElementById("video");
const status = document.getElementById("status");
const objectList = document.getElementById("objectList");

//---------- Property simulation variable for tracking stable frames ----------
let detection = {
  label: null,
  stableFrames: 0,
  sent: false
}

const STABILITY_THRESHOLD = 7;

// ---------- MODEL ----------
let model;
const MODEL_URL = "model/model.json";
const METADATA_URL = "model/metadata.json";

// ---------- THRESHOLD ----------
const CONFIDENCE_THRESHOLD = 0.7;

// ---------- STATE ----------
let currentLabel = "empty_belt";

// ---------- ESP32 SERIAL ----------
let espPort = null;
let connectPromise = null;

const ESP_BAUD = 115200;

async function closeESP32() {
  try {
    if (espPort) {
      await espPort.close();
      espPort = null;
    }
  } catch (err) {
    console.warn("Error closing port:", err);
  }
}

async function connectESP32() {
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      if (!espPort) {
        espPort = await navigator.serial.requestPort();
      }

      if (!espPort.readable || !espPort.writable) {
        await espPort.open({
          baudRate: ESP_BAUD,
          flowControl: "none",
        });
      }

      if (espPort.writable.locked) {
        console.log("Port writable is locked (expected for active writer)");
      }

      console.log("ESP32 connected and ready.");
      console.log("Port connected?", espPort.connected);
      console.log("Port writable locked?", espPort.writable.locked);
    } catch (err) {
      console.error("Connection failed:", err);
      await closeESP32();
      throw err;
    }
  })();

  try {
    await connectPromise;
  } finally {
    connectPromise = null;
  }
}

async function sendToESP32(message) {
  try {
    //Only connect if don't have a port or it's closed
    if (!espPort || !espPort.connected) {
      await connectESP32();
    }

    //Wait for the port to actually be writable before getting the writer
    const writer = espPort.writable.getWriter();
    
    //Encode with \r\n to match your Serial.readStringUntil('\n')
    const data = new TextEncoder().encode(message + "\r\n");
    await writer.write(data);
    
    //Release the lock so the NEXT call to sendToESP32 can get a new writer
    writer.releaseLock();

    console.log(`Sent to ESP32: ${message}`);
    return true;
  } catch (err) {
    console.error("Send failed:", err);
    return false;
  }
}

// Connect on first click
document.addEventListener("click", () => {
  connectESP32().catch(err => {
    console.error("Initial serial connect failed:", err);
  });
}, { once: true });

// ---------- CAMERA ----------
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}

// ---------- LOAD MODEL ----------
async function loadModel() {
  model = await tmImage.load(MODEL_URL, METADATA_URL);
  status.innerText = "Model loaded. Detecting...";
}

// ---------- BIN DECISION ----------
function decideBin(label) {
  if (label === "paper") return 1;
  if (label === "plastic") return 2;
  if (label === "metal") return 3;
  return null;
}

// ---------- SIDEBAR UPDATE ----------
function updateSidebar(label, probability, predictions) {
  objectList.innerHTML = "";

  predictions.forEach(pred => {
    const pcal = (pred.probability * 100).toFixed(1);
    const li = document.createElement("li");
    li.textContent = `${pred.className}: ${pcal}%`;
    objectList.appendChild(li);
  });
}

//  const li = document.createElement("li");
//  li.textContent = `${label} (${(probability * 100).toFixed(1)}%)`;
//  objectList.appendChild(li);


// ---------- DETECTION LOOP ----------
async function detectLoop() {
  const predictions = await model.predict(video);

  // Find highest probability prediction
  let highest = predictions.reduce((prev, current) =>
    prev.probability > current.probability ? prev : current
  );
  
  const label = highest.className;
  const probability = highest.probability;

  updateSidebar(label, probability, predictions);

  if (probability >= CONFIDENCE_THRESHOLD) {
    if (label !== "empty_belt") {
      console.log(label, probability);
      if (label === detection.label) {
        detection.stableFrames++;
      } else {
        detection.label = label;
        detection.stableFrames = 1;
        detection.sent = false;
      }
      if (detection.stableFrames >= STABILITY_THRESHOLD && !detection.sent) {
        const bin = decideBin(label);
        const message = `BIN_${bin}`;

        if (bin !== null) {
          await sendToESP32(message);
          console.log("Sent", detection.label, message, "at", performance.now().toFixed(2), "ms");
          console.log("Stable frames:", detection.stableFrames);
          console.log("Readable/Writable:", !!espPort?.readable, !!espPort?.writable,);

          detection.sent = true;
        } else {
          return;
        }
      }
      currentLabel = label;
    } else {
      currentLabel = "empty_belt";
      detection.label = null;
      detection.stableFrames = 1;
      detection.sent = false;
    }
  }

  requestAnimationFrame(detectLoop);
}

window.testESP = async (nbBin) => {
  console.log("espPort:", espPort);
  console.log("open readable/writable:", !!espPort?.readable, !!espPort?.writable);
  const status = await sendToESP32(`BIN_${nbBin}`);
  console.log("testESP result:", status);
  return status;
};

// ---------- START ----------
async function init() {
  await startCamera();
  await loadModel();
  detectLoop();
  window.alert("Welcome, type testESP(Here put 1, 2 or 3) in the console to send a bin test to the ESP32. Note: DON'T FORGET TO CONNECT THE ESP32 YOU KNOW HOW!!!");
}

init();  