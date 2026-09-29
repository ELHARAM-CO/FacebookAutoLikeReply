(function(){
  if(window.__fbAutoReady)return;
  window.__fbAutoReady=true;

  const S={busy:false,comment:null,stage:'idle',deadline:0,commentWaits:0,sortDone:false};
  const T=e=>(e&&((e.innerText||e.textContent)||'' )).replace(/\s+/g,' ').trim();
  const A=e=>e?((e.getAttribute('aria-label')||'')+' '+(e.getAttribute('title')||'')+' '+(e.getAttribute('data-tooltip-content')||'' )).replace(/\s+/g,' ').trim():'';
  const V=e=>!!(e&&e.offsetParent!==null&&getComputedStyle(e).visibility!=='hidden');
  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  // مستوحى من طريقة المشروع الأول: لا نعتمد على عنصر button فقط.
  // Facebook قد يرسم الزر كـ span/div مع role=button.
  function clickables(root){
    return Array.from((root||document).querySelectorAll(
      'button,[role="button"],span[role="button"],div[role="button"],a[role="button"],a'
    )).filter(e=>V(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true');
  }
  function label(e){return (T(e)+' '+A(e)).replace(/\s+/g,' ').trim();}
  function norm(s){return (s||'').replace(/\s+/g,' ').trim().toLowerCase();}
  function exactOrContains(root, words, exclude){
    const list=clickables(root), ws=words.map(norm), ex=(exclude||[]).map(norm);
    let best=null, bestScore=-1;
    for(const e of list){
      const l=norm(label(e));
      if(!l||ex.some(x=>l.includes(x))) continue;
      let score=-1;
      for(const w of ws){
        if(l===w) score=Math.max(score,100);
        else if(l.startsWith(w+' ')) score=Math.max(score,85);
        else if(l.includes(w)) score=Math.max(score,60);
      }
      if(score>bestScore){best=e;bestScore=score;}
    }
    return best;
  }
  function nearestClickable(e){
    let n=e;
    for(let i=0;i<6&&n;i++,n=n.parentElement){
      if(n.matches&&n.matches('button,[role="button"],span[role="button"],div[role="button"],a')) return n;
    }
    return null;
  }
  async function safeClick(el){
    if(!el)return false;
    try{el.scrollIntoView({block:'center',inline:'nearest'});}catch(e){}
    await wait(180);
    try{el.click();return true;}catch(e){
      try{nearestClickable(el)?.click();return true;}catch(x){return false;}
    }
  }

  window.__fbAutoHasHumanCheck=function(){
    try{
      const hay=(document.body?document.body.innerText:'')+' '+
        Array.from(document.querySelectorAll('[aria-label],[title]')).map(e=>A(e)).join(' ');
      return /(confirm you.?re human|verify you.?re human|verify that you are human|i.?m not a robot|captcha|human verification|security check|تأكيد أنك إنسان|تأكيد انك انسان|تحقق من أنك إنسان|تحقق انك انسان|أنا لست روبوت|انا لست روبوت|اختبار أمان|اختبار امان)/i.test(hay);
    }catch(e){return false;}
  };

  window.__fbAutoBringHumanCheckIntoView=function(){
    try{
      const re=/(confirm you.?re human|verify you.?re human|verify that you are human|i.?m not a robot|captcha|human verification|security check|تأكيد أنك إنسان|تأكيد انك انسان|تحقق من أنك إنسان|تحقق انك انسان|أنا لست روبوت|انا لست روبوت|اختبار أمان|اختبار امان)/i;
      const all=Array.from(document.querySelectorAll('div,section,main,[role=dialog],[role=alert],iframe,[aria-label],[title]'));
      const el=all.find(e=>{const t=((e.innerText||e.textContent||'')+' '+A(e)).replace(/\s+/g,' ');return t&&re.test(t)&&V(e);});
      if(el&&el.scrollIntoView)el.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
      return !!el;
    }catch(e){return false;}
  };

  function comments(){
    const articles=Array.from(document.querySelectorAll('[role="article"]')).filter(V).filter(a=>{
      const t=norm(T(a));
      const hasAction=!!exactOrContains(a,['reply','رد']) || !!exactOrContains(a,['like','إعجاب','اعجبني'],['unlike','إلغاء الإعجاب','تم الإعجاب']);
      const hasAvatar=!!a.querySelector('img');
      return hasAction && (hasAvatar || /reply|رد|like|إعجاب|اعجبني/i.test(t));
    });
    // احتفظ بالعناصر العليا فقط حتى لا تتم معالجة نفس العميل أكثر من مرة بسبب
    // articles متداخلة داخل بطاقة التعليق.
    const top=articles.filter(a=>!articles.some(b=>b!==a && b.contains(a)));
    if(top.length)return top;
    return Array.from(document.querySelectorAll('div')).filter(V).filter(a=>{
      const r=exactOrContains(a,['reply','رد']);
      const l=exactOrContains(a,['like','إعجاب','اعجبني'],['unlike','إلغاء الإعجاب','تم الإعجاب']);
      return !!r&&!!l&&T(a).length<1800&&!!a.querySelector('img');
    }).slice(0,50);
  }
  function done(c){return c&&c.dataset.fbAutoHandled==='1';}
  function mark(c){if(c)c.dataset.fbAutoHandled='1';}
  function name(c){
    const h=c&&c.querySelector('h2,h3,h4,a[role="link"]');
    return T(h)||'حضرتك';
  }
  function textboxes(){
    return Array.from(document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')).filter(V);
  }
  function boxInfo(x){return ((x.getAttribute('aria-label')||'')+' '+(x.getAttribute('placeholder')||'')+' '+(x.getAttribute('title')||'')).replace(/\s+/g,' ').trim();}
  function isMainCommentBox(x){return /(comment as|write a comment|add a comment|تعليق ك|اكتب تعليق|أضف تعليق|comment)/i.test(boxInfo(x)) && !/(reply|رد|message|رسالة)/i.test(boxInfo(x));}
  function findReplyBox(c,before){
    const now=textboxes();
    const fresh=now.find(x=>!before.has(x)&&/(reply|رد)/i.test(boxInfo(x))&&!isMainCommentBox(x));
    if(fresh)return fresh;
    const hinted=now.find(x=>/(reply|رد)/i.test(boxInfo(x))&&!isMainCommentBox(x));
    if(hinted)return hinted;
    const cr=c?.getBoundingClientRect?.();
    if(cr){
      let best=null,bd=1e9;
      for(const x of now){
        if(isMainCommentBox(x))continue;
        const r=x.getBoundingClientRect(), d=Math.abs(r.top-cr.bottom)+Math.abs(r.left-cr.left);
        if(d<bd){bd=d;best=x;}
      }
      if(best&&bd<1200)return best;
    }
    return null;
  }
  function findMessageBox(before){
    const now=textboxes();
    return now.find(x=>!before.has(x)&&/(message|رسالة|write.*message|اكتب.*رسالة)/i.test(boxInfo(x))) ||
           now.find(x=>/(message|رسالة|write.*message|اكتب.*رسالة)/i.test(boxInfo(x))) || null;
  }
  function type(el,value){
    if(!el)return false;
    try{el.focus();
      if(el.tagName==='TEXTAREA'){
        const p=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
        if(p&&p.set)p.set.call(el,value);else el.value=value;
      }else{
        el.textContent='';el.focus();document.execCommand('insertText',false,value);
        if(T(el)!==value)el.textContent=value;
      }
      el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    }catch(e){return false;}
  }
  function nearbySend(box,root){
    const candidates=clickables(root||document).filter(x=>/(send|إرسال|comment|تعليق|post|نشر)/i.test(label(x)));
    if(!candidates.length)return null;
    const br=box?.getBoundingClientRect?.();
    if(!br)return candidates[0];
    let best=null,bd=1e9;
    for(const x of candidates){const r=x.getBoundingClientRect();const d=Math.abs(r.top-br.bottom)+Math.abs(r.left-br.left);if(d<bd){bd=d;best=x;}}
    return best;
  }

  async function selectNewestOnce(){
    if(S.sortDone)return true;

    // أولًا: إذا كانت نافذة ترتيب التعليقات مفتوحة بالفعل، اختر Newest مرة واحدة.
    let newest=exactOrContains(document,['newest','الأحدث','الأحدث أولاً']);
    if(newest){
      await safeClick(newest);
      await wait(450);
      const ok=exactOrContains(document,['ok','موافق','تم','done']);
      if(ok){
        await safeClick(ok);
        await wait(700);
        S.sortDone=true;
        return true;
      }
      return false;
    }

    // ثانيًا: افتح زر ترتيب التعليقات ثم اختر Newest.
    const sort=exactOrContains(document,['sort comments','ترتيب التعليقات','comment sorting','ترتيب التعليقات حسب']);
    if(sort){
      await safeClick(sort);
      await wait(650);
      newest=exactOrContains(document,['newest','الأحدث','الأحدث أولاً']);
      if(newest){
        await safeClick(newest);
        await wait(450);
        const ok=exactOrContains(document,['ok','موافق','تم','done']);
        if(ok){
          await safeClick(ok);
          await wait(700);
          S.sortDone=true;
          return true;
        }
      }
    }
    return false;
  }

  async function publicReply(c,text){
    const before=new Set(textboxes());
    const r=exactOrContains(c,['reply','رد']);
    if(!r)return false;
    if(!await safeClick(r))return false;
    await wait(650);
    const box=findReplyBox(c,before);
    if(!box)return false;
    const msg=(text||'').replace('[اسم العميل]',name(c));
    if(!type(box,msg))return false;
    await wait(300);
    const send=nearbySend(box,c) || nearbySend(box,box.parentElement?.parentElement||document);
    if(send){await safeClick(send);await wait(900);return true;}
    box.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter',code:'Enter',keyCode:13,which:13}));
    await wait(900);
    return true;
  }

  async function privateMsg(c,text){
    const m=exactOrContains(c,['send message','إرسال رسالة','message','رسالة']);
    if(!m)return {available:false,sent:false};
    const before=new Set(textboxes());
    if(!await safeClick(m))return {available:true,sent:false};
    await wait(850);
    const box=findMessageBox(before);
    if(!box)return {available:true,sent:false};
    if(!type(box,text||''))return {available:true,sent:false};
    await wait(300);
    const send=nearbySend(box,box.closest('[role="dialog"]')||document);
    if(!send)return {available:true,sent:false};
    await safeClick(send);
    await wait(900);
    return {available:true,sent:true,needConfirm:true};
  }

  window.__fbAutoOpenComments=async function(){
    try{
      for(let attempt=0;attempt<10;attempt++){
        let list=comments();
        if(!list.length){
          const commentButton=exactOrContains(document,['comments','comment','التعليقات','تعليقات']);
          if(commentButton){
            await safeClick(commentButton);
            await wait(900);
          }
        }
        // لا نحاول اختيار Newest قبل ظهور واجهة التعليقات.
        const sorted=await selectNewestOnce();
        if(sorted)await wait(500);
        list=comments();
        if(list.length){
          list[0].scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
          return true;
        }
        await wait(700);
      }
      return false;
    }catch(e){return false;}
  };

  window.__fbAutoProcessNext=async function(pub,priv,alt,sendPrivate,publicEnabled,doLike){
    if(S.busy)return JSON.stringify({state:'busy'});
    S.busy=true;
    try{
      if(!S.sortDone){
        await selectNewestOnce();
      }
      const list=comments();
      let c=list.find(x=>!done(x));
      if(!c){
        S.commentWaits=(S.commentWaits||0)+1;
        S.busy=false;
        if(S.commentWaits<=12)return JSON.stringify({state:'waiting',tries:S.commentWaits});
        return JSON.stringify({state:'done'});
      }
      S.commentWaits=0;S.comment=c;

      // بطاقة العميل هي comment/article نفسها؛ يتم تحديد أزرار Like وReply
      // والرسالة من داخل البطاقة، وليس من خانة التعليق الرئيسية أسفل الصفحة.
      try{c.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});}catch(e){}
      await wait(300);

      let didLike=false, publicDone=false, privateDone=false;
      if(doLike){
        const like=exactOrContains(c,['like','إعجاب','اعجبني'],['unlike','إلغاء الإعجاب','تم الإعجاب','liked']);
        if(like){
          const beforeLabel=norm(label(like));
          await safeClick(like);
          await wait(700);
          const pressed=like.getAttribute('aria-pressed')==='true';
          const after=exactOrContains(c,['unlike','إلغاء الإعجاب','تم الإعجاب','liked'],[]);
          didLike=!!(pressed||after||norm(label(like))!==beforeLabel);
        }
      }

      if(publicEnabled){
        publicDone=await publicReply(c,pub);
      }

      if(sendPrivate){
        const msg=exactOrContains(c,['send message','إرسال رسالة','message','رسالة']);
        if(msg){
          const p=await privateMsg(c,priv);
          if(!p.sent){S.busy=false;return JSON.stringify({state:'error',message:'تعذر تحديد خانة الرسالة الخاصة أو زر الإرسال داخل بطاقة العميل.'});}
          privateDone=true;
          S.stage='confirm';S.deadline=Date.now()+15000;S.busy=false;
          return JSON.stringify({state:'confirm',like:didLike,public:publicDone,private:true});
        }
      }

      // إذا اختار المستخدم الرد العام، استخدم الرد البديل فقط عند عدم نجاح الرد الأساسي.
      if(publicEnabled && !publicDone && alt){
        publicDone=await publicReply(c,alt);
      }

      mark(c);S.busy=false;
      return JSON.stringify({state:'processed',like:didLike,public:publicDone,private:privateDone});
    }catch(e){S.busy=false;return JSON.stringify({state:'error',message:String(e)});}
  };

  window.__fbAutoConfirmDialog=function(){
    if(S.stage!=='confirm')return JSON.stringify({state:'no'});
    const dialogs=Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).filter(V);
    const root=dialogs.length?dialogs[dialogs.length-1]:document;
    const b=exactOrContains(root,['ok','موافق','done','تم','close','إغلاق']);
    if(b){b.click();mark(S.comment);S.stage='idle';return JSON.stringify({state:'confirmed'});}
    if(Date.now()>S.deadline){S.stage='idle';return JSON.stringify({state:'timeout'});}
    return JSON.stringify({state:'no'});
  };
})();
