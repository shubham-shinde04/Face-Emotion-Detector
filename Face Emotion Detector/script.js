
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/";

const EMOTIONS = {
  happy:     {emoji:"😄", name:"Happy"},
  sad:       {emoji:"😢", name:"Sad"},
  angry:     {emoji:"😠", name:"Angry"},
  surprised: {emoji:"😮", name:"Surprised"},
  fearful:   {emoji:"😨", name:"Fearful"},
  disgusted: {emoji:"🤢", name:"Disgusted"},
  neutral:   {emoji:"😐", name:"Neutral"}
};

const $ = id => document.getElementById(id);
const statusEl = $("status"), emojiEl = $("emoji"), labelEl = $("label");
const photo = $("photo"), video = $("video"), overlay = $("overlay");

let modelsReady = false, mode = "photo", stream = null, loopId = null;

// build probability bars
$("bars").innerHTML = Object.entries(EMOTIONS).map(([k,v]) =>
  `<div class="bar"><span>${v.emoji}</span><span>${v.name}</span>
   <div class="track"><div class="fill" id="f_${k}"></div></div>
   <span id="p_${k}">0%</span></div>`
).join("");

async function loadModels(){
  try{
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

    modelsReady = true;

    statusEl.textContent = "Ready. Choose photo or Start Camera.";
  }catch(e){
    statusEl.textContent = "Models Not Loading . Please Check Your Internet.";
    console.error(e);
  }
}

const opts = () =>
  new faceapi.TinyFaceDetectorOptions({
    inputSize:320,
    scoreThreshold:0.4
  });

function showResult(expr){
  let best = "neutral", max = 0;

  for(const k in EMOTIONS){
    const v = expr[k] || 0;

    $("f_"+k).style.width = (v*100)+"%";
    $("p_"+k).textContent = Math.round(v*100)+"%";

    if(v > max){
      max = v;
      best = k;
    }
  }

  emojiEl.textContent = EMOTIONS[best].emoji;
  labelEl.textContent =
    EMOTIONS[best].name + " (" + Math.round(max*100) + "%)";

  return best;
}

function noFace(){
  emojiEl.textContent = "❓";
  labelEl.textContent = "Chehra sapadla nahi";

  for(const k in EMOTIONS){
    $("f_"+k).style.width="0";
    $("p_"+k).textContent="0%";
  }
}

function drawBox(det, expr, source, w, h){
  overlay.width = w;
  overlay.height = h;

  const ctx = overlay.getContext("2d");

  ctx.clearRect(0,0,w,h);

  const best = Object.keys(expr).reduce(
    (a,b) => expr[a] > expr[b] ? a : b
  );

  const b = det.box;

  ctx.strokeStyle = "#ffc247";
  ctx.lineWidth = Math.max(2, w/300);

  ctx.strokeRect(
    b.x,
    b.y,
    b.width,
    b.height
  );

  ctx.font = Math.max(24, b.width*0.35) + "px serif";
  ctx.textBaseline = "bottom";

  ctx.fillText(
    EMOTIONS[best]?.emoji || "🙂",
    b.x,
    b.y
  );
}

// ---- Photo mode ----

$("file").addEventListener("change", e => {
  const f = e.target.files[0];

  if(!f) return;

  photo.onload = analysePhoto;

  photo.src = URL.createObjectURL(f);

  photo.style.display = "block";

  $("hint").style.display = "none";
});

async function analysePhoto(){

  if(!modelsReady){
    statusEl.textContent="Models ajun load hot aahet...";
    return;
  }

  statusEl.textContent = "Chehra tapasat aahe...";

  const res = await faceapi
    .detectSingleFace(photo, opts())
    .withFaceExpressions();

  const w = photo.naturalWidth;
  const h = photo.naturalHeight;

  // canvas must match how the image is displayed (object-fit: contain)
  overlay.width = w;
  overlay.height = h;

  overlay.style.objectFit = "contain";

  if(!res){

    overlay
      .getContext("2d")
      .clearRect(0,0,w,h);

    noFace();

    statusEl.textContent =
      "Chehra sapadla nahi. Dusra photo vapra.";

    return;
  }

  showResult(res.expressions);

  drawBox(
    res.detection,
    res.expressions,
    photo,
    w,
    h
  );

  statusEl.textContent = "Zale!";
}

// ---- Camera mode ----

$("camStart").onclick = async () => {

  if(!modelsReady){
    statusEl.textContent =
      "Models ajun load hot aahet...";
    return;
  }

  try{

    stream = await navigator.mediaDevices.getUserMedia({
      video:{
        facingMode:"user"
      }
    });

  }catch(e){

    statusEl.textContent =
      "Camera permission dya (localhost kiva https var chalva).";

    return;
  }

  video.srcObject = stream;

  video.style.display = "block";

  $("hint").style.display = "none";

  video.onloadedmetadata = () => {

    statusEl.textContent =
      "Live detection chalu aahe";

    loop();
  };
};

async function loop(){

  if(!stream) return;

  const res = await faceapi
    .detectSingleFace(video, opts())
    .withFaceExpressions();

  const w = video.videoWidth;
  const h = video.videoHeight;

  if(res){

    showResult(res.expressions);

    drawBox(
      res.detection,
      res.expressions,
      video,
      w,
      h
    );

  }else{

    noFace();

    overlay
      .getContext("2d")
      .clearRect(
        0,
        0,
        overlay.width,
        overlay.height
      );
  }

  loopId = requestAnimationFrame(loop);
}

function stopCam(){

  if(loopId)
    cancelAnimationFrame(loopId);

  if(stream){
    stream
      .getTracks()
      .forEach(t => t.stop());

    stream = null;
  }

  video.style.display = "none";

  overlay
    .getContext("2d")
    .clearRect(
      0,
      0,
      overlay.width,
      overlay.height
    );
}

$("camStop").onclick = () => {

  stopCam();

  statusEl.textContent =
    "Camera band kela";
};

// ---- Tabs ----

function setMode(m){

  mode = m;

  stopCam();

  $("tabPhoto")
    .classList
    .toggle("on", m==="photo");

  $("tabCam")
    .classList
    .toggle("on", m==="cam");

  $("photoControls").style.display =
    m==="photo" ? "flex":"none";

  $("camControls").style.display =
    m==="cam" ? "flex":"none";

  photo.style.display =
    (m==="photo" && photo.src)
      ? "block"
      : "none";

  $("hint").style.display =
    (m==="photo" && photo.src)
      ? "none"
      : "block";

  overlay
    .getContext("2d")
    .clearRect(
      0,
      0,
      overlay.width,
      overlay.height
    );

  emojiEl.textContent="🙂";
  labelEl.textContent="—";
}

$("tabPhoto").onclick = () =>
  setMode("photo");

$("tabCam").onclick = () =>
  setMode("cam");

loadModels();
