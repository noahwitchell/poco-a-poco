(()=>{
'use strict';
// ---------- data ----------
const DECK=/*@DECK@*/[];
const TAGS={v:'verb',n:'noun',adj:'adjective',adv:'adverb',prep:'preposition',conj:'connector',pron:'pronoun',num:'number',phr:'phrase',q:'question word'};
const CARDS=DECK.map((d,i)=>({id:d[0],alts:d[0].split('/'),es:d[0].split('/')[0],en:d[1],tag:d[2],ses:d[3],sen:d[4],i}));
const BYID=Object.fromEntries(CARDS.map(c=>[c.id,c]));
const MIN=6e4,HOUR=36e5,DAY=864e5,STEPS=[1*MIN,10*MIN];
const LAD=[.6,.8,1],LNAME=['Slow','Steady','Natural'];
const app=document.getElementById('app');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ---------- storage ----------
const KEY='pocoapoco-v1';
const blank=()=>({cards:{},sents:{},settings:{voice:'',newPerDay:10,mode:'type',autoplay:true},day:{date:'',newDone:0,reviews:0,listened:0,extra:0},streak:{last:'',n:0}});
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.cards){const b=blank();return {...b,...s,settings:{...b.settings,...s.settings},day:{...b.day,...s.day},streak:{...b.streak,...s.streak}}}}catch(e){}return blank()}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function rollDay(){const t=ymd(new Date());if(S.day.date!==t)S.day={date:t,newDone:0,reviews:0,listened:0,extra:0}}
function bumpStreak(){const t=ymd(new Date());if(S.streak.last===t)return;const y=new Date();y.setDate(y.getDate()-1);S.streak.n=S.streak.last===ymd(y)?S.streak.n+1:1;S.streak.last=t}
function streakNow(){const t=ymd(new Date()),y=new Date();y.setDate(y.getDate()-1);return (S.streak.last===t||S.streak.last===ymd(y))?S.streak.n:0}

// ---------- text helpers ----------
const deacc=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'');
const norm=s=>s.toLowerCase().replace(/[¿?¡!.,;:"“”()…—]/g,' ').replace(/\s+/g,' ').trim();
const ARTG={el:'m',un:'m',los:'m',unos:'m',la:'f',una:'f',las:'f',unas:'f'};
function splitArt(s){const w=s.split(' ');return (w.length>1&&ARTG[w[0]])?[w[0],w.slice(1).join(' ')]:['',s]}
function lev(a,b){if(Math.abs(a.length-b.length)>2)return 9;const d=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t}}return d[b.length]}
const close=(a,b)=>a===b||(b.length>=5&&lev(a,b)<=1);
const baseEn=s=>s.toLowerCase().replace(/\(.*?\)/g,'').split('/').map(x=>x.trim().replace(/^(the|to|a) /,'')).filter(Boolean);

// ---------- spaced repetition ----------
function schedule(s,r,now){
  s=s?{...s}:{due:now,ivl:0,ease:2.5,reps:0,lapses:0,step:0};
  s.reps++;
  if(s.step>=0){
    if(r===1){s.step=0;s.due=now+STEPS[0]}
    else if(r===2){s.due=now+STEPS[Math.min(s.step,STEPS.length-1)]*1.5}
    else if(r===3){s.step++;if(s.step>=STEPS.length){s.step=-1;s.ivl=Math.max(1,s.ivl||1);s.due=now+s.ivl*DAY-2*HOUR}else s.due=now+STEPS[s.step]}
    else{s.step=-1;s.ivl=Math.max(4,Math.round((s.ivl||0)*1.5));s.due=now+s.ivl*DAY-2*HOUR}
  }else{
    const f=.95+Math.random()*.1;
    if(r===1){s.lapses++;s.ease=Math.max(1.3,s.ease-.2);s.ivl=Math.max(1,Math.round(s.ivl*.3));s.step=0;s.due=now+STEPS[0];return s}
    if(r===2){s.ivl=Math.max(s.ivl+1,s.ivl*1.2);s.ease=Math.max(1.3,s.ease-.15)}
    if(r===3){s.ivl=Math.max(s.ivl+1,s.ivl*s.ease)}
    if(r===4){s.ivl=Math.max(s.ivl+2,s.ivl*s.ease*1.3);s.ease+=.15}
    s.ivl=Math.round(s.ivl*f);s.due=now+s.ivl*DAY-2*HOUR;
  }
  return s;
}
function span(ms){ms=Math.max(0,ms);if(ms<HOUR)return Math.max(1,Math.round(ms/MIN))+'m';if(ms<DAY)return Math.round(ms/HOUR)+'h';const d=Math.round(ms/DAY);if(d<31)return d+'d';if(d<365)return Math.round(d/30)+'mo';return (d/365).toFixed(1)+'y'}
function spanLong(ms){const s=span(ms);return s.replace(/m$/,' min').replace(/h$/,' h').replace(/d$/,s==='1d'?' day':' days').replace(/mo$/,' months')}
const newLeft=()=>Math.max(0,S.settings.newPerDay+S.day.extra-S.day.newDone);
function counts(){const now=Date.now();let lrn=0,rev=0,unseen=0;for(const c of CARDS){const s=S.cards[c.id];if(!s){unseen++;continue}if(s.due<=now)(s.step>=0?lrn++:rev++)}return {lrn,rev,nw:Math.min(newLeft(),unseen),unseen}}
let lastId=null;
function nextCard(){
  const now=Date.now(),L=[],R=[],A=[];
  for(const c of CARDS){const s=S.cards[c.id];if(!s)continue;
    if(s.step>=0){if(s.due<=now)L.push(c);else if(s.due<=now+20*MIN)A.push(c)}else if(s.due<=now)R.push(c)}
  const bd=(a,b)=>S.cards[a.id].due-S.cards[b.id].due;L.sort(bd);R.sort(bd);A.sort(bd);
  const nw=newLeft()>0?CARDS.find(c=>!S.cards[c.id]):null;
  const pools=[L,R,nw?[nw]:[],A];
  for(const p of pools){const c=p.find(c=>c.id!==lastId);if(c)return c}
  for(const p of pools)if(p.length)return p[0];
  return null;
}
function nextDueIn(){let m=Infinity;for(const id in S.cards)m=Math.min(m,S.cards[id].due);return m===Infinity?null:m-Date.now()}

// ---------- grading a typed answer ----------
function grade(card,input){
  const a=norm(input);
  if(!a)return {kind:'wrong',def:1,label:'No answer'};
  const targets=[];
  for(const alt of card.alts){const t=norm(alt);targets.push(t);if(card.tag==='adj'&&/o$/.test(t))targets.push(t.slice(0,-1)+'a')}
  const show=card.es;
  for(const t of targets){
    if(a===t)return {kind:'right',def:3,label:'Correct'};
    const [ta,tw]=splitArt(t),[aa,aw]=splitArt(a);
    const same=(x,y)=>x===y,noAcc=(x,y)=>deacc(x)===deacc(y)&&x!==y,typo=(x,y)=>close(deacc(x),deacc(y));
    for(const [test,kind] of [[same,'right'],[noAcc,'accent'],[typo,'typo']]){
      let ok=false,art='';
      if(ta){ if(test(aw,tw)){ok=true;art=!aa?'missing':(ARTG[aa]===ARTG[ta]?'':'gender')} else if(!aa&&test(a,tw)){ok=true;art='missing'} }
      else if(test(a,t)){ok=true}
      if(!ok)continue;
      if(art==='gender')return {kind:'almost',def:2,label:'Almost: check the gender',note:`It's <b>${esc(show)}</b>. Learn nouns with their article.`};
      const notes=[];
      if(kind==='accent')notes.push(`Watch the accent: <b>${esc(show)}</b>.`);
      if(kind==='typo')notes.push(`Small typo. It's <b>${esc(show)}</b>.`);
      if(art==='missing')notes.push(`Learn it with its article: <b>${esc(show)}</b>.`);
      return {kind:kind==='right'?'right':'almost',def:3,label:kind==='right'?'Correct':'Close enough',note:notes.join(' ')};
    }
  }
  // another card with the same meaning?
  const mine=baseEn(card.en);
  for(const o of CARDS){if(o===card)continue;
    if(!baseEn(o.en).some(x=>mine.includes(x)))continue;
    if(o.alts.some(alt=>{const t=norm(alt),[,tw]=splitArt(t);return deacc(a)===deacc(t)||deacc(a)===deacc(tw)}))
      return {kind:'almost',def:2,label:'Also right, different word',note:`<b>${esc(o.es)}</b> means that too. This card is <b>${esc(show)}</b>.`};
  }
  return {kind:'wrong',def:1,label:'Not quite',you:input.trim()};
}
function hintFor(card){
  const w=splitArt(norm(card.alts[0]))[1];
  const toks=card.ses.split(' ');
  let idx=toks.findIndex(t=>deacc(norm(t))===deacc(w));
  if(idx<0&&card.tag==='v'){const stem=deacc(w.replace(/se$/,'').slice(0,-2));if(stem.length>=3)idx=toks.findIndex(t=>deacc(norm(t)).startsWith(stem))}
  if(idx<0&&card.tag==='adj'&&w.length>3){const stem=deacc(w.slice(0,-1));idx=toks.findIndex(t=>deacc(norm(t)).startsWith(stem))}
  const first=card.es.split(' ').map(x=>x[0]+'_'.repeat(Math.max(0,x.length-1)).split('').join(' ')).join('  ');
  let cloze='';
  if(idx>=0&&!w.includes(' ')){cloze=toks.map((t,i)=>i===idx?t.replace(/[\p{L}]+/u,m=>'_'.repeat(m.length)):t).join(' ')}
  return {first,cloze};
}

// ---------- speech ----------
const SYN=('speechSynthesis' in window)?window.speechSynthesis:null;
let VOICES=[];
const NOVELTY=/^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Bad News|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Albert|Fred|Junior|Kathy|Ralph)\b/i;
function loadVoices(){if(!SYN)return;VOICES=SYN.getVoices().filter(v=>/^es/i.test(v.lang));VOICES.sort((a,b)=>(NOVELTY.test(a.name)-NOVELTY.test(b.name))||a.lang.localeCompare(b.lang)||a.name.localeCompare(b.name))}
if(SYN){loadVoices();SYN.addEventListener?.('voiceschanged',()=>{loadVoices();if(view==='settings'||view==='home')render()})}
function voice(){const ok=VOICES.filter(v=>!NOVELTY.test(v.name));
  return VOICES.find(v=>v.voiceURI===S.settings.voice)
   ||ok.find(v=>/paulina|m[oó]nica/i.test(v.name)&&/premium|enhanced|mejorad/i.test(v.name))
   ||ok.find(v=>/paulina/i.test(v.name))||ok.find(v=>/m[oó]nica/i.test(v.name))
   ||ok.find(v=>/es[-_](MX|US|419)/i.test(v.lang))||ok.find(v=>/es[-_]ES/i.test(v.lang))||ok[0]||VOICES[0]||null}
let speakGen=0;
function utter(text,rate){const u=new SpeechSynthesisUtterance(text);const v=voice();if(v){u.voice=v;u.lang=v.lang}else u.lang='es-ES';u.rate=rate;return u}
function stopSpeech(){speakGen++;if(SYN)SYN.cancel();clearInterval(estTimer);document.querySelectorAll('.w.on').forEach(e=>e.classList.remove('on'));document.querySelector('.playbig')?.classList.remove('speaking')}
let estTimer=0;
// speak a sentence; onword(charIndex) drives the word highlight. Falls back to a timing estimate when the voice sends no word boundaries.
function speak(text,rate,{onword,onend}={}){
  if(!SYN){toast('This browser has no speech voices.');return}
  stopSpeech();const gen=speakGen;
  const u=utter(text,rate);let gotB=false,t0=0;
  u.onstart=()=>{t0=performance.now();if(!onword)return;onword(0);
    setTimeout(()=>{if(gotB||gen!==speakGen)return;const cps=13.5*rate;estTimer=setInterval(()=>{if(gen!==speakGen){clearInterval(estTimer);return}const ci=Math.floor((performance.now()-t0)/1000*cps);if(ci>text.length)clearInterval(estTimer);else onword(ci)},90)},450)};
  u.onboundary=e=>{if(e.name&&e.name!=='word')return;gotB=true;clearInterval(estTimer);onword&&onword(e.charIndex)};
  u.onend=u.onerror=()=>{if(gen!==speakGen)return;clearInterval(estTimer);onend&&onend()};
  SYN.speak(u);
}
// queue several chunks at once (iOS only lets the first utterance start from a tap, so they all go in now)
function speakChunks(chunks,rate,{onchunk,onend}={}){
  if(!SYN)return;stopSpeech();const gen=speakGen;
  chunks.forEach((c,i)=>{const u=utter(c.text,rate);u.onstart=()=>{if(gen===speakGen)onchunk&&onchunk(i)};if(i===chunks.length-1)u.onend=u.onerror=()=>{if(gen===speakGen)onend&&onend()};SYN.speak(u)});
}
const say=(t,r=.85)=>speak(t,r);

// ---------- icons ----------
const I={
  spk:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z" fill="currentColor"/></svg>',
};
const spkBtn=(act,arg,label)=>`<button class="iconbtn" data-act="${act}" data-arg="${esc(arg)}" aria-label="${esc(label)}">${I.spk}</button>`;
let toastT=0;
function toast(msg){document.querySelector('.toast')?.remove();const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=msg;document.body.appendChild(t);clearTimeout(toastT);toastT=setTimeout(()=>t.remove(),2600)}

// ---------- views ----------
let view='home',cur=null,L=null,confirmReset=false;
function go(v){stopSpeech();view=v;confirmReset=false;if(v==='cards'){cur=null;nextCardUI()}else if(v==='listen'){L=null;nextSent()}render();window.scrollTo(0,0)}
function render(){
  rollDay();
  app.innerHTML=view==='home'?homeHTML():view==='cards'?cardsHTML():view==='listen'?listenHTML():settingsHTML();
  if(view==='cards'&&cur&&cur.phase==='ask'&&S.settings.mode==='type'){const a=document.getElementById('ans');if(a&&matchMedia('(hover:hover)').matches)a.focus()}
}

function homeHTML(){
  const c=counts();
  const learning=Object.keys(S.cards).length;
  const known=Object.values(S.cards).filter(s=>s.step<0).length;
  const mastered=Object.values(S.sents).filter(s=>s.lvl>=3).length;
  const ready=listenPool().length;
  const due=c.lrn+c.rev;
  const noVoice=SYN&&VOICES.length===0;
  return `
  <div class="bar"><div style="flex:1"></div><button class="iconbtn" data-act="go" data-arg="settings" aria-label="Settings">${I.gear}</button></div>
  <div class="tiles" aria-hidden="true"></div>
  <div class="brand"><div><h1>Poco a Poco<span class="tilde">~</span></h1><p class="tag">Spanish, a few words a day. Works offline.</p></div></div>
  <div class="stats">
    <div class="stat"><b>${known}</b><span>words known of ${CARDS.length}</span></div>
    <div class="stat"><b>${streakNow()}</b><span>day streak</span></div>
    <div class="stat"><b>${mastered}</b><span>sentences at full speed</span></div>
  </div>
  ${!SYN?'<div class="warnbox">This browser has no text-to-speech, so audio and listening won\'t work here. Safari on iPhone does support it.</div>':noVoice?'<div class="warnbox">No Spanish voice found yet. On iPhone: Settings → Accessibility → Spoken Content → Voices → Spanish, then download one (Paulina or Mónica).</div>':''}
  <section class="panel act">
    <span class="label">Vocabulary</span>
    <h3>Flashcards</h3>
    <p class="muted small">See the English, recall the Spanish. Words come back right before you'd forget them.</p>
    <div class="meta chips"><span class="chip rev">${due} due</span><span class="chip new">${c.nw} new today</span><span class="chip">${learning} started</span></div>
    <button class="btn" data-act="go" data-arg="cards">${due||c.nw?'Start session':'Practice'}</button>
  </section>
  <section class="panel act">
    <span class="label">Listening</span>
    <h3>Sentence trainer</h3>
    <p class="muted small">Hear a sentence slow, then faster. Count the words, type what you hear, and see where the sounds run together.</p>
    <div class="meta chips"><span class="chip">${ready} sentences ready</span><span class="chip">${S.day.listened} today</span></div>
    <button class="btn" data-act="go" data-arg="listen">Start listening</button>
  </section>`;
}

// ----- flashcards -----
function nextCardUI(){const c=nextCard();cur=c?{card:c,phase:'ask',hint:null,res:null,isNew:!S.cards[c.id]}:{done:true};if(c)lastId=c.id}
function cardsHTML(){
  const c=counts();
  const top=`<div class="bar"><button class="iconbtn" data-act="go" data-arg="home" aria-label="Back to home">${I.back}</button><h2>Flashcards</h2>
    <div class="chips" aria-label="Remaining"><span class="chip new" title="new">${c.nw}</span><span class="chip lrn" title="learning">${c.lrn}</span><span class="chip rev" title="review">${c.rev}</span></div></div>`;
  if(cur.done){
    const nd=nextDueIn();
    return top+`<section class="panel done"><span class="label">Session done</span><h2>¡Muy bien!</h2>
      <p class="muted">${S.day.reviews} cards today.${nd!=null?` Next card due in ${spanLong(nd)}.`:''}</p>
      <div class="row" style="justify-content:center">
        ${c.unseen?'<button class="btn" data-act="more">Learn 5 more words</button>':''}
        <button class="btn line" data-act="go" data-arg="listen">Practice listening</button></div></section>`;
  }
  const k=cur.card,typed=S.settings.mode==='type';
  let h=top+`<section class="panel prompt">
    <span class="label">${cur.isNew?'New · ':''}${TAGS[k.tag]||k.tag}</span>
    <div class="en">${esc(k.en)}</div>
    <p class="ctx">“${esc(k.sen)}”</p>
    ${cur.hint?`<p class="cloze"><b>${esc(cur.hint.first)}</b>${cur.hint.cloze?`<br><span class="muted">${esc(cur.hint.cloze)}</span>`:''}</p>`:''}
  </section>`;
  if(cur.phase==='ask'){
    if(typed)h+=`<div class="ansbox">
      <label class="label" for="ans">Type the Spanish</label>
      <input id="ans" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="es" enterkeyhint="go" placeholder="en español…">
      <div class="accents">${['á','é','í','ó','ú','ñ','ü'].map(ch=>`<button data-act="acc" data-arg="${ch}" aria-label="Insert ${ch}">${ch}</button>`).join('')}</div>
      <button class="btn" data-act="check">Check</button>
      <div class="links"><button data-act="hint" ${cur.hint?'disabled':''}>Hint</button><button data-act="idk">I don't know</button></div></div>`;
    else h+=`<p class="muted small">Say it in your head (or out loud), then check.</p><button class="btn" data-act="reveal">Show answer</button>`;
    return h;
  }
  const r=cur.res;
  if(r)h+=`<div class="res ${r.kind}" role="status">${r.label}${r.you?`: <span class="you">${esc(r.you)}</span>`:''}${r.note?`<span class="note">${r.note}</span>`:''}</div>`;
  h+=`<section class="panel">
    <div class="answer"><div class="es">${esc(k.es)}${k.alts.length>1?`<span class="alts">also ${k.alts.slice(1).map(esc).join(', ')}</span>`:''}</div>${spkBtn('sayword',k.es,'Hear the word')}</div>
    <div class="say"><p><span class="es-s" lang="es">${esc(k.ses)}</span><br><span class="muted small">${esc(k.sen)}</span></p>${spkBtn('saysent',k.ses,'Hear the sentence')}</div>
  </section>`;
  const now=Date.now(),s=S.cards[k.id];
  const names=['Again','Hard','Good','Easy'];
  h+=`<div class="rates">${[1,2,3,4].map(n=>`<button class="rate r${n}${n===cur.def?' def':''}" data-act="rate" data-arg="${n}"><b>${names[n-1]}</b><span>${span(schedule(s,n,now).due-now)}</span></button>`).join('')}</div>`;
  return h;
}
function showAnswer(res){cur.phase='shown';cur.res=res||null;cur.def=res?Math.min(res.def,cur.hint?2:4):3;render();if(S.settings.autoplay)say(cur.card.es,.85)}
function rateCard(n){
  const k=cur.card,now=Date.now();
  S.cards[k.id]=schedule(S.cards[k.id],n,now);
  if(cur.isNew)S.day.newDone++;
  S.day.reviews++;bumpStreak();save();
  stopSpeech();nextCardUI();render();
}

// ----- listening -----
function toks(s){const out=[];let pos=0;for(const raw of s.split(' ')){const st=s.indexOf(raw,pos);pos=st+raw.length;const core=raw.replace(/^[¿¡"“(—-]+|[.,;:!?"”)…]+$/g,'');if(core)out.push({raw,core,start:st,brk:/[.,;:!?…]["”)]?$/.test(raw)})}return out}
function linkType(a,b){if(a.brk)return 0;const x=deacc(a.core.toLowerCase()),y=deacc(b.core.toLowerCase());
  const endV=/[aeiouy]$/.test(x),startV=/^h?[aeiou]/.test(y)||y==='y';
  if(endV&&startV)return 2;if(startV&&/[a-z]$/.test(x))return 1;return 0}
function chunksOf(t){const out=[];let cur=[];t.forEach((w,i)=>{cur.push(i);if(w.brk||cur.length>=3&&!(i+1<t.length&&linkType(w,t[i+1])===2)){out.push(cur);cur=[]}});if(cur.length)out.push(cur);return out}
const WORDIDX={};
for(const c of CARDS)for(const alt of c.alts){const w=splitArt(norm(alt))[1];if(!w.includes(' '))WORDIDX[w]=WORDIDX[w]||c.id}
function listenPool(){
  const seen=CARDS.filter(c=>S.cards[c.id]);
  return (seen.length>=8?seen:CARDS.slice(0,Math.max(20,seen.length)));
}
let lastSid=null;
function nextSent(){
  const now=Date.now(),pool=listenPool();
  const due=pool.filter(c=>S.sents[c.id]&&S.sents[c.id].due<=now&&S.sents[c.id].lvl<3&&c.id!==lastSid).sort((a,b)=>S.sents[a.id].lvl-S.sents[b.id].lvl||S.sents[a.id].due-S.sents[b.id].due);
  const fresh=pool.filter(c=>!S.sents[c.id]&&c.id!==lastSid);
  const fallback=CARDS.filter(c=>!S.sents[c.id]&&c.id!==lastSid);
  const soon=pool.filter(c=>S.sents[c.id]&&c.id!==lastSid).sort((a,b)=>S.sents[a.id].due-S.sents[b.id].due);
  const pick=due[0]||fresh[0]||fallback[0]||soon[0]||CARDS[0];
  lastSid=pick.id;
  const st=S.sents[pick.id];
  L={card:pick,t:toks(pick.ses),spd:Math.min(2,st?st.lvl:0),count:false,text:false,trans:false,typing:false,ok:null,added:[],explain:false,plays:0};
}
function wordsHTML(){
  const t=L.t;let h='';
  t.forEach((w,i)=>{
    let cls='w';if(!L.text)cls+=' blank';if(L.ok)cls+=L.ok[i]?' ok':' miss';
    const width=!L.text?` style="width:${(w.core.length*.62+.3).toFixed(2)}em"`:'';
    h+=`<button class="${cls}" data-act="tapword" data-arg="${i}"${width} aria-label="${L.text?esc(w.core):'word '+(i+1)}" lang="es">${L.text?esc(w.raw.replace(/^[—-]/,'')):'·'}</button>`;
    if(i<t.length-1){const lt=L.text?linkType(w,t[i+1]):0;h+=lt?`<span class="lk l${lt}" aria-hidden="true"></span>`:'<span class="gap"></span>'}
  });
  return `<div class="words" id="words">${h}</div>`;
}
function listenHTML(){
  const k=L.card,st=S.sents[k.id];
  const lvl=st?st.lvl:0;
  let h=`<div class="bar"><button class="iconbtn" data-act="go" data-arg="home" aria-label="Back to home">${I.back}</button><h2>Listening</h2>
    <div class="chips"><span class="chip">${lvl>=3?'Full speed ✓':'Target: '+LNAME[Math.min(lvl,2)]}</span></div></div>
  <div class="speeds" role="group" aria-label="Speed">${LAD.map((r,i)=>`<button class="${i===L.spd?'on':''}" data-act="spd" data-arg="${i}" aria-pressed="${i===L.spd}"><b>${LNAME[i]}</b><span>${Math.round(r*100)}%</span></button>`).join('')}</div>
  <div class="player">
    <div class="side"><button class="btn plain" data-act="chunks">In pieces</button></div>
    <button class="playbig" data-act="play" aria-label="Play sentence">${I.play}</button>
    <div class="side"><button class="btn plain" data-act="slower">Slower</button></div>
  </div>`;
  if(!L.plays&&!L.count&&!L.text)h+=`<p class="muted small" style="text-align:center">Listen first. Replay as often as you like. Reveal more only when you need it.</p>`;
  h+=`<section class="panel">`;
  if(L.count||L.text){
    h+=`<span class="label">${L.text?'The sentence':'Word count: '+L.t.length+' words'}</span>${wordsHTML()}`;
    h+=`<p class="muted small">Tap any word to hear it on its own.</p>`;
    if(L.text)h+=`<div class="legend"><span><i></i>vowels merge</span><span><i class="l1"></i>consonant slides over</span><button class="btn small line" data-act="explain">${L.explain?'Hide':'Why?'}</button></div>
      ${L.explain?`<p class="explain">Spanish doesn't pause between words. When one word ends in a vowel and the next starts with one, they melt into a single syllable: <i>va a ir</i> sounds like “vair”, <i>lo que es</i> like “lo-kes”. A final consonant jumps onto the next word's vowel: <i>los amigos</i> sounds like “lo-sa-mi-gos”. A silent <i>h</i> doesn't stop the blend.</p>`:''}`;
    if(L.trans)h+=`<p class="trans">${esc(k.sen)}</p>`;
  }
  if(L.ok){const n=L.ok.filter(Boolean).length;h+=`<p class="score">${n} of ${L.ok.length} words${n===L.ok.length?'. Perfect!':''}</p>`}
  if(L.added.length)h+=`<p class="added">Added to your flashcards: <b>${L.added.map(id=>esc(BYID[id].es)).join(', ')}</b></p>`;
  if(L.typing&&!L.ok)h+=`<label class="label" for="dict">Type what you hear</label><textarea id="dict" rows="2" lang="es" autocomplete="off" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="Accents optional"></textarea><button class="btn" data-act="dictcheck">Check</button>`;
  const steps=[];
  if(!L.count&&!L.text)steps.push(['count','Count the words']);
  if(!L.typing&&!L.text)steps.push(['type','Type it']);
  if(!L.text)steps.push(['text','Show the text']);
  else if(!L.trans)steps.push(['trans','Translation']);
  if(steps.length)h+=`<div class="row">${steps.map(([a,lbl])=>`<button class="btn line small grow" data-act="${a}">${lbl}</button>`).join('')}</div>`;
  h+=`</section>`;
  if(L.text){
    const def=L.ok?(L.ok.every(Boolean)?3:L.ok.filter(Boolean).length/L.ok.length>=.6?2:1):0;
    h+=`<span class="label">How did you do at ${LNAME[L.spd].toLowerCase()} speed?</span><div class="lrates">
      ${[[1,'Missed it'],[2,'Partly'],[3,'Got it']].map(([n,lbl])=>`<button class="rate r${n}${n===def?' def':''}" data-act="lrate" data-arg="${n}"><b>${lbl}</b></button>`).join('')}</div>`;
  }
  return h;
}
function highlight(ci){const w=document.querySelectorAll('#words .w');if(!w.length)return;let idx=0;L.t.forEach((t,i)=>{if(t.start<=ci)idx=i});w.forEach((e,i)=>e.classList.toggle('on',i===idx))}
function playSent(rate){
  L.plays++;const first=L.plays===1;if(first)render();
  const pb=document.querySelector('.playbig');pb&&pb.classList.add('speaking');
  speak(L.card.ses,rate,{onword:ci=>highlight(ci),onend:()=>{document.querySelector('.playbig')?.classList.remove('speaking');document.querySelectorAll('.w.on').forEach(e=>e.classList.remove('on'))}});
}
function dictCheck(){
  const typed=norm(document.getElementById('dict').value).split(' ').filter(Boolean).map(deacc);
  const exp=L.t.map(t=>deacc(norm(t.core)));
  const n=exp.length,m=typed.length,dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=close(typed[j],exp[i])?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const ok=new Array(n).fill(false);let i=0,j=0;
  while(i<n&&j<m){if(close(typed[j],exp[i])){ok[i]=true;i++;j++}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++}
  L.ok=ok;L.text=true;
  // missed words that are in the deck go to flashcards
  const add=new Set();const own=L.card;
  ok.forEach((good,i)=>{if(good)return;const w=exp[i];let id=WORDIDX[norm(L.t[i].core)];
    if(!id){const base=deacc(splitArt(norm(own.alts[0]))[1]).replace(/se$/,'');const stem=own.tag==='v'?base.slice(0,-2):base.slice(0,-1);if(stem.length>=3&&w.startsWith(stem))id=own.id}
    if(id)add.add(id)});
  const now=Date.now();
  for(const id of add){const s=S.cards[id];if(!s)S.cards[id]={due:now,ivl:0,ease:2.5,reps:0,lapses:0,step:0};else if(s.due>now)s.due=now}
  L.added=[...add];save();render();
}
function rateSent(n){
  const k=L.card,now=Date.now(),st=S.sents[k.id]||{lvl:0,due:now,n:0};
  if(n===3){st.lvl=Math.max(st.lvl,L.spd+1);st.due=now+[0,10*MIN,DAY,4*DAY][st.lvl]}
  else if(n===2){st.due=now+3*MIN}
  else{st.lvl=Math.min(st.lvl,L.spd);st.due=now+2*MIN}
  st.n++;S.sents[k.id]=st;S.day.listened++;bumpStreak();save();
  stopSpeech();nextSent();render();window.scrollTo(0,0);
}

// ----- settings -----
function settingsHTML(){
  const st=S.settings,cv=voice();
  const opts=VOICES.map(v=>`<option value="${esc(v.voiceURI)}"${cv&&v.voiceURI===cv.voiceURI?' selected':''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('');
  return `<div class="bar"><button class="iconbtn" data-act="go" data-arg="home" aria-label="Back to home">${I.back}</button><h2>Settings</h2></div>
  <section class="panel">
    <div class="field"><label class="label" for="voice">Voice</label>
      ${VOICES.length?`<select id="voice" data-set="voice">${opts}</select>`:'<p class="muted small">No Spanish voices found. On iPhone, add one in Settings → Accessibility → Spoken Content → Voices → Spanish.</p>'}
    </div>
    <button class="btn plain small" data-act="saysent" data-arg="Hola, ¿qué tal? Vamos a aprender español poco a poco.">${I.spk} Test voice</button>
  </section>
  <section class="panel">
    <div class="field"><label class="label" for="npd">New words per day</label>
      <select id="npd" data-set="newPerDay">${[5,10,15,20,30].map(n=>`<option${n===st.newPerDay?' selected':''}>${n}</option>`).join('')}</select></div>
    <div class="field"><span class="label">Answer style</span>
      <div class="seg" role="group"><button class="${st.mode==='type'?'on':''}" data-act="mode" data-arg="type" aria-pressed="${st.mode==='type'}">Type it</button><button class="${st.mode==='flip'?'on':''}" data-act="mode" data-arg="flip" aria-pressed="${st.mode==='flip'}">Flip card</button></div></div>
    <div class="field"><span class="label">Say the answer out loud when shown</span>
      <div class="seg" role="group"><button class="${st.autoplay?'on':''}" data-act="auto" data-arg="1" aria-pressed="${st.autoplay}">On</button><button class="${!st.autoplay?'on':''}" data-act="auto" data-arg="0" aria-pressed="${!st.autoplay}">Off</button></div></div>
  </section>
  <section class="panel">
    <span class="label">Backup</span>
    <p class="muted small">Progress is saved on this device only. Copy it somewhere safe, or paste a backup to restore it.</p>
    <textarea id="backup" spellcheck="false" placeholder="Paste a backup here to restore"></textarea>
    <div class="row"><button class="btn plain small grow" data-act="export">Copy progress</button><button class="btn plain small grow" data-act="import">Restore from box</button></div>
  </section>
  <section class="panel">
    <span class="label danger">Start over</span>
    ${confirmReset?`<p class="small">This erases every card and listening level on this device. It can't be undone.</p><div class="row"><button class="btn dangerbtn small grow" data-act="reset2">Erase progress</button><button class="btn plain small grow" data-act="reset0">Keep it</button></div>`:`<button class="btn plain small" data-act="reset1">Reset progress…</button>`}
  </section>
  <p class="muted small" style="text-align:center">${CARDS.length} words · build __BUILD__</p>`;
}

// ---------- events ----------
app.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act,arg=b.dataset.arg;
  switch(a){
    case 'go':go(arg);break;
    case 'acc':{const i=document.getElementById('ans');if(!i)break;const s=i.selectionStart??i.value.length,en=i.selectionEnd??s;i.value=i.value.slice(0,s)+arg+i.value.slice(en);i.focus();i.setSelectionRange(s+1,s+1);break}
    case 'check':showAnswer(grade(cur.card,document.getElementById('ans').value));break;
    case 'idk':showAnswer({kind:'wrong',def:1,label:"Here's the answer"});break;
    case 'hint':cur.hint=hintFor(cur.card);{const v=document.getElementById('ans')?.value||'';render();const i=document.getElementById('ans');if(i)i.value=v}break;
    case 'reveal':showAnswer(null);break;
    case 'rate':rateCard(+arg);break;
    case 'more':S.day.extra+=5;save();nextCardUI();render();break;
    case 'sayword':say(arg,.8);break;
    case 'saysent':say(arg,.9);break;
    case 'spd':L.spd=+arg;render();playSent(LAD[L.spd]);break;
    case 'play':playSent(LAD[L.spd]);break;
    case 'slower':playSent(Math.max(.45,LAD[L.spd]-.2));break;
    case 'chunks':{L.plays++;const ch=chunksOf(L.t);if(!L.count&&!L.text){L.count=true;render()}
      speakChunks(ch.map(c=>({text:c.map(i=>L.t[i].core).join(' ')})),Math.max(.5,LAD[L.spd]-.1),{onchunk:n=>{document.querySelectorAll('#words .w').forEach((e,i)=>e.classList.toggle('on',ch[n].includes(i)))},onend:()=>document.querySelectorAll('.w.on').forEach(e=>e.classList.remove('on'))});break}
    case 'tapword':{const w=L.t[+arg];if(w){say(w.core,.7);document.querySelectorAll('#words .w').forEach((e,i)=>e.classList.toggle('on',i===+arg));setTimeout(()=>document.querySelectorAll('.w.on').forEach(e=>e.classList.remove('on')),900)}break}
    case 'count':L.count=true;render();break;
    case 'type':L.typing=true;L.count=true;render();document.getElementById('dict')?.focus();break;
    case 'dictcheck':dictCheck();break;
    case 'text':L.text=true;L.count=true;render();break;
    case 'trans':L.trans=true;render();break;
    case 'explain':L.explain=!L.explain;render();break;
    case 'lrate':rateSent(+arg);break;
    case 'mode':S.settings.mode=arg;save();render();break;
    case 'auto':S.settings.autoplay=arg==='1';save();render();break;
    case 'export':{const txt=JSON.stringify(S);const box=document.getElementById('backup');box.value=txt;
      const fall=()=>{box.focus();box.select();toast('Selected. Copy it from the box.')};
      try{navigator.clipboard.writeText(txt).then(()=>toast('Progress copied.'),fall)}catch(err){fall()}break}
    case 'import':{try{const s=JSON.parse(document.getElementById('backup').value);if(!s||!s.cards)throw 0;const b=blank();S={...b,...s,settings:{...b.settings,...s.settings},day:{...b.day,...s.day},streak:{...b.streak,...s.streak}};save();toast('Progress restored.');render()}catch(err){toast("That doesn't look like a Poco a Poco backup.")}break}
    case 'reset1':confirmReset=true;render();break;
    case 'reset0':confirmReset=false;render();break;
    case 'reset2':S=blank();save();confirmReset=false;toast('Progress erased.');render();break;
  }
});
app.addEventListener('change',e=>{const k=e.target.dataset.set;if(!k)return;S.settings[k]=k==='newPerDay'?+e.target.value:e.target.value;save();if(k==='voice')say('Hola, ¿qué tal?',.9)});
app.addEventListener('keydown',e=>{
  if(view!=='cards'||!cur||cur.done)return;
  if(e.target.id==='ans'&&e.key==='Enter'){e.preventDefault();showAnswer(grade(cur.card,e.target.value));return}
  if(cur.phase==='shown'&&e.target.tagName!=='TEXTAREA'){if(e.key==='Enter'){e.preventDefault();rateCard(cur.def)}else if(/^[1-4]$/.test(e.key))rateCard(+e.key)}
});
document.addEventListener('keydown',e=>{if(view==='cards'&&cur&&cur.phase==='shown'&&e.target===document.body){if(e.key==='Enter')rateCard(cur.def);else if(/^[1-4]$/.test(e.key))rateCard(+e.key)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSpeech();else if(view==='home')render()});

rollDay();render();
})();
