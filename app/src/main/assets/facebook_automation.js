(function(){
  if(window.__fbAutoReady)return; window.__fbAutoReady=true;

  const S={busy:false,comment:null,stage:'idle',deadline:0,commentWaits:0,commentsOpened:false,sortHandled:false};
  const T=e=>(e&&(e.innerText||e.textContent)||'').replace(/\s+/g,' ').trim();
  const A=e=>e?((e.getAttribute('aria-label')||'')+' '+(e.getAttribute('title')||'')).replace(/\s+/g,' ').trim():'';
  const V=e=>!!(e&&e.offsetParent!==null);
  const B=root=>Array.from((root||document).querySelectorAll('button,[role="button"],a')).filter(V);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  function buttonText(e){
    return (T(e)+' '+A(e)).replace(/\s+/g,' ').trim().toLowerCase();
  }

  function F(root,words){
    const wanted=words.map(w=>String(w).toLowerCase());
    return B(root).find(b=>wanted.some(w=>buttonText(b).includes(w)));
  }

  // Facebook sometimes renders Like/Reply as a span/div inside the real
  // clickable element rather than as a <button>.  Find the visible text or
  // aria-label first, then climb to the nearest clickable ancestor.
  function action(root,words){
    const scope=root||document;
    const wanted=words.map(w=>String(w).trim().toLowerCase());
    const els=Array.from(scope.querySelectorAll('button,[role="button"],a,[role="link"],div,span'))
      .filter(V)
      .filter(e=>{
        const text=T(e).toLowerCase();
        const aria=(e.getAttribute('aria-label')||'').trim().toLowerCase();
        const title=(e.getAttribute('title')||'').trim().toLowerCase();
        return wanted.includes(text)||wanted.includes(aria)||wanted.includes(title);
      });

    els.sort((a,b)=>{
      const aa=(T(a)||A(a)).length, bb=(T(b)||A(b)).length;
      return aa-bb;
    });

    for(const e of els){
      let p=e;
      for(let i=0;i<5&&p;i++,p=p.parentElement){
        if(!V(p)) continue;
        const role=(p.getAttribute('role')||'').toLowerCase();
        if(p.tagName==='BUTTON'||p.tagName==='A'||role==='button'||role==='link'||p.hasAttribute('tabindex')) return p;
      }
      return e;
    }
    return null;
  }

  function actionPressed(el){
    if(!el)return false;
    const vals=[el.getAttribute('aria-pressed'),el.getAttribute('aria-checked'),el.getAttribute('data-pressed')];
    if(vals.some(v=>v==='true'))return true;
    return /^(unlike|إلغاء الإعجاب|تم الإعجاب|liked|liked by)/i.test(buttonText(el));
  }

  function exactVisible(root,words,roles){
    const wanted=words.map(w=>String(w).trim().toLowerCase());
    const scope=root||document;
    let els=Array.from(scope.querySelectorAll(roles||'button,[role="button"],[role="radio"],label,div,span')).filter(V);
    els=els.filter(e=>{
      const text=T(e).toLowerCase();
      const aria=(e.getAttribute('aria-label')||'').trim().toLowerCase();
      return wanted.includes(text)||wanted.includes(aria);
    });
    els.sort((a,b)=>((T(a)||A(a)).length)-((T(b)||A(b)).length));
    return els[0]||null;
  }

  function dialogForSort(){
    const all=Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"],div,section')).filter(V);
    const marker=all.find(e=>/(sort comments|ترتيب التعليقات)/i.test(T(e)) && T(e).length<1200);
    if(!marker)return null;
    let d=marker.closest('[role="dialog"],[aria-modal="true"]');
    if(d)return d;
    let p=marker;
    for(let i=0;i<5&&p;i++,p=p.parentElement){
      const t=T(p);
      if(t.length<1800 && /(?:Most relevant|Newest|All comments|الأحدث|كل التعليقات)/i.test(t)) return p;
    }
    return marker;
  }

  function radioSelected(el){
    if(!el)return false;
    if(el.getAttribute('aria-checked')==='true')return true;
    const input=el.querySelector&&el.querySelector('input[type="radio"]');
    if(input&&input.checked)return true;
    return false;
  }

  async function ensureNewestComments(){
    // Handle the sort dialog at most once per page/session.  The old flow
    // reopened/clicked it on every retry, which caused Newest to be selected
    // repeatedly.
    if(S.sortHandled)return true;

    for(let attempt=0;attempt<12;attempt++){
      const dialog=dialogForSort();
      if(!dialog){
        if(comments().length){
          S.sortHandled=true;
          return true;
        }
        await wait(350);
        continue;
      }

      const newest=exactVisible(dialog,['Newest','الأحدث','التعليقات الأحدث'],'[role="radio"],button,[role="button"],label,div,span');
      if(newest && !radioSelected(newest)){
        newest.click();
        await wait(500);
      }

      const ok=exactVisible(dialog,['OK','موافق','حسنًا','حسناً'],'button,[role="button"],div,span');
      if(ok){
        ok.click();
        S.sortHandled=true;
        await wait(1400);
        return true;
      }
      await wait(500);
    }
    return S.sortHandled;
  }

  function comments(){
    return Array.from(document.querySelectorAll('[role="article"]'))
      .filter(V)
      .filter(a=>{
        // Ignore the global comment composer itself.
        if(a.querySelector('textarea,[contenteditable="true"],[role="textbox"]')) return false;
        const like=action(a,['Like','like','إعجاب','اعجبني']);
        const reply=action(a,['Reply','reply','رد']);
        return !!(like||reply);
      });
  }

  function done(c){return c&&c.dataset.fbAutoHandled==='1';}
  function mark(c){if(c)c.dataset.fbAutoHandled='1';}
  function name(c){
    let h=c.querySelector('h2,h3,h4,a[role="link"]');
    return T(h)||'حضرتك';
  }

  function input(root){
    const scope=root||document;
    const local=Array.from(scope.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]'))
      .filter(V).find(x=>!x.closest('[aria-hidden="true"]'));
    if(local)return local;
    return Array.from(document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]'))
      .filter(V).find(x=>!x.closest('[aria-hidden="true"]'));
  }

  function type(el,value){
    if(!el)return false;
    el.focus();
    if(el.tagName==='TEXTAREA'){
      const p=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
      p&&p.set?p.set.call(el,value):el.value=value;
    }else{
      el.textContent=value;
    }
    el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }

  async function publicReply(c,text){
    const r=action(c,['Reply','reply','رد']);
    if(!r)return false;
    r.scrollIntoView({block:'center',inline:'nearest'});
    await wait(350);
    r.click();
    await wait(800);
    const box=input(c);
    if(!box)return false;
    const msg=text.replace('[اسم العميل]',name(c));
    if(!type(box,msg))return false;
    await wait(350);

    // Prefer the send control belonging to the active composer, then fall
    // back to a visible Send/Comment control on the page.
    let send=null;
    let p=box;
    for(let i=0;i<6&&p&&!send;i++,p=p.parentElement){
      send=action(p,['Send','send','إرسال','Comment','comment','تعليق']);
    }
    send=send||action(document,['Send','send','إرسال','Comment','comment','تعليق']);
    if(send){
      send.click();
      await wait(1000);
      return true;
    }
    box.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter',code:'Enter'}));
    await wait(1000);
    return true;
  }

  async function privateMsg(c,text){
    // The message action may be rendered as a text link or a role=button.
    const m=action(c,['Send message','send message','Message','message','إرسال رسالة','رسالة']);
    if(!m)return {available:false,sent:false};
    m.scrollIntoView({block:'center',inline:'nearest'});
    await wait(350);
    m.click();
    await wait(1000);
    const box=input(document);
    if(!box)return {available:true,sent:false};
    if(!type(box,text))return {available:true,sent:false};
    await wait(350);

    let send=null;
    let p=box;
    for(let i=0;i<7&&p&&!send;i++,p=p.parentElement){
      send=action(p,['Send','send','إرسال']);
    }
    send=send||action(document,['Send','send','إرسال']);
    if(!send)return {available:true,sent:false};
    send.click();
    await wait(1000);
    return {available:true,sent:true,needConfirm:true};
  }

  window.__fbAutoOpenComments=async function(){
    try{
      for(let attempt=0;attempt<12;attempt++){
        // Open the comments area only once.  Re-clicking it while Facebook is
        // still rendering the sort dialog was the cause of repeated Newest dialogs.
        if(!S.commentsOpened){
          const commentButton=action(document,['Comments','comments','Comment','comment','التعليقات','تعليقات']);
          if(commentButton){
            commentButton.scrollIntoView({block:'center',inline:'nearest'});
            await wait(300);
            commentButton.click();
            S.commentsOpened=true;
            await wait(1000);
          }
        }

        const newestDone=await ensureNewestComments();
        const list=comments();
        if(newestDone && list.length){
          document.activeElement&&document.activeElement.blur&&document.activeElement.blur();
          list[0].scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
          S.commentWaits=0;
          return true;
        }
        await wait(900);
      }
      return false;
    }catch(e){return false;}
  };

  window.__fbAutoProcessNext=async function(pub,priv,alt,sendPrivate,publicEnabled){
    if(S.busy)return JSON.stringify({state:'busy'});
    S.busy=true;

    try{
      let c=comments().find(x=>!done(x));

      if(!c){
        S.commentWaits=(S.commentWaits||0)+1;
        S.busy=false;
        if(S.commentWaits<=15)return JSON.stringify({state:'waiting',tries:S.commentWaits});
        return JSON.stringify({state:'done'});
      }

      S.commentWaits=0;
      S.comment=c;

      // REQUIRED ORDER: Like first, then Reply, then private message.
      // Use a DOM/text/aria locator rather than screen coordinates so the
      // action still works when Facebook changes the layout or scroll position.
      let like=action(c,['Like','like','إعجاب','اعجبني']);
      let didLike=false;

      if(like && !actionPressed(like) && !/(unlike|إلغاء الإعجاب|تم الإعجاب)/i.test(buttonText(like))){
        like.scrollIntoView({block:'center',inline:'nearest'});
        await wait(350);
        like.click();
        await wait(900);
        // Verify the same action now reports a pressed/liked state.
        const after=action(c,['Like','like','إعجاب','اعجبني','Unlike','unlike','إلغاء الإعجاب','تم الإعجاب']);
        didLike=!!after && (actionPressed(after)||/(unlike|إلغاء الإعجاب|تم الإعجاب)/i.test(buttonText(after)));
      }

      let msg=action(c,['Send message','send message','Message','message','إرسال رسالة','رسالة']);
      let publicDone=false;

      if(publicEnabled){
        publicDone=await publicReply(c,pub);
      }

      if(!msg){
        if(alt){
          await publicReply(c,alt);
          publicDone=true;
        }
        mark(c);
        S.busy=false;
        return JSON.stringify({state:'processed',like:didLike,public:publicDone,private:false});
      }

      if(sendPrivate){
        let p=await privateMsg(c,priv);
        if(!p.sent){
          S.busy=false;
          return JSON.stringify({state:'error',message:'تعذر إدخال أو إرسال الرسالة الخاصة.'});
        }
        S.stage='confirm';
        S.deadline=Date.now()+15000;
        S.busy=false;
        return JSON.stringify({state:'confirm',like:didLike,public:publicDone});
      }

      mark(c);
      S.busy=false;
      return JSON.stringify({state:'processed',like:didLike,public:publicDone,private:false});

    }catch(e){
      S.busy=false;
      return JSON.stringify({state:'error',message:String(e)});
    }
  };

  window.__fbAutoConfirmDialog=function(){
    if(S.stage!=='confirm')return JSON.stringify({state:'no'});
    let b=F(document,['ok','موافق','done','تم','close','إغلاق']);
    if(b){
      b.click();
      mark(S.comment);
      S.stage='idle';
      return JSON.stringify({state:'confirmed'});
    }
    if(Date.now()>S.deadline){
      S.stage='idle';
      return JSON.stringify({state:'timeout'});
    }
    return JSON.stringify({state:'no'});
  };
})();
