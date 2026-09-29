(function(){
  if(window.__fbAutoReady)return; window.__fbAutoReady=true;

  const S={
    busy:false,
    comment:null,
    stage:'idle',
    deadline:0,
    commentWaits:0,
    sortHandled:false,
    sortBusy:false,
    sortClicks:0
  };

  const T=e=>(e&&((e.innerText||e.textContent||'')+'' )).replace(/\s+/g,' ').trim();
  const A=e=>((e&&((e.getAttribute('aria-label')||'')+' '+(e.getAttribute('title')||'')))||'').replace(/\s+/g,' ').trim();
  const V=e=>!!(e&&e.offsetParent!==null);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const norm=s=>(s||'').replace(/\s+/g,' ').trim().toLowerCase();

  function visible(root){
    return Array.from((root||document).querySelectorAll('*')).filter(V);
  }

  function clickableAncestor(el,root){
    let n=el;
    for(let i=0;n&&i<7;i++,n=n.parentElement){
      if(n===root?.parentElement) break;
      const role=(n.getAttribute&&n.getAttribute('role'))||'';
      const tag=(n.tagName||'').toLowerCase();
      if(tag==='button'||tag==='a'||role==='button'||role==='link'||typeof n.onclick==='function'||n.tabIndex>=0){
        return n;
      }
    }
    return el;
  }

  function exactish(text,re){
    const s=norm(text);
    return re.test(s) && s.length<=90;
  }

  // Finds an action inside a specific comment instead of searching the whole page.
  // It first checks accessible labels, then short visible text nodes/elements.
  function findAction(root,patterns){
    if(!root)return null;
    const els=visible(root);
    const regs=patterns.map(x=>x instanceof RegExp?x:new RegExp(x,'i'));

    // Accessible name is the safest signal for Facebook controls.
    for(const el of els){
      const acc=A(el);
      if(acc && regs.some(re=>re.test(norm(acc)))){
        return clickableAncestor(el,root);
      }
    }

    // Prefer small elements whose own visible text is the action label.
    const candidates=[];
    for(const el of els){
      const own=Array.from(el.childNodes||[]).filter(n=>n.nodeType===3).map(n=>n.textContent||'').join(' ').trim();
      const txt=norm(own||T(el));
      if(!txt || txt.length>90)continue;
      if(regs.some(re=>exactish(txt,re))){
        candidates.push({el,score:(own?0:10)+txt.length});
      }
    }
    candidates.sort((a,b)=>a.score-b.score);
    return candidates.length?clickableAncestor(candidates[0].el,root):null;
  }

  function comments(){
    const raw=Array.from(document.querySelectorAll('[role="article"]')).filter(V);
    return raw.filter(a=>{
      const t=(T(a)+' '+A(a)).toLowerCase();
      return /(\blike\b|\breply\b|إعجاب|اعجبني|رد)/i.test(t);
    });
  }

  function done(c){return !!(c&&c.dataset&&c.dataset.fbAutoHandled==='1');}
  function mark(c){if(c&&c.dataset)c.dataset.fbAutoHandled='1';}

  function name(c){
    const h=c.querySelector('h2,h3,h4,a[role="link"]');
    return T(h)||'حضرتك';
  }

  function textboxes(root){
    return Array.from((root||document).querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')).filter(V);
  }

  function setValue(el,value){
    if(!el)return false;
    try{
      el.focus();
      if(el.tagName==='TEXTAREA'){
        const p=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
        if(p&&p.set)p.set.call(el,value); else el.value=value;
      }else{
        el.textContent=value;
      }
      el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    }catch(e){return false;}
  }

  function sendButtonNear(box,scope){
    const root=scope||box?.parentElement||document;
    const btn=findAction(root,[/^(send|إرسال)$/i,/^(comment|تعليق)$/i]);
    if(btn)return btn;
    const near=box?.parentElement?.parentElement;
    return findAction(near,[/send|إرسال|comment|تعليق/i]);
  }

  function nearestTextboxForComment(c,before){
    const after=textboxes(c);
    const fresh=after.filter(x=>!before.includes(x));
    if(fresh.length)return fresh[0];
    // Facebook sometimes puts the reply composer beside the comment rather than inside it.
    const cr=c.getBoundingClientRect();
    const all=textboxes(document).filter(V).filter(x=>{
      if(before.includes(x))return false;
      const r=x.getBoundingClientRect();
      return r.top>=cr.top-30 && r.top<=cr.bottom+220;
    });
    all.sort((a,b)=>Math.abs(a.getBoundingClientRect().top-cr.bottom)-Math.abs(b.getBoundingClientRect().top-cr.bottom));
    return all[0]||null;
  }

  async function publicReply(c,text){
    if(!text)return false;
    const reply=findAction(c,[/^(reply|رد)$/i]);
    if(!reply)return false;

    const before=textboxes(document);
    reply.scrollIntoView({block:'center',inline:'nearest'});
    reply.click();
    await wait(650);

    const box=nearestTextboxForComment(c,before);
    if(!box)return false;
    const msg=text.replace('[اسم العميل]',name(c));
    if(!setValue(box,msg))return false;
    await wait(350);

    const send=sendButtonNear(box,c);
    if(send){send.click();await wait(900);return true;}

    // Enter is scoped to the reply composer only; never use the main post composer.
    box.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter',code:'Enter',which:13,keyCode:13}));
    await wait(900);
    return true;
  }

  function findPrivateAction(c){
    return findAction(c,[
      /^(send message|message|إرسال رسالة|رسالة)$/i,
      /^(message|رسالة)$/i
    ]);
  }

  async function privateMsg(c,text){
    const m=findPrivateAction(c);
    if(!m)return {available:false,sent:false};
    const before=textboxes(document);
    m.scrollIntoView({block:'center',inline:'nearest'});
    m.click();
    await wait(900);

    // Prefer a newly-created composer. Do not fall back to the post's main comment box.
    let box=textboxes(document).find(x=>!before.includes(x));
    if(!box){
      const dialogs=Array.from(document.querySelectorAll('[role="dialog"]')).filter(V);
      for(const d of dialogs){
        const b=textboxes(d);
        if(b.length){box=b[b.length-1];break;}
      }
    }
    if(!box)return {available:true,sent:false};
    if(!setValue(box,text))return {available:true,sent:false};
    await wait(300);

    const scope=box.closest('[role="dialog"]')||box.parentElement?.parentElement||document;
    const send=sendButtonNear(box,scope);
    if(!send)return {available:true,sent:false};
    send.click();
    await wait(900);
    return {available:true,sent:true,needConfirm:true};
  }

  function findSortDialog(){
    const els=visible(document);
    return els.find(e=>{
      const t=norm((T(e)+' '+A(e)));
      return /most relevant|newest|all comments|الأكثر صلة|الأحدث|كل التعليقات/.test(t) && t.length<220;
    })||null;
  }

  async function ensureNewestOnce(){
    if(S.sortHandled||S.sortBusy)return S.sortHandled;
    const dialog=findSortDialog();
    if(!dialog)return false;
    S.sortBusy=true;
    try{
      const newest=findAction(dialog,[/^(newest|الأحدث)$/i]);
      if(newest){
        const selected=/(checked|selected|aria-checked)/i.test(A(newest)+' '+(newest.getAttribute('aria-checked')||''));
        if(!selected){newest.click();S.sortClicks++;await wait(250);}
      }
      const ok=findAction(dialog,[/^(ok|موافق)$/i]);
      if(ok){ok.click();await wait(1000);S.sortHandled=true;return true;}
      // Some Facebook variants close the menu as soon as Newest is selected.
      if(newest){S.sortHandled=true;return true;}
      return false;
    }finally{S.sortBusy=false;}
  }

  window.__fbAutoHasHumanCheck=function(){
    try{
      const hay=(document.body?document.body.innerText:'')+' '+
        Array.from(document.querySelectorAll('[aria-label],[title]')).map(e=>(e.getAttribute('aria-label')||'')+' '+(e.getAttribute('title')||'')).join(' ');
      return /(confirm you.?re human|verify you.?re human|verify that you are human|i.?m not a robot|captcha|human verification|security check|تأكيد أنك إنسان|تأكيد انك انسان|تحقق من أنك إنسان|تحقق انك انسان|أنا لست روبوت|انا لست روبوت|اختبار أمان|اختبار امان)/i.test(hay);
    }catch(e){return false;}
  };

  window.__fbAutoBringHumanCheckIntoView=function(){
    try{
      const re=/(confirm you.?re human|verify you.?re human|verify that you are human|i.?m not a robot|captcha|human verification|security check|تأكيد أنك إنسان|تأكيد انك انسان|تحقق من أنك إنسان|تحقق انك انسان|أنا لست روبوت|انا لست روبوت|اختبار أمان|اختبار امان)/i;
      const all=Array.from(document.querySelectorAll('div,section,main,[role=dialog],[role=alert],iframe,[aria-label],[title]'));
      const el=all.find(e=>{const t=((e.innerText||e.textContent||'')+' '+(e.getAttribute?.('aria-label')||'')+' '+(e.getAttribute?.('title')||'')).replace(/\s+/g,' ');return t&&re.test(t)&&e.offsetParent!==null;});
      if(el&&el.scrollIntoView)el.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
      return !!el;
    }catch(e){return false;}
  };

  window.__fbAutoOpenComments=async function(){
    try{
      S.sortHandled=false;S.sortBusy=false;S.sortClicks=0;
      for(let attempt=0;attempt<8;attempt++){
        await ensureNewestOnce();
        const list=comments();
        if(list.length){list[0].scrollIntoView({block:'center',inline:'nearest'});S.commentWaits=0;return true;}
        const buttons=visible(document);
        const commentButton=buttons.find(b=>{
          const t=norm(T(b)||A(b));
          return /^(comments?|التعليقات|تعليقات|comment|comments)/i.test(t) || /\bcomments?\b|التعليقات|تعليقات/.test(t);
        });
        if(commentButton){commentButton.scrollIntoView({block:'center',inline:'nearest'});await wait(250);commentButton.click();}
        await wait(1000);
      }
      return false;
    }catch(e){return false;}
  };

  window.__fbAutoProcessNext=async function(pub,priv,alt,sendPrivate,publicEnabled){
    if(S.busy)return JSON.stringify({state:'busy'});
    S.busy=true;
    try{
      if(!S.sortHandled){
        const sorted=await ensureNewestOnce();
        if(!sorted){S.busy=false;return JSON.stringify({state:'waiting',tries:1,reason:'sort'});}
        await wait(500);
      }

      let c=comments().find(x=>!done(x));
      if(!c){
        S.commentWaits=(S.commentWaits||0)+1;
        S.busy=false;
        if(S.commentWaits<=15)return JSON.stringify({state:'waiting',tries:S.commentWaits});
        return JSON.stringify({state:'done'});
      }
      S.commentWaits=0;S.comment=c;

      // Like is located and verified inside the current comment only.
      let like=findAction(c,[/^(like|إعجاب|اعجبني)$/i]);
      let didLike=false;
      if(like && !/unlike|إلغاء الإعجاب|تم الإعجاب|liked/i.test(A(like)+' '+T(like))){
        like.scrollIntoView({block:'center',inline:'nearest'});
        like.click();
        await wait(650);
        const after=findAction(c,[/^(like|إعجاب|اعجبني)$/i]);
        didLike=!!after && /unlike|إلغاء الإعجاب|تم الإعجاب|liked/i.test(A(after)+' '+T(after));
      }

      let publicDone=false,privateDone=false;
      const msg=findPrivateAction(c);
      if(publicEnabled)publicDone=await publicReply(c,pub);

      if(!msg){
        if(alt)publicDone=(await publicReply(c,alt))||publicDone;
        mark(c);S.busy=false;
        return JSON.stringify({state:'processed',like:didLike,public:publicDone,private:false});
      }

      if(sendPrivate){
        const p=await privateMsg(c,priv);
        if(!p.sent){S.busy=false;return JSON.stringify({state:'error',message:'تعذر إدخال أو إرسال الرسالة الخاصة لهذا التعليق.'});}
        S.stage='confirm';S.deadline=Date.now()+15000;S.busy=false;
        return JSON.stringify({state:'confirm',like:didLike,public:publicDone});
      }

      mark(c);S.busy=false;
      return JSON.stringify({state:'processed',like:didLike,public:publicDone,private:privateDone});
    }catch(e){S.busy=false;return JSON.stringify({state:'error',message:String(e)});}
  };

  window.__fbAutoConfirmDialog=function(){
    if(S.stage!=='confirm')return JSON.stringify({state:'no'});
    const dialog=Array.from(document.querySelectorAll('[role="dialog"]')).filter(V).pop()||document;
    const b=findAction(dialog,[/^(ok|موافق|done|تم|close|إغلاق)$/i]);
    if(b){b.click();mark(S.comment);S.stage='idle';return JSON.stringify({state:'confirmed'});}
    if(Date.now()>S.deadline){S.stage='idle';return JSON.stringify({state:'timeout'});}
    return JSON.stringify({state:'no'});
  };
})();
