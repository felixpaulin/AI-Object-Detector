/* 
  TEACHABLE MACHINE VERSION
  - Uses TensorFlow.js + Teachable Machine
  - No bounding boxes
  - No tracking
  - Sends BIN_1 / BIN_2 / BIN_3 via Web Serial
  - Threshold = 0.7
  - Sends continuously until empty_belt is detected
*/

// ---------- DOM ----------
const video = document.getElementById("video");
const status = document.getElementById("status");
const objectList = document.getElementById("objectList");

// ---------- MODEL ----------
let model;
const MODEL_URL = "model/model.json";
const METADATA_URL = "model/metadata.json";

// ---------- CONFIG ----------
const CONFIDENCE_THRESHOLD = 0.7;

// ---------- STATE ----------
let currentLabel = "empty_belt";

// ---------- ESP32 SERIAL ----------
let espPort = null;
let espWriter = null;
let connectPromise = null;

const ESP_BAUD = 9600;

async function connectESP32() {
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    if (!espPort) {
      espPort = await navigator.serial.requestPort();
    }

    if (!espPort.readable || !espPort.writable) {
      await espPort.open({ baudRate: ESP_BAUD });
    }

    if (!espWriter) {
      espWriter = espPort.writable.getWriter();
    }

    console.log("ESP32 connected.");
  })();

  try {
    await connectPromise;
  } catch (err) {
    console.error("ESP connection failed:", err);
    espWriter = null;
    espPort = null;
    throw err;
  } finally {
    connectPromise = null;
  }
}

// Connect on first click
document.addEventListener("click", () => {
  connectESP32();
}, { once: true });

// ---------- SEND FUNCTION ----------
function sendToESP32(message) {
  if (!espWriter) return;

  const data = new TextEncoder().encode(message + "\n");
  espWriter.write(data);
}

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
function updateSidebar(label, probability) {
  objectList.innerHTML = "";

  const li = document.createElement("li");
  li.textContent = `${label} (${(probability * 100).toFixed(1)}%)`;
  objectList.appendChild(li);
}

// ---------- DETECTION LOOP ----------
async function detectLoop() {
  const predictions = await model.predict(video);

  // Find highest probability prediction
  let highest = predictions.reduce((prev, current) =>
    prev.probability > current.probability ? prev : current
  );

  const label = highest.className;
  const probability = highest.probability;

  updateSidebar(label, probability);

  if (probability >= CONFIDENCE_THRESHOLD) {
    if (label !== "empty_belt") {

      const bin = decideBin(label);

      if (bin !== null) {
        sendToESP32(`BIN_${bin}`);
        console.log("Sent:", `BIN_${bin}`);
      }

      currentLabel = label;

    } else {
      // reset when belt empty
      currentLabel = "empty_belt";
    }
  }

  requestAnimationFrame(detectLoop);
}

// ---------- START ----------
async function init() {
  await startCamera();
  await loadModel();
  detectLoop();
  window.alert("Welcome, Press m to switch between filtered mode where only certain objects will be detected and all mode where any object will by detected if possible., type testESP(Here put 1, 2 or 3) to send a bin test to the ESP32. Type resetLearning() to reset all labels. Note: DON'T FORGET TO CONNECT THE ESP32 YOU KNOW HOW!!!");
}

init();  