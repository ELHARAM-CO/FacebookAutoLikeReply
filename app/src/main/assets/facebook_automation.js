(function(){
  if(window.__fbAutoReady)return; window.__fbAutoReady=true;

  // لا نعدل touch-action أو overscroll في Facebook.
  // Facebook يستخدم حاويات تمرير متعددة (ومنها نوافذ التحقق)،
  // وأي CSS عام على html/body قد يمنع سحب نافذة التحقق.

  const S={busy:false,comment:null,stage:'idle',deadline:0,commentWaits:0};
  const T=e=>(e&&(e.innerText||e.textContent)||'').replace(/\s+/g,' ').trim();
  const V=e=>!!(e&&e.offsetParent!==null);
  const B=root=>Array.from((root||document).querySelectorAll('button,[role="button"],a')).filter(V);
  const F=(root,words)=>B(root).find(b=>words.some(w=>T(b).toLowerCase().includes(w)));
  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  // اكتشاف واجهات التحقق من الإنسان/الكابتشا بدون لمس محتوى iframe
  // لأن بعض اختبارات Facebook تكون داخل iframe منفصل. نكتفي بفحص
  // النصوص والـ aria-label/title الظاهرة في الصفحة الأم.
  window.__fbAutoHasHumanCheck=function(){
    try{
      const hay=(document.body?document.body.innerText:'')+' '+
        Array.from(document.querySelectorAll('[aria-label],[title]')).map(e=>(e.getAttribute('aria-label')||'')+' '+(e.getAttribute('title')||'')).join(' ');
      return /(confirm you.?re human|verify you.?re human|verify that you are human|i.?m not a robot|captcha|human verification|security check|تأكيد أنك إنسان|تأكيد انك انسان|تحقق من أنك إنسان|تحقق انك انسان|أنا لست روبوت|انا لست روبوت|اختبار أمان|اختبار امان)/i.test(hay);
    }catch(e){ return false; }
  };

  window.__fbAutoBringHumanCheckIntoView=function(){
    try{
      const re=/(confirm you.?re human|verify you.?re human|verify that you are human|i.?m not a robot|captcha|human verification|security check|تأكيد أنك إنسان|تأكيد انك انسان|تحقق من أنك إنسان|تحقق انك انسان|أنا لست روبوت|انا لست روبوت|اختبار أمان|اختبار امان)/i;
      const all=Array.from(document.querySelectorAll('div,section,main,[role=dialog],[role=alert],iframe,[aria-label],[title]'));
      const el=all.find(e=>{const t=((e.innerText||e.textContent||'')+' '+(e.getAttribute?.('aria-label')||'')+' '+(e.getAttribute?.('title')||'')).replace(/\s+/g,' ');return t && re.test(t) && e.offsetParent!==null;});
      if(el && el.scrollIntoView) el.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
      return !!el;
    }catch(e){ return false; }
  };
  function comments(){return Array.from(document.querySelectorAll('[role="article"]')).filter(V).filter(a=>{const t=T(a).toLowerCase(); return F(a,['reply','رد'])||F(a,['like','إعجاب','اعجبني'])||/reply|رد|like|إعجاب|comment|تعليق/i.test(t);});}
  function done(c){return c&&c.dataset.fbAutoHandled==='1';}
  function mark(c){c.dataset.fbAutoHandled='1';}
  function name(c){let h=c.querySelector('h2,h3,h4,a[role="link"]');return T(h)||'حضرتك';}
  function input(root){
    const scope=root||document;
    const local=Array.from(scope.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')).filter(V).find(x=>!x.closest('[aria-hidden="true"]'));
    if(local)return local;
    return Array.from(document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')).filter(V).find(x=>!x.closest('[aria-hidden="true"]'));
  }
  function type(el,value){if(!el)return false;el.focus();if(el.tagName==='TEXTAREA'){let p=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');p&&p.set? p.set.call(el,value):el.value=value;}else{el.textContent=value;}el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;}
  async function publicReply(c,text){
    let r=F(c,['reply','رد']);
    if(!r)return false;
    r.click();
    await wait(700);
    let box=input(c);
    if(!box)return false;
    let msg=text.replace('[اسم العميل]',name(c));
    if(!type(box,msg))return false;
    await wait(250);
    let send=F(c,['comment','تعليق','send','إرسال']) || F(document,['comment','تعليق','send','إرسال']);
    if(send){send.click();await wait(900);return true;}
    box.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter',code:'Enter'}));
    await wait(900);
    return true;
  }
  async function privateMsg(c,text){let m=F(c,['send message','إرسال رسالة','message']);if(!m)return {available:false,sent:false};m.click();await wait(900);let box=input();if(!box)return {available:true,sent:false,needConfirm:false};if(!type(box,text))return {available:true,sent:false};await wait(250);let send=F(document,['send','إرسال']);if(!send)return {available:true,sent:false};send.click();await wait(900);return {available:true,sent:true,needConfirm:true};}
  window.__fbAutoOpenComments=async function(){
    try{
      // Facebook قد يؤخر تحميل التعليقات؛ نحاول فتحها وفحصها عدة مرات قبل إعلان الفشل.
      for(let attempt=0;attempt<6;attempt++){
        const buttons=B(document);
        let commentButton=buttons.find(b=>{
          const t=((T(b)+' '+(b.getAttribute('aria-label')||'')+' '+(b.getAttribute('title')||''))).toLowerCase();
          return /^(comments?|التعليقات|تعليقات|comment|comments)/i.test(t) || /\bcomments?\b|التعليقات|تعليقات/.test(t);
        });
        if(commentButton){
          commentButton.scrollIntoView({block:'center',inline:'nearest'});
          await wait(250);
          commentButton.click();
        }
        await wait(900);
        const list=comments();
        if(list.length){
          list[0].scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
          S.commentWaits=0;
          return true;
        }
      }
      return false;
    }catch(e){return false;}
  };
  window.__fbAutoProcessNext=async function(pub,priv,alt,sendPrivate,publicEnabled){
    if(S.busy)return JSON.stringify({state:'busy'}); S.busy=true;
    try{
      let c=comments().find(x=>!done(x));
      if(!c){
        S.commentWaits=(S.commentWaits||0)+1;
        S.busy=false;
        if(S.commentWaits<=12) return JSON.stringify({state:'waiting',tries:S.commentWaits});
        return JSON.stringify({state:'done'});
      }
      S.commentWaits=0;
      S.comment=c;
      let like=F(c,['like','إعجاب','اعجبني']); let didLike=false; if(like&&!/unlike|إلغاء الإعجاب|تم الإعجاب/i.test(T(like))){like.click();didLike=true;await wait(450);}
      let msg=F(c,['send message','إرسال رسالة','message']); let publicDone=false, privateDone=false;
      if(publicEnabled){publicDone=await publicReply(c,pub);}
      if(!msg){if(alt){await publicReply(c,alt);publicDone=true;}mark(c);S.busy=false;return JSON.stringify({state:'processed',like:didLike,public:publicDone,private:false});}
      if(sendPrivate){let p=await privateMsg(c,priv);if(!p.sent){S.busy=false;return JSON.stringify({state:'error',message:'تعذر إدخال أو إرسال الرسالة الخاصة.'});}S.stage='confirm';S.deadline=Date.now()+15000;S.busy=false;return JSON.stringify({state:'confirm'});}
      mark(c);S.busy=false;return JSON.stringify({state:'processed',like:didLike,public:publicDone,private:false});
    }catch(e){S.busy=false;return JSON.stringify({state:'error',message:String(e)});}
  };
  window.__fbAutoConfirmDialog=function(){
    if(S.stage!=='confirm')return JSON.stringify({state:'no'});
    let b=F(document,['ok','موافق','done','تم','close','إغلاق']);
    if(b){b.click();mark(S.comment);S.stage='idle';return JSON.stringify({state:'confirmed'});}
    if(Date.now()>S.deadline){S.stage='idle';return JSON.stringify({state:'timeout'});}
    return JSON.stringify({state:'no'});
  };
})();
