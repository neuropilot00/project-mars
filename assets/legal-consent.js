// ── Legal Modals ──
function openTosModal(){ document.getElementById('tosModal').classList.add('open'); }
function closeTosModal(){ document.getElementById('tosModal').classList.remove('open'); }
function openPrivacyModal(){ document.getElementById('privacyModal').classList.add('open'); }
function closePrivacyModal(){ document.getElementById('privacyModal').classList.remove('open'); }

// Close legal modals with Escape key
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){
    closeTosModal();
    closePrivacyModal();
  }
});

// ── Cookie Consent ──
(function(){
  if(!localStorage.getItem('cookie_consent')){
    document.getElementById('cookieBanner').classList.add('show');
  }
})();
function acceptCookies(){
  localStorage.setItem('cookie_consent','1');
  document.getElementById('cookieBanner').classList.remove('show');
}

// ── Gambling Disclaimer (one-time before arena) ──
var _origOpenArena = window.openArena;
window.openArena = function(){
  if(!localStorage.getItem('gamble_disclaimer_accepted')){
    document.getElementById('gambleDisclaimer').classList.add('open');
    return;
  }
  _origOpenArena();
};
function acceptGambleDisclaimer(){
  localStorage.setItem('gamble_disclaimer_accepted','1');
  document.getElementById('gambleDisclaimer').classList.remove('open');
  _origOpenArena();
}
