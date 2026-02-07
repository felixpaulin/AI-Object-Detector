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
// remembers this class = this label
let learnedObjects = [];

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
        label: null,
        bbox: p.bbox,
        center
      };
    } else {
      match.center = center;
      match.bbox = p.bbox;
    }
    
    updated.push(match);
    //checks if it already knows this objects label to label it on the screen.
    const memory = learnedObjects.find(o => o.class === match.class);
    if (memory && !match.label) {
      match.label = memory.label;
    }  
    // Draw box
    // draws a box around current object/s, || means that if it cannot find this then use this so in this case if it connot find match.label it uses match.class
    ctx.lineWidth = 3;
    ctx.strokeStyle = "lime";
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "Blue";
    ctx.font = "16px Arial";
    ctx.fillText(
      `${match.id} ${match.label || match.class}`,
        x + 4,
       y + 14
    );

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

  //Saves objects learnt
  learnedObjects.push({
    class: clicked.class,
    label
  });
  saveMemory();
});

/* ---------- START ---------- */
// this starts the whole thing, async () => makes it beign imediatly on file open and then loads the ai memory, then loads the camera and the model, the order matters, then it starts the detecting process 
(async () => {
  loadMemory();
  await startCamera();
  await loadModel();
  detectLoop();
})();
