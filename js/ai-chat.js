let aiChatHistory = [
  { role: "user", parts: [{ text: "Sen bir öğrenci çalışma asistanısın. Kısa, motive edici ve net cevaplar ver. Uzun paragraflardan kaçın." }] },
  { role: "model", parts: [{ text: "Anladım! Hızlı ve net yanıtlar vererek sana yardımcı olacağım." }] }
];

function toggleAiChat() {
  const panel = document.getElementById('ai-chat-panel');
  panel.classList.toggle('hidden');
  
  if (!panel.classList.contains('hidden')) {
    checkAiKey();
    document.getElementById('ai-chat-input').focus();
  }
}

function checkAiKey() {
  const key = localStorage.getItem('gemini_api_key');
  const setupDiv = document.getElementById('ai-key-setup');
  const inputArea = document.getElementById('ai-chat-input-area');
  
  if (!key) {
    setupDiv.classList.remove('hidden');
    inputArea.style.display = 'none';
  } else {
    setupDiv.classList.add('hidden');
    inputArea.style.display = 'flex';
  }
}

function saveAiKey() {
  const val = document.getElementById('ai-api-key-input').value.trim();
  if (val) {
    localStorage.setItem('gemini_api_key', val);
    checkAiKey();
  }
}

async function sendAiMessage() {
  const inp = document.getElementById('ai-chat-input');
  const text = inp.value.trim();
  if (!text) return;
  
  inp.value = '';
  addMsgToDOM(text, 'user');
  
  const key = localStorage.getItem('gemini_api_key');
  if (!key) return;

  aiChatHistory.push({ role: "user", parts: [{ text }] });
  
  const msgsDiv = document.getElementById('ai-chat-messages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'ai-typing';
  typingDiv.id = 'ai-typing';
  typingDiv.innerHTML = '<span></span><span></span><span></span>';
  msgsDiv.appendChild(typingDiv);
  msgsDiv.scrollTop = msgsDiv.scrollHeight;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: aiChatHistory,
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
      })
    });
    
    const data = await res.json();
    document.getElementById('ai-typing')?.remove();
    
    if (data.error) {
      addMsgToDOM('Hata: ' + data.error.message, 'ai');
      return;
    }
    
    const reply = data.candidates[0].content.parts[0].text;
    aiChatHistory.push({ role: "model", parts: [{ text: reply }] });
    
    addMsgToDOM(reply, 'ai');
  } catch (err) {
    document.getElementById('ai-typing')?.remove();
    addMsgToDOM('Bağlantı hatası oluştu.', 'ai');
  }
}

function addMsgToDOM(text, sender) {
  const msgsDiv = document.getElementById('ai-chat-messages');
  const div = document.createElement('div');
  div.className = `ai-msg ${sender}`;
  // Basic markdown bold processing
  div.innerHTML = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  msgsDiv.appendChild(div);
  msgsDiv.scrollTop = msgsDiv.scrollHeight;
}
