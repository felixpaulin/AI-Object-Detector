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

async function connectESP32() {
    if (connectPromise) return connectPromise;

    // Force reset variables if they are in a broken state
    if (espWriter) {
      try { espWriter.releaseLock(); } catch(e) {}
      espWriter = null;
}
    connectPromise = (async () => {
        try {
            if (!espPort) {
                espPort = await navigator.serial.requestPort();
            }

            // Only open if the port is currently closed
            if (!espPort.readable || !espPort.writable) {
                await espPort.open({ 
                    baudRate: ESP_BAUD,
                    flowControl: "none" // FIX 1: Prevents the "CTS Holding" hardware block
                });
                
                // FIX 2: Manually "Kick" the DTR/RTS signals. 
                // This resets the ESP32 chip's write-buffer state.
                await espPort.setSignals({ dataTerminalReady: true, requestToSend: true });
            }

        if (espPort.writable && espPort.writable.locked) {
          console.warn("Stream is locked. Trying to clear...");
          // If it's locked and we don't have the active espWriter, 
          // the only way to fix it in a browser is to close and re-open the port.
          await espPort.close(); 
          await espPort.open({ baudRate: ESP_BAUD, flowControl: "none" });
          await espPort.setSignals({ dataTerminalReady: true, requestToSend: true });
}
        espWriter = espPort.writable.getWriter();
        
            console.log("ESP32 connected and ready to write.");
            console.log("Locked: ", espPort.writable.locked);
        } catch (err) {
            console.error("Connection failed:", err);
            // Reset variables so you can try again on next click
            espPort = null;
            espWriter = null;
        }
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
  console.log("Sent to ESP32:", message);
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
    console.log(label, probability);

      const bin = decideBin(label);

      if (bin !== null) {
        const message = `BIN_${bin}`;
        sendToESP32(message);
        console.log("Sent", message, "at", performance.now().toFixed(2), "ms");
      }

      currentLabel = label;

    } else {
      // reset when belt empty
      currentLabel = "empty_belt";
    }
  }

  requestAnimationFrame(detectLoop); // Run the loop again
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