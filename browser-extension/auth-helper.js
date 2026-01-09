// Script helper per salvare il JWT token in chrome.storage
// Deve essere iniettato nella pagina dell'app dopo il login

(function() {
  // Leggi il cookie extension_token
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  const jwtToken = getCookie('extension_token');

  if (jwtToken && typeof chrome !== 'undefined' && chrome.storage) {
    // Salva il token in chrome.storage
    chrome.storage.local.set({ jwtToken }, () => {
      console.log('✅ JWT token saved to extension storage');

      // Mostra notifica all'utente
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
      `;
      notification.textContent = '✅ Estensione autenticata con successo!';
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.remove();
      }, 3000);
    });
  } else {
    console.log('⚠️ Extension not detected or no JWT token found');
  }
})();
