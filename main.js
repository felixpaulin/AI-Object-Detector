// ESP32 READY:
// - Auto-connect on first click
// - sendToESP32() is the ONLY hardware interface
// - Message format: BIN_1 / BIN_2 / BIN_3
// type testESP() in the console to test sending a message to the ESP32 and the servo move.

// gets video, status and overlay info from HTML file
const video = document.getElementById("video");  
const status = document.getElementById("status");
const canvas = document.getElementById("overlay");
// for canvas drawing.
const ctx = canvas.getContext("2d");
const objectList = document.getElementById("objectList");

//detects objects in current frame
let trackedObjects = [];
//gives each object detected a unique ID
let nextId = 1;
//stores ai model
let model;
//remembers this class = this label
let learnedObjects = [];

let espSocket = new WebSocket("ws://localhost:8765");

espSocket.onopen = () => {
  console.log("Connected to ESP32 simulator");
};

espSocket.onerror = err => {
  console.error("ESP32 socket error", err);
};

let espPort = null;
let espWriter = null;
let askedForESP = false;

async function connectESP32() {
  if (askedForESP) return;
  askedForESP = true;

  try {
    espPort = await navigator.serial.requestPort();
    await espPort.open({ baudRate: 115200 });
    espWriter = espPort.writable.getWriter();

    console.log("ESP32 connected");
  } catch (err) {
    console.error("ESP32 connection failed:", err);
  }
}

document.addEventListener("click", () => {
  connectESP32();
}, { once: true });


//tracks objects from frame to frame
function distance(a, b) {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );
}

/* ---------- CAMERA ---------- */
//asnyc functions can use await to pause and wait for something like video feed or a ai model loading
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

/* ---------- LOAD AI MODEL ---------- */
async function loadModel() {
  model = await cocoSsd.load();
  status.innerText = "Model loaded. Detecting...";
}

/* ---------- MEMORY (IndexedDB) ---------- */
//saves objects learnt and saves learnt objects and shows object names (partly)
function saveMemory() {
  localStorage.setItem("learnedObjects", JSON.stringify(learnedObjects));
}
//loads what it knows to display it
function loadMemory() {
  const data = localStorage.getItem("learnedObjects");
  if (data) learnedObjects = JSON.parse(data);
}

/* ---------- OBJECT DETECTION LOOP ---------- */
async function detectLoop() {
  //looks at current frame and returns class, its confidence plus a bounding box to display
  const predictions = await model.detect(video);
  //removes old boxes to prevent stacking
  ctx.clearRect(0, 0, canvas.width, canvas.height);

console.log(
  video.videoWidth,
  video.videoHeight,
  canvas.width,
  canvas.height
);


  let updated = [];
  //filters confidence so leaves things if ai is not atleast 50% sure
  predictions.forEach(p => {
    if (p.score < 0.5) return;

   const [x, y, w, h] = p.bbox;
   const center = { x: x + w / 2, y: y + h / 2 };

    //matches objects from last frame to current frame
    let match = trackedObjects.find(o => distance(o.center, center) < 50);
    // if object is not a match it gives it a new ID and creates a new object in the script, so not physically
    if (!match) {
      match = {
        id: nextId++,
        class: p.class,
        customLabel: null,
        label: null,
        bbox: p.bbox,
        center,
        stableFrames: 1,
        locked: false,
        sent: false
      };
    } else {
      match.center = center;
      match.bbox = p.bbox;
      match.stableFrames++;
    }

    if (match.locked) return;

    updated.push(match);
    //checks if it already knows this objects label to label it on the screen.
    const memory = learnedObjects.find(o => o.class === match.class);
    if (memory && !match.label) {
      match.label = memory.label;
    }  

   // get actual display size for video
    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;

    // get real canvas size
    const drawWidth = canvas.width;
    const drawHeight = canvas.height;

    // compute scale between draw space and display space
    const scaleX = drawWidth / displayWidth;
    const scaleY = drawHeight / displayHeight;

    if (match.stableFrames < 5) return;

    if (!match.sent && match.stableFrames >= 5) {
      const bin = decideBin(match);
      sendToESP32(`BIN_${bin}`);
      match.sent = true;
  }


// ---- draw mirrored box + text ----
ctx.save();

// flip entire drawing space
ctx.translate(canvas.width, 0);
ctx.scale(-1, 1);

// draw box (mirrored)
ctx.lineWidth = 3;
ctx.strokeStyle = "lime";
ctx.strokeRect(x, y, w, h);

// draw text at same mirrored position
ctx.save();

// un-flip text so it reads normally
ctx.scale(-1, 1);

ctx.fillStyle = "blue";
ctx.font = "16px Arial";
ctx.fillText(
  `${match.id} ${match.label || match.class}`,
  -(x + w) + 4,
  y + 14
);

ctx.restore(); // restore text flip
ctx.restore(); // restore canvas


  });

    trackedObjects.forEach(oldObj => {
    const stillHere = updated.find(o => o.id === oldObj.id); 
    if (!stillHere) {
      console.log("Object has exited:", oldObj.id);
    }
  });

  trackedObjects = updated;
  updateObjectList(trackedObjects);
  requestAnimationFrame(detectLoop);
}

/* -------- Object list update function -------- */
function updateObjectList(objects) {
  //clears the sidebar
  objectList.innerHTML = "";
// uses a arrow function to write out objects on sidebar, also uses || operator to find out what to use
objects.forEach(o => {
  const li = document.createElement("li");
  li.textContent = o.label || o.class;
  objectList.appendChild(li);
});
}

/* -------- detection prompt --------- */
// makes the canvas listen for mouse clicks, used e => to verify it comes from a mouse
canvas.addEventListener("click", e => {
  const rect = canvas.getBoundingClientRect();
  // converts the coords of the canvas click to see if the click matched the screen 
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // checks if the canvas click matched the postion of a box on the screen
  const clicked = trackedObjects.find(o => {
    const [bx, by, bw, bh] = o.bbox;
    return x >= bx && x <=bx + bw &&
           y >= by && y <= by + bh;
  });

  //if it was not clicked then return
  if (!clicked) return;
  // if it was clicked the line above will allow to continue prompting the user for a name or imput which it then saves
  const label = prompt("What is this object");
  if (!label) return;

  clicked.label = label;
  clicked.locked = true;

  //Saves objects learnt
  learnedObjects.push({
    class: clicked.class,
    label
  });
  saveMemory();
});
 
// decides which bin to send the object to based on its label.
function decideBin(object) {
  if (object.label === "plastic") return 1;
  if (object.label === "paper") return 2;
  return 3;
}

async function sendToESP32(message) {

  // --- SIMULATOR MODE (WebSocket) ---
  if (typeof espSocket !== "undefined" &&
      espSocket.readyState === WebSocket.OPEN) {
    espSocket.send(message);
    return;
  }

  // --- USB MODE (ESP32) ---
  if (!espWriter) return;

  const data = new TextEncoder().encode(message + "\n");
  await espWriter.write(data);


  console.log(
   "Sent",
    message,
    "at",
    performance.now().toFixed(2),
    "ms"
);
}

window.testESP = () => {
  sendToESP32("BIN_1");
}

/* ---------- START ---------- */
// this starts the whole thing, async () => makes it beign imediatly on file open and then loads the ai memory, then loads the camera and the model, the order matters, then it starts the detecting process 
(async () => {
  loadMemory();
  await startCamera();
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  await loadModel();
  detectLoop();
})();
