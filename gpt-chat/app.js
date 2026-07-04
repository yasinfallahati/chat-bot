/* =========================================================
   چت‌بات هوشمند متصل به OpenAI API
   همه‌چیز (کلید API، گفتگوها، حافظه) در localStorage مرورگر شما ذخیره می‌شود.
   ========================================================= */

const LS_KEYS = {
  apiKey: 'gptchat_api_key',
  chatModel: 'gptchat_chat_model',
  imageModel: 'gptchat_image_model',
  systemPrompt: 'gptchat_system_prompt',
  conversations: 'gptchat_conversations',
  activeConv: 'gptchat_active_conv'
};

let state = {
  apiKey: localStorage.getItem(LS_KEYS.apiKey) || '',
  chatModel: localStorage.getItem(LS_KEYS.chatModel) || 'gpt-4o-mini',
  imageModel: localStorage.getItem(LS_KEYS.imageModel) || 'dall-e-3',
  systemPrompt: localStorage.getItem(LS_KEYS.systemPrompt) || '',
  conversations: loadConversations(),
  activeConvId: localStorage.getItem(LS_KEYS.activeConv) || null,
  pendingFiles: [] // { name, type, textContent?, dataUrl? }
};

function loadConversations(){
  try{
    const raw = localStorage.getItem(LS_KEYS.conversations);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveConversations(){
  localStorage.setItem(LS_KEYS.conversations, JSON.stringify(state.conversations));
}
function saveActiveConv(){
  localStorage.setItem(LS_KEYS.activeConv, state.activeConvId || '');
}

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const sidebar = $('sidebar');
const convList = $('convList');
const messagesEl = $('messages');
const emptyState = $('emptyState');
const userInput = $('userInput');
const sendBtn = $('sendBtn');
const attachBtn = $('attachBtn');
const fileInput = $('fileInput');
const filePreview = $('filePreview');
const chatTitle = $('chatTitle');
const modeSelect = $('modeSelect');
const newChatBtn = $('newChatBtn');
const menuBtn = $('menuBtn');

const settingsOverlay = $('settingsOverlay');
const settingsBtn = $('settingsBtn');
const closeSettingsBtn = $('closeSettingsBtn');
const saveSettingsBtn = $('saveSettingsBtn');
const apiKeyInput = $('apiKeyInput');
const chatModelInput = $('chatModelInput');
const imageModelInput = $('imageModelInput');
const systemPromptInput = $('systemPromptInput');

const exportBtn = $('exportBtn');
const importBtn = $('importBtn');
const importInput = $('importInput');

// ---------- Init ----------
function init(){
  if(!state.activeConvId || !state.conversations.find(c=>c.id===state.activeConvId)){
    if(state.conversations.length){
      state.activeConvId = state.conversations[0].id;
    }
  }
  renderConvList();
  renderMessages();
  autoResizeTextarea();

  if(!state.apiKey){
    setTimeout(openSettings, 400);
  }
}

// ---------- Conversations ----------
function newConversation(){
  const conv = {
    id: 'c_' + Date.now(),
    title: 'گفتگوی جدید',
    createdAt: Date.now(),
    messages: [] // {role, content, attachments?, imageB64?}
  };
  state.conversations.unshift(conv);
  state.activeConvId = conv.id;
  saveConversations();
  saveActiveConv();
  renderConvList();
  renderMessages();
}

function getActiveConv(){
  return state.conversations.find(c => c.id === state.activeConvId);
}

function renderConvList(){
  convList.innerHTML = '';
  state.conversations.forEach(conv=>{
    const item = document.createElement('div');
    item.className = 'conv-item' + (conv.id === state.activeConvId ? ' active' : '');
    item.innerHTML = `<span class="title">${escapeHtml(conv.title)}</span><span class="del" title="حذف">✕</span>`;
    item.querySelector('.title').addEventListener('click', ()=>{
      state.activeConvId = conv.id;
      saveActiveConv();
      renderConvList();
      renderMessages();
      closeSidebarMobile();
    });
    item.querySelector('.del').addEventListener('click', (e)=>{
      e.stopPropagation();
      if(confirm('این گفتگو حذف بشه؟')){
        state.conversations = state.conversations.filter(c=>c.id!==conv.id);
        if(state.activeConvId === conv.id){
          state.activeConvId = state.conversations[0]?.id || null;
        }
        saveConversations();
        saveActiveConv();
        renderConvList();
        renderMessages();
      }
    });
    convList.appendChild(item);
  });
}

function renderMessages(){
  const conv = getActiveConv();
  messagesEl.innerHTML = '';
  if(!conv || conv.messages.length === 0){
    messagesEl.appendChild(emptyState);
    chatTitle.textContent = conv ? conv.title : 'گفتگوی جدید';
    return;
  }
  chatTitle.textContent = conv.title;
  conv.messages.forEach(m => messagesEl.appendChild(renderMessageEl(m)));
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderMessageEl(m){
  const div = document.createElement('div');
  div.className = 'msg ' + (m.role === 'user' ? 'user' : 'assistant');

  if(m.attachments && m.attachments.length){
    const attWrap = document.createElement('div');
    attWrap.className = 'attachments';
    m.attachments.forEach(a=>{
      if(a.dataUrl){
        const img = document.createElement('img');
        img.src = a.dataUrl;
        img.className = 'att-thumb';
        attWrap.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'att-file';
        span.textContent = '📄 ' + a.name;
        attWrap.appendChild(span);
      }
    });
    div.appendChild(attWrap);
  }

  const textNode = document.createElement('div');
  textNode.textContent = m.content || '';
  div.appendChild(textNode);

  if(m.imageB64){
    const img = document.createElement('img');
    img.className = 'gen-image';
    img.src = 'data:image/png;base64,' + m.imageB64;
    div.appendChild(img);
  }
  return div;
}

function updateConvTitleFromFirstMessage(conv){
  if(conv.title === 'گفتگوی جدید'){
    const first = conv.messages.find(m=>m.role==='user');
    if(first && first.content){
      conv.title = first.content.slice(0, 40) + (first.content.length>40?'…':'');
    }
  }
}

// ---------- File attachments ----------
const TEXT_EXT = ['txt','md','json','csv','js','ts','py','html','css','xml','yaml','yml','log'];
const IMG_EXT = ['png','jpg','jpeg','gif','webp'];

attachBtn.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', async (e)=>{
  const files = Array.from(e.target.files);
  for(const f of files){
    const ext = f.name.split('.').pop().toLowerCase();
    if(IMG_EXT.includes(ext)){
      const dataUrl = await readFileAsDataURL(f);
      state.pendingFiles.push({ name:f.name, type:'image', dataUrl });
    } else if(TEXT_EXT.includes(ext)){
      const text = await readFileAsText(f);
      state.pendingFiles.push({ name:f.name, type:'text', textContent: text.slice(0, 8000) });
    } else {
      state.pendingFiles.push({ name:f.name, type:'other' });
    }
  }
  fileInput.value = '';
  renderFilePreview();
});

function renderFilePreview(){
  filePreview.innerHTML = '';
  state.pendingFiles.forEach((f, idx)=>{
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    if(f.type === 'image'){
      chip.innerHTML = `<img src="${f.dataUrl}"><span>${escapeHtml(f.name)}</span><span class="rm">✕</span>`;
    } else {
      chip.innerHTML = `<span>📄 ${escapeHtml(f.name)}</span><span class="rm">✕</span>`;
    }
    chip.querySelector('.rm').addEventListener('click', ()=>{
      state.pendingFiles.splice(idx,1);
      renderFilePreview();
    });
    filePreview.appendChild(chip);
  });
}

function readFileAsDataURL(file){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function readFileAsText(file){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsText(file);
  });
}

// ---------- Sending messages ----------
userInput.addEventListener('input', autoResizeTextarea);
function autoResizeTextarea(){
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
}
userInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    handleSend();
  }
});
sendBtn.addEventListener('click', handleSend);

async function handleSend(){
  const text = userInput.value.trim();
  if(!text && state.pendingFiles.length === 0) return;

  if(!state.apiKey){
    alert('اول کلید API خودت رو در تنظیمات وارد کن.');
    openSettings();
    return;
  }

  if(!getActiveConv()){
    newConversation();
  }
  const conv = getActiveConv();

  const attachments = state.pendingFiles.map(f=>({
    name: f.name,
    dataUrl: f.type === 'image' ? f.dataUrl : null,
    textContent: f.type === 'text' ? f.textContent : null
  }));

  const userMsg = { role:'user', content:text, attachments: attachments.length? attachments : undefined };
  conv.messages.push(userMsg);
  updateConvTitleFromFirstMessage(conv);
  state.pendingFiles = [];
  renderFilePreview();
  userInput.value = '';
  autoResizeTextarea();
  renderMessages();
  saveConversations();
  renderConvList();

  if(modeSelect.value === 'image'){
    await runImageGeneration(conv, text);
  } else {
    await runChatCompletion(conv);
  }
}

// ---------- Chat completion (streaming) ----------
async function runChatCompletion(conv){
  const typingEl = showTyping();

  // Build messages payload
  const payload = [];
  if(state.systemPrompt){
    payload.push({ role:'system', content: state.systemPrompt });
  }
  conv.messages.forEach(m=>{
    if(m.role === 'user'){
      const parts = [];
      let textContent = m.content || '';
      if(m.attachments){
        m.attachments.forEach(a=>{
          if(a.textContent){
            textContent += `\n\n[فایل پیوست شده: ${a.name}]\n${a.textContent}`;
          }
        });
      }
      if(textContent) parts.push({ type:'text', text: textContent });
      if(m.attachments){
        m.attachments.forEach(a=>{
          if(a.dataUrl){
            parts.push({ type:'image_url', image_url:{ url: a.dataUrl } });
          }
        });
      }
      payload.push({ role:'user', content: parts.length===1 && parts[0].type==='text' ? parts[0].text : parts });
    } else if(m.role === 'assistant' && m.content){
      payload.push({ role:'assistant', content: m.content });
    }
  });

  const assistantMsg = { role:'assistant', content:'' };

  try{
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + state.apiKey
      },
      body: JSON.stringify({
        model: state.chatModel,
        messages: payload,
        stream: true
      })
    });

    if(!resp.ok || !resp.body){
      const errText = await resp.text().catch(()=> '');
      throw new Error(`خطای API (${resp.status}): ${errText.slice(0,300)}`);
    }

    conv.messages.push(assistantMsg);
    removeTyping(typingEl);
    renderMessages();
    const assistantEl = messagesEl.lastElementChild;

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while(true){
      const { done, value } = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, { stream:true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for(const line of lines){
        const trimmed = line.trim();
        if(!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if(data === '[DONE]') continue;
        try{
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if(delta){
            assistantMsg.content += delta;
            assistantEl.querySelector('div') ? (assistantEl.textContent = assistantMsg.content) : null;
            assistantEl.textContent = assistantMsg.content;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        }catch(e){ /* ignore parse errors on partial chunks */ }
      }
    }

    saveConversations();
  } catch(err){
    removeTyping(typingEl);
    showErrorMessage(err.message || String(err));
  }
}

// ---------- Image generation ----------
async function runImageGeneration(conv, prompt){
  if(!prompt){
    showErrorMessage('برای تولید تصویر، یک توضیح متنی بنویس.');
    return;
  }
  const typingEl = showTyping('در حال ساخت تصویر...');
  try{
    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + state.apiKey
      },
      body: JSON.stringify({
        model: state.imageModel,
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      })
    });
    if(!resp.ok){
      const errText = await resp.text().catch(()=> '');
      throw new Error(`خطای API (${resp.status}): ${errText.slice(0,300)}`);
    }
    const json = await resp.json();
    const b64 = json.data?.[0]?.b64_json;
    removeTyping(typingEl);
    const assistantMsg = { role:'assistant', content: '🖼️ تصویر تولید شد:', imageB64: b64 };
    conv.messages.push(assistantMsg);
    renderMessages();
    saveConversations();
  } catch(err){
    removeTyping(typingEl);
    showErrorMessage(err.message || String(err));
  }
}

// ---------- UI helpers ----------
function showTyping(label){
  if(emptyState.parentNode === messagesEl) messagesEl.removeChild(emptyState);
  const el = document.createElement('div');
  el.className = 'typing';
  el.innerHTML = `<span>${label || 'در حال نوشتن'}</span><span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}
function removeTyping(el){
  if(el && el.parentNode) el.parentNode.removeChild(el);
}
function showErrorMessage(text){
  const div = document.createElement('div');
  div.className = 'msg system-note';
  div.textContent = '⚠️ ' + text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function escapeHtml(str){
  return (str||'').replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

// ---------- Settings modal ----------
function openSettings(){
  apiKeyInput.value = state.apiKey;
  chatModelInput.value = state.chatModel;
  imageModelInput.value = state.imageModel;
  systemPromptInput.value = state.systemPrompt;
  settingsOverlay.classList.add('open');
}
function closeSettings(){
  settingsOverlay.classList.remove('open');
}
settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (e)=>{ if(e.target === settingsOverlay) closeSettings(); });

saveSettingsBtn.addEventListener('click', ()=>{
  state.apiKey = apiKeyInput.value.trim();
  state.chatModel = chatModelInput.value.trim() || 'gpt-4o-mini';
  state.imageModel = imageModelInput.value.trim() || 'dall-e-3';
  state.systemPrompt = systemPromptInput.value;
  localStorage.setItem(LS_KEYS.apiKey, state.apiKey);
  localStorage.setItem(LS_KEYS.chatModel, state.chatModel);
  localStorage.setItem(LS_KEYS.imageModel, state.imageModel);
  localStorage.setItem(LS_KEYS.systemPrompt, state.systemPrompt);
  closeSettings();
});

// ---------- New chat / sidebar ----------
newChatBtn.addEventListener('click', newConversation);
menuBtn.addEventListener('click', ()=> sidebar.classList.toggle('open'));
function closeSidebarMobile(){
  if(window.innerWidth <= 800) sidebar.classList.remove('open');
}

// ---------- Export / Import ----------
exportBtn.addEventListener('click', ()=>{
  const data = JSON.stringify(state.conversations, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gptchat-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
});
importBtn.addEventListener('click', ()=> importInput.click());
importInput.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const text = await readFileAsText(file);
    const parsed = JSON.parse(text);
    if(Array.isArray(parsed)){
      state.conversations = parsed.concat(state.conversations);
      saveConversations();
      renderConvList();
      alert('پشتیبان با موفقیت وارد شد.');
    }
  }catch(err){
    alert('فایل پشتیبان معتبر نیست.');
  }
  importInput.value = '';
});

init();
