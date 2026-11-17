(()=>{
'use strict';
// ================= data =================
const DECK=/*@DECK@*/[];
const TAGS={v:'verb',n:'noun',adj:'adjective',adv:'adverb',prep:'preposition',conj:'connector',pron:'pronoun',num:'number',phr:'phrase',q:'question word'};
const CARDS=DECK.map((d,i)=>({id:d[0],alts:d[0].split('/'),es:d[0].split('/')[0],en:d[1],tag:d[2],ses:d[3],sen:d[4],i}));
const BYID=Object.fromEntries(CARDS.map(c=>[c.id,c]));
const MIN=6e4,HOUR=36e5,DAY=864e5;
const LAD=[.6,.8,1],LNAME=['Slow','Steady','Natural'];
const app=document.getElementById('app');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=s=>document.querySelector(s);

// ================= storage =================
const KEY='pocoapoco-v1';
const blank=()=>({cards:{},sents:{},settings:{voice:'',newPerDay:10,style:'mixed',answer:'voice',sounds:true},day:{date:'',newDone:0,reviews:0,listened:0,extra:0},streak:{last:'',n:0}});
function merge(s){const b=blank();return {...b,...s,settings:{...b.settings,...s.settings},day:{...b.day,...s.day},streak:{...b.streak,...s.streak}}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.cards)return merge(s)}catch(e){}return blank()}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function rollDay(){const t=ymd(new Date());if(S.day.date!==t)S.day={date:t,newDone:0,reviews:0,listened:0,extra:0}}
function bumpStreak(){const t=ymd(new Date());if(S.streak.last===t)return;const y=new Date();y.setDate(y.getDate()-1);S.streak.n=S.streak.last===ymd(y)?S.streak.n+1:1;S.streak.last=t}
function streakNow(){const t=ymd(new Date()),y=new Date();y.setDate(y.getDate()-1);return (S.streak.last===t||S.streak.last===ymd(y))?S.streak.n:0}

// ================= text helpers =================
const deacc=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'');
const norm=s=>s.toLowerCase().replace(/[¿?¡!.,;:"“”()…—]/g,' ').replace(/\s+/g,' ').trim();
const NUMW={'1':'uno','2':'dos','3':'tres','4':'cuatro','5':'cinco','6':'seis','7':'siete','8':'ocho','9':'nueve','10':'diez','20':'veinte','100':'cien'};
const normS=s=>norm(s).split(' ').map(w=>NUMW[w]||w).join(' ');
const ARTG={el:'m',un:'m',los:'m',unos:'m',la:'f',una:'f',las:'f',unas:'f'};
function splitArt(s){const w=s.split(' ');return (w.length>1&&ARTG[w[0]])?[w[0],w.slice(1).join(' ')]:['',s]}
function lev(a,b){if(Math.abs(a.length-b.length)>2)return 9;const d=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t}}return d[b.length]}
const close=(a,b)=>a===b||(b.length>=5&&lev(a,b)<=1);
const baseEn=s=>s.toLowerCase().replace(/\(.*?\)/g,'').split('/').map(x=>x.trim().replace(/^(the|to|a) /,'')).filter(Boolean);
// how a word sounds, roughly: lets speech recognition spell "ola" for hola or "bamos" for vamos
function phon(w){return deacc(w.toLowerCase()).replace(/[^a-z]/g,'').replace(/ch/g,'ç').replace(/h/g,'').replace(/ll/g,'y').replace(/v/g,'b').replace(/z/g,'s')
  .replace(/c([ei])/g,'s$1').replace(/qu/g,'k').replace(/c/g,'k').replace(/gu([ei])/g,'ǧ$1').replace(/g([ei])/g,'j$1').replace(/ǧ/g,'g').replace(/x/g,'ks').replace(/y$/,'i').replace(/(.)\1/g,'$1')}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function targetsOf(card){const t=[];for(const alt of card.alts){const x=norm(alt);t.push(x);if(card.tag==='adj'&&/o$/.test(x))t.push(x.slice(0,-1)+'a')}return t}
function sameMeaning(a,b){const x=baseEn(a.en);return baseEn(b.en).some(y=>x.includes(y))}

// typed answer -> right | close | wrong
function gradeTyped(card,input){
  const a=norm(input);if(!a)return {kind:'wrong'};
  const show=card.es;
  for(const t of targetsOf(card)){
    if(a===t)return {kind:'right'};
    const [ta,tw]=splitArt(t),[aa,aw]=splitArt(a);
    const tests=[[(x,y)=>x===y,''],[(x,y)=>deacc(x)===deacc(y),'accent'],[(x,y)=>close(deacc(x),deacc(y)),'typo']];
    for(const [test,why] of tests){
      let ok=false,art='';
      if(ta){if(test(aw,tw)){ok=true;art=!aa?'missing':(ARTG[aa]===ARTG[ta]?'':'gender')}else if(!aa&&test(a,tw)){ok=true;art='missing'}}
      else if(test(a,t))ok=true;
      if(!ok)continue;
      if(art==='gender')return {kind:'close',note:`Check the gender: it's <b>${esc(show)}</b>.`};
      if(why==='accent')return {kind:'close',note:`Watch the accent: <b>${esc(show)}</b>.`};
      if(why==='typo')return {kind:'close',note:`Small typo: <b>${esc(show)}</b>.`};
      return {kind:'right',note:art==='missing'?`Learn it with its article: <b>${esc(show)}</b>.`:''};
    }
  }
  return otherCard(card,[a])||{kind:'wrong'};
}
// spoken answer: any of the recognizer's guesses containing the word counts
function gradeSpoken(card,texts){
  let best=null;
  for(const text of texts){
    const tw=normS(text).split(' ').filter(Boolean),tp=tw.map(phon);
    for(const t of targetsOf(card)){
      const [art,core]=splitArt(t),cp=core.split(' ').map(phon);
      for(let i=0;i+cp.length<=tp.length;i++){
        if(!cp.every((p,k)=>tp[i+k]===p||(p.length>=5&&lev(tp[i+k],p)<=1)))continue;
        if(art&&i>0&&ARTG[tw[i-1]]&&ARTG[tw[i-1]]!==ARTG[art]){best=best||{kind:'close',note:`Check the gender: it's <b>${esc(card.es)}</b>.`};continue}
        return {kind:'right'};
      }
      if(cp.length>1&&tp.join('').includes(cp.join('')))return {kind:'right'};
    }
  }
  return best||otherCard(card,texts.map(normS));
}
function otherCard(card,texts){
  for(const o of CARDS){if(o===card||!sameMeaning(card,o))continue;
    for(const text of texts){const tp=text.split(' ').map(phon);
      if(o.alts.some(alt=>{const core=splitArt(norm(alt))[1].split(' ').map(phon).join(' ');return (' '+tp.join(' ')+' ').includes(' '+core+' ')}))
        return {kind:'wrong',note:`<b>${esc(o.es)}</b> means that too, but this card is <b>${esc(card.es)}</b>.`};}
  }
  return null;
}

// ================= speech out =================
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
let speakGen=0,estTimer=0,speakingNow=false;
function utter(text,rate){const u=new SpeechSynthesisUtterance(text);const v=voice();if(v){u.voice=v;u.lang=v.lang}else u.lang='es-ES';u.rate=rate;return u}
function stopSpeech(){speakGen++;speakingNow=false;if(SYN)SYN.cancel();clearInterval(estTimer);document.querySelectorAll('.w.on').forEach(e=>e.classList.remove('on'));$('.playbig')?.classList.remove('speaking')}
// speak; onword(charIndex) drives the word highlight (estimated when the voice sends no word boundaries); onend always fires
function speak(text,rate,{onword,onend}={}){
  if(!SYN){onend&&setTimeout(onend,300);return}
  stopSpeech();const gen=speakGen;speakingNow=true;
  const u=utter(text,rate);let gotB=false,t0=0,ended=false;
  const fin=()=>{if(ended||gen!==speakGen)return;ended=true;speakingNow=false;clearInterval(estTimer);Mic.quietUntil=Date.now()+1200;onend&&onend()};
  u.onstart=()=>{t0=performance.now();if(!onword)return;onword(0);
    setTimeout(()=>{if(gotB||gen!==speakGen)return;const cps=13.5*rate;estTimer=setInterval(()=>{if(gen!==speakGen){clearInterval(estTimer);return}const ci=Math.floor((performance.now()-t0)/1000*cps);if(ci>text.length)clearInterval(estTimer);else onword(ci)},90)},450)};
  u.onboundary=e=>{if(e.name&&e.name!=='word')return;gotB=true;clearInterval(estTimer);onword&&onword(e.charIndex)};
  u.onend=u.onerror=fin;
  // safety net: some browsers drop onend
  const cap=Date.now()+text.length*220/rate+4000; // never let a stuck voice stall the app
  const guard=()=>{if(ended||gen!==speakGen)return;if(SYN.speaking&&Date.now()<cap)setTimeout(guard,800);else{if(SYN.speaking)SYN.cancel();fin()}};
  setTimeout(guard,Math.max(2500,text.length*160/rate));
  SYN.speak(u);
}
function speakChunks(chunks,rate,{onchunk,onend}={}){
  if(!SYN)return;stopSpeech();const gen=speakGen;speakingNow=true;
  chunks.forEach((c,i)=>{const u=utter(c,rate);u.onstart=()=>{if(gen===speakGen)onchunk&&onchunk(i)};if(i===chunks.length-1)u.onend=u.onerror=()=>{if(gen!==speakGen)return;speakingNow=false;Mic.quietUntil=Date.now()+1200;onend&&onend()};SYN.speak(u)});
}
// one tiny two-note chime for right / wrong
let AC=null;
function unlockAudio(){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch(e){}}
function chime(ok){if(!S.settings.sounds||!AC)return;try{const t=AC.currentTime;(ok?[660,990]:[330,247]).forEach((f,i)=>{const o=AC.createOscillator(),g=AC.createGain(),st=t+i*.09;o.type=ok?'sine':'triangle';o.frequency.value=f;g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(ok?.12:.09,st+.012);g.gain.exponentialRampToValueAtTime(.001,st+.26);o.connect(g).connect(AC.destination);o.start(st);o.stop(st+.3)})}catch(e){}}

// ================= speech in (microphone) =================
// 'sr' = the browser's own speech recognition (Safari / Chrome tabs and the home-screen app)
// 'dict' = claude.ai artifact dictation (Chromium + Claude desktop app); otherwise typing
const SRC=window.SpeechRecognition||window.webkitSpeechRecognition;
const inFrame=(()=>{try{return window.top!==window}catch(e){return true}})();
const Mic={kind:(SRC&&!inFrame)?'sr':null,needTap:false,rec:null,d:null,dictOn:false,cb:null,quietUntil:0,live:false,
  route(text,final){if(!this.cb||Date.now()<this.quietUntil||speakingNow)return;text=text.trim();if(!text)return;this.cb.onText([text],final)}};
if(!Mic.kind&&window.claude&&typeof window.claude.use==='function'){
  window.claude.use('dictation').then(d=>{if(!d)return;Mic.d=d;Mic.kind='dict';Mic.needTap=true;
    d.onPartial(({text})=>Mic.route(text,false));d.onFinal(({text})=>Mic.route(text,true));
    d.onState(({state,reason})=>{Mic.dictOn=state!=='idle';Mic.live=state==='listening';
      if(state==='idle'){Mic.needTap=true;if(reason==='not_granted'||reason==='unavailable')Mic.kind=null;if(Mic.cb)Mic.cb.onFail('tap')}
      paintMic()});
    if(view==='home')render()}).catch(()=>{});
}
const micLang=()=>{const v=voice();return v&&/^es/i.test(v.lang)?v.lang.replace('_','-'):'es-MX'};
function micStop(){Mic.cb=null;Mic.live=Mic.kind==='dict'&&Mic.dictOn;if(Mic.rec){const r=Mic.rec;Mic.rec=null;Mic.live=false;try{r.abort()}catch(e){}}paintMic()}
function micEnd(){micStop();if(Mic.d&&Mic.dictOn)Mic.d.stop().catch(()=>{})}
// listen for one answer. cb = {onText(texts, final), onFail(why)}; gesture = called straight from a tap
function micListen(cb,gesture){
  micStop();Mic.cb=cb;
  if(Mic.kind==='dict'){
    if(Mic.dictOn){Mic.live=true;paintMic();return}
    if(!gesture){Mic.needTap=true;cb.onFail('tap');return}
    Mic.d.start({language:'es'}).then(()=>{Mic.needTap=false;paintMic()}).catch(e=>{if(e&&(e.code==='not_granted'||e.code==='unavailable')){Mic.kind=null;cb.onFail('blocked')}else{Mic.needTap=true;cb.onFail('tap')}});
    return;
  }
  if(Mic.kind!=='sr'){cb.onFail('blocked');return}
  const r=new SRC();r.lang=micLang();r.interimResults=true;r.maxAlternatives=5;r.continuous=false;
  let finalSeen=false,failed=false,last=null;
  r.onresult=e=>{if(Mic.rec!==r)return;const res=e.results[e.results.length-1];const n=Math.max(1,res.length);const texts=[];
    for(let k=0;k<n;k++)texts.push(Array.from(e.results).map(rr=>(rr[k]||rr[0]).transcript).join(' '));
    last=texts;if(res.isFinal)finalSeen=true;cb.onText(texts,res.isFinal)};
  r.onerror=e=>{if(Mic.rec!==r||e.error==='aborted')return;failed=true;Mic.live=false;
    if(e.error==='not-allowed'||e.error==='service-not-allowed'){if(gesture){Mic.kind=null;cb.onFail('blocked')}else{Mic.needTap=true;cb.onFail('tap')}}
    else if(e.error==='network')cb.onFail('network');else cb.onFail('silence');paintMic()};
  r.onend=()=>{if(Mic.rec!==r)return;Mic.rec=null;Mic.live=false;paintMic();if(failed||finalSeen)return;if(last)cb.onText(last,true);else cb.onFail('silence')};
  Mic.rec=r;
  try{r.start();Mic.live=true;Mic.needTap=false}catch(e){Mic.rec=null;Mic.needTap=true;cb.onFail('tap')}
  paintMic();
}
function paintMic(){const m=$('.mic');if(!m)return;const on=!!(Mic.live&&Mic.cb);m.classList.toggle('live',on);m.classList.toggle('idle',!on);m.setAttribute('aria-label',on?'Listening':'Tap to speak');
  const h=$('#heard');if(h&&!h.querySelector('b'))h.textContent=on?'Listening…':'Tap the mic and say it'}
const voiceOK=()=>S.settings.answer==='voice'&&!!Mic.kind;

// ================= icons / toast =================
const I={
  spk:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z" fill="currentColor"/></svg>',
  mic:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
};
const spkBtn=(arg,label,rate='.85')=>`<button class="iconbtn" data-act="say" data-arg="${esc(arg)}" data-rate="${rate}" aria-label="${esc(label)}">${I.spk}</button>`;
let toastT=0;
function toast(msg){$('.toast')?.remove();const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=msg;document.body.appendChild(t);clearTimeout(toastT);toastT=setTimeout(()=>t.remove(),2800)}

// ================= scheduling (the app decides) =================
const newLeft=()=>Math.max(0,S.settings.newPerDay+S.day.extra-S.day.newDone);
function dueCounts(){const now=Date.now();let due=0,unseen=0;for(const c of CARDS){const s=S.cards[c.id];if(!s)unseen++;else if(s.step>=0||s.due<=now)due++}return {due,nw:Math.min(newLeft(),unseen),unseen}}
function nextDueIn(){let m=Infinity;for(const id in S.cards)m=Math.min(m,S.cards[id].due);return m===Infinity?null:m-Date.now()}
function spanLong(ms){ms=Math.max(0,ms);if(ms<HOUR)return Math.max(1,Math.round(ms/MIN))+' min';if(ms<DAY)return Math.round(ms/HOUR)+' h';const d=Math.round(ms/DAY);return d+(d===1?' day':' days')}
// called once a card is finished for this session. misses = wrong answers today, close = near misses, fast = answered quickly
function finishCard(id,{misses,close,fast,practice}){
  const now=Date.now(),old=S.cards[id];let s=old?{...old}:{ivl:0,ease:2.5,reps:0,lapses:0};
  s.reps=(s.reps||0)+1;
  const fuzz=.93+Math.random()*.14;
  if(practice){if(misses){s.ivl=Math.max(1,Math.round((s.ivl||1)*.5));s.due=now+s.ivl*DAY-3*HOUR}S.cards[id]=s;return}
  if(!old||old.step>=0||!old.ivl){          // brand new or still learning
    s.ivl=misses?1:(fast&&!close?3:2);s.ease=Math.max(1.3,2.5-.15*misses-(close?.1:0));
  }else if(misses){                          // forgot it
    s.lapses=(s.lapses||0)+1;s.ease=Math.max(1.3,s.ease-.2);s.ivl=Math.max(1,Math.round(s.ivl*.3));
  }else if(close){
    s.ivl=Math.max(s.ivl+1,Math.round(s.ivl*1.2*fuzz));s.ease=Math.max(1.3,s.ease-.1);
  }else{
    s.ivl=Math.max(s.ivl+1,Math.round(s.ivl*s.ease*(fast?1.15:1)*fuzz));if(fast)s.ease=Math.min(3,s.ease+.05);
  }
  s.step=-1;s.due=now+s.ivl*DAY-3*HOUR;S.cards[id]=s;
}

// ================= flashcard session =================
let SES=null;
function prodMode(){return voiceOK()?'say':'type'}
function testFor(c){
  const st=S.settings.style,s=S.cards[c.id];
  if(st==='pick')return 'pick';if(st==='say')return 'prod';
  if(!s||s.step>=0||s.ivl<4)return Math.random()<.65?'pick':'prod';
  return Math.random()<.8?'prod':'pick';
}
function buildSession(){
  rollDay();const now=Date.now();
  const lrn=CARDS.filter(c=>S.cards[c.id]&&S.cards[c.id].step>=0);
  const rev=CARDS.filter(c=>{const s=S.cards[c.id];return s&&s.step<0&&s.due<=now}).sort((a,b)=>S.cards[a.id].due-S.cards[b.id].due).slice(0,30);
  const nw=CARDS.filter(c=>!S.cards[c.id]).slice(0,Math.min(newLeft(),10));
  let base=shuffle([...lrn,...rev]),practice=false;
  if(!base.length&&!nw.length){practice=true;base=shuffle(CARDS.filter(c=>S.cards[c.id]).sort((a,b)=>S.cards[a.id].due-S.cards[b.id].due).slice(0,12))}
  if(!base.length&&!nw.length)return null;
  const q=base.map(c=>({id:c.id,t:testFor(c)}));
  nw.forEach((c,i)=>q.splice(Math.min(q.length,i*3),0,{id:c.id,t:'intro'}));
  return {q,i:0,practice,fresh:new Set(nw.map(c=>c.id)),miss:{},close:{},fast:{},phase:'ask',paused:false,silence:0,timer:0,t0:0,missedIds:[],res:null,heard:'',choice:null};
}
function startSession(){SES=buildSession();view='session';if(!SES){view='home';toast('Nothing to study yet.');render();return}showItem(true)}
const curItem=()=>SES&&SES.q[SES.i];
const pendingLater=id=>SES.q.slice(SES.i+1).some(x=>x.id===id);
function insertLater(item,gap){SES.q.splice(Math.min(SES.q.length,SES.i+1+gap),0,item)}
function clearTimers(){if(SES){clearTimeout(SES.timer);SES.timer=0}}
// show the current item and start whatever it needs (audio, microphone)
function showItem(gesture){
  clearTimers();micStop();
  if(!SES)return;
  if(SES.i>=SES.q.length){SES.phase='done';stopSpeech();micEnd();render();chime(true);return}
  const it=curItem(),c=BYID[it.id];
  SES.phase='ask';SES.res=null;SES.heard='';SES.choice=null;SES.t0=Date.now();
  if(it.t==='intro'){
    if(!S.cards[c.id]){S.cards[c.id]={due:Date.now(),ivl:0,ease:2.5,reps:0,lapses:0,step:0};S.day.newDone++;save()}
    render();
    if(SES.paused)return;
    speak(c.es,.8,{onend:()=>{if(curItem()!==it||SES.paused)return;SES.timer=setTimeout(()=>{if(curItem()!==it||SES.paused)return;
      speak(c.ses,.9,{onend:()=>{if(curItem()!==it||SES.paused)return;autoNext(1400)}})},350)}});
    return;
  }
  if(it.t==='pick'){it.opts=it.opts||pickOptions(c);render();if(!SES.paused)speak(c.es,.85);return}
  render();
  if(SES.paused)return;
  if(prodMode()==='say')startListening(gesture);
  else{const a=$('#ans');if(a)a.focus()}
}
function pickOptions(c){
  const ok=o=>o!==c&&!sameMeaning(c,o)&&!sameMeaning(o,c);
  const same=shuffle(CARDS.filter(o=>o.tag===c.tag&&ok(o))).slice(0,5);
  const rest=shuffle(CARDS.filter(o=>o.tag!==c.tag&&ok(o))).slice(0,7-same.length);
  return shuffle([c,...same,...rest]).map(o=>o.id);
}
function startListening(gesture){
  const it=curItem();if(!it)return;
  micListen({
    onText:(texts,final)=>{
      if(curItem()!==it||SES.phase!=='ask')return;
      SES.heard=texts[0];const h=$('#heard');if(h)h.innerHTML=`<b>${esc(texts[0])}</b>`;
      const g=gradeSpoken(BYID[it.id],texts);
      if(g&&g.kind==='right'){answer(g);return}
      if(final){SES.silence=0;answer(g&&g.kind==='close'?g:{kind:'wrong',note:g&&g.note})}
    },
    onFail:why=>{
      if(curItem()!==it||SES.phase!=='ask')return;
      if(why==='silence'){SES.silence++;if(SES.silence<2&&Mic.kind==='sr'){startListening(false);return}
        SES.silence=0;pause("I didn't hear anything. Tap when you're ready.");return}
      if(why==='blocked'){toast('Microphone is off for this app. Switching to typing.');render();const a=$('#ans');a&&a.focus();return}
      if(why==='network'){toast('Speech recognition needs a connection here. Type this one.');Mic.kind=null;render();return}
      render(); // 'tap': show the big mic button
    }
  },gesture);
  // dictation has no silence event: stop waiting after a while
  if(Mic.kind==='dict'){SES.timer=setTimeout(()=>{if(curItem()===it&&SES.phase==='ask'&&!SES.heard&&Mic.dictOn)pause("I didn't hear anything. Tap when you're ready.")},12000)}
}
function answer(res){
  const it=curItem();if(!it||SES.phase!=='ask')return;const c=BYID[it.id];
  micStop();clearTimers();
  SES.phase='fb';SES.res=res;
  const ms=Date.now()-SES.t0,fast=ms<(it.t==='pick'?3500:4500);
  if(res.kind==='wrong'){
    SES.miss[it.id]=(SES.miss[it.id]||0)+1;if(!SES.missedIds.includes(it.id))SES.missedIds.push(it.id);
    insertLater({id:it.id,t:it.t},3);
    chime(false);render();
    speak(c.es,.8,{onend:()=>{if(curItem()===it&&SES.phase==='fb')autoNext(1500)}});
  }else{
    if(res.kind==='close')SES.close[it.id]=1;
    SES.fast[it.id]=(SES.fast[it.id]!==false)&&fast&&res.kind==='right';
    // a word met for the first time today gets a second, harder test before it's done
    if(SES.fresh.has(it.id)&&it.t==='pick'&&S.settings.style==='mixed'&&!pendingLater(it.id))insertLater({id:it.id,t:'prod'},3);
    if(!pendingLater(it.id)){
      finishCard(it.id,{misses:SES.miss[it.id]||0,close:!!SES.close[it.id],fast:!!SES.fast[it.id],practice:SES.practice});
      S.day.reviews++;bumpStreak();save();
    }
    chime(true);render();
    if(res.kind==='close')speak(c.es,.85,{onend:()=>{if(curItem()===it&&SES.phase==='fb')autoNext(900)}});
    else autoNext(it.t==='pick'?900:1100);
  }
}
function autoNext(ms){clearTimers();if(!SES||SES.paused)return;const bar=$('#autobar');if(bar)bar.innerHTML=`<i style="animation-duration:${ms}ms"></i>`;SES.timer=setTimeout(advance,ms)}
function advance(){if(!SES)return;clearTimers();stopSpeech();
  const it=curItem();if(it&&it.t==='intro'&&!pendingLater(it.id))insertLater({id:it.id,t:S.settings.style==='say'?'prod':'pick'},2);
  SES.i++;showItem(false)}
function pause(msg){if(!SES)return;SES.paused=msg||'Paused';clearTimers();stopSpeech();micStop();render()}
function resume(){if(!SES)return;SES.paused=false;unlockAudio();if(SES.phase==='fb'){advance();return}showItem(true)}
function quitSession(){clearTimers();stopSpeech();micEnd();SES=null;go('home')}
function overrideRight(){ // "I said it right": the recognizer misheard
  const it=curItem();if(!it||SES.phase!=='fb')return;
  SES.miss[it.id]=Math.max(0,(SES.miss[it.id]||1)-1);if(!SES.miss[it.id])SES.missedIds=SES.missedIds.filter(x=>x!==it.id);
  const later=SES.q.findIndex((x,k)=>k>SES.i&&x.id===it.id);if(later>=0)SES.q.splice(later,1);
  SES.res={kind:'right',note:'Counted as right.'};
  if(!pendingLater(it.id)){finishCard(it.id,{misses:SES.miss[it.id]||0,close:false,fast:false,practice:SES.practice});S.day.reviews++;bumpStreak();save()}
  stopSpeech();render();autoNext(900);
}

function sessionHTML(){
  const total=SES.q.length,done=Math.min(SES.i,total);
  const pct=total?Math.round(done/total*100):100;
  let h=`<div class="top"><button class="iconbtn" data-act="quit" aria-label="End session">${I.x}</button>
    <div class="prog" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    ${SES.phase==='done'?'<span style="width:44px"></span>':`<button class="iconbtn" data-act="pause" aria-label="Pause">${I.pause}</button>`}</div>`;
  if(SES.phase==='done')return h+doneHTML();
  const it=curItem(),c=BYID[it.id],fb=SES.phase==='fb',r=SES.res;
  const prod=it.t==='prod'?prodMode():null;
  let stage='',dock='';
  const fbChip=r?`<span class="fb ${r.kind}">${r.kind==='right'?'¡Correcto!':r.kind==='close'?'Close enough':'Not quite'}</span>`:'';
  if(it.t==='intro'){
    stage=`<span class="q-label">New word · ${TAGS[c.tag]||c.tag}</span>
      <div class="q-big">${esc(c.en)}</div>
      <div class="q-row"><div class="q-es" lang="es">${esc(c.es)}</div>${spkBtn(c.es,'Hear the word','.8')}</div>
      ${c.alts.length>1?`<p class="note">also ${c.alts.slice(1).map(esc).join(', ')}</p>`:''}
      <p class="sent" lang="es">${esc(c.ses)}</p><p class="q-sub">${esc(c.sen)}</p>`;
    dock=`<div class="autobar" id="autobar"></div><p class="tapnote">Listen. It moves on by itself, or tap to skip.</p>`;
  }else if(it.t==='pick'){
    stage=`<span class="q-label">What does this mean?</span>
      <div class="q-row"><div class="q-es" lang="es">${esc(c.es)}</div>${spkBtn(c.es,'Hear it again','.8')}</div>
      ${fb?`${fbChip}${r.kind==='wrong'?`<p class="sent"><b>${esc(c.es)}</b> = ${esc(c.en)}</p>`:''}<p class="sent" lang="es">${esc(c.ses)}</p>`:''}`;
    dock=`<div class="opts">${it.opts.map(id=>{const o=BYID[id];let cls='opt';
      if(fb){if(id===c.id)cls+=' ok';else if(id===SES.choice)cls+=' bad';else cls+=' dim'}
      return `<button class="${cls}" data-act="pick" data-arg="${esc(id)}" ${fb?'tabindex="-1"':''}>${esc(o.en)}</button>`}).join('')}</div>
      ${fb?'<div class="autobar" id="autobar"></div>':''}`;
  }else{
    stage=`<span class="q-label">${prod==='say'?'Say it in Spanish':'Type it in Spanish'} · ${TAGS[c.tag]||c.tag}</span>
      <div class="q-big">${esc(c.en)}</div>
      ${fb?`${fbChip}<div class="q-row"><div class="q-es" lang="es">${esc(c.es)}</div>${spkBtn(c.es,'Hear it again','.8')}</div>${r.note?`<p class="note">${r.note}</p>`:''}<p class="sent" lang="es">${esc(c.ses)}</p>`
          :`<p class="q-sub">“${esc(c.sen)}”</p>`}`;
    if(prod==='say'){
      const live=!!(Mic.live&&Mic.cb);
      dock=fb?`${r.kind==='wrong'&&SES.heard?`<p class="heard">I heard: <b>${esc(SES.heard)}</b></p><div class="center"><button class="linkbtn" data-act="override">I said it right</button></div>`:''}<div class="autobar" id="autobar"></div>`
        :`<button class="mic ${live?'live':'idle'}" data-act="mic" aria-label="${live?'Listening':'Tap to speak'}">${I.mic}</button>
          <p class="heard" id="heard">${SES.heard?`<b>${esc(SES.heard)}</b>`:live?'Listening…':'Tap the mic and say it'}</p>
          <div class="center"><button class="linkbtn" data-act="idk">Show me</button></div>`;
    }else{
      dock=fb?`<div class="autobar" id="autobar"></div>`
        :`<input id="ans" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="es" enterkeyhint="go" placeholder="en español…">
          <div class="accents">${['á','é','í','ó','ú','ñ','ü'].map(ch=>`<button data-act="acc" data-arg="${ch}" aria-label="Insert ${ch}">${ch}</button>`).join('')}</div>
          <div class="row"><button class="btn grow" data-act="check">Check</button><button class="btn line grow" data-act="idk">Show me</button></div>`;
    }
  }
  const ov=SES.paused?`<div class="overlay"><h2>Paused</h2><p class="muted">${esc(SES.paused==='Paused'?'Take your time.':SES.paused)}</p><button class="btn" data-act="resume">Keep going</button></div>`:'';
  return h+`<div class="stage" data-act="${fb||it.t==='intro'?'skip':''}"><div class="fade" style="display:flex;flex-direction:column;gap:12px">${stage}</div>${ov}</div><div class="dock">${dock}</div>`;
}
function doneHTML(){
  const c=dueCounts(),nd=nextDueIn(),more=c.due||c.nw;
  const ids=[...new Set(SES.q.map(it=>it.id))],words=ids.length,clean=ids.filter(id=>!SES.miss[id]).length;
  return `<div class="stage mid center" style="align-items:center"><span class="q-label">${SES.practice?'Practice round done':'Session done'}</span><h2 style="font-size:38px">¡Muy bien!</h2>
    <p class="muted">${words} words · ${clean} without a miss</p>
    ${SES.missedIds.length?`<p class="small muted">These come back sooner:</p><div class="missed">${SES.missedIds.map(id=>`<span class="chip">${esc(BYID[id].es)}</span>`).join('')}</div>`:''}
    ${!more&&nd!=null?`<p class="small muted">Next review in ${spanLong(nd)}.</p>`:''}</div>
    <div class="dock" style="justify-content:flex-end">
      <button class="btn" data-act="${more?'start':c.unseen?'more':'start'}">${more?'Keep going':c.unseen?'Learn 5 more words':'Practice again'}</button>
      <button class="btn line" data-act="go" data-arg="listen">Practice listening</button>
      <button class="btn plain" data-act="go" data-arg="home">Home</button></div>`;
}

// ================= listening =================
function toks(s){const out=[];let pos=0;for(const raw of s.split(' ')){const st=s.indexOf(raw,pos);pos=st+raw.length;const core=raw.replace(/^[¿¡"“(—-]+|[.,;:!?"”)…]+$/g,'');if(core)out.push({raw,core,start:st,brk:/[.,;:!?…]["”)]?$/.test(raw)})}return out}
function linkType(a,b){if(a.brk)return 0;const x=deacc(a.core.toLowerCase()),y=deacc(b.core.toLowerCase());
  const endV=/[aeiouy]$/.test(x),startV=/^h?[aeiou]/.test(y)||y==='y';
  if(endV&&startV)return 2;if(startV&&/[a-z]$/.test(x))return 1;return 0}
function chunksOf(t){const out=[];let cur=[];t.forEach((w,i)=>{cur.push(i);if(w.brk||cur.length>=3&&!(i+1<t.length&&linkType(w,t[i+1])===2)){out.push(cur);cur=[]}});if(cur.length)out.push(cur);return out}
const WORDIDX={};
for(const c of CARDS)for(const alt of c.alts){const w=splitArt(norm(alt))[1];if(!w.includes(' '))WORDIDX[w]=WORDIDX[w]||c.id}
function listenPool(){const seen=CARDS.filter(c=>S.cards[c.id]);return seen.length>=8?seen:CARDS.slice(0,Math.max(20,seen.length))}
let L=null,lastSid=null;
function pickSentence(){
  const now=Date.now(),pool=listenPool();
  const due=pool.filter(c=>S.sents[c.id]&&S.sents[c.id].due<=now&&S.sents[c.id].lvl<3&&c.id!==lastSid).sort((a,b)=>S.sents[a.id].lvl-S.sents[b.id].lvl||S.sents[a.id].due-S.sents[b.id].due);
  const fresh=pool.filter(c=>!S.sents[c.id]&&c.id!==lastSid);
  const fallback=CARDS.filter(c=>!S.sents[c.id]&&c.id!==lastSid);
  const soon=pool.filter(c=>S.sents[c.id]&&c.id!==lastSid).sort((a,b)=>S.sents[a.id].due-S.sents[b.id].due);
  return due[0]||fresh[0]||fallback[0]||soon[0]||CARDS[0];
}
function startSentence(){
  if(L)clearTimeout(L.timer);micStop();
  const c=pickSentence();lastSid=c.id;const st=S.sents[c.id];
  L={card:c,t:toks(c.ses),spd:Math.min(2,st?st.lvl:0),phase:'listen',typing:!voiceOK(),ok:null,added:[],explain:false,heard:'',hold:false,timer:0,buf:'',bufT:0};
  render();playSent(LAD[L.spd]);
}
function playSent(rate){
  micStop();if(L.phase==='answer')L.heard='';const h=$('#lheard');if(h)h.textContent=L.heard;
  $('.playbig')?.classList.add('speaking');
  speak(L.card.ses,rate,{onword:highlight,onend:()=>{$('.playbig')?.classList.remove('speaking');document.querySelectorAll('.w.on').forEach(e=>e.classList.remove('on'));afterPlay()}});
}
function afterPlay(){
  if(view!=='listen'||!L||L.phase==='result')return;
  L.phase='answer';
  if(!L.typing&&voiceOK())listenBack(false);
  paintLDock();
}
function listenBack(gesture){
  const me=L;L.buf='';
  micListen({
    onText:(texts,final)=>{if(L!==me||L.phase==='result')return;
      if(Mic.kind==='dict'){ // dictation sends settled pieces; wait for a pause before checking
        if(final){L.buf=(L.buf+' '+texts[0]).trim();clearTimeout(L.bufT);L.bufT=setTimeout(()=>{if(L===me&&L.phase!=='result')evaluate([L.buf])},1400)}
        L.heard=(L.buf+' '+(final?'':texts[0])).trim();
      }else{L.heard=texts[0];if(final)evaluate(texts)}
      const h=$('#lheard');if(h)h.textContent=L.heard;},
    onFail:why=>{if(L!==me||L.phase==='result')return;if(why==='blocked'){L.typing=true;toast('Microphone is off for this app. Type instead.')}paintLDock()}
  },gesture);
  paintLDock();
}
function highlight(ci){const w=document.querySelectorAll('#words .w');if(!w.length)return;let idx=0;L.t.forEach((t,i)=>{if(t.start<=ci)idx=i});w.forEach((e,i)=>e.classList.toggle('on',i===idx))}
function diffWords(typed){
  const exp=L.t.map(t=>deacc(normS(t.core)));
  const n=exp.length,m=typed.length,dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  const eq=(a,b)=>close(a,b)||phon(a)===phon(b);
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=eq(typed[j],exp[i])?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const ok=new Array(n).fill(false);let i=0,j=0;
  while(i<n&&j<m){if(eq(typed[j],exp[i])){ok[i]=true;i++;j++}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++}
  return ok;
}
function evaluate(texts){
  if(!L||L.phase==='result')return;
  micStop();clearTimeout(L.bufT);
  let best=null;for(const t of texts){const ok=diffWords(normS(t).split(' ').filter(Boolean).map(deacc));if(!best||ok.filter(Boolean).length>best.filter(Boolean).length)best=ok}
  L.ok=best;finishSentence(best.filter(Boolean).length/best.length);
}
function giveUp(){if(!L||L.phase==='result')return;micStop();stopSpeech();L.ok=null;finishSentence(0,true)}
function finishSentence(score,gaveUp){
  L.phase='result';L.score=score;
  // missed words that are in the deck go to flashcards
  const add=new Set(),own=L.card,now=Date.now();
  if(L.ok)L.ok.forEach((good,i)=>{if(good)return;const w=norm(L.t[i].core);let id=WORDIDX[w];
    if(!id){const base=deacc(splitArt(norm(own.alts[0]))[1]).replace(/se$/,'');const stem=own.tag==='v'?base.slice(0,-2):base.slice(0,-1);if(stem.length>=3&&deacc(w).startsWith(stem))id=own.id}
    if(id)add.add(id)});
  for(const id of add){const s=S.cards[id];if(!s)S.cards[id]={due:now,ivl:0,ease:2.5,reps:0,lapses:0,step:0};else if(s.due>now)s.due=now}
  L.added=[...add];
  // the app rates it
  const st=S.sents[own.id]||{lvl:0,due:now,n:0};
  if(score>=.999){st.lvl=Math.max(st.lvl,L.spd+1);st.due=now+[0,10*MIN,DAY,4*DAY][st.lvl]}
  else if(score>=.6){st.due=now+3*MIN}
  else{st.lvl=Math.min(st.lvl,L.spd);st.due=now+2*MIN}
  st.n++;S.sents[own.id]=st;S.day.listened++;bumpStreak();save();
  chime(score>=.999);render();
  if(!gaveUp){const ms=score>=.999?3500:9000;L.timer=setTimeout(()=>{if(view==='listen'&&!L.hold)startSentence()},ms);const b=$('#autobar');if(b)b.innerHTML=`<i style="animation-duration:${ms}ms"></i>`}
}
function holdListen(){if(L&&L.phase==='result'&&!L.hold){L.hold=true;clearTimeout(L.timer);const b=$('#autobar');if(b)b.innerHTML=''}}
function wordsHTML(){
  const t=L.t,show=L.phase==='result';let h='';
  t.forEach((w,i)=>{
    let cls='w';if(!show)cls+=' blank';if(L.ok)cls+=L.ok[i]?' ok':' miss';
    const width=!show?` style="width:${(w.core.length*.62+.3).toFixed(2)}em"`:'';
    h+=`<button class="${cls}" data-act="tapword" data-arg="${i}"${width} aria-label="${show?esc(w.core):'word '+(i+1)}" lang="es">${show?esc(w.raw.replace(/^[—-]/,'')):'·'}</button>`;
    if(i<t.length-1){const lt=show?linkType(w,t[i+1]):0;h+=lt?`<span class="lk l${lt}" aria-hidden="true"></span>`:'<span class="gap"></span>'}
  });
  return `<div class="words" id="words">${h}</div>`;
}
function listenHTML(){
  const k=L.card,st=S.sents[k.id],lvl=st?st.lvl:0,res=L.phase==='result';
  let h=`<div class="top"><button class="iconbtn" data-act="go" data-arg="home" aria-label="Back to home">${I.back}</button><h2>Listening</h2>
    <div class="chips"><span class="chip">${lvl>=3?'Full speed ✓':'Level: '+LNAME[Math.min(lvl,2)]}</span></div></div>
  <div class="scroll">
  <div class="speeds" role="group" aria-label="Speed">${LAD.map((r,i)=>`<button class="${i===L.spd?'on':''}" data-act="spd" data-arg="${i}" aria-pressed="${i===L.spd}"><b>${LNAME[i]}</b><span>${Math.round(r*100)}%</span></button>`).join('')}</div>
  <div class="player">
    <div class="side"><button class="btn plain" data-act="chunks">In pieces</button></div>
    <button class="playbig" data-act="play" aria-label="Play sentence">${I.play}</button>
    <div class="side"><button class="btn plain" data-act="slower">Slower</button></div>
  </div>
  <section class="panel lpanel">
    <span class="label">${res?'The sentence':L.t.length+' words'}</span>${wordsHTML()}
    <p class="muted small">Tap any word to hear it on its own.</p>`;
  if(res){
    h+=`<p class="trans">${esc(k.sen)}</p>
    <div class="legend"><span><i></i>vowels merge</span><span><i class="l1"></i>consonant slides over</span><button class="btn small line" data-act="explain">${L.explain?'Hide':'Why?'}</button></div>
    ${L.explain?`<p class="explain">Spanish doesn't pause between words. When one word ends in a vowel and the next starts with one, they melt into a single syllable: <i>va a ir</i> sounds like “vair”, <i>lo que es</i> like “lo-kes”. A final consonant jumps onto the next word's vowel: <i>los amigos</i> sounds like “lo-sa-mi-gos”. A silent <i>h</i> doesn't stop the blend.</p>`:''}`;
    if(L.ok){const n=L.ok.filter(Boolean).length;h+=`<p class="score">${n===L.ok.length?'Every word. ¡Perfecto!':`${n} of ${L.ok.length} words`}</p>`}
    if(L.added.length)h+=`<p class="added">Added to your flashcards: <b>${L.added.map(id=>esc(BYID[id].es)).join(', ')}</b></p>`;
  }
  h+=`</section></div><div class="ldock" id="ldock">${ldockHTML()}</div>`;
  return h;
}
function ldockHTML(){
  if(L.phase==='result')return `<div class="autobar" id="autobar"></div><button class="btn" data-act="lnext">Next sentence</button>`;
  if(L.typing)return `<textarea id="dict" rows="2" lang="es" autocomplete="off" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="Type what you hear (accents optional)"></textarea>
    <div class="row"><button class="btn grow" data-act="dictcheck">Check</button><button class="btn line grow" data-act="giveup">Show me</button></div>
    ${voiceOK()?'<div class="center"><button class="linkbtn" data-act="usemic">Say it instead</button></div>':''}`;
  const live=!!(Mic.live&&Mic.cb),waiting=L.phase==='listen';
  return `<p class="heard" id="lheard">${esc(L.heard)}</p>
    <button class="mic ${live?'live':'idle'}" data-act="lmic" aria-label="${live?'Listening':'Tap to speak'}">${I.mic}</button>
    <p class="tapnote">${waiting?'Listen, then say it back.':live?'Say it back…':'Tap the mic and say it back.'}</p>
    <div class="row" style="justify-content:center"><button class="linkbtn" data-act="usetype">Type instead</button><button class="linkbtn" data-act="giveup">Show me</button></div>`;
}
function paintLDock(){const d=$('#ldock');if(d&&view==='listen')d.innerHTML=ldockHTML()}

// ================= home / settings =================
let view='home',confirmReset=false;
function go(v){
  clearTimers();stopSpeech();micEnd();if(L)clearTimeout(L.timer);
  if(v!=='session')SES=null;
  view=v;confirmReset=false;
  if(v==='listen'){startSentence();return}
  render();
}
function render(){
  rollDay();
  app.innerHTML=view==='home'?homeHTML():view==='session'?sessionHTML():view==='listen'?listenHTML():settingsHTML();
}
function homeHTML(){
  const c=dueCounts(),known=Object.values(S.cards).filter(s=>s.step<0).length;
  const mastered=Object.values(S.sents).filter(s=>s.lvl>=3).length,nd=nextDueIn();
  const st=S.settings.style,anything=c.due||c.nw;
  const micNote=S.settings.answer==='voice'&&!Mic.kind&&st!=='pick'?'<p class="small muted">Speaking needs Safari or Chrome with the microphone allowed. Here you\'ll type your answers instead.</p>':'';
  return `<div class="top"><div style="flex:1"></div><button class="iconbtn" data-act="go" data-arg="settings" aria-label="Settings">${I.gear}</button></div>
  <div class="scroll">
  <div class="tiles" aria-hidden="true"></div>
  <div class="brand"><h1>Poco a Poco<span class="tilde">~</span></h1><p class="tag">Spanish, a few words a day. Works offline.</p></div>
  <div class="stats">
    <div class="stat"><b>${known}</b><span>words known of ${CARDS.length}</span></div>
    <div class="stat"><b>${streakNow()}</b><span>day streak</span></div>
    <div class="stat"><b>${mastered}</b><span>sentences at full speed</span></div>
  </div>
  ${!SYN?'<div class="warnbox">This browser has no text-to-speech, so audio won\'t play here. Safari on iPhone supports it.</div>':VOICES.length===0?'<div class="warnbox">No Spanish voice found yet. On iPhone: Settings → Accessibility → Spoken Content → Voices → Spanish, then download Paulina or Mónica.</div>':''}
  <section class="panel act">
    <span class="label">Vocabulary</span>
    <h3>${anything?'Today\'s words':'All caught up'}</h3>
    <div class="chips"><span class="chip rev">${c.due} to review</span><span class="chip new">${c.nw} new</span></div>
    ${!anything&&nd!=null?`<p class="small muted">Next review in ${spanLong(nd)}. You can still practice, or learn more words.</p>`:''}
    <div class="seg" role="group" aria-label="Style">${[['mixed','Mixed'],['say','Say it'],['pick','Pick it']].map(([k,l])=>`<button class="${st===k?'on':''}" data-act="style" data-arg="${k}" aria-pressed="${st===k}">${l}</button>`).join('')}</div>
    <p class="small muted">${st==='mixed'?'New words start with picking the meaning, then you say them. The app decides what comes back and when.':st==='say'?'See the English, say the Spanish out loud.':'See the Spanish, pick the English from eight choices.'}</p>
    ${micNote}
    <button class="btn" data-act="start">${anything?'Start':'Practice'}</button>
    ${!anything&&c.unseen?'<button class="btn line" data-act="more">Learn 5 more words</button>':''}
  </section>
  <section class="panel act">
    <span class="label">Listening</span>
    <h3>Sentence trainer</h3>
    <p class="muted small">Hear a sentence, say it back. It starts slow and speeds up as you get them.</p>
    <div class="chips"><span class="chip">${listenPool().length} sentences ready</span><span class="chip">${S.day.listened} today</span></div>
    <button class="btn" data-act="go" data-arg="listen">Start listening</button>
  </section></div>`;
}
function settingsHTML(){
  const st=S.settings,cv=voice();
  const opts=VOICES.map(v=>`<option value="${esc(v.voiceURI)}"${cv&&v.voiceURI===cv.voiceURI?' selected':''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('');
  const seg=(key,pairs)=>`<div class="seg" role="group">${pairs.map(([v,l])=>`<button class="${String(st[key])===String(v)?'on':''}" data-act="set" data-key="${key}" data-arg="${v}" aria-pressed="${String(st[key])===String(v)}">${l}</button>`).join('')}</div>`;
  return `<div class="top"><button class="iconbtn" data-act="go" data-arg="home" aria-label="Back to home">${I.back}</button><h2>Settings</h2></div>
  <div class="scroll">
  <section class="panel">
    <div class="field"><label class="label" for="voice">Voice</label>
      ${VOICES.length?`<select id="voice" data-set="voice">${opts}</select>`:'<p class="muted small">No Spanish voices found. On iPhone, add one in Settings → Accessibility → Spoken Content → Voices → Spanish.</p>'}</div>
    <button class="btn plain small" data-act="say" data-arg="Hola, ¿qué tal? Vamos a aprender español poco a poco." data-rate=".9">${I.spk} Test voice</button>
  </section>
  <section class="panel">
    <div class="field"><span class="label">Answer by</span>${seg('answer',[['voice','Speaking'],['type','Typing']])}
      ${st.answer==='voice'&&!Mic.kind?'<p class="small muted">No microphone access here, so you\'ll type. Safari or Chrome on your phone can listen.</p>':''}</div>
    <div class="field"><label class="label" for="npd">New words per day</label>
      <select id="npd" data-set="newPerDay">${[5,10,15,20,30].map(n=>`<option${n===st.newPerDay?' selected':''}>${n}</option>`).join('')}</select></div>
    <div class="field"><span class="label">Sounds</span>${seg('sounds',[[true,'On'],[false,'Off']])}</div>
  </section>
  <section class="panel">
    <span class="label">Backup</span>
    <p class="muted small">Progress is saved on this device only. Copy it somewhere safe, or paste a backup to restore it.</p>
    <textarea id="backup" spellcheck="false" placeholder="Paste a backup here to restore"></textarea>
    <div class="row"><button class="btn plain small grow" data-act="export">Copy progress</button><button class="btn plain small grow" data-act="import">Restore from box</button></div>
  </section>
  <section class="panel">
    <span class="label danger">Start over</span>
    ${confirmReset?`<p class="small">This erases every word and listening level on this device. It can't be undone.</p><div class="row"><button class="btn dangerbtn small grow" data-act="reset2">Erase progress</button><button class="btn plain small grow" data-act="reset0">Keep it</button></div>`:`<button class="btn plain small" data-act="reset1">Reset progress…</button>`}
  </section>
  <p class="muted small center">${CARDS.length} words · build __BUILD__</p></div>`;
}

// ================= events =================
app.addEventListener('click',e=>{
  unlockAudio();
  const b=e.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act,arg=b.dataset.arg;
  if(view==='listen'&&L&&L.phase==='result'&&a!=='lnext')holdListen();
  switch(a){
    case 'go':go(arg);break;
    case 'start':startSession();break;
    case 'more':S.day.extra+=5;save();startSession();break;
    case 'style':S.settings.style=arg;save();render();break;
    case 'quit':quitSession();break;
    case 'pause':pause();break;
    case 'resume':resume();break;
    case 'skip':if(SES&&!SES.paused&&(SES.phase==='fb'||curItem()?.t==='intro'))advance();break;
    case 'pick':{if(!SES||SES.phase!=='ask')break;const it=curItem();SES.choice=arg;answer(arg===it.id?{kind:'right'}:{kind:'wrong'});break}
    case 'mic':if(SES&&SES.phase==='ask'){SES.silence=0;startListening(true)}break;
    case 'idk':answer({kind:'wrong'});break;
    case 'check':{const v=$('#ans').value;if(v.trim())answer(gradeTyped(BYID[curItem().id],v));break}
    case 'acc':{const i=$('#ans');if(!i)break;const s=i.selectionStart??i.value.length,en=i.selectionEnd??s;i.value=i.value.slice(0,s)+arg+i.value.slice(en);i.focus();i.setSelectionRange(s+1,s+1);break}
    case 'override':overrideRight();break;
    case 'say':if(SES&&SES.phase==='ask'&&curItem()?.t==='prod')break;speak(arg,+(b.dataset.rate||.85));break;
    // listening
    case 'spd':L.spd=+arg;document.querySelectorAll('.speeds button').forEach((x,i)=>{x.classList.toggle('on',i===L.spd);x.setAttribute('aria-pressed',String(i===L.spd))});playSent(LAD[L.spd]);break;
    case 'play':playSent(LAD[L.spd]);break;
    case 'slower':playSent(Math.max(.45,LAD[L.spd]-.2));break;
    case 'chunks':{micStop();const ch=chunksOf(L.t);speakChunks(ch.map(c=>c.map(i=>L.t[i].core).join(' ')),Math.max(.5,LAD[L.spd]-.1),{onchunk:n=>{document.querySelectorAll('#words .w').forEach((x,i)=>x.classList.toggle('on',ch[n].includes(i)))},onend:()=>{document.querySelectorAll('.w.on').forEach(x=>x.classList.remove('on'));afterPlay()}});break}
    case 'tapword':{const w=L.t[+arg];if(w){micStop();speak(w.core,.7,{onend:afterPlay});document.querySelectorAll('#words .w').forEach((x,i)=>x.classList.toggle('on',i===+arg));setTimeout(()=>document.querySelectorAll('.w.on').forEach(x=>x.classList.remove('on')),900)}break}
    case 'lmic':if(L.phase!=='result'){stopSpeech();L.phase='answer';listenBack(true)}break;
    case 'usetype':micStop();L.typing=true;paintLDock();$('#dict')?.focus();break;
    case 'usemic':L.typing=false;L.phase='answer';listenBack(true);break;
    case 'dictcheck':{const v=$('#dict').value;if(v.trim())evaluate([v]);break}
    case 'giveup':giveUp();break;
    case 'lnext':startSentence();break;
    case 'explain':L.explain=!L.explain;render();break;
    // settings
    case 'set':{const k=b.dataset.key;S.settings[k]=k==='sounds'?arg==='true':arg;save();render();break}
    case 'export':{const txt=JSON.stringify(S);const box=$('#backup');box.value=txt;
      const fall=()=>{box.focus();box.select();toast('Selected. Copy it from the box.')};
      try{navigator.clipboard.writeText(txt).then(()=>toast('Progress copied.'),fall)}catch(err){fall()}break}
    case 'import':{try{const s=JSON.parse($('#backup').value);if(!s||!s.cards)throw 0;S=merge(s);save();toast('Progress restored.');render()}catch(err){toast("That doesn't look like a Poco a Poco backup.")}break}
    case 'reset1':confirmReset=true;render();break;
    case 'reset0':confirmReset=false;render();break;
    case 'reset2':S=blank();save();confirmReset=false;toast('Progress erased.');render();break;
  }
});
app.addEventListener('change',e=>{const k=e.target.dataset.set;if(!k)return;S.settings[k]=k==='newPerDay'?+e.target.value:e.target.value;save();if(k==='voice')speak('Hola, ¿qué tal?',.9)});
app.addEventListener('keydown',e=>{
  if(e.target.id==='ans'&&e.key==='Enter'){e.preventDefault();const v=e.target.value;if(v.trim()&&SES&&SES.phase==='ask')answer(gradeTyped(BYID[curItem().id],v))}
  if(e.target.id==='dict'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();const v=e.target.value;if(v.trim())evaluate([v])}
});
document.addEventListener('keydown',e=>{
  if(e.target!==document.body)return;
  if(view==='session'&&SES){const it=curItem();if(SES.phase==='ask'&&it?.t==='pick'&&/^[1-8]$/.test(e.key)){const id=it.opts[+e.key-1];SES.choice=id;answer(id===it.id?{kind:'right'}:{kind:'wrong'})}
    else if((e.key==='Enter'||e.key===' ')&&(SES.phase==='fb'||it?.t==='intro')){e.preventDefault();advance()}}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(view==='session'&&SES&&SES.phase!=='done')pause();else{stopSpeech();micStop()}}else if(view==='home')render()});
// keep the shell exactly the visible height (iOS keyboard)
function fit(){const vv=window.visualViewport;document.documentElement.style.setProperty('--appH',(vv?vv.height:innerHeight)+'px');if(vv)window.scrollTo(0,0)}
if(window.visualViewport){visualViewport.addEventListener('resize',fit);visualViewport.addEventListener('scroll',()=>window.scrollTo(0,0))}
addEventListener('resize',fit);fit();

rollDay();render();
})();
