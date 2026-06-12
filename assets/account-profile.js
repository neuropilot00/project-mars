var emailAuth = {
  token: localStorage.getItem('pw_token') || null,
  user: null
};

function accountReadJson(key, url, minGap, auth) {
  var walletKey = (window.walletState && walletState.address) ? String(walletState.address).toLowerCase() : 'public';
  var fetchOptions = auth === false ? {} : { headers: getAuthHeaders() };
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('account:' + key + ':' + walletKey, url, {
      minGap: minGap || 10000,
      backoffMs: 120000,
      fetchOptions: fetchOptions
    });
  }
  return fetch(url, fetchOptions).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}

function _authRankCacheKey(wallet){
  return wallet ? 'om_rank_' + String(wallet).toLowerCase() : '';
}
function _setAuthRankDisplays(rank){
  var n = parseInt(rank, 10);
  if (!Number.isFinite(n) || n <= 0) return false;
  var ids = ['profileLevel', 'profileLevelBadge', 'baseRankLevel', 'profileXpLv'];
  ids.forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.textContent = n;
  });
  try{ if(typeof applyBaseTabLocks === 'function') applyBaseTabLocks(); }catch(_){}
  return true;
}
function _rememberAuthRank(wallet, rank){
  var n = parseInt(rank, 10);
  var key = _authRankCacheKey(wallet);
  if (!key || !Number.isFinite(n) || n <= 0) return;
  try{ localStorage.setItem(key, String(n)); }catch(_){}
}
function _applyAuthRank(data){
  data = data || {};
  var user = data.user || {};
  var wallet = data.wallet || user.wallet || (walletState && walletState.address) || '';
  var rank = parseInt(data.rank || data.rankLevel || user.rank || user.rankLevel, 10);
  if (!Number.isFinite(rank) || rank <= 0) {
    try{ rank = parseInt(localStorage.getItem(_authRankCacheKey(wallet)) || '0', 10); }catch(_){}
  }
  if (_setAuthRankDisplays(rank)) {
    _rememberAuthRank(wallet, rank);
    window._authRankLevel = rank;
  }
}

function _applyAuthMeBalances(d){
  if(!d) return;
  walletState.gameUsdt=d.usdtBalance||0;
  walletState.gamePP=d.ppBalance||0;
  var setText=function(id,val){var el=document.getElementById(id);if(el)el.textContent=val;};
  setText('walletUsdt',(d.usdtBalance||0).toFixed(2));
  setText('walletPP',(d.ppBalance||0).toFixed(2));
  setText('authUsdtBal',(d.usdtBalance||0).toFixed(2));
  setText('authPPBal',(d.ppBalance||0).toFixed(2));
  if(d.gpBalance !== undefined){
    if(window._dailyState) window._dailyState.gpBalance = parseFloat(d.gpBalance)||0;
    walletState.gameGP = parseFloat(d.gpBalance)||0;
    if(typeof updateGPDisplay==='function') updateGPDisplay();
  }
  _applyAuthRank(d);
}

// Auto-login: restore session from saved token, or re-login with saved credentials
(function autoLoginInit(){
  if(emailAuth.token){
    _authQuietPublicReads(300000);
    fetch('/api/auth/me',{headers:{'Authorization':'Bearer '+emailAuth.token}})
      .then(function(r){if(!r.ok) throw new Error('expired'); return r.json()})
      .then(function(d){
        // [v7.174 A-C3] emailVerified 추적 — 미인증 시 verify 배너 노출
        emailAuth.user={wallet:d.wallet,email:d.email,nickname:d.nickname,rank:d.rank||1,referralCode:d.referralCode,emailVerified:!!d.emailVerified};
        walletState.connected=true;
        walletState.address=d.wallet;
        walletState.chain='base';
        try{_applyAuthMeBalances(d)}catch(e){}
        try{updateWalletUI();updateEmailVerifyBanner();}catch(e){}
        try{ if(typeof _clearPublicHudFetchBackoff==='function') _clearPublicHudFetchBackoff(); }catch(e){}
        _refreshWorldAfterAuth();
        try{updateChainUI()}catch(e){}
        try{updateTopbarAvatar(true)}catch(e){}
        try{loadReferralInfo()}catch(e){}
        try{trackQuestAction('login',1)}catch(e){}
        try{checkDailyLogin();}catch(e){}
        try{initOnboarding(d.wallet)}catch(e){}
        // ── 부트 시점에 user level 미리 로드 ──
        // 이전엔 BASE 모달 열어야 profileLevel DOM 채워졌음 → 그 전엔 sector overlay 가 myLevel=1 로
        // 모든 high-tier 섹터를 entry-blocked 로 그렸음 ("처음 로딩하고 섹터 누르면 반영 안됨" 신고).
        // 미리 fetch 해서 profileLevel DOM 채우고 sector 텍스처 재합성 트리거.
        try {
          accountReadJson('base-user:' + d.wallet, '/api/user/' + encodeURIComponent(d.wallet) + '/base', 15000, false).then(function(u){
            if (!u || !u.user) return;
            window._baseUserData = u;
            var pl = document.getElementById('profileLevel');
            var plb = document.getElementById('profileLevelBadge');
            if (pl)  pl.textContent  = u.user.rank;
            if (plb) plb.textContent = u.user.rank;
            try{ applyBaseTabLocks(); }catch(_){}
            // 텍스처 캐시 무효화 + 재합성 → 정확한 entry-blocked 판정으로 다시 그림
            if (typeof marsCanvasTexture !== 'undefined') marsCanvasTexture = null;
            if (typeof claimsSnapshot !== 'undefined') claimsSnapshot = null;
            if (typeof compositeClaimsOnTexture === 'function') compositeClaimsOnTexture();
          }).catch(function(){});
        } catch(_) {}
        console.log('[Auth] Auto-login OK:',d.nickname);
      })
      .catch(function(){
        // Token expired — try credential-based auto-login
        emailAuth.token=null;
        try{localStorage.removeItem('pw_token')}catch(e){}
        console.log('[Auth] Token expired, trying saved credentials...');
        _authQuietPublicReads(300000);
        _tryCredentialAutoLogin();
      });
  } else {
    _tryCredentialAutoLogin();
  }
})();

function _tryCredentialAutoLogin(){
  // [v7.170 A-M5 fix] 평문 비밀번호 localStorage 의존 폐지. 자동 로그인은 JWT 토큰(pw_token) 갱신 흐름으로만.
  //   token 만료 시 사용자가 재로그인하도록 정상 흐름 복귀(보안 우선).
  try{
    if(localStorage.getItem('pw_autologin')!=='1') return;
    var email=localStorage.getItem('pw_rem_email');
    var passB64=localStorage.getItem('pw_rem_pass');
    // 과거 저장된 평문 cleanup
    if (passB64) { try { localStorage.removeItem('pw_rem_pass'); } catch(_){} }
    return; // credential auto-login 비활성 — JWT token 갱신 경로(별도)만 사용
    if(!email||!passB64) return;
    var pass=decodeURIComponent(escape(atob(passB64)));
    console.log('[Auth] Credential auto-login for:',email);
    fetch('/api/auth/login',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:email,password:pass})
    }).then(function(r){return r.json()}).then(function(d){
      if(!d.token){console.log('[Auth] Credential auto-login failed');return}
      emailAuth.token=d.token;
      emailAuth.user=d.user;
      try{localStorage.setItem('pw_token',d.token)}catch(e){}
      walletState.connected=true;
      walletState.address=d.user.wallet;
      walletState.chain='base';
      try{updateWalletUI()}catch(e){}
      try{updateChainUI()}catch(e){}
      try{updateTopbarAvatar(true)}catch(e){}
      try{refreshEmailBalances()}catch(e){}
      try{loadReferralInfo()}catch(e){}
      try{trackQuestAction('login',1)}catch(e){}
      try{initOnboarding(d.user.wallet)}catch(e){}
      console.log('[Auth] Credential auto-login OK:',d.user.nickname);
    }).catch(function(e){console.log('[Auth] Credential auto-login error:',e)});
  }catch(e){}
}

function togglePassEye(){
  var inp=document.getElementById('authPassInput');
  var btn=document.getElementById('passEyeBtn');
  if(inp.type==='password'){inp.type='text';btn.classList.add('active');}
  else{inp.type='password';btn.classList.remove('active');}
}
function togglePassField(id,btn){
  var inp=document.getElementById(id);
  if(inp.type==='password'){inp.type='text';btn.classList.add('active');}
  else{inp.type='password';btn.classList.remove('active');}
}

function _authQuietPublicReads(ms){
  var quietMs = Math.max(ms || 0, 300000);
  try{ if(typeof _quietPublicHudFetches==='function') _quietPublicHudFetches(quietMs); }catch(_){}
  window._authSubmitInFlight = !!_authSubmitInFlight;
}
function _refreshWorldAfterAuth(){
  try{
    if(typeof loadServerClaims==='function' && (!window.claims || !window.claims.length)) loadServerClaims();
  }catch(_){}
  try{ if(typeof refreshSectors==='function') refreshSectors(); }catch(_){}
}

function openAuthModal(){
  document.getElementById('authModal').classList.add('open');
  _authQuietPublicReads(300000);
  if(emailAuth.token && emailAuth.user){
    showAuthLoggedIn();
  } else {
    showAuthForm();
  }
}
function closeAuthModal(){ document.getElementById('authModal').classList.remove('open'); }
// Collapsible section toggler for profile modal. Keeps tap target big (whole header row)
// and rotates the chevron via CSS class.
window._togProfSec = function(id){
  var sec = document.getElementById(id);
  if(!sec) return;
  var open = sec.classList.toggle('open');
  var hdr = sec.querySelector('.prof-section-header');
  if(hdr) hdr.classList.toggle('open', open);
};

/* ── Find ID / Reset PW ── */
function showFindEmail(){
  document.getElementById('authForm').style.display='none';
  document.getElementById('findEmailView').style.display='';
  document.getElementById('resetPassView').style.display='none';
  document.getElementById('findEmailResult').style.display='none';
  document.getElementById('findEmailErr').textContent='';
  document.getElementById('findNickInput').value='';
}
var _resetEmail='';
function showResetPassword(){
  document.getElementById('authForm').style.display='none';
  document.getElementById('findEmailView').style.display='none';
  document.getElementById('resetPassView').style.display='';
  document.getElementById('resetStep1').style.display='';
  document.getElementById('resetStep2').style.display='none';
  document.getElementById('resetPassResult').style.display='none';
  document.getElementById('resetStep1Err').textContent='';
  document.getElementById('resetEmailInput').value='';
  var btn=document.getElementById('resetStep1Btn');
  btn.disabled=false;btn.textContent=LANG==='ko'?'인증코드 발송':LANG==='ja'?'認証コード送信':LANG==='zh'?'发送验证码':'Send Code';
  _resetEmail='';
}
function backToAuthForm(){
  document.getElementById('authForm').style.display='';
  document.getElementById('findEmailView').style.display='none';
  document.getElementById('resetPassView').style.display='none';
}
function showAuthForm(){
  document.getElementById('authLoggedIn').style.display='none';
  document.getElementById('authForm').style.display='';
  document.getElementById('findEmailView').style.display='none';
  document.getElementById('resetPassView').style.display='none';
  // Restore saved credentials & checkbox states
  try{
    var rem=localStorage.getItem('pw_remember')==='1';
    var auto=localStorage.getItem('pw_autologin')==='1';
    var remCb=document.getElementById('rememberMe');
    var autoCb=document.getElementById('autoLogin');
    if(remCb) remCb.checked=rem;
    if(autoCb) autoCb.checked=auto;
    if(rem){
      var savedEmail=localStorage.getItem('pw_rem_email');
      // [v7.170 A-M5] pw_rem_pass 평문 의존 폐지 — email 만 prefill, 비밀번호는 직접 입력
      if(savedEmail) document.getElementById('authEmailInput').value=savedEmail;
      try { localStorage.removeItem('pw_rem_pass'); } catch(_){}
    }
  }catch(e){}
}

async function doFindEmail(){
  var nick=document.getElementById('findNickInput').value.trim();
  var errEl=document.getElementById('findEmailErr');
  errEl.textContent='';
  document.getElementById('findEmailResult').style.display='none';
  if(!nick){errEl.textContent=LANG==='ko'?'닉네임을 입력하세요':LANG==='ja'?'ニックネームを入力してください':LANG==='zh'?'请输入昵称':'Enter your nickname';return}
  try{
    var resp=await fetch('/api/auth/find-email',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({nickname:nick})
    });
    var d=await resp.json();
    if(!resp.ok){errEl.textContent=d.error||(LANG==='ko'?'찾을 수 없습니다':LANG==='ja'?'見つかりません':LANG==='zh'?'未找到':'Not found');return}
    document.getElementById('foundEmail').textContent=d.maskedEmail;
    document.getElementById('foundWallet').textContent='Wallet: '+d.walletHint;
    document.getElementById('findEmailResult').style.display='';
  }catch(e){errEl.textContent=LANG==='ko'?'네트워크 오류':LANG==='ja'?'ネットワークエラー':LANG==='zh'?'网络错误':'Network error'}
}

async function doResetStep1(){
  var email=document.getElementById('resetEmailInput').value.trim();
  var errEl=document.getElementById('resetStep1Err');
  errEl.textContent='';
  if(!email){errEl.textContent=LANG==='ko'?'이메일을 입력하세요':LANG==='ja'?'メールアドレスを入力してください':LANG==='zh'?'请输入邮箱':'Enter your email';return}
  var btn=document.getElementById('resetStep1Btn');
  btn.disabled=true;btn.textContent=LANG==='ko'?'발송 중...':LANG==='ja'?'送信中...':LANG==='zh'?'发送中...':'Sending...';
  try{
    var resp=await fetch('/api/auth/reset-password',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:email})
    });
    var d=await resp.json();
    var _sendCodeLabel=LANG==='ko'?'인증코드 발송':LANG==='ja'?'認証コード送信':LANG==='zh'?'发送验证码':'Send Code';
    if(!resp.ok){errEl.textContent=d.error||(LANG==='ko'?'실패':LANG==='ja'?'失敗':LANG==='zh'?'失败':'Failed');btn.disabled=false;btn.textContent=_sendCodeLabel;return}
    _resetEmail=email;
    document.getElementById('resetStep2Hint').textContent=(LANG==='ko'?'인증코드 전송: ':LANG==='ja'?'認証コード送信: ':LANG==='zh'?'验证码已发送: ':'Code sent to: ')+(d.hint||email);
    document.getElementById('resetStep1').style.display='none';
    document.getElementById('resetStep2').style.display='';
    document.getElementById('resetStep2Err').textContent='';
    document.getElementById('resetCodeInput').value='';
    document.getElementById('resetNewPassInput').value='';
    document.getElementById('resetConfirmPassInput').value='';
  }catch(e){errEl.textContent=LANG==='ko'?'네트워크 오류':LANG==='ja'?'ネットワークエラー':LANG==='zh'?'网络错误':'Network error';btn.disabled=false;btn.textContent=LANG==='ko'?'인증코드 발송':LANG==='ja'?'認証コード送信':LANG==='zh'?'发送验证码':'Send Code'}
}

async function doResetStep2(){
  var code=document.getElementById('resetCodeInput').value.trim();
  var newPass=document.getElementById('resetNewPassInput').value;
  var confirmPass=document.getElementById('resetConfirmPassInput').value;
  var errEl=document.getElementById('resetStep2Err');
  errEl.textContent='';
  if(!code||code.length!==6){errEl.textContent=LANG==='ko'?'6자리 인증코드를 입력하세요':LANG==='ja'?'6桁の認証コードを入力してください':LANG==='zh'?'请输入6位验证码':'Enter the 6-digit code';return}
  // [v7.173 A-M4 fix] 서버 정책(8자+대소문자+숫자+특수문자)에 맞춰 클라 검증 강화 — 이전 6자만 통과시켜 서버 거절 빈발했음.
  if(!newPass||newPass.length<8){errEl.textContent=tl('Password must be at least 8 characters','비밀번호는 8자 이상','パスワードは8文字以上','密码至少8位');return}
  if(!/[A-Z]/.test(newPass)||!/[a-z]/.test(newPass)||!/[0-9]/.test(newPass)||!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPass)){
    errEl.textContent=tl('Need uppercase, lowercase, number, special char','대문자·소문자·숫자·특수문자 모두 필요','大文字・小文字・数字・特殊文字すべて必要','需包含大写、小写、数字与特殊字符');
    return;
  }
  if(newPass!==confirmPass){errEl.textContent=LANG==='ko'?'비밀번호가 일치하지 않습니다':LANG==='ja'?'パスワードが一致しません':LANG==='zh'?'密码不一致':'Passwords do not match';return}
  var btn=document.getElementById('resetStep2Btn');
  btn.disabled=true;btn.textContent=LANG==='ko'?'변경 중...':LANG==='ja'?'変更中...':LANG==='zh'?'更改中...':'Updating...';
  try{
    var resp=await fetch('/api/auth/reset-password/verify',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:_resetEmail,code:code,newPassword:newPass})
    });
    var d=await resp.json();
    var _changePwLabel=LANG==='ko'?'비밀번호 변경':LANG==='ja'?'パスワード変更':LANG==='zh'?'修改密码':'Change Password';
    if(!resp.ok){errEl.textContent=d.error||(LANG==='ko'?'실패':LANG==='ja'?'失敗':LANG==='zh'?'失败':'Failed');btn.disabled=false;btn.textContent=_changePwLabel;return}
    document.getElementById('resetStep2').style.display='none';
    document.getElementById('resetPassResult').style.display='';
  }catch(e){errEl.textContent=LANG==='ko'?'네트워크 오류':LANG==='ja'?'ネットワークエラー':LANG==='zh'?'网络错误':'Network error';btn.disabled=false;btn.textContent=LANG==='ko'?'비밀번호 변경':LANG==='ja'?'パスワード変更':LANG==='zh'?'修改密码':'Change Password'}
}

var authTab='login';
var _authSubmitInFlight = false;
var _authSubmitCooldownUntil = 0;
function switchAuthTab(tab){
  authTab=tab;
  document.getElementById('tabLogin').classList.toggle('active',tab==='login');
  document.getElementById('tabRegister').classList.toggle('active',tab==='register');
  document.getElementById('registerFields').style.display=tab==='register'?'':'none';
  var btn=document.getElementById('authSubmitBtn');
  btn.textContent=t(tab);
  document.getElementById('authErrMsg').textContent='';
}

async function submitAuth(){
  if(_authSubmitInFlight) return;
  var email=document.getElementById('authEmailInput').value.trim();
  var pass=document.getElementById('authPassInput').value;
  var errEl=document.getElementById('authErrMsg');
  errEl.textContent='';

  var now=Date.now();
  if(now<_authSubmitCooldownUntil){
    var waitSec=Math.ceil((_authSubmitCooldownUntil-now)/1000);
    errEl.textContent=LANG==='ko'?'요청이 너무 많습니다. '+waitSec+'초 후 다시 시도하세요.':LANG==='ja'?'リクエストが多すぎます。'+waitSec+'秒後に再試行してください。':LANG==='zh'?'请求过多。请在 '+waitSec+' 秒后重试。':'Too many attempts. Try again in '+waitSec+'s.';
    return;
  }

  if(!email||!pass){errEl.textContent='Email and password required';return}

  var btn=document.getElementById('authSubmitBtn');
  _authSubmitInFlight=true;
  _authQuietPublicReads(300000);
  btn.disabled=true;btn.textContent='...';

  try{
    var body={email:email,password:pass};
    if(authTab==='register'){
      body.nickname=document.getElementById('authNickInput').value.trim()||undefined;
      body.referralCode=document.getElementById('authRefInput').value.trim()||undefined;
      if(!body.referralCode&&window._pendingRefCode) body.referralCode=window._pendingRefCode;
      var tosBox=document.getElementById('tosAgree');
      if(!tosBox||!tosBox.checked){errEl.textContent='You must agree to the Terms of Service';btn.disabled=false;btn.textContent=t(authTab);return}
      body.tosAccepted=true;
    }

    var apiUrl='/api/auth/'+(authTab==='register'?'register':'login');
    console.log('[Auth] fetch →',apiUrl);
    var resp;
    try{
      resp=await fetch(apiUrl,{
        method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body:JSON.stringify(body)
      });
    }catch(fetchErr){
      console.error('[Auth] fetch itself failed:',fetchErr);
      errEl.textContent='Connection failed: '+fetchErr.message;
      return;
    }

    var d;
    try{ d=await resp.json(); }catch(jsonErr){
      console.error('[Auth] JSON parse failed:',jsonErr,'status:',resp.status);
      errEl.textContent='Server error (status '+resp.status+')';
      return;
    }

    if(!resp.ok){
      if(resp.status===429){
        var retryAfter=parseInt(resp.headers.get('Retry-After')||'0',10);
        var waitMs=(retryAfter>0?retryAfter*1000:300000);
        _authSubmitCooldownUntil=Date.now()+waitMs;
        _authQuietPublicReads(waitMs);
      }
      errEl.textContent=d.error||'Failed';
      return;
    }

    // Success — wrap each step so we can see which one breaks on mobile
    emailAuth.token=d.token;
    emailAuth.user=d.user;
    try{ localStorage.setItem('pw_token',d.token); }catch(lsErr){ console.warn('[Auth] localStorage fail:',lsErr); }

    // Save credentials if Remember checked
    try{
      var remCb=document.getElementById('rememberMe');
      var autoCb=document.getElementById('autoLogin');
      // [v7.170 A-M5 fix] 비밀번호 평문 localStorage 저장 제거 — XSS 1회로 탈취 가능했음.
      //   email 만 기억하고, 자동 로그인은 JWT 토큰(pw_token)으로만 처리(이미 onauth 흐름에 있음).
      if(remCb&&remCb.checked){
        localStorage.setItem('pw_rem_email',email);
        localStorage.setItem('pw_remember','1');
      }else{
        localStorage.removeItem('pw_rem_email');
        localStorage.removeItem('pw_remember');
      }
      // 과거 저장된 평문 비밀번호 cleanup (있다면 제거)
      try { localStorage.removeItem('pw_rem_pass'); } catch(_){}
      if(autoCb&&autoCb.checked){
        localStorage.setItem('pw_autologin','1');
      }else{
        localStorage.removeItem('pw_autologin');
      }
    }catch(e3){}

    walletState.connected=true;
    walletState.address=d.user.wallet;
    walletState.chain='base';
    _applyAuthRank(d);
    try{ if(typeof _clearPublicHudFetchBackoff==='function') _clearPublicHudFetchBackoff(); }catch(e2){}
    _refreshWorldAfterAuth();
    try{ updateWalletUI(); }catch(e2){ console.error('[Auth] updateWalletUI:',e2); }
    try{ updateChainUI(); }catch(e2){ console.error('[Auth] updateChainUI:',e2); }
    try{ updateTopbarAvatar(true); }catch(e2){ console.error('[Auth] updateTopbarAvatar:',e2); }
    try{ showAuthLoggedIn(); }catch(e2){ console.error('[Auth] showAuthLoggedIn:',e2); }
    showToast(t(authTab==='register'?'registered':'login_success'));

    try{ loadReferralInfo(); }catch(e2){ console.error('[Auth] loadReferralInfo:',e2); }
    if(window._pendingRefCode){delete window._pendingRefCode}
    try{ refreshEmailBalances(); }catch(e2){ console.error('[Auth] refreshEmailBalances:',e2); }
    try{ trackQuestAction('login',1); }catch(e2){}
    try{ checkDailyLogin(); }catch(e2){ console.error('[Auth] checkDailyLogin:',e2); }
    try{ initOnboarding(d.user.wallet); }catch(e2){}

  }catch(e){
    console.error('[Auth] submitAuth error:', e);
    errEl.textContent=(e.message||'Unknown error')+' ('+e.name+')';
  }finally{
    _authSubmitInFlight=false;
    window._authSubmitInFlight = false;
    btn.disabled=false;
    btn.textContent=t(authTab);
  }
}

function updateTopbarAvatar(loggedIn){
  var loginBtn=document.getElementById('loginBtn');
  var tbAvatarEmoji=document.getElementById('tbAvatarEmoji');
  var tbAvatarImg=document.getElementById('tbAvatarImg');
  if(loggedIn){
    loginBtn.style.display='none';
    var avatar=localStorage.getItem('pw_avatar');
    tbAvatarImg.src=avatar||'/assets/avatars/default.png';
    tbAvatarImg.style.display='block';
    tbAvatarEmoji.style.display='none';
  }else{
    loginBtn.style.display='flex';
    loginBtn.textContent=t('login');
    loginBtn.style.color='';
    tbAvatarEmoji.style.display='none';
    tbAvatarImg.style.display='none';
  }
}

function showAuthLoggedIn(){
  document.getElementById('authForm').style.display='none';
  document.getElementById('authLoggedIn').style.display='';
  loadNotifSettings();
  try{loadDisplaySettings();}catch(_e){}
  if(emailAuth.user){
    document.getElementById('authNickname').textContent=emailAuth.user.nickname||'--';
    document.getElementById('authEmail').textContent=emailAuth.user.email||'--';
    var _addr=emailAuth.user.wallet||'--';
    var _awEl=document.getElementById('authWallet');
    _awEl.dataset.full=_addr;
    _awEl.textContent=_addr;
    // Avatar
    var avatar=localStorage.getItem('pw_avatar');
    document.getElementById('avatarImg').src=avatar||'/assets/avatars/default.png';
    document.getElementById('avatarImg').style.display='';
    document.getElementById('avatarEmoji').style.display='none';
    // Chain in profile
    var ch=walletState.chain||'base';
    var cfg=CHAINS[ch];
    if(cfg){
      document.getElementById('profileChainDot').className='chain-dot '+ch;
      document.getElementById('profileChainName').textContent=cfg.name.toUpperCase();
    }
  }
}

function copyGameWallet(){
  var el=document.getElementById('authWallet');
  var addr=(el && el.dataset && el.dataset.full)||el.textContent;
  if(!addr||addr==='--'){showToast('NO WALLET');return}
  navigator.clipboard.writeText(addr).then(function(){showToast('WALLET ADDRESS COPIED!')});
}

function editNickname(){
  document.getElementById('nickEditWrap').style.display='';
  document.getElementById('nickEditInput').value=emailAuth.user?emailAuth.user.nickname:'';
  document.getElementById('nickEditInput').focus();
}
function cancelEditNick(){
  document.getElementById('nickEditWrap').style.display='none';
}
async function saveNickname(){
  var newName=document.getElementById('nickEditInput').value.trim();
  if(!newName){showToast('ENTER A NAME');return}
  if(!emailAuth.token){showToast('NOT LOGGED IN');return}
  try{
    var resp=await fetch('/api/auth/update-profile',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+emailAuth.token},
      body:JSON.stringify({nickname:newName})
    });
    var d=await resp.json();
    if(d.success){
      emailAuth.user.nickname=newName;
      document.getElementById('authNickname').textContent=newName;
      document.getElementById('nickEditWrap').style.display='none';
      showToast('NAME UPDATED!');
    }else{showToast(srvErr(d.error)||'FAILED','error')}
  }catch(e){showToast('NETWORK ERROR')}
}

function changeAvatar(){
  var input=document.createElement('input');
  input.type='file';input.accept='image/*';
  input.onchange=function(e){
    var file=e.target.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onload=function(ev){
      var dataUrl=ev.target.result;
      // Resize to 200x200 for storage
      var img=new Image();
      img.onload=function(){
        var c=document.createElement('canvas');c.width=200;c.height=200;
        var ctx=c.getContext('2d');
        var size=Math.min(img.width,img.height);
        var sx=(img.width-size)/2, sy=(img.height-size)/2;
        ctx.drawImage(img,sx,sy,size,size,0,0,200,200);
        var small=c.toDataURL('image/jpeg',0.8);
        localStorage.setItem('pw_avatar',small);
        document.getElementById('avatarImg').src=small;
        document.getElementById('avatarImg').style.display='';
        document.getElementById('avatarEmoji').style.display='none';
        // Update topbar avatar too
        document.getElementById('tbAvatarImg').src=small;
        document.getElementById('tbAvatarImg').style.display='block';
        document.getElementById('tbAvatarEmoji').style.display='none';
        showToast(t('prof_photo_updated'));
      };
      img.src=dataUrl;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
// ═══════ PROFILE SETTINGS ═══════
function saveNotifSettings(){
  var s={hijack:document.getElementById('notifHijack').checked,weather:document.getElementById('notifWeather').checked,
    rocket:document.getElementById('notifRocket').checked,mining:document.getElementById('notifMining').checked,
    sound:document.getElementById('notifSound').checked};
  localStorage.setItem('pw_notif_settings',JSON.stringify(s));
}
function loadNotifSettings(){
  try{var s=JSON.parse(localStorage.getItem('pw_notif_settings'));if(!s)return;
    if(s.hijack!==undefined)document.getElementById('notifHijack').checked=s.hijack;
    if(s.weather!==undefined)document.getElementById('notifWeather').checked=s.weather;
    if(s.rocket!==undefined)document.getElementById('notifRocket').checked=s.rocket;
    if(s.mining!==undefined)document.getElementById('notifMining').checked=s.mining;
    if(s.sound!==undefined)document.getElementById('notifSound').checked=s.sound;
  }catch(_e){}
}
function getNotifSetting(key){
  try{var s=JSON.parse(localStorage.getItem('pw_notif_settings'));return s?s[key]!==false:true;}catch(_e){return true;}
}
// ─── Display Settings (HUD visibility toggles) ───
function saveDisplaySettings(){
  var _get=function(id){var e=document.getElementById(id);return e?e.checked:true;};
  var s={
    weatherBar:_get('dispWeatherBar'),
    commanderBar:_get('dispCommanderBar'),
    rocketBar:_get('dispRocketBar'),
    announceBar:_get('dispAnnounceBar'),
    guildEmblem:_get('dispGuildEmblem'),
    guildTag:_get('dispGuildTag')
  };
  localStorage.setItem('pw_display_settings',JSON.stringify(s));
  // Apply immediately
  try{ if(typeof updateWeatherBanner==='function') updateWeatherBanner(); }catch(_e){}
  try{ if(typeof loadCommanderBanner==='function') loadCommanderBanner(); }catch(_e){}
  try{ applyHudToggles(); }catch(_e){}
  try{ if(typeof selectedPlot!=='undefined' && selectedPlot && selectedPlot.owner) showTerritoryInfo(selectedPlot); }catch(_e){}
}
function loadDisplaySettings(){
  try{var s=JSON.parse(localStorage.getItem('pw_display_settings'));if(!s){ applyHudToggles(); return; }
    var _set=function(id,v){var e=document.getElementById(id);if(e&&v!==undefined)e.checked=v;};
    _set('dispWeatherBar',s.weatherBar);
    _set('dispCommanderBar',s.commanderBar);
    _set('dispRocketBar',s.rocketBar);
    _set('dispAnnounceBar',s.announceBar);
    _set('dispGuildEmblem',s.guildEmblem);
    _set('dispGuildTag',s.guildTag);
    applyHudToggles();
  }catch(_e){}
}
// Apply rocket/announce toggles by adding a .hud-hidden class
// (their show state is managed elsewhere via .show classList)
function applyHudToggles(){
  var rb=document.getElementById('rocketBanner');
  if(rb) rb.classList.toggle('hud-hidden', !getDisplaySetting('rocketBar'));
  var ab=document.getElementById('announceBanner');
  if(ab) ab.classList.toggle('hud-hidden', !getDisplaySetting('announceBar'));
}
function getDisplaySetting(key){
  try{var s=JSON.parse(localStorage.getItem('pw_display_settings'));return s?s[key]!==false:true;}catch(_e){return true;}
}
function openChangePassword(){
  var el=document.getElementById('profileChangePw');
  el.style.display=el.style.display==='none'?'block':'none';
  document.getElementById('profPwErr').textContent='';
  document.getElementById('profCurPw').value='';
  document.getElementById('profNewPw').value='';
  document.getElementById('profNewPw2').value='';
}
async function doChangePassword(){
  var cur=document.getElementById('profCurPw').value;
  var nw=document.getElementById('profNewPw').value;
  var nw2=document.getElementById('profNewPw2').value;
  var errEl=document.getElementById('profPwErr');
  if(!cur){errEl.textContent='Enter current password';return;}
  if(nw.length<8){errEl.textContent='New password must be 8+ characters';return;}
  if(nw!==nw2){errEl.textContent='Passwords do not match';return;}
  if(!/[A-Z]/.test(nw)||!/[a-z]/.test(nw)||!/[0-9]/.test(nw)||!/[^A-Za-z0-9]/.test(nw)){
    errEl.textContent='Need uppercase, lowercase, number, special char';return;}
  try{
    // [v7.170 A-C1 fix] API 전역 미정의로 'undefined/auth/...' 호출되던 버그. 동일 origin '/api' 로 고정.
    var r=await fetch('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+emailAuth.token},
      body:JSON.stringify({currentPassword:cur,newPassword:nw})});
    var d=await r.json();
    if(!r.ok){errEl.textContent=d.error||'Failed';return;}
    document.getElementById('profileChangePw').style.display='none';
    showToast('Password changed successfully');
  }catch(e){errEl.textContent='Network error';}
}
function exportAccountData(){
  if(!emailAuth.user)return;
  var data={email:emailAuth.user.email,nickname:emailAuth.user.nickname,wallet:walletState.address,
    exportedAt:new Date().toISOString()};
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='occupymars_account_'+Date.now()+'.json';a.click();
  URL.revokeObjectURL(a.href);
  showToast('Account data exported');
}
async function requestDeleteAccount(){
  var ok1=await gameConfirm({icon:'⚠',title:'DELETE ACCOUNT',body:LANG==='ko'?'계정을 삭제하면 모든 영토와 PP가 사라지며 되돌릴 수 없습니다.':LANG==='ja'?'アカウントを削除すると、すべての領土とPPが失われ、元に戻せません。':LANG==='zh'?'删除账户将永久失去所有领地和PP，无法撤销。':'Deleting your account will erase all territory and PP. This cannot be undone.',confirmText:LANG==='ko'?'계속':LANG==='ja'?'続ける':LANG==='zh'?'继续':'Continue'});
  if(!ok1)return;
  var ok2=await gameConfirm({icon:'💀',title:'FINAL WARNING',body:'<b style="color:var(--red)">'+(LANG==='ko'?'영구 삭제':LANG==='ja'?'完全削除':LANG==='zh'?'永久删除':'PERMANENT DELETE')+'</b> — '+(LANG==='ko'?'지갑, 영토, 모든 게임 데이터가 삭제됩니다.':LANG==='ja'?'ウォレット、領土、すべてのゲームデータが削除されます。':LANG==='zh'?'钱包、领地和所有游戏数据将被删除。':'Your wallet, territory, and all game data will be deleted.'),confirmText:LANG==='ko'?'영구 삭제':LANG==='ja'?'完全削除':LANG==='zh'?'永久删除':'Delete Forever'});
  if(!ok2)return;
  fetch('/api/auth/delete-account',{method:'POST',headers:{'Authorization':'Bearer '+emailAuth.token}})
    .then(function(r){return r.json()})
    .then(function(d){if(d.success){showToast(tl('Account deleted','계정이 삭제되었습니다','アカウントが削除されました','账号已删除'));logoutEmail();}else{showToast(srvErr(d.error)||'Failed to delete','error');}})
    .catch(function(){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'));});
}
function logoutEmail(){
  emailAuth.token=null;
  emailAuth.user=null;
  localStorage.removeItem('pw_token');
  // Clear auto-login (keep remember if user wants)
  localStorage.removeItem('pw_autologin');
  walletState.connected=false;
  walletState.address=null;
  updateTopbarAvatar(false);
  document.getElementById('walletCTA').style.display='';
  document.getElementById('walletSection').style.display='none';
  document.getElementById('alertsSection').style.display='none';
  document.getElementById('referralSection').style.display='none';
  document.getElementById('chainIndicator').style.display='none';
  // [v7.175 Task 1] 로그아웃 시 MY ASSETS 상단 버튼 숨김
  var maBtn=document.getElementById('tbMyAssetsBtn'); if(maBtn) maBtn.classList.remove('show');
  closeAuthModal();
  showToast(t('logout'));
}

async function refreshEmailBalances(){
  if(!emailAuth.token) return;
  try{
    var resp=await fetch('/api/auth/me',{headers:{'Authorization':'Bearer '+emailAuth.token}});
    var d=await resp.json();
    if(resp.ok){
      _applyAuthMeBalances(d);
    }
  }catch(e){}
}

/* ── Referral System ─────────────────────────────── */
async function loadReferralInfo(){
  if(!walletState.connected||!walletState.address) return;
  var refSec=document.getElementById('referralSection'); if(refSec) refSec.style.display='';
  try{
    var d=await accountReadJson('referral-info:' + walletState.address, '/api/referral/'+walletState.address, 30000, false);
    if(!d) return;
    var code=d.code||'--';
    var refs=d.referrals||0;
    var earnedPP=(d.totalEarned||0).toFixed(2);
    var earnedGP=(d.totalEarnedGP||0).toFixed(0);
    // Build display string: show GP if non-zero (Migration 099)
    var earnedStr=earnedPP+' PP'+(parseFloat(earnedGP)>0?' + '+earnedGP+' GP':'');
    var setText=function(id,val){var el=document.getElementById(id);if(el)el.textContent=val;};
    setText('myRefCode',code);
    setText('refCount',refs);
    setText('refEarned',earnedStr);
    // Profile panel mirror
    setText('profileMyRefCode',code);
    setText('profileRefCount',refs);
    setText('profileRefEarned',earnedStr);
    // Real-time commission toast — diff against last seen PP value
    try{
      var key='refEarned:'+walletState.address.toLowerCase();
      var prev=parseFloat(localStorage.getItem(key)||'NaN');
      var curr=parseFloat(d.totalEarned||0);
      if(!isNaN(prev) && curr>prev+0.0001){
        var delta=(curr-prev).toFixed(2);
        showToast('💰 +'+delta+' PP commission earned!');
      }
      localStorage.setItem(key,String(curr));
      // GP toast
      var gpKey='refEarnedGP:'+walletState.address.toLowerCase();
      var prevGP=parseFloat(localStorage.getItem(gpKey)||'NaN');
      var currGP=parseFloat(d.totalEarnedGP||0);
      if(!isNaN(prevGP) && currGP>prevGP+0.01){
        var deltaGP=(currGP-prevGP).toFixed(0);
        showToast('💎 +'+deltaGP+' GP referral commission!');
      }
      localStorage.setItem(gpKey,String(currGP));
    }catch(e){}
    var show=function(id,v){var el=document.getElementById(id);if(el)el.style.display=v;};
    if(d.referredBy){
      show('enterRefWrap','none');
      show('alreadyReferred','');
      show('profileEnterRefWrap','none');
      show('profileAlreadyReferred','');
      var refByName=d.referredByNickname||(d.referredBy.slice(0,6)+'...'+d.referredBy.slice(-4));
      var el=document.getElementById('referredByAddr');
      if(el){ el.textContent=refByName; el.title=d.referredBy; }
      var pel=document.getElementById('profileReferredBy');
      if(pel){ pel.textContent=refByName; pel.title=d.referredBy; }
    } else {
      show('enterRefWrap','');
      show('alreadyReferred','none');
      show('profileEnterRefWrap','');
      show('profileAlreadyReferred','none');
    }
  }catch(e){console.error('Referral load error:',e)}
}

async function profileApplyRef(){
  if(!walletState.connected){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  var inp=document.getElementById('profileRefInput');
  var code=(inp?inp.value:'').trim().toUpperCase();
  if(!code){showToast(tl('Enter a code','코드를 입력하세요','コードを入力してください','请输入代码'));return}
  var status=document.getElementById('profileRefStatus');
  if(status){ status.style.color='var(--tx3)'; status.textContent='Registering...'; }
  try{
    var resp=await fetch('/api/referral/register',{
      method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:walletState.address,referralCode:code})
    });
    var d=await resp.json();
    if(d.success){
      if(status){ status.style.color='var(--gn)'; status.textContent='Referred by '+d.referrer; }
      showToast('REFERRAL REGISTERED!');
      loadReferralInfo();
    } else {
      if(status){ status.style.color='var(--red)'; status.textContent=d.error||'Failed'; }
    }
  }catch(e){ if(status){ status.style.color='var(--red)'; status.textContent='Network error'; } }
}

function copyRefCode(){
  var code=document.getElementById('myRefCode').textContent;
  if(!code||code==='--'){showToast('NO CODE YET');return}
  var url=window.location.origin+'?ref='+code;
  navigator.clipboard.writeText(url).then(function(){showToast('REFERRAL LINK COPIED!')}).catch(function(){
    navigator.clipboard.writeText(code).then(function(){showToast('CODE COPIED: '+code)});
  });
}

async function registerReferral(){
  if(!walletState.connected){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  var code=document.getElementById('refCodeInput').value.trim().toUpperCase();
  if(!code){showToast(tl('Enter a code','코드를 입력하세요','コードを入力してください','请输入代码'));return}
  var status=document.getElementById('refStatus');
  status.style.color='var(--tx3)';status.textContent='Registering...';
  try{
    var resp=await fetch('/api/referral/register',{
      method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:walletState.address,referralCode:code})
    });
    var d=await resp.json();
    if(d.success){
      status.style.color='var(--gn)';status.textContent='Referred by '+d.referrer;
      showToast('REFERRAL REGISTERED!');
      loadReferralInfo();
    } else {
      status.style.color='var(--red)';status.textContent=d.error||'Failed';
    }
  }catch(e){status.style.color='var(--red)';status.textContent='Network error'}
}

// Auto-apply referral code from URL
(function(){
  var params=new URLSearchParams(window.location.search);
  var refCode=params.get('ref');
  if(refCode) window._pendingRefCode=refCode.toUpperCase();
})();

// ── DYNASTY view (leaderboard + tree) ──
function toggleDynastyView(){
  var w=document.getElementById('dynastyViewWrap');
  if(!w) return;
  if(w.style.display==='none'){
    w.style.display='';
    showDynastyTab('lb');
  } else {
    w.style.display='none';
  }
}
function showDynastyTab(tab){
  var lb=document.getElementById('dynastyLb'),tr=document.getElementById('dynastyTree');
  var tlb=document.getElementById('dynTabLb'),ttr=document.getElementById('dynTabTree');
  // Active tab = gold text + gold border + gold-tinted background
  var activeStyle={background:'rgba(255,184,77,.15)',borderColor:'rgba(255,184,77,.6)',color:'var(--gold)'};
  var idleStyle={background:'',borderColor:'',color:''};
  function apply(btn,style){if(!btn)return;btn.style.background=style.background;btn.style.borderColor=style.borderColor;btn.style.color=style.color;}
  if(tab==='lb'){
    lb.style.display='';tr.style.display='none';
    apply(tlb,activeStyle);apply(ttr,idleStyle);
    loadDynastyLb();
  } else {
    lb.style.display='none';tr.style.display='';
    apply(tlb,idleStyle);apply(ttr,activeStyle);
    loadDynastyTree();
  }
}
// Trigger-type → human label + emoji. Matches creditReferralCommission trigger keys.
var DYNASTY_TRIGGER_LABELS = {
  hijack:   {ko:'영토 탈취', en:'Hijack',    ja:'奪取',      zh:'劫持',    icon:'⚔️'},
  deposit:  {ko:'입금',     en:'Deposit',   ja:'入金',      zh:'充值',    icon:'💵'},
  swap:     {ko:'스왑 수수료',en:'Swap Fee', ja:'スワップ手数料',zh:'兑换费',icon:'🔄'},
  shop:     {ko:'상점 구매', en:'Shop Buy',  ja:'ショップ',   zh:'商店',    icon:'🛒'},
  cantina:  {ko:'칸티나',    en:'Cantina',   ja:'カンティーナ', zh:'赌场',    icon:'🎰'},
  harvest:  {ko:'채굴',      en:'Mining',    ja:'採掘',       zh:'挖矿',    icon:'⛏️'}
};
function dynastyLabel(trigger){
  var lang=(window.LANG||'en');
  var key=(trigger||'').replace(/_usdt$/,'');
  var tag=DYNASTY_TRIGGER_LABELS[key];
  // tag is keyed by lang code (ko/en/ja/zh) + icon. Fall back to en.
  var name=tag?(tag[lang]||tag.en||key):key.toUpperCase();
  var icon=tag?tag.icon:'•';
  var suffix=/_usdt$/.test(trigger)?' (USDT)':'';
  return icon+' '+name+suffix;
}
function displayName(wallet, nickname){
  if(nickname) return nickname;
  if(!wallet) return '--';
  return wallet.slice(0,6)+'...'+wallet.slice(-4);
}
async function loadDynastyLb(){
  var el=document.getElementById('dynastyLb');
  if(!el) return;
  var lang=(window.LANG||'en');
  var msgs={loading:{ko:'불러오는 중...',en:'Loading...',ja:'読み込み中...',zh:'加载中...'},
            empty:{ko:'아직 다이너스티 없음',en:'No dynasty yet',ja:'ダイナスティなし',zh:'暂无王朝'},
            failed:{ko:'불러오기 실패',en:'Load failed',ja:'読み込み失敗',zh:'加载失败'}};
  el.innerHTML='<div style="font-size:8px;color:var(--tx3);text-align:center;padding:8px">'+(msgs.loading[lang]||msgs.loading.en)+'</div>';
  try{
    var d=await accountReadJson('referral-leaderboard', '/api/referral/leaderboard/top?limit=20', 30000, false);
    if(!d) return;
    var rows=d.leaderboard||[];
    if(!rows.length){el.innerHTML='<div style="font-size:8px;color:var(--tx3);text-align:center;padding:8px">'+(msgs.empty[lang]||msgs.empty.en)+'</div>';return}
    var me=(walletState.address||'').toLowerCase();
    var html='';
    rows.forEach(function(r){
      var isMe=r.wallet.toLowerCase()===me;
      var medal=r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':'#'+r.rank;
      html+='<div style="display:flex;align-items:center;gap:6px;padding:6px;border-bottom:1px solid var(--bdr);font-size:10px;min-height:36px;'+(isMe?'background:rgba(255,184,77,.1)':'')+'">'+
        '<span style="width:26px;color:var(--gold);font-size:9px;flex-shrink:0">'+medal+'</span>'+
        '<span style="flex:1;min-width:0;color:'+(isMe?'var(--gold)':'var(--tx2)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+r.wallet+'">'+displayName(r.wallet,r.nickname)+'</span>'+
        '<span style="color:var(--tx3);font-size:9px;flex-shrink:0">'+r.directCount+'👥</span>'+
        '<span style="color:var(--pp);min-width:64px;text-align:right;flex-shrink:0">'+r.totalEarned.toFixed(2)+' PP</span>'+
        '</div>';
    });
    el.innerHTML=html;
  }catch(e){el.innerHTML='<div style="font-size:8px;color:var(--red);text-align:center;padding:8px">'+(msgs.failed[lang]||msgs.failed.en)+'</div>'}
}
async function loadDynastyTree(){
  var el=document.getElementById('dynastyTree');
  if(!el) return;
  var lang=(window.LANG||'en');
  var msgs={loading:{ko:'불러오는 중...',en:'Loading...',ja:'読み込み中...',zh:'加载中...'},
            needLogin:{ko:'먼저 로그인하세요',en:'Login first',ja:'ログインしてください',zh:'请先登录'},
            bySource:{ko:'수익원별 집계',en:'EARNINGS BY SOURCE',ja:'収益源別',zh:'按来源'},
            direct:{ko:'다이렉트 다운라인',en:'DIRECT DOWNLINE',ja:'直接ダウンライン',zh:'直接下线'},
            noRefs:{ko:'아직 추천인 없음',en:'No referrals yet',ja:'紹介者なし',zh:'暂无推荐'},
            failed:{ko:'불러오기 실패',en:'Load failed',ja:'読み込み失敗',zh:'加载失败'}};
  if(!walletState.address){el.innerHTML='<div style="font-size:8px;color:var(--tx3);text-align:center;padding:8px">'+(msgs.needLogin[lang]||msgs.needLogin.en)+'</div>';return}
  el.innerHTML='<div style="font-size:8px;color:var(--tx3);text-align:center;padding:8px">'+(msgs.loading[lang]||msgs.loading.en)+'</div>';
  try{
    var d=await accountReadJson('referral-tree:' + walletState.address, '/api/referral/tree/'+walletState.address, 30000, false);
    if(!d) return;
    var direct=d.directReferrals||[];
    var byTrig=d.byTrigger||[];
    var html='';
    if(byTrig.length){
      html+='<div style="font-size:8px;color:var(--tx3);margin-bottom:4px">'+(msgs.bySource[lang]||msgs.bySource.en)+'</div>';
      byTrig.forEach(function(t){
        html+='<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 4px;border-bottom:1px solid var(--bdr)">'+
          '<span style="color:var(--tx2)">'+dynastyLabel(t.trigger)+'</span>'+
          '<span style="color:var(--pp)">'+t.total.toFixed(2)+'</span>'+
          '</div>';
      });
    }
    html+='<div style="font-size:8px;color:var(--tx3);margin:8px 0 4px">'+(msgs.direct[lang]||msgs.direct.en)+' ('+direct.length+')</div>';
    if(!direct.length){
      html+='<div style="font-size:8px;color:var(--tx3);text-align:center;padding:4px">'+(msgs.noRefs[lang]||msgs.noRefs.en)+'</div>';
    } else {
      direct.forEach(function(r){
        html+='<div style="display:flex;align-items:center;gap:6px;padding:6px;border-bottom:1px solid var(--bdr);font-size:10px;min-height:34px">'+
          '<span style="flex:1;min-width:0;color:var(--tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+r.wallet+'">'+displayName(r.wallet,r.nickname)+'</span>'+
          (r.subCount>0?'<span style="color:var(--tx3);font-size:9px;flex-shrink:0">+'+r.subCount+' sub</span>':'')+
          '<span style="color:var(--pp);min-width:64px;text-align:right;flex-shrink:0">'+r.earnedFrom.toFixed(2)+' PP</span>'+
          '</div>';
      });
    }
    el.innerHTML=html;
  }catch(e){el.innerHTML='<div style="font-size:8px;color:var(--red);text-align:center;padding:8px">'+(msgs.failed[lang]||msgs.failed.en)+'</div>'}
}
