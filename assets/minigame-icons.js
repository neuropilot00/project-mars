// Render game sprites as icons
document.addEventListener('DOMContentLoaded', function() {
  // Safety: on tablet/mobile (≤1024px) ensure panels start CLOSED so the globe is visible.
  // Defends against any auto-open path or stale .open class from previous sessions.
  try {
    if (window.innerWidth <= 1024) {
      var pL = document.getElementById('panelL');
      var pR = document.getElementById('panelR');
      if (pL) pL.classList.remove('open');
      if (pR) pR.classList.remove('open');
    }
  } catch(_) {}
  try {
    var el = document.getElementById('mgShipIcon');
    if (el && window.MarsInvaders && MarsInvaders.getShipIcon) {
      var img = new Image(); img.src = MarsInvaders.getShipIcon(36);
      img.style.cssText = 'width:32px;height:32px;image-rendering:pixelated';
      el.textContent = ''; el.appendChild(img);
    }
    var el2 = document.getElementById('mgRunnerIcon');
    if (el2 && window.MarsRunner && MarsRunner.getAstronautIcon) {
      var img2 = new Image(); img2.src = MarsRunner.getAstronautIcon(36);
      img2.style.cssText = 'width:32px;height:32px;image-rendering:pixelated';
      el2.textContent = ''; el2.appendChild(img2);
    }
    var el3 = document.getElementById('mgDiggerIcon');
    if (el3 && window.MarsDigger && MarsDigger.getPickaxeIcon) {
      var img3 = new Image(); img3.src = MarsDigger.getPickaxeIcon(36);
      img3.style.cssText = 'width:32px;height:32px;image-rendering:pixelated';
      el3.textContent = ''; el3.appendChild(img3);
    }
  } catch(e) {}
});
