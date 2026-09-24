/* =========================================================================
   Everything below this line is the engine — you shouldn't need to edit it.
   ========================================================================= */
(function(){
  // ---- resolve customer id from URL ----
  const params = new URLSearchParams(location.search);
  const customerId = params.get('id')
  

 const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

function applyTemplateData(payload){
  if(!payload || typeof payload !== "object") return;

  const recipientName = payload.recipientName || CONFIG.friendName;
  const values = Array.isArray(payload.values) ? payload.values : [];
  const media = Array.isArray(payload.media) ? payload.media : [];
  const memoryMedia = media.filter(item =>
    item && item.field_key === "memory_photos" && item.signed_url
  );
  const mainMedia = media.find(item =>
    item && ["main_photo", "cover_photo", "profile_photo"].includes(item.field_key) &&
    item.signed_url
  );

  CONFIG.friendName = recipientName;
  CONFIG.mediaAssets = media.filter(item => item && item.signed_url);
  CONFIG.memoryAssets = memoryMedia.length
    ? memoryMedia
    : CONFIG.mediaAssets;

  const valueFor = (key) => {
    const item = values.find(value => value && value.field_key === key);
    if(!item) return "";
    if(item.value_text != null) return String(item.value_text);
    if(item.value_number != null) return String(item.value_number);
    if(item.value_boolean != null) return item.value_boolean ? "Yes" : "No";
    if(item.value_date != null) return String(item.value_date);
    return item.value_json == null ? "" : String(item.value_json);
  };

  const message = valueFor("special_message") ||
    payload.message ||
    CONFIG.letterBody.join(" ");
  CONFIG.letterBody = [message];
  CONFIG.songUrl = payload.music?.signed_url || "";

  const customerNameElement = document.getElementById("customerName");
  if(customerNameElement){
    customerNameElement.textContent = `Hey ${recipientName} ❤️`;
  }

  const finalName = document.getElementById("finalName");
  if(finalName){
    finalName.innerHTML = `Happy Birthday<br>${recipientName}! 🎂❤️`;
  }

  renderLetter();

  if(mainMedia){
    const mainImage = document.getElementById("specialImg") ||
      document.getElementById("foreverImg");
    if(mainImage) mainImage.src = mainMedia.signed_url;
  }

  if(CONFIG.songUrl){
    const audio = document.getElementById("bgm");
    if(audio) audio.src = CONFIG.songUrl;
  }

  if(CONFIG.memoryAssets.length){
    const uploadedUrls = CONFIG.memoryAssets.map(item => item.signed_url);
    const imageElements = Array.from(document.querySelectorAll(
      ".carousel img, #specialImg, #foreverImg"
    ));
    imageElements.forEach((image, index) => {
      image.src = uploadedUrls[index % uploadedUrls.length];
      image.onerror = null;
    });
  }
}

window.addEventListener("message", event => {
  if(event.origin !== window.location.origin) return;
  if(event.data?.type !== "surprizyy-template-data") return;
  applyTemplateData(event.data.payload);
});

async function loadCustomerName(){
  if(!customerId){
    showExpired();
    return false;
  }

  const { data: customer, error } = await supabaseClient.rpc(
    "get_customer",
    { p_customer_id: customerId }
  );

  if(error){
    console.error("Customer validation error:", error);
    showExpired();
    return false;
  }

  if(!customer){
    showExpired();
    return false;
  }

  const nameElement = document.getElementById("customerName");

  if(nameElement && customer.customer_name){
    nameElement.textContent = `Hey ${customer.customer_name} ❤️`;
    CONFIG.friendName = customer.customer_name;
  }

  return true;
}

function showExpired(){
  document.body.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      padding:30px;
      font-family:Arial,sans-serif;
      background:#fff5fa;
      color:#6b4b5b;
    ">
      <div>
        <div style="font-size:50px;">💌</div>
        <h1>This surprise isn't available</h1>
        <p>The link may be invalid or expired.</p>
      </div>
    </div>
  `;
}
if(params.get("hosted") === "1"){
  renderLetter();
}else{
  loadCustomerName().then(valid => {
    if(valid){
      renderLetter();
    }
  });
}

async function fileUrl(name){
  const mediaAssets = CONFIG.mediaAssets || [];
  const memoryAssets = CONFIG.memoryAssets || [];
  const assetIndex = Number.parseInt(String(name).match(/\d+/)?.[0] || "1", 10) - 1;
  const preferredAssets = name.startsWith("W") || name.startsWith("M") ||
    name.startsWith("O") || name.startsWith("S")
    ? memoryAssets
    : mediaAssets;
  const mappedAsset = preferredAssets[assetIndex];
  if(mappedAsset?.signed_url){
    return mappedAsset.signed_url;
  }

  const path = `${CONFIG.basePath}/${customerId}/${name}`;

  const { data, error } = await supabaseClient.storage
    .from(CONFIG.bucket)
    .createSignedUrl(path, 3600);

  if(error){
    console.error("Supabase file error:", error);
    return null;
  }

  return data.signedUrl;
}



// Intentionally left without a helper, because the file loader is already used directly.

  // cute inline placeholder so the demo never looks "broken" before real
  // photos are uploaded to Supabase — shows on any image load error.
  function placeholderSvg(label){
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='#ffd6ea'/><stop offset='1' stop-color='#c9e7ff'/>
      </linearGradient></defs>
      <rect width='300' height='300' fill='url(#g)'/>
      <text x='50%' y='46%' font-size='44' text-anchor='middle' font-family='sans-serif'>📷</text>
      <text x='50%' y='68%' font-size='16' text-anchor='middle' fill='#7a5a68' font-family='sans-serif'>${label}</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  async function safeImg(img, name){
  if(!img) return;

  img.loading = "lazy";

  img.onerror = function(){
    img.onerror = null;
    img.src = placeholderSvg(name);
  };

  const url = await fileUrl(name);

  if(url){
    img.src = url;
  } else {
    img.src = placeholderSvg(name);
  }
}

  // ---------------- PARTICLES ----------------
  const EMOJI_SET = ["💕","✨","🌸","⭐️","🦋","💛","🌷","💫"];
  function spawnParticles(){
    const layer = document.getElementById('particles');
    layer.innerHTML = "";
    const count = window.innerWidth < 480 ? 16 : 22;
    for(let i=0;i<count;i++){
      const s = document.createElement('span');
      s.className = 'particle';
      s.textContent = EMOJI_SET[i % EMOJI_SET.length];
      const left = Math.random()*100;
      const dur = 9 + Math.random()*8;
      const delay = Math.random()*-dur;
      const size = 12 + Math.random()*14;
      const drift = (Math.random()*60-30).toFixed(0)+"px";
      s.style.left = left+"%";
      s.style.fontSize = size+"px";
      s.style.animationDuration = dur+"s";
      s.style.animationDelay = delay+"s";
      s.style.setProperty('--drift', drift);
      s.style.setProperty('--spin', (Math.random()*360).toFixed(0)+'deg');
      layer.appendChild(s);
    }
  }
  spawnParticles();

  // static twinkle stars for the night page
  (function(){
    const wrap = document.getElementById('starsStatic');
    for(let i=0;i<28;i++){
      const s = document.createElement('span');
      s.textContent = Math.random()>.5 ? "✦" : "⭐️";
      s.style.left = Math.random()*100+"%";
      s.style.top = Math.random()*70+"%";
      s.style.fontSize = (6+Math.random()*10)+"px";
      s.style.opacity = (0.3+Math.random()*0.7).toFixed(2);
      wrap.appendChild(s);
    }
  })();

  // ---------------- CAROUSELS ----------------
  function buildCarousel(containerId, prefix, count, ext, captionPrefixLabel){
    const el = document.getElementById(containerId);
    el.innerHTML = `<button class="car-arrow left">‹</button>
                     <div class="car-track"></div>
                     <button class="car-arrow right">›</button>`;
    const track = el.querySelector('.car-track');
    let items = [];
    for(let i=1;i<=count;i++){
      const item = document.createElement('div');
      item.className = 'car-item';
      const rot = (Math.random()*10-5).toFixed(1);
      item.innerHTML = `<div class="polaroid" style="transform:rotate(${rot}deg)">
                           <img>
                           <div class="cap">${captionPrefixLabel} ${i}</div>
                         </div>`;
      safeImg(item.querySelector('img'), `${prefix}${i}.${ext}`);
      track.appendChild(item);
      items.push(item);
    }
    let current = 0;
    function render(){
      items.forEach((item,i)=>{
        const offset = i - current;
        const abs = Math.abs(offset);
        const tx = offset*78;
        const scale = Math.max(1 - abs*0.18, 0.55);
        const rotY = offset*-16;
        const z = 100 - abs*10;
        const op = abs>2 ? 0 : 1 - abs*0.22;
        item.style.transform = `translateX(${tx}px) scale(${scale}) rotateY(${rotY}deg)`;
        item.style.zIndex = z;
        item.style.opacity = op;
        item.style.pointerEvents = abs>2 ? 'none' : 'auto';
      });
    }
    function go(delta){ current = (current+delta+count)%count; render(); }
    el.querySelector('.car-arrow.left').addEventListener('click', ()=>go(-1));
    el.querySelector('.car-arrow.right').addEventListener('click', ()=>go(1));
    // swipe / drag — horizontal gesture flips photos (mobile + trackpad drag)
    let startX=null;
    track.addEventListener('touchstart', e=>{ startX = e.touches[0].clientX; }, {passive:true});
    track.addEventListener('touchend', e=>{
      if(startX===null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if(Math.abs(dx)>40) go(dx<0?1:-1);
      startX=null;
    });
    let dragging=false, dragStartX=0;
    track.addEventListener('pointerdown', e=>{ dragging=true; dragStartX=e.clientX; });
    window.addEventListener('pointerup', e=>{
      if(!dragging) return; dragging=false;
      const dx = e.clientX-dragStartX;
      if(Math.abs(dx)>40) go(dx<0?1:-1);
    });
    // mouse wheel over the album flips photos (laptop/desktop) — and is kept
    // from bubbling up so it never also flips the whole page underneath it.
    let carWheelLock = false;
    el.addEventListener('wheel', function(e){
      e.stopPropagation();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if(Math.abs(delta) < 10) return;
      e.preventDefault();
      if(carWheelLock) return;
      carWheelLock = true;
      go(delta > 0 ? 1 : -1);
      setTimeout(()=>{ carWheelLock = false; }, 320);
    }, {passive:false});
    render();
    return { next: ()=>go(1), prev: ()=>go(-1) };
  }
  // Update 1
  // ============================================================
// ALBUM 2 ONLY — CHAOS SCRAPBOOK CAROUSEL
// ============================================================
function buildChaosScrapbook(containerId, prefix, count, ext){

  const el = document.getElementById(containerId);

  el.innerHTML = `
    <div class="chaos-bg-sticker sticker-camera">📸</div>
    <div class="chaos-bg-sticker sticker-plane">✈️</div>
    <div class="chaos-bg-sticker sticker-heart">💗</div>
    <div class="chaos-bg-sticker sticker-cat">🐱</div>
    <div class="chaos-bg-sticker sticker-flower">🌸</div>
    <div class="chaos-bg-sticker sticker-star">⭐</div>

    <div class="chaos-note note-left">
      Silly<br>heads 😭
    </div>

    <div class="chaos-note note-right">
      BEST<br>FRIENDS<br>FOREVER 💕
    </div>

    <div class="chaos-message message-top">
      life is better<br>when it's messy ✨
    </div>

    <div class="chaos-doodle doodle-1">♡</div>
    <div class="chaos-doodle doodle-2">♡</div>
    <div class="chaos-doodle doodle-3">✦</div>
    <div class="chaos-doodle doodle-4">〰</div>

    <div class="chaos-photo-stage">
      <button class="car-arrow left chaos-arrow">‹</button>

      <div class="chaos-photo-slot slot-tl"></div>
      <div class="chaos-photo-slot slot-tr"></div>
      <div class="chaos-photo-slot slot-bl"></div>
      <div class="chaos-photo-slot slot-br"></div>

      <div class="chaos-main-photo"></div>

      <button class="car-arrow right chaos-arrow">›</button>
    </div>

    <div class="chaos-photo-caption">
      this is chaos. 😂
    </div>
  `;

  const stage = el.querySelector(".chaos-photo-stage");
  const main = el.querySelector(".chaos-main-photo");

  const slots = {
    tl: el.querySelector(".slot-tl"),
    tr: el.querySelector(".slot-tr"),
    bl: el.querySelector(".slot-bl"),
    br: el.querySelector(".slot-br")
  };

  const positions = ["tl", "tr", "bl", "br"];

  const photos = [];

  for(let i = 1; i <= count; i++){

    const photo = document.createElement("div");

    photo.className = "chaos-photo";

    photo.innerHTML = `
      <div class="chaos-tape"></div>

      <div class="chaos-photo-paper">
        <img>
      </div>

      <span class="chaos-mini-sticker">
        ${["💗","✨","🌸","😭","🫶"][i-1] || "💗"}
      </span>
    `;

    safeImg(
      photo.querySelector("img"),
      `${prefix}${i}.${ext}`
    );

    photos.push(photo);
  }

  let current = 0;

  function clearSlots(){

    Object.values(slots).forEach(slot => {
      slot.innerHTML = "";
    });

    main.innerHTML = "";
  }

  function putMain(photo){

    main.appendChild(photo);

    photo.classList.remove(
      "chaos-small",
      "chaos-corner"
    );

    photo.classList.add("chaos-big");
  }

  function putSmall(photo, position){

    slots[position].appendChild(photo);

    photo.classList.remove(
      "chaos-big"
    );

    photo.classList.add(
      "chaos-small",
      "chaos-corner"
    );

    photo.dataset.position = position;
  }

  function render(){

    clearSlots();

    const currentPhoto = photos[current];

    putMain(currentPhoto);

    let smallIndex = 0;

    photos.forEach((photo, index) => {

      if(index === current) return;

      const position = positions[smallIndex];

      putSmall(photo, position);

      smallIndex++;
    });

  }

  function go(direction){

    current =
      (current + direction + photos.length)
      % photos.length;

    render();
  }

  // Arrow buttons
  el.querySelector(".chaos-arrow.left")
    .addEventListener("click", () => go(-1));

  el.querySelector(".chaos-arrow.right")
    .addEventListener("click", () => go(1));

  // Existing "more chaos" button
  const nextButton =
    document.getElementById("btn-chaos-next");

  if(nextButton){

    nextButton.onclick = () => {
      go(1);
    };

  }

  // ----------------------------------------------------------
  // TOUCH SWIPE
  // ----------------------------------------------------------

  let startX = null;

  stage.addEventListener(
    "touchstart",
    e => {
      startX = e.touches[0].clientX;
    },
    { passive:true }
  );

  stage.addEventListener(
    "touchend",
    e => {

      if(startX === null) return;

      const dx =
        e.changedTouches[0].clientX - startX;

      if(Math.abs(dx) > 40){

        go(dx < 0 ? 1 : -1);

      }

      startX = null;
    },
    { passive:true }
  );

  // ----------------------------------------------------------
  // MOUSE / TRACKPAD DRAG
  // ----------------------------------------------------------

  let dragging = false;
  let dragStartX = 0;

  stage.addEventListener(
    "pointerdown",
    e => {

      dragging = true;
      dragStartX = e.clientX;

    }
  );

  window.addEventListener(
    "pointerup",
    e => {

      if(!dragging) return;

      dragging = false;

      const dx =
        e.clientX - dragStartX;

      if(Math.abs(dx) > 40){

        go(dx < 0 ? 1 : -1);

      }

    }
  );

  // ----------------------------------------------------------
  // MOUSE WHEEL
  // ----------------------------------------------------------

  let wheelLock = false;

  el.addEventListener(
    "wheel",
    e => {

      e.stopPropagation();

      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : e.deltaY;

      if(Math.abs(delta) < 10) return;

      e.preventDefault();

      if(wheelLock) return;

      wheelLock = true;

      go(delta > 0 ? 1 : -1);

      setTimeout(() => {
        wheelLock = false;
      }, 350);

    },
    { passive:false }
  );

  render();

  return {
    next: () => go(1),
    prev: () => go(-1)
  };
}

  const carGood  = buildCarousel('car-good',  CONFIG.albums.good.prefix,  CONFIG.albums.good.count,  CONFIG.albums.good.ext,  "Good Times");
  const carChaos = buildChaosScrapbook(
  'car-chaos',
  CONFIG.albums.chaos.prefix,
  CONFIG.albums.chaos.count,
  CONFIG.albums.chaos.ext
);
 /* =========================================================
   ALBUM 3 — ADVENTURE SCRAPBOOK
   Does NOT use the normal carousel.
   ========================================================= */

function buildAdventureScrapbook(){

  const mainImg = document.getElementById("adv-main-img");
  const leftImg = document.getElementById("adv-left-img");
  const rightImg = document.getElementById("adv-right-img");

  const leftCaption = document.getElementById("adv-left-caption");
  const rightCaption = document.getElementById("adv-right-caption");

  if(!mainImg || !leftImg || !rightImg) return null;

  const prefix = CONFIG.albums.adv.prefix;
  const count = CONFIG.albums.adv.count;
  const ext = CONFIG.albums.adv.ext;

  let current = 0;

  /*
    Each state contains:
    MAIN  = large center photo
    LEFT  = left Polaroid
    RIGHT = right Polaroid
  */

  const states = [];

  for(let i = 0; i < count; i++){

    states.push({
      main: i,
      left: (i + 1) % count,
      right: (i + 2) % count
    });

  }


  function fileName(index){
    return `${prefix}${index + 1}.${ext}`;
  }


  function setImage(img, index){

    img.classList.remove("adventure-photo-changing");

    /*
      Force animation restart
    */
    void img.offsetWidth;

    img.classList.add("adventure-photo-changing");

    safeImg(
      img,
      fileName(index)
    );
  }


  function render(){

    const state = states[current];

    setImage(mainImg, state.main);
    setImage(leftImg, state.left);
    setImage(rightImg, state.right);

    if(leftCaption){
      leftCaption.textContent =
        `memory ${state.left + 1} ✦`;
    }

    if(rightCaption){
      rightCaption.textContent =
        `good times ${state.right + 1}`;
    }

    

  }


  function next(){

    current++;

    if(current >= states.length){
      current = 0;
    }

    render();

  }


  function prev(){

    current--;

    if(current < 0){
      current = states.length - 1;
    }

    render();

  }


  /* NEXT ADVENTURE BUTTON */

  const nextButton =
    document.getElementById("btn-adv-next");

  if(nextButton){

    nextButton.addEventListener(
      "click",
      next
    );

  }


  /* SIDE ARROWS */

  const leftButton =
    document.getElementById("adv-left");

  const rightButton =
    document.getElementById("adv-right");

  if(leftButton){
    leftButton.addEventListener(
      "click",
      prev
    );
  }

  if(rightButton){
    rightButton.addEventListener(
      "click",
      next
    );
  }


  /* SWIPE */

  const board =
    document.querySelector(".adventure-board");

  let startX = null;

  if(board){

    board.addEventListener(
      "touchstart",
      function(e){

        if(!e.touches.length) return;

        startX =
          e.touches[0].clientX;

      },
      {passive:true}
    );


    board.addEventListener(
      "touchend",
      function(e){

        if(startX === null) return;

        const endX =
          e.changedTouches[0].clientX;

        const difference =
          endX - startX;

        if(Math.abs(difference) > 45){

          if(difference < 0){
            next();
          }else{
            prev();
          }

        }

        startX = null;

      },
      {passive:true}
    );

  }


  /* MOUSE WHEEL */

  let wheelLock = false;

  if(board){

    board.addEventListener(
      "wheel",
      function(e){

        if(Math.abs(e.deltaY) < 10) return;

        e.preventDefault();

        if(wheelLock) return;

        wheelLock = true;

        if(e.deltaY > 0){
          next();
        }else{
          prev();
        }

        setTimeout(
          () => {
            wheelLock = false;
          },
          450
        );

      },
      {passive:false}
    );

  }


  render();

  return {
    next,
    prev
  };

}


buildAdventureScrapbook();
  // ============================================================
// ALBUM 3 — THE SILLY SIDE
// 3-photo scrapbook:
// main + top-right + bottom-left
// ============================================================

function buildSillyScrapbook(){

  const mainImg = document.getElementById('silly-main-img');
  const rightImg = document.getElementById('silly-right-img');
  const leftImg = document.getElementById('silly-left-img');

  const nextBtn = document.getElementById('btn-silly-next');
  const leftBtn = document.getElementById('silly-left');
  const rightBtn = document.getElementById('silly-right');

  const prefix = CONFIG.albums.silly.prefix;
  const count = CONFIG.albums.silly.count;
  const ext = CONFIG.albums.silly.ext;

  let current = 0;

  function setPhoto(img, index){

    const realIndex = ((index % count) + count) % count;

    img.classList.remove('silly-photo-changing');

    void img.offsetWidth;

    img.classList.add('silly-photo-changing');

    safeImg(
      img,
      `${prefix}${realIndex + 1}.${ext}`
    );
  }

  function render(){

    /*
      Current photo = BIG CENTER

      Next photo = TOP RIGHT

      Previous photo = BOTTOM LEFT
    */

    const next = (current + 1) % count;
    const previous = (current - 1 + count) % count;

    setPhoto(mainImg, current);
    setPhoto(rightImg, next);
    setPhoto(leftImg, previous);
  }

  function go(delta){

    current = (current + delta + count) % count;

    render();
  }

  leftBtn.addEventListener('click', ()=>{
    go(-1);
  });

  rightBtn.addEventListener('click', ()=>{
    go(1);
  });

  nextBtn.addEventListener('click', ()=>{
    go(1);
  });

  // ----------------------------------------------------------
  // Touch swipe
  // ----------------------------------------------------------

  const board = document.querySelector('.silly-board');

  let startX = null;

  board.addEventListener(
    'touchstart',
    e=>{
      startX = e.touches[0].clientX;
    },
    {passive:true}
  );

  board.addEventListener(
    'touchend',
    e=>{

      if(startX === null) return;

      const dx =
        e.changedTouches[0].clientX - startX;

      if(Math.abs(dx) > 40){

        go(dx < 0 ? 1 : -1);

      }

      startX = null;
    },
    {passive:true}
  );

  // ----------------------------------------------------------
  // Desktop mouse drag
  // ----------------------------------------------------------

  let dragging = false;
  let dragStartX = 0;

  board.addEventListener('pointerdown', e=>{
    dragging = true;
    dragStartX = e.clientX;
  });

  window.addEventListener('pointerup', e=>{

    if(!dragging) return;

    dragging = false;

    const dx = e.clientX - dragStartX;

    if(Math.abs(dx) > 40){
      go(dx < 0 ? 1 : -1);
    }
  });

  // ----------------------------------------------------------
  // Mouse wheel
  // ----------------------------------------------------------

  let wheelLock = false;

  board.addEventListener(
    'wheel',
    e=>{

      e.stopPropagation();

      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : e.deltaY;

      if(Math.abs(delta) < 10) return;

      e.preventDefault();

      if(wheelLock) return;

      wheelLock = true;

      go(delta > 0 ? 1 : -1);

      setTimeout(()=>{
        wheelLock = false;
      },320);

    },
    {passive:false}
  );

  render();

  return {
    next:()=>go(1),
    prev:()=>go(-1)
  };
}

const carSilly = buildSillyScrapbook();

  document.getElementById('btn-good-next').addEventListener('click', carGood.next);
  document.getElementById('btn-chaos-next').addEventListener('click', carChaos.next);
 
  document.getElementById('btn-silly-next').addEventListener('click', carSilly.next);

  // ---------------- COLLAGE (page 8) ----------------
  (function(){
    const wrap = document.getElementById('collage');
    const positions = [
      {top:'0%',left:'2%',rot:-8},
      {top:'4%',right:'4%',rot:6},
      {top:'46%',left:'22%',rot:-4},
      {top:'40%',right:'0%',rot:9},
    ];
    CONFIG.collagePhotos.slice(0,4).forEach((name,i)=>{
      const pos = positions[i] || positions[0];
      const div = document.createElement('div');
      div.className = 'polaroid';
      let style = `position:absolute; transform:rotate(${pos.rot}deg);`;
      if(pos.top) style += `top:${pos.top};`;
      if(pos.left) style += `left:${pos.left};`;
      if(pos.right) style += `right:${pos.right};`;
      div.style.cssText = style;
      div.innerHTML = `<img>`;
      const ext = name.startsWith('W')?CONFIG.albums.good.ext:name.startsWith('M')?CONFIG.albums.chaos.ext:name.startsWith('O')?CONFIG.albums.adv.ext:CONFIG.albums.silly.ext;
      safeImg(div.querySelector('img'), `${name}.${ext}`);
      wrap.appendChild(div);
    });
  })();

  // ---------------- LETTER (page 2) ----------------

  function replaceName(text){
  return text.replaceAll("{{friendName}}", CONFIG.friendName);
}
 function renderLetter(){
  const el = document.getElementById('letterPaper');
  if(!el) return;

  let html = `<h2>${replaceName(CONFIG.letterTitle)}</h2>`;
  CONFIG.letterBody.forEach(p => html += `<p>${replaceName(p)}</p>`);
  html += `<p><strong>${replaceName(CONFIG.letterClosing)}</strong></p>`;
  html += `<p>${replaceName(CONFIG.letterFooter)}</p>`;
  html += `<p class="letter-sign">${replaceName("Forever your bestie 🐻")}</p>`;

  el.innerHTML = html;
}

  // ---------------- REASONS (page 9) ----------------
  (function(){
    const el = document.getElementById('notebook');
    el.innerHTML = CONFIG.reasons.map(r=>`<div class="reason-tag">${r}</div>`).join('');
  })();

  // ---------------- FOREVER + FINAL images ----------------
  (function(){
    const foreverExt = CONFIG.foreverPhoto.startsWith('W')?CONFIG.albums.good.ext:CONFIG.foreverPhoto.startsWith('M')?CONFIG.albums.chaos.ext:CONFIG.foreverPhoto.startsWith('O')?CONFIG.albums.adv.ext:CONFIG.albums.silly.ext;
    safeImg(document.getElementById('foreverImg'), `${CONFIG.foreverPhoto}.${foreverExt}`);
    const specialImg = document.getElementById('specialImg'); if(specialImg) safeImg(specialImg, CONFIG.finalPhoto);
  })();

  // ---------------- personalize text ----------------
  const finalName = document.getElementById('finalName'); if(finalName) finalName.innerHTML = `Happy Birthday<br>${CONFIG.friendName}! 🎂❤️`;
const signLine = document.getElementById('signLine'); if(signLine) signLine.textContent = CONFIG.senderSign;
  if(CONFIG.showBranding){
    [document.getElementById('brandLine1'), document.getElementById('brandLine2')].forEach(el=>{
      el.innerHTML = `<a href="${CONFIG.brandLink}" target="_blank" rel="noopener">${CONFIG.brandName}</a>`;
    });
  }

  // ---------------- MUSIC ----------------
  const bgm = document.getElementById('bgm');
  const musicBtn = document.getElementById('musicBtn');
  bgm.loop = true;
  const configuredSong = CONFIG.songUrl
    ? Promise.resolve(CONFIG.songUrl)
    : fileUrl(CONFIG.songFile);
  configuredSong.then(url => {
  if(url) bgm.src = url;
});
  let musicStarted = false;
  function playMusic(){
    bgm.volume = 0.75;
    bgm.play().then(()=>{
      musicBtn.textContent = '🎵';
      musicBtn.classList.add('playing');
    }).catch(()=>{ /* autoplay blocked — user can tap the button */ });
    musicStarted = true;
  }
  musicBtn.addEventListener('click', ()=>{
    if(!musicStarted){ playMusic(); return; }
    if(bgm.paused){ bgm.play(); musicBtn.textContent='🎵'; musicBtn.classList.add('playing'); }
    else { bgm.pause(); musicBtn.textContent='🔇'; musicBtn.classList.remove('playing'); }
  });

  // ---------------- PAGE NAVIGATION ----------------
  const pages = Array.from(document.querySelectorAll('.page'));
  const TOTAL = pages.length;
  let current = 1;
  let navLocking = false; // blocks double-triggers while a page transition is mid-flight

  function goTo(n, dir){
    if(navLocking) return;
    n = Math.max(1, Math.min(TOTAL, n));
    const from = pages[current-1];
    const to = pages[n-1];
    if(from === to) return;
    navLocking = true;
    from.classList.remove('active');
    from.classList.toggle('leaving-left', dir === 'next');
    to.classList.remove('leaving-left');
    // force reflow so the entering page animates in from the correct side
    void to.offsetWidth;
    to.classList.add('active');
    current = n;
    setTimeout(()=>{ navLocking = false; }, 600);
  }

  document.querySelectorAll('[data-next]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(!musicStarted) playMusic(); // first tap anywhere in the flow also unlocks audio
      goTo(current+1, 'next');
    });
  });
  document.querySelectorAll('[data-back]').forEach(btn=>{
    btn.addEventListener('click', ()=> goTo(current-1, 'back'));
  });
  document.querySelectorAll('[data-home]').forEach(btn=>{
    btn.addEventListener('click', ()=> goTo(1, 'back'));
  });
  document.getElementById('restartBtn').addEventListener('click', ()=> goTo(1, 'back'));

  // hide the "back" control on page 1 (nothing to go back to)
  pages[0].querySelector('[data-back]')?.remove();

  // keyboard support (desktop demoing)
  window.addEventListener('keydown', e=>{
    if(e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(current+1,'next');
    if(e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(current-1,'back');
  });

  // ---------------- SWIPE — page-to-page navigation (mobile) --------------
  // The mouse wheel is intentionally NOT used for page navigation — it's
  // reserved for flipping through photos inside an album (see buildCarousel
  // above). Only touch swipe moves between the 12 pages, and only on the
  // VERTICAL axis, since horizontal swipe already belongs to the carousels.
  // If the swipe starts inside a page that can scroll internally (the
  // letter on page 2), we only change page once that inner content has
  // reached its top/bottom edge, so normal reading scroll still works first.
  const app = document.getElementById('app');

  function scrollableAncestor(el){
    return el && el.closest ? el.closest('.letter-paper') : null;
  }

 


})();