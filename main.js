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
let espWriter = null;
let connectPromise = null;

const ESP_BAUD = 115200;

async function closeESP32() {
  try {
    if (espWriter) {
      await espWriter.close();
      espWriter = null;
    }
  } catch (err) {
    console.warn("Error closing writer:", err);
  }

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

      if (espPort.writable.locked && !espWriter) {
        console.warn("Writable stream locked without writer. Resetting port...");
        await closeESP32();
        espPort = await navigator.serial.requestPort();
        await espPort.open({ baudRate: ESP_BAUD, flowControl: "none" });
      }

      if (!espWriter) {
        espWriter = espPort.writable.getWriter();
      }

      console.log("ESP32 connected and ready to write.");
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
    if (!espPort || !espPort.writable) {
      await connectESP32();
    }

    if (!espWriter) {
      espWriter = espPort.writable.getWriter();
    }

    const data = new TextEncoder().encode(message + "\n");
    await espWriter.write(data);
    console.log("Sent to ESP32:", message);
  } catch (err) {
    console.error("Send failed:", err);
    await closeESP32();
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
      console.log(label, probability);
      const bin = decideBin(label);
      if (bin !== null) {
        const message = `BIN_${bin}`;
        // Only send once when high-confidence label changes
        if (currentLabel !== label) {
          await sendToESP32(message);
          console.log("Sent", message, "at", performance.now().toFixed(2), "ms");
        }
      }
      currentLabel = label;
    } else {
      currentLabel = "empty_belt";
    }
  }

  requestAnimationFrame(detectLoop);
}

window.testESP = async (nbBin) => {
  console.log("espPort:", espPort);
  console.log("espWriter:", espWriter);
  console.log("open readable/writable:", !!espPort?.readable, !!espPort?.writable);
  sendToESP32(`BIN_${nbBin}`);
};

// ---------- START ----------
async function init() {
  await startCamera();
  await loadModel();
  detectLoop();
  window.alert("Welcome, type testESP(Here put 1, 2 or 3) in the console to send a bin test to the ESP32. Note: DON'T FORGET TO CONNECT THE ESP32 YOU KNOW HOW!!!");
}

init();  