const video = document.getElementById('video');
const msg   = document.getElementById('msg');
const tbl   = document.querySelector('#tbl tbody');
const list  = document.getElementById('list');
const qtyEl = document.getElementById('qty');
const noteEl= document.getElementById('note');

let lastData = null;
let records  = JSON.parse(localStorage.getItem('records')||'[]'); // 간단히 localStorage 사용
renderList();

// 데이터 파싱: JSON 또는 key=value;... 둘 다 지원
function parseData(text){
  try { return JSON.parse(text); }
  catch(e){
    const obj = {};
    text.split(';').forEach(p=>{
      const [k, ...rest] = p.split('=');
      if(!k) return;
      const v = rest.join('=');
      if (v!==undefined) obj[k.trim()] = v.trim();
    });
    return obj;
  }
}

function renderTable(obj){
  tbl.innerHTML = '';
  const keys = Object.keys(obj);
  if(keys.length===0){ msg.textContent='인식된 데이터가 없어요.'; return; }
  msg.textContent='';
  keys.forEach(k=>{
    const tr=document.createElement('tr');
    const th=document.createElement('th'); th.textContent=k;
    const td=document.createElement('td'); td.textContent=obj[k];
    tr.append(th,td); tbl.appendChild(tr);
  });
}

async function startLiveScan(){
  if(location.protocol !== 'https:' && location.hostname !== 'localhost'){
    msg.textContent='실시간 스캔은 HTTPS(또는 localhost)에서만 됩니다. 아래 사진 폴백을 쓰세요.';
    return;
  }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});
    video.srcObject = stream; video.style.display='block'; await video.play();

    const c = document.createElement('canvas'), x = c.getContext('2d');
    (function loop(){
      if(video.readyState === video.HAVE_ENOUGH_DATA){
        c.width=video.videoWidth; c.height=video.videoHeight;
        x.drawImage(video,0,0,c.width,c.height);
        const d=x.getImageData(0,0,c.width,c.height);
        const code=jsQR(d.data,c.width,c.height);
        if(code && code.data){
          stopStream(stream);
          handleRaw(code.data);
          return;
        }
      }
      requestAnimationFrame(loop);
    })();
  }catch(e){
    msg.textContent = `카메라 오류: ${e.name || e}`;
  }
}

function stopStream(stream){ stream.getTracks().forEach(t=>t.stop()); video.style.display='none'; }

function handleRaw(text){
  lastData = text;
  const obj = parseData(text);
  renderTable(obj);
}

document.getElementById('scanBtn').onclick = startLiveScan;

document.getElementById('pick').onchange = (ev)=>{
  const f = ev.target.files[0]; if(!f) return;
  const img = new Image();
  img.onload = ()=>{
    const c=document.createElement('canvas'), x=c.getContext('2d');
    c.width=img.naturalWidth; c.height=img.naturalHeight;
    x.drawImage(img,0,0);
    const d=x.getImageData(0,0,c.width,c.height);
    const code=jsQR(d.data,c.width,c.height);
    handleRaw(code ? code.data : '');
  };
  img.src = URL.createObjectURL(f);
};

document.getElementById('saveBtn').onclick = ()=>{
  if(!lastData){ msg.textContent='먼저 QR을 스캔하세요.'; return; }
  const r = {
    raw:lastData,
    qty:Number(qtyEl.value||0),
    note:noteEl.value||'',
    at:new Date().toISOString()
  };
  records.push(r);
  localStorage.setItem('records', JSON.stringify(records));
  renderList();
  noteEl.value='';
};

function renderList(){
  list.innerHTML='';
  records.slice().reverse().forEach(r=>{
    const li=document.createElement('li');
    li.textContent = `${r.at} | qty:${r.qty} | ${r.note} | ${r.raw}`;
    list.appendChild(li);
  });
}

document.getElementById('exportBtn').onclick = ()=>{
  const header = 'time,qty,note,data\n';
  const rows = records.map(r=>`${r.at},${r.qty},${csvSafe(r.note)},${csvSafe(r.raw)}`).join('\n');
  download('inventory_'+new Date().toISOString().slice(0,10)+'.csv', header+rows);
};
function csvSafe(s){ return `"${String(s).replace(/"/g,'""')}"`; }
function download(name, text){
  const blob = new Blob([text], {type:'text/csv'});
  const a = document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; a.click();
}
