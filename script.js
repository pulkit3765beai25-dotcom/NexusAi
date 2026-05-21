// ================================================================
// NEXUSAI - COMPLETE WORKING SCRIPT (ALL BUTTONS FIXED)
// ================================================================

// ===== API KEYS =====
const GITHUB_TOKEN = "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";
const OPENROUTER_KEY = "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";

// ===== API MODELS CONFIGURATION =====
const API_MODELS = {
    gpt      : { name: "GPT-4o",color: "#10a37f", emoji: "🟢", model: "openai/gpt-4o" },
    claude   : { name: "Claude Haiku",color: "#d97757", emoji: "🟠", model: "anthropic/claude-3-haiku" },
    phi4     : { name: "Phi-4",color: "#00a8ff", emoji: "🔷", model: "microsoft/phi-4" },
    deepseek : { name: "DeepSeek R1",color: "#a78bfa", emoji: "🟣", model: "deepseek/deepseek-r1" }
};

// ===== GLOBAL VARIABLES =====
let selectedPlan = "Annual Pro — $72/yr";
let trialAfterPlan = "Monthly — $12/mo";
let chatSessions = [];
let activeChatId = null;
let currentMessages = [];

// ===== DEMO MODE =====
let isDemoMode = false;
const DEMO_MESSAGE_LIMIT = 3;        // max messages in demo
const DEMO_TIME_LIMIT_MS = 5 * 60 * 1000; // 5 minutes in ms
let demoMessageCount = 0;
let demoStartTime = null;
let demoExpired = false;

// ===== DOM ELEMENTS =====
let loginModal, paymentModal, signupModal, forgotModal, chatContainer, chatMain, chatInput, chatSend;
let forgotUserEmail = "";

// ================================================================
// ===== HELPER FUNCTIONS =====
// ================================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================================================================
// ===== USER MESSAGE WITH THREE-DOT MENU =====
// ================================================================

function createUserMessageEl(text, msgId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'user-message-wrap';
    wrapper.dataset.msgId = msgId || '';
    wrapper.innerHTML = `
        <div class="user-message">${escapeHtml(text)}</div>
        <div class="msg-menu-wrap">
            <button class="msg-three-dots" title="Options">⋯</button>
            <div class="msg-dropdown">
                <button class="msg-dropdown-item edit-prompt-btn">✏️ Edit Prompt</button>
            </div>
        </div>
    `;

    const dotsBtn = wrapper.querySelector('.msg-three-dots');
    const dropdown = wrapper.querySelector('.msg-dropdown');
    const editBtn = wrapper.querySelector('.edit-prompt-btn');

    dotsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close any other open dropdowns
        document.querySelectorAll('.msg-dropdown.open').forEach(d => {
            if (d !== dropdown) d.classList.remove('open');
        });
        dropdown.classList.toggle('open');
    });

    editBtn.addEventListener('click', () => {
        dropdown.classList.remove('open');
        if (chatInput) {
            chatInput.value = text;
            chatInput.focus();
        }
    });

    document.addEventListener('click', () => dropdown.classList.remove('open'), { capture: false });
    return wrapper;
}

// ================================================================
// ===== IMAGE GALLERY =====
// ================================================================

let generatedImages = []; // { prompt, imageUrl, time }

function addToImageGallery(prompt, imageUrl) {
    const now = new Date();
    generatedImages.unshift({
        prompt,
        imageUrl,
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    renderImageGallery();
}

function renderImageGallery() {
    const list = document.getElementById('imgGalleryList');
    const count = document.getElementById('imgGalleryCount');
    if (count) count.textContent = generatedImages.length;
    if (!list) return;
    list.innerHTML = '';

    generatedImages.forEach((img, idx) => {
        const item = document.createElement('div');
        item.className = 'img-gallery-item';
        item.innerHTML = `
            <img src="${img.imageUrl}" alt="${escapeHtml(img.prompt)}" class="img-gallery-thumb"
                onclick="window.open('${img.imageUrl}','_blank')" title="Click to view full size">
            <div class="img-gallery-meta">
                <div class="img-gallery-prompt" title="${escapeHtml(img.prompt)}">${escapeHtml(img.prompt.length > 35 ? img.prompt.substring(0,35)+'...' : img.prompt)}</div>
                <div class="img-gallery-time">${img.time}</div>
            </div>
        `;
        list.appendChild(item);
    });
}

function openModal(modal) {
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modal) {
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ================================================================
// ===== AUTH STATE UI =====
// ================================================================

function updateNavAuthState() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const userName   = localStorage.getItem('userName') || 'User';
    const userEmail  = localStorage.getItem('userEmail') || '';

    const navLoginBtn = document.getElementById('navLoginBtn');
    const navAccount  = document.getElementById('navAccount');
    const avatarInitial = document.getElementById('avatarInitial');
    const dropdownName  = document.getElementById('dropdownName');
    const dropdownEmail = document.getElementById('dropdownEmail');

    if (navLoginBtn)   navLoginBtn.style.display  = isLoggedIn ? 'none' : '';
    if (navAccount)    navAccount.style.display    = isLoggedIn ? 'flex' : 'none';
    if (avatarInitial) avatarInitial.textContent   = isLoggedIn ? (userName[0] || 'U').toUpperCase() : 'U';
    if (dropdownName)  dropdownName.textContent    = userName;
    if (dropdownEmail) dropdownEmail.textContent   = userEmail;
}

function logoutUser() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    closeChat();
    updateNavAuthState();
}

function loginUser(name, email) {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userName', name || 'User');
    localStorage.setItem('userEmail', email || '');
    updateNavAuthState();
}

function openChat() {
    if (chatContainer) {
        chatContainer.classList.add('active');
        document.body.style.overflow = 'hidden';
        renderChatHistory();
        setTimeout(() => {
            if (chatInput) chatInput.focus();
        }, 300);
    }
}

function closeChat() {
    if (chatContainer) {
        chatContainer.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function addSystemMsg(text) {
    if (!chatMain) return;
    const div = document.createElement('div');
    div.className = 'chat-welcome';
    div.innerHTML = `<p style="color:var(--text-muted)">${escapeHtml(text)}</p>`;
    chatMain.appendChild(div);
    chatMain.scrollTop = chatMain.scrollHeight;
}

// ================================================================
// ===== CHAT HISTORY FUNCTIONS =====
// ================================================================

function renderChatHistory() {
    const list = document.getElementById('chatHistoryList');
    if (!list) return;
    list.innerHTML = '';
    
    chatSessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'chat-history-item' + (session.id === activeChatId ? ' active' : '');
        item.innerHTML = `
            <div class="chi-main" style="flex:1;min-width:0;cursor:pointer;">
                <div class="chi-title">${escapeHtml(session.title)}</div>
                <div class="chi-meta">${escapeHtml(session.time)}</div>
            </div>
            <button class="chi-delete-btn" title="Delete chat" data-id="${session.id}">🗑</button>
        `;
        item.querySelector('.chi-main').addEventListener('click', () => loadChatSession(session.id));
        item.querySelector('.chi-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChatSession(session.id);
        });
        list.appendChild(item);
    });
}

function deleteChatSession(sessionId) {
    if (!confirm('Delete this chat?')) return;
    chatSessions = chatSessions.filter(s => s.id !== sessionId);
    if (activeChatId === sessionId) {
        startNewChat();
    } else {
        renderChatHistory();
    }
}

function saveCurrentChatToHistory(firstMessage, isNewChat = true) {
    if (!activeChatId && isNewChat) {
        const newId = Date.now();
        activeChatId = newId;
        
        const title = firstMessage.length > 40 
            ? firstMessage.substring(0, 40) + '...' 
            : firstMessage;
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        chatSessions.unshift({
            id: newId,
            title: title,
            preview: firstMessage,
            time: timeStr,
            messages: []
        });
        
        const activeChatTitle = document.getElementById('activeChatTitle');
        if (activeChatTitle) activeChatTitle.textContent = title;
        renderChatHistory();
    }
}

function updateCurrentSessionMessages() {
    const session = chatSessions.find(s => s.id === activeChatId);
    if (session) {
        session.messages = [...currentMessages];
        if (currentMessages.length > 0) {
            const lastMsg = currentMessages[currentMessages.length - 1];
            if (lastMsg.role === 'user') {
                session.preview = lastMsg.text.substring(0, 50) + (lastMsg.text.length > 50 ? '...' : '');
            }
        }
        const now = new Date();
        session.time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        renderChatHistory();
    }
}

function loadChatSession(sessionId) {
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    activeChatId = session.id;
    currentMessages = session.messages ? [...session.messages] : [];
    
    const activeChatTitle = document.getElementById('activeChatTitle');
    if (activeChatTitle) activeChatTitle.textContent = session.title;
    
    if (!chatMain) return;
    chatMain.innerHTML = '';
    
    if (currentMessages.length === 0) {
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'chat-welcome';
        welcomeDiv.innerHTML = `
            <h3>💬 ${escapeHtml(session.title)}</h3>
            <p style="color:var(--text-muted);font-size:0.9rem;">Continue your conversation below...</p>
        `;
        chatMain.appendChild(welcomeDiv);
    } else {
        currentMessages.forEach(msg => {
            if (msg.role === 'user') {
                chatMain.appendChild(createUserMessageEl(msg.text, msg.id));
            } else if (msg.role === 'ai') {
                const aiDiv = document.createElement('div');
                aiDiv.className = 'ai-response';
                let html = escapeHtml(msg.text)
                    .replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.3);padding:0.7rem;border-radius:8px;overflow-x:auto;font-size:0.85em;margin:0.5rem 0;"><code>$1</code></pre>')
                    .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:0.1em 0.4em;border-radius:4px;">$1</code>')
                    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                    .replace(/\n/g, '<br>');
                aiDiv.innerHTML = `<div class="ai-response-content">${html}</div>`;
                chatMain.appendChild(aiDiv);
            } else if (msg.role === 'image') {
                // Restore image card
                const imageCard = document.createElement('div');
                imageCard.className = 'ai-responses';
                imageCard.innerHTML = `
                    <div class="ai-response" style="max-width:480px;">
                        <div class="ai-response-header">
                            <div class="avatar">🎨</div>
                            <div class="ai-response-name">Image Generator</div>
                        </div>
                        <div class="ai-response-content">
                            <div style="margin-bottom:0.5rem;font-size:0.82rem;opacity:0.6;">Prompt: "${escapeHtml(msg.prompt)}"</div>
                            <img src="${msg.imageUrl}" alt="${escapeHtml(msg.prompt)}"
                                style="width:100%;max-width:460px;border-radius:12px;display:block;border:1px solid rgba(255,255,255,0.1);">
                            <div style="margin-top:0.6rem;display:flex;gap:8px;">
                                <a href="${msg.imageUrl}" download="nexusai-image.jpg" target="_blank"
                                    style="font-size:0.8rem;padding:5px 12px;border-radius:8px;
                                    background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
                                    color:inherit;text-decoration:none;cursor:pointer;">⬇ Download</a>
                                <button onclick="window.open('${msg.imageUrl}','_blank')"
                                    style="font-size:0.8rem;padding:5px 12px;border-radius:8px;
                                    background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
                                    color:inherit;cursor:pointer;">🔍 Full Size</button>
                            </div>
                        </div>
                    </div>
                `;
                chatMain.appendChild(imageCard);
            }
        });
    }
    
    chatMain.scrollTop = chatMain.scrollHeight;
    renderChatHistory();
    if (chatInput) chatInput.focus();
}

function startNewChat() {
    activeChatId = null;
    currentMessages = [];
    const activeChatTitle = document.getElementById('activeChatTitle');
    if (activeChatTitle) activeChatTitle.textContent = 'Nexus Workspace';
    
    if (chatMain) {
        chatMain.innerHTML = `
            <div class="chat-welcome">
                <h3>🚀 New Chat</h3>
                <p>Toggle models above and send a message to query them simultaneously.</p>
            </div>`;
    }
    
    renderChatHistory();
    if (chatInput) chatInput.focus();
}

// ================================================================
// ================================================================
// ===== FORGOT PASSWORD — BUILT ENTIRELY WITH JS =====
// ================================================================

function showForgotStep(step) {
    [1, 2, 3].forEach(n => {
        const el = document.getElementById('forgotStep' + n);
        if (el) el.style.display = (n === step) ? 'block' : 'none';
    });
}

function checkPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8)          score++;
    if (password.length >= 12)         score++;
    if (/[A-Z]/.test(password))        score++;
    if (/[0-9]/.test(password))        score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const levels = [
        { pct: '20%',  color: '#ef4444', text: 'Very Weak'  },
        { pct: '40%',  color: '#f97316', text: 'Weak'       },
        { pct: '60%',  color: '#eab308', text: 'Fair'       },
        { pct: '80%',  color: '#84cc16', text: 'Strong'     },
        { pct: '100%', color: '#22c55e', text: 'Very Strong' }
    ];
    const lvl   = levels[Math.min(score, 4)];
    const fill  = document.getElementById('forgotStrengthFill');
    const label = document.getElementById('forgotStrengthLabel');
    const bar   = document.getElementById('forgotStrengthBar');
    if (bar)   bar.style.display  = 'block';
    if (fill)  { fill.style.width = lvl.pct; fill.style.background = lvl.color; }
    if (label) { label.textContent = lvl.text; label.style.color = lvl.color; }
}

function createForgotModal() {
    forgotModal = document.createElement('div');
    forgotModal.id = 'forgotModal';
    forgotModal.className = 'modal';

    forgotModal.innerHTML = `
        <div class="modal-box">
            <button class="modal-close" id="forgotClose">x</button>
            <div class="modal-logo">NexusAI</div>

            <div id="forgotStep1">
                <h2 class="modal-title">Reset Password</h2>
                <p class="modal-sub">Enter your registered email address</p>
                <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" id="forgotEmail" placeholder="Enter your email">
                </div>
                <div id="forgotEmailError" style="display:none;color:#f87171;font-size:0.85rem;margin-bottom:0.8rem;"></div>
                <button class="btn btn-primary modal-submit" id="forgotNextBtn">Continue</button>
                <div class="modal-footer-txt">Remember it? <span class="modal-link" id="forgotBackToLogin">Back to Login</span></div>
            </div>

            <div id="forgotStep2" style="display:none;">
                <h2 class="modal-title">Set New Password</h2>
                <p class="modal-sub" id="forgotEmailDisplay">Resetting password for your account</p>
                <div class="form-group">
                    <label>New Password</label>
                    <input type="password" id="forgotNewPassword" placeholder="Enter new password">
                </div>
                <div class="form-group">
                    <label>Confirm New Password</label>
                    <input type="password" id="forgotConfirmPassword" placeholder="Re-enter new password">
                </div>
                <div id="forgotStrengthBar" style="display:none;margin-bottom:0.8rem;">
                    <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">
                        Strength: <span id="forgotStrengthLabel">Weak</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.1);border-radius:4px;height:5px;">
                        <div id="forgotStrengthFill" style="height:5px;border-radius:4px;width:0%;transition:width 0.3s,background 0.3s;"></div>
                    </div>
                </div>
                <div id="forgotMatchError" style="display:none;color:#f87171;font-size:0.85rem;margin-bottom:0.8rem;"></div>
                <button class="btn btn-primary modal-submit" id="forgotResetPassword">Reset Password</button>
            </div>

            <div id="forgotStep3" style="display:none;text-align:center;padding:1.5rem 0;">
                <div style="font-size:3rem;margin-bottom:1rem;">&#9989;</div>
                <h2 class="modal-title">Password Reset!</h2>
                <p class="modal-sub">Your password has been changed. You can now log in.</p>
                <button class="btn btn-primary modal-submit" id="forgotGoLogin">Back to Login</button>
            </div>
        </div>
    `;

    document.body.appendChild(forgotModal);

    // Close button
    document.getElementById('forgotClose').addEventListener('click', () => {
        closeModal(forgotModal); showForgotStep(1);
    });

    // Click outside to close
    forgotModal.addEventListener('click', e => {
        if (e.target === forgotModal) { closeModal(forgotModal); showForgotStep(1); }
    });

    // Step 1: Continue - validate email then go to step 2
    document.getElementById('forgotNextBtn').addEventListener('click', () => {
        const email  = document.getElementById('forgotEmail').value.trim();
        const errEl  = document.getElementById('forgotEmailError');
        if (!email || !email.includes('@')) {
            errEl.textContent   = 'Please enter a valid email address.';
            errEl.style.display = 'block';
            return;
        }
        errEl.style.display = 'none';
        forgotUserEmail = email;
        document.getElementById('forgotEmailDisplay').textContent =
            'Resetting password for: ' + email;
        showForgotStep(2);
    });

    // Step 2: Live password strength bar
    document.getElementById('forgotNewPassword').addEventListener('input', function () {
        checkPasswordStrength(this.value);
        document.getElementById('forgotMatchError').style.display = 'none';
    });

    // Step 2: Reset password - validate and save
    document.getElementById('forgotResetPassword').addEventListener('click', () => {
        const newPass  = document.getElementById('forgotNewPassword').value;
        const confirm  = document.getElementById('forgotConfirmPassword').value;
        const matchErr = document.getElementById('forgotMatchError');

        if (!newPass || newPass.length < 8) {
            matchErr.textContent   = 'Password must be at least 8 characters.';
            matchErr.style.display = 'block';
            return;
        }
        if (newPass !== confirm) {
            matchErr.textContent   = 'Passwords do not match. Please try again.';
            matchErr.style.display = 'block';
            return;
        }
        matchErr.style.display = 'none';
        localStorage.setItem('nexus_password_' + forgotUserEmail, newPass);
        showForgotStep(3);
    });

    // Step 3: Back to login
    document.getElementById('forgotGoLogin').addEventListener('click', () => {
        closeModal(forgotModal); showForgotStep(1); openModal(loginModal);
    });

    // Back to login link (step 1)
    document.getElementById('forgotBackToLogin').addEventListener('click', () => {
        closeModal(forgotModal); showForgotStep(1); openModal(loginModal);
    });
}

function addForgotLinkToLoginModal() {
    const loginPasswordInput = document.getElementById('loginPassword');
    if (!loginPasswordInput) return;
    const passwordGroup = loginPasswordInput.closest('.form-group');
    if (!passwordGroup) return;
    const label = passwordGroup.querySelector('label');
    if (!label) return;

    label.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';

    const forgotLink = document.createElement('span');
    forgotLink.className     = 'modal-link';
    forgotLink.id            = 'goToForgot';
    forgotLink.textContent   = 'Forgot password?';
    forgotLink.style.cssText = 'font-size:0.82rem;font-weight:400;';
    forgotLink.addEventListener('click', () => {
        closeModal(loginModal);
        showForgotStep(1);
        openModal(forgotModal);
    });
    label.appendChild(forgotLink);
}

// ===== GOOGLE SIGN-IN =====
// ================================================================

function handleGoogleSignIn() {
    const btn = event?.currentTarget;
    if (btn) {
        btn.innerHTML = '⏳ Redirecting...';
        btn.disabled = true;
    }
    
    setTimeout(() => {
        loginUser('Google User', 'user@gmail.com');
        
        alert('✅ Successfully signed in with Google!\nRedirecting to chat...');
        
        closeModal(loginModal);
        closeModal(signupModal);
        
        openChat();
    }, 500);
}

// ================================================================
// ===== TRIAL PLAN FUNCTIONS =====
// ================================================================

window.selectTrialAfterPlan = function(el) {
    document.querySelectorAll('.trial-plan-choice').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    trialAfterPlan = el.dataset.after;
};

function updatePaymentPlanUI() {
    const isTrial = selectedPlan.includes('Trial');
    const paySection = document.getElementById('payMethodSection');
    const trialInfo = document.getElementById('trialInfo');
    const submitBtn = document.getElementById('paymentSubmit');
    if (isTrial) {
        if (paySection) paySection.style.display = 'none';
        if (trialInfo) trialInfo.style.display = 'block';
        if (submitBtn) submitBtn.textContent = '🎁 Start Free 7-Day Trial';
    } else {
        if (paySection) paySection.style.display = 'block';
        if (trialInfo) trialInfo.style.display = 'none';
        if (submitBtn) submitBtn.textContent = '🔐 Pay & Get Access';
    }
}

// ================================================================
// ===== REAL API CALL - OPENROUTER =====
// ================================================================

async function fetchModelResponse(modelId, promptContent) {
    const info = API_MODELS[modelId];
    if (!info) return `❌ Unknown model: ${modelId}`;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.href,
                "X-Title": "NexusAI"
            },
            body: JSON.stringify({
                model: info.model,
                messages: [{ role: "user", content: promptContent }],
                max_tokens: 80
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error?.message || response.statusText;
            return `❌ **${info.name} Error:** ${errMsg}`;
        }

        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (!reply) return `⚠️ **${info.name}:** No response received.`;
        return reply;

    } catch (err) {
        return `❌ **${info.name} Network Error:** ${err.message}`;
    }
}

// ================================================================
// ===== SEND MESSAGE FUNCTION =====
// ================================================================


// ================================================================
// ===== IMAGE GENERATION (Pollinations.ai — free, no key needed) =====
// ================================================================

function isImagePrompt(text) {
    const triggers = [
        /^generate (an? )?image/i,
        /^create (an? )?image/i,
        /^make (an? )?image/i,
        /^draw (an? )?image/i,
        /^show (an? )?image/i,
        /^generate (an? )?picture/i,
        /^create (an? )?picture/i,
        /^make (an? )?picture/i,
        /^draw (a )?picture/i,
        /^generate (an? )?photo/i,
        /^create (an? )?photo/i,
        /^image of/i,
        /^picture of/i,
        /^photo of/i,
        /^draw me/i,
        /^generate me/i,
        /^paint (a |an )?/i,
        /^illustrate/i,
    ];
    return triggers.some(r => r.test(text.trim()));
}

function extractImagePrompt(text) {
    return text
        .replace(/^(generate|create|make|draw|show|paint|illustrate|give me|get me|produce)\s+(me\s+)?(an?\s+)?(image|picture|photo|illustration|painting|drawing|art)?\s*(of)?\s*/i, '')
        .trim() || text;
}

async function generateAndDisplayImage(promptText) {
    if (!chatMain) return;

    // User message already added — now show image card
    const imageCard = document.createElement('div');
    imageCard.className = 'ai-responses';
    imageCard.innerHTML = `
        <div class="ai-response" style="max-width:480px;">
            <div class="ai-response-header">
                <div class="avatar">🎨</div>
                <div class="ai-response-name">Image Generator</div>
            </div>
            <div class="ai-response-content" id="imgGenContent">
                <span class="typing-indicator">Generating image...</span>
            </div>
        </div>
    `;
    chatMain.appendChild(imageCard);
    chatMain.scrollTop = chatMain.scrollHeight;

    const cleanPrompt = extractImagePrompt(promptText);
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    const seed = Math.floor(Math.random() * 999999);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&seed=${seed}&nologo=true`;

    const contentEl = document.getElementById('imgGenContent');

    // Preload image
    const img = new Image();
    img.onload = () => {
        if (contentEl) {
            contentEl.innerHTML = `
                <div style="margin-bottom:0.5rem;font-size:0.82rem;opacity:0.6;">Prompt: "${escapeHtml(cleanPrompt)}"</div>
                <img src="${imageUrl}" alt="${escapeHtml(cleanPrompt)}"
                    style="width:100%;max-width:460px;border-radius:12px;display:block;border:1px solid rgba(255,255,255,0.1);">
                <div style="margin-top:0.6rem;display:flex;gap:8px;">
                    <a href="${imageUrl}" download="nexusai-image.jpg" target="_blank"
                        style="font-size:0.8rem;padding:5px 12px;border-radius:8px;
                        background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
                        color:inherit;text-decoration:none;cursor:pointer;">⬇ Download</a>
                    <button onclick="window.open('${imageUrl}','_blank')"
                        style="font-size:0.8rem;padding:5px 12px;border-radius:8px;
                        background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
                        color:inherit;cursor:pointer;border:1px solid rgba(255,255,255,0.15);">🔍 Full Size</button>
                </div>
            `;
        }
        // Save to gallery and session
        addToImageGallery(cleanPrompt, imageUrl);
        currentMessages.push({ role: 'image', prompt: cleanPrompt, imageUrl: imageUrl });
        updateCurrentSessionMessages();
        chatMain.scrollTop = chatMain.scrollHeight;
    };

    img.onerror = () => {
        if (contentEl) {
            contentEl.innerHTML = `<span style="color:#f87171;">❌ Image generation failed. Try a different prompt.</span>`;
        }
    };

    img.src = imageUrl;
}

async function handleSendMessage() {
    if (!chatInput || !chatMain) return;
    
    const text = chatInput.value.trim();

    // Get pending attachments from the plus-menu system (exposed via window)
    const attachments = window.getPendingAttachments ? window.getPendingAttachments() : [];

    // Must have either text or attachments
    if (!text && attachments.length === 0) return;

    // ── DEMO MODE GUARD ──
    if (isDemoMode) {
        if (demoExpired) return;
        if (demoMessageCount >= DEMO_MESSAGE_LIMIT) {
            expireDemo();
            return;
        }
    }

    const displayText = text || (attachments.length > 0 ? `📎 ${attachments.map(a=>a.name).join(', ')}` : '');

    if (!activeChatId) {
        saveCurrentChatToHistory(displayText, true);
    }
    
    currentMessages.push({ role: "user", text: displayText, id: Date.now() });
    updateCurrentSessionMessages();

    // Show user message (with attachment previews if any)
    const userWrap = document.createElement('div');
    userWrap.className = 'user-message-wrap';
    let attachHTML = '';
    attachments.forEach(att => {
        if (att.type === 'image') {
            attachHTML += `<img src="${att.dataUrl}" style="max-width:220px;max-height:180px;border-radius:10px;display:block;margin-top:6px;border:1px solid rgba(255,255,255,0.15);">`;
        } else if (att.type === 'video') {
            attachHTML += `<div style="margin-top:6px;font-size:0.83rem;opacity:0.7;">🎥 ${escapeHtml(att.name)}</div>`;
        } else {
            attachHTML += `<div style="margin-top:6px;font-size:0.83rem;opacity:0.7;">📄 ${escapeHtml(att.name)}</div>`;
        }
    });
    userWrap.innerHTML = `
        <div class="user-message">
            ${text ? escapeHtml(text) : ''}
            ${attachHTML}
        </div>
        <div class="msg-menu-wrap">
            <button class="msg-three-dots" title="Options">⋯</button>
            <div class="msg-dropdown">
                <button class="msg-dropdown-item edit-prompt-btn">✏️ Edit Prompt</button>
            </div>
        </div>`;
    const dotsBtn = userWrap.querySelector('.msg-three-dots');
    const dropdown = userWrap.querySelector('.msg-dropdown');
    const editBtn  = userWrap.querySelector('.edit-prompt-btn');
    dotsBtn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('open'); });
    editBtn.addEventListener('click', () => { dropdown.classList.remove('open'); if (chatInput) { chatInput.value = text; chatInput.focus(); } });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
    chatMain.appendChild(userWrap);

    chatInput.value = '';
    if (chatSend) chatSend.disabled = true;
    chatMain.scrollTop = chatMain.scrollHeight;

    // Clear attachments from the plus-menu system
    if (window.clearPendingAttachments) window.clearPendingAttachments();

    // ── IMAGE GENERATION INTERCEPT ──
    if (isImagePrompt(text) && attachments.length === 0) {
        const realPersonWarning = document.createElement('div');
        realPersonWarning.style.cssText = `
            background: rgba(251,191,36,0.1);
            border: 1px solid rgba(251,191,36,0.35);
            border-radius: 10px;
            padding: 8px 14px;
            font-size: 0.82rem;
            color: #fbbf24;
            margin-bottom: 8px;
        `;
        realPersonWarning.innerHTML = `⚠️ <strong>Note:</strong> AI image generation cannot produce accurate photos of real people (e.g. Rohit Sharma, celebrities). It creates artistic/AI interpretations only. For real photos, search Google Images.`;
        chatMain.appendChild(realPersonWarning);
        chatMain.scrollTop = chatMain.scrollHeight;

        if (isDemoMode) demoMessageCount++;
        updateDemoMsgCount();
        await generateAndDisplayImage(text);
        if (chatSend) chatSend.disabled = false;
        if (chatInput) chatInput.focus();
        checkDemoLimitAfterMessage();
        return;
    }

    const activeModels = [...document.querySelectorAll('.model-toggle:checked')].map(el => el.value);
    if (activeModels.length === 0) {
        addSystemMsg('Please enable at least one model!');
        if (chatSend) chatSend.disabled = false;
        return;
    }

    if (isDemoMode) demoMessageCount++;
    updateDemoMsgCount();

    // ── Build the message content for the API ──
    async function buildApiContent(userText, atts) {
        if (atts.length === 0) return userText;

        const parts = [];
        if (userText) parts.push({ type: "text", text: userText });

        for (const att of atts) {
            if (att.type === 'image') {
                const base64 = att.dataUrl.split(',')[1];
                const mimeType = att.file.type || 'image/jpeg';
                parts.push({
                    type: "image_url",
                    image_url: { url: `data:${mimeType};base64,${base64}` }
                });
            } else if (att.type === 'file') {
                const isPdf = att.file.type === 'application/pdf' || att.name.toLowerCase().endsWith('.pdf');
                try {
                    let extractedText = '';
                    if (isPdf) {
                        extractedText = await extractPdfText(att.file);
                    } else {
                        extractedText = await readFileAsText(att.file);
                    }
                    const truncated = extractedText.length > 12000
                        ? extractedText.substring(0, 12000) + '\n\n[...content truncated for length...]'
                        : extractedText;
                    parts.push({
                        type: "text",
                        text: `\n\n[Attached ${isPdf ? 'PDF' : 'file'}: ${att.name}]\n\n${truncated}`
                    });
                } catch(e) {
                    parts.push({ type: "text", text: `\n\n[Attached file: ${att.name} — could not read content: ${e.message}]` });
                }
            } else if (att.type === 'video') {
                parts.push({ type: "text", text: `\n\n[Video attached: ${att.name} — video analysis not supported]` });
            }
        }

        if (parts.length === 1 && parts[0].type === 'text') return parts[0].text;
        return parts;
    }

    // Extract real text from PDF using PDF.js (loaded from CDN)
    async function extractPdfText(file) {
        // Load PDF.js from CDN if not already loaded
        if (!window.pdfjsLib) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 20); // cap at 20 pages

        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            fullText += `\n--- Page ${i} ---\n${pageText}\n`;
        }

        if (pdf.numPages > maxPages) {
            fullText += `\n[Note: Only first ${maxPages} of ${pdf.numPages} pages extracted]`;
        }

        return fullText.trim() || '[PDF appears to contain no extractable text — it may be a scanned image-only PDF]';
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    const apiContent = await (async () => {
        // Show "Reading PDF..." notice if files attached
        let notice = null;
        if (attachments.some(a => a.type === 'file')) {
            notice = document.createElement('div');
            notice.style.cssText = `
                background: rgba(99,102,241,0.1);
                border: 1px solid rgba(99,102,241,0.3);
                border-radius: 10px;
                padding: 8px 14px;
                font-size: 0.83rem;
                color: #a5b4fc;
                margin-bottom: 8px;
            `;
            const hasPdf = attachments.some(a => a.name && a.name.toLowerCase().endsWith('.pdf'));
            notice.innerHTML = `⏳ ${hasPdf ? '📄 Extracting PDF text...' : '📂 Reading file...'} please wait.`;
            chatMain.appendChild(notice);
            chatMain.scrollTop = chatMain.scrollHeight;
        }
        const content = await buildApiContent(text, attachments);
        if (notice) notice.remove();
        return content;
    })();

    const responsesDiv = document.createElement('div');
    responsesDiv.className = 'ai-responses';
    const responseElements = {};

    activeModels.forEach(id => {
        const info = API_MODELS[id];
        if (!info) return;
        const card = document.createElement('div');
        card.className = 'ai-response';
        const uniqueId = `resp-${id}-${Date.now()}`;
        card.innerHTML = `
            <div class="ai-response-header">
                <div class="avatar" style="color:${info.color}">${info.emoji}</div>
                <div class="ai-response-name">${info.name}</div>
            </div>
            <div class="ai-response-content" id="${uniqueId}">
                <span class="typing-indicator">Thinking...</span>
            </div>`;
        responsesDiv.appendChild(card);
        responseElements[id] = { container: card, contentId: uniqueId };
    });

    chatMain.appendChild(responsesDiv);
    chatMain.scrollTop = chatMain.scrollHeight;

    const promises = activeModels.map(async (id) => {
        await new Promise(resolve => setTimeout(resolve, 600));
        const result = await fetchModelResponse(id, apiContent);
        const el = document.getElementById(responseElements[id]?.contentId);
        if (el) {
            let html = escapeHtml(result)
                .replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.3);padding:0.7rem;border-radius:8px;overflow-x:auto;font-size:0.85em;margin:0.5rem 0;"><code>$1</code></pre>')
                .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:0.1em 0.4em;border-radius:4px;">$1</code>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
            el.innerHTML = html;
            el.classList.remove('typing-indicator');
        }
        currentMessages.push({ role: "ai", text: result, model: id });
        updateCurrentSessionMessages();
        chatMain.scrollTop = chatMain.scrollHeight;
        return result;
    });

    await Promise.all(promises);
    if (chatSend) chatSend.disabled = false;
    if (chatInput) chatInput.focus();
    checkDemoLimitAfterMessage();
}

function updateDemoMsgCount() {
    if (!isDemoMode) return;
    const el = document.getElementById('demoMsgsLeft');
    if (el) el.textContent = Math.max(0, DEMO_MESSAGE_LIMIT - demoMessageCount);
}

function checkDemoLimitAfterMessage() {
    if (!isDemoMode || demoExpired) return;
    if (demoMessageCount >= DEMO_MESSAGE_LIMIT) {
        setTimeout(() => expireDemo(), 800);
    }
}

// ================================================================
// ===== UPDATE MODEL TOGGLES =====
// ================================================================

function updateModelToggles() {
    const togglesContainer = document.querySelector('.ai-toggles');
    if (togglesContainer) {
        togglesContainer.innerHTML = '';
        
        const models = [
            { id: 'gpt', name: 'GPT-4o', emoji: '🟢', color: '#10a37f', checked: true },
            { id: 'claude', name: 'Claude 3.5', emoji: '🟠', color: '#d97757', checked: true },
            { id: 'phi4', name: 'Phi-4', emoji: '🔷', color: '#00a8ff', checked: true },
            { id: 'deepseek', name: 'DeepSeek R1', emoji: '🟣', color: '#a78bfa', checked: false }
        ];
        
        models.forEach(model => {
            const label = document.createElement('label');
            label.className = 'ai-toggle';
            label.innerHTML = `
                <input type="checkbox" class="model-toggle" value="${model.id}" ${model.checked ? 'checked' : ''}>
                <span class="ai-toggle-btn"><span style="color:${model.color}">${model.emoji}</span> ${model.name}</span>
            `;
            togglesContainer.appendChild(label);
        });
    }
}

// ================================================================
// ===== DEMO MODE =====
// ================================================================

function startDemoMode() {
    isDemoMode = true;
    demoMessageCount = 0;
    demoExpired = false;
    demoStartTime = Date.now();
    openChat();

    // Show demo banner
    setTimeout(() => {
        showDemoBanner();
        // Auto-expire demo after time limit
        setTimeout(() => {
            if (isDemoMode && !demoExpired) expireDemo();
        }, DEMO_TIME_LIMIT_MS);
    }, 400);
}

function showDemoBanner() {
    if (!chatMain) return;
    // Remove old banner if any
    const old = document.getElementById('demoBanner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'demoBanner';
    banner.style.cssText = `
        background: linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25));
        border: 1px solid rgba(168,85,247,0.5);
        border-radius: 14px;
        padding: 14px 18px;
        margin-bottom: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
    `;
    banner.innerHTML = `
        <div>
            <div style="font-weight:700;font-size:0.95rem;">⚡ Live Demo — Limited Access</div>
            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:3px;">
                You have <strong id="demoMsgsLeft">${DEMO_MESSAGE_LIMIT}</strong> messages &nbsp;|&nbsp;
                ⏱ <span id="demoTimer">5:00</span> remaining
            </div>
        </div>
        <button onclick="showSubscribeWall('demo_cta')" class="btn btn-primary" style="padding:8px 18px;font-size:0.85rem;white-space:nowrap;">
            🚀 Subscribe Now
        </button>
    `;
    chatMain.insertBefore(banner, chatMain.firstChild);

    // Start countdown
    startDemoCountdown();
}

function startDemoCountdown() {
    const interval = setInterval(() => {
        if (!isDemoMode || demoExpired) { clearInterval(interval); return; }
        const elapsed = Date.now() - demoStartTime;
        const remaining = Math.max(0, DEMO_TIME_LIMIT_MS - elapsed);
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        const timerEl = document.getElementById('demoTimer');
        if (timerEl) timerEl.textContent = `${mins}:${secs.toString().padStart(2,'0')}`;
        if (remaining <= 0) {
            clearInterval(interval);
            expireDemo();
        }
    }, 1000);
}

function expireDemo() {
    demoExpired = true;
    showSubscribeWall('time_expired');
}

function showSubscribeWall(reason) {
    demoExpired = true;
    if (!chatMain) return;

    // Blur/disable input
    const inputBar = document.querySelector('.chat-input-bar');
    if (inputBar) inputBar.style.pointerEvents = 'none';

    // Remove demo banner
    const banner = document.getElementById('demoBanner');
    if (banner) banner.remove();

    const reasonText = reason === 'time_expired'
        ? '⏱ Your demo time has expired!'
        : reason === 'msg_limit'
        ? `🚫 You've used all ${DEMO_MESSAGE_LIMIT} demo messages!`
        : '🚀 Enjoying NexusAI?';

    const wall = document.createElement('div');
    wall.id = 'subscribeWall';
    wall.style.cssText = `
        background: linear-gradient(135deg, rgba(15,12,41,0.97), rgba(48,43,99,0.97));
        border: 1px solid rgba(168,85,247,0.6);
        border-radius: 20px;
        padding: 2rem;
        text-align: center;
        margin: 1rem 0;
        box-shadow: 0 8px 40px rgba(99,102,241,0.3);
    `;
    wall.innerHTML = `
        <div style="font-size:2.5rem;margin-bottom:0.5rem;">🔒</div>
        <div style="font-size:1.3rem;font-weight:800;margin-bottom:0.5rem;">${reasonText}</div>
        <p style="color:var(--text-muted);font-size:0.92rem;margin-bottom:1.5rem;max-width:360px;margin-left:auto;margin-right:auto;">
            Subscribe to NexusAI to get <strong>unlimited access</strong> to GPT-4o, Claude, Gemini, DeepSeek — all in one place.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:1rem;">
            <button onclick="launchSubscribeFromDemo('Monthly — \$12/mo')"
                style="padding:12px 22px;border-radius:12px;background:rgba(255,255,255,0.1);
                border:1px solid rgba(255,255,255,0.2);color:#fff;cursor:pointer;font-size:0.9rem;font-weight:600;">
                📅 Monthly — $12/mo
            </button>
            <button onclick="launchSubscribeFromDemo('Annual Pro — \$72/yr')"
                style="padding:12px 22px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#a855f7);
                border:none;color:#fff;cursor:pointer;font-size:0.9rem;font-weight:700;">
                🔥 Annual Pro — $72/yr &nbsp;<span style="font-size:0.75em;background:rgba(255,255,255,0.2);padding:2px 7px;border-radius:20px;">Save 50%</span>
            </button>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);">
            ✅ No commitment &nbsp;·&nbsp; Cancel anytime &nbsp;·&nbsp; 256-bit SSL
        </div>
    `;
    chatMain.appendChild(wall);
    chatMain.scrollTop = chatMain.scrollHeight;
}

window.launchSubscribeFromDemo = function(plan) {
    isDemoMode = false;
    demoExpired = false;
    selectedPlan = plan;
    const planAnnual = document.getElementById('planAnnual');
    const planMonthly = document.getElementById('planMonthly');
    if (plan.includes('Annual')) {
        if (planAnnual) planAnnual.classList.add('active');
        if (planMonthly) planMonthly.classList.remove('active');
    } else {
        if (planMonthly) planMonthly.classList.add('active');
        if (planAnnual) planAnnual.classList.remove('active');
    }
    updatePaymentPlanUI();
    // Re-enable input
    const inputBar = document.querySelector('.chat-input-bar');
    if (inputBar) inputBar.style.pointerEvents = '';
    closeChat();
    openModal(paymentModal);
};

window.showSubscribeWall = showSubscribeWall;

// ================================================================
// ===== INITIALIZE EVERYTHING =====
// ================================================================

function init() {
    console.log("Initializing NexusAI...");
    
    // Get DOM elements
    loginModal = document.getElementById('loginModal');
    paymentModal = document.getElementById('paymentModal');
    signupModal = document.getElementById('signupModal');
    chatContainer = document.getElementById('chatContainer');
    chatMain = document.getElementById('chatMain');
    chatInput = document.getElementById('chatInput');
    chatSend = document.getElementById('chatSend');
    
    // Update model toggles
    updateModelToggles();
    
    // ===== BUTTON EVENT LISTENERS =====
    
    // Get Started button
    const heroGetStarted = document.getElementById('heroGetStarted');
    if (heroGetStarted) {
        heroGetStarted.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Get Started clicked");
            selectedPlan = "Annual Pro — $72/yr";
            const planAnnual = document.getElementById('planAnnual');
            const planMonthly = document.getElementById('planMonthly');
            if (planAnnual) planAnnual.classList.add('active');
            if (planMonthly) planMonthly.classList.remove('active');
            updatePaymentPlanUI();
            openModal(paymentModal);
        });
    } else {
        console.error("heroGetStarted button not found!");
    }
    
    // Demo button
    const heroDemo = document.getElementById('heroDemo');
    if (heroDemo) {
        heroDemo.addEventListener('click', function(e) {
            e.preventDefault();
            startDemoMode();
        });
    }
    
    // Nav Login button
    const navLoginBtn = document.getElementById('navLoginBtn');
    if (navLoginBtn) {
        navLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Nav Login clicked");
            openModal(loginModal);
        });
    }
    
    // Google Sign In buttons
    const loginGoogleBtn = document.getElementById('loginGoogle');
    if (loginGoogleBtn) {
        loginGoogleBtn.addEventListener('click', handleGoogleSignIn);
    }
    
    const signupGoogleBtn = document.getElementById('signupGoogle');
    if (signupGoogleBtn) {
        signupGoogleBtn.addEventListener('click', handleGoogleSignIn);
    }
    
    // Pricing plan buttons
    document.querySelectorAll('.plan-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Plan button clicked:", this.dataset.plan);
            selectedPlan = this.dataset.plan;
            const planAnnual = document.getElementById('planAnnual');
            const planMonthly = document.getElementById('planMonthly');
            if (selectedPlan.includes('Annual')) {
                if (planAnnual) planAnnual.classList.add('active');
                if (planMonthly) planMonthly.classList.remove('active');
            } else {
                if (planMonthly) planMonthly.classList.add('active');
                if (planAnnual) planAnnual.classList.remove('active');
            }
            updatePaymentPlanUI();
            openModal(paymentModal);
        });
    });
    
    // Compare CTA button
    const compareCta = document.getElementById('compareCta');
    if (compareCta) {
        compareCta.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Compare CTA clicked");
            selectedPlan = "Monthly — $12/mo";
            const planMonthly = document.getElementById('planMonthly');
            const planAnnual = document.getElementById('planAnnual');
            if (planMonthly) planMonthly.classList.add('active');
            if (planAnnual) planAnnual.classList.remove('active');
            updatePaymentPlanUI();
            openModal(paymentModal);
        });
    }
    
    // Modal plan selector
    document.querySelectorAll('.modal-plan-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.modal-plan-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            selectedPlan = this.dataset.plan;
            updatePaymentPlanUI();
        });
    });
    
    // Payment tabs
    document.querySelectorAll('.pay-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.pay-tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const tabContent = document.getElementById('tab-' + this.dataset.tab);
            if (tabContent) tabContent.classList.add('active');
        });
    });
    
    // Wallet options
    document.querySelectorAll('.wallet-option').forEach(opt => {
        opt.addEventListener('click', function() {
            const grid = this.closest('.wallet-grid');
            if (grid) {
                grid.querySelectorAll('.wallet-option').forEach(o => o.classList.remove('selected'));
            }
            this.classList.add('selected');
        });
    });
    
    // Modal close buttons
    const loginClose = document.getElementById('loginClose');
    if (loginClose) loginClose.addEventListener('click', () => closeModal(loginModal));
    
    const paymentClose = document.getElementById('paymentClose');
    if (paymentClose) paymentClose.addEventListener('click', () => closeModal(paymentModal));
    
    const signupClose = document.getElementById('signupClose');
    if (signupClose) signupClose.addEventListener('click', () => closeModal(signupModal));
    
    // Close modals when clicking outside
    if (loginModal) {
        loginModal.addEventListener('click', e => { if (e.target === loginModal) closeModal(loginModal); });
    }
    if (paymentModal) {
        paymentModal.addEventListener('click', e => { if (e.target === paymentModal) closeModal(paymentModal); });
    }
    if (signupModal) {
        signupModal.addEventListener('click', e => { if (e.target === signupModal) closeModal(signupModal); });
    }
    
    // Card auto format
    const cardNumber = document.getElementById('cardNumber');
    if (cardNumber) {
        cardNumber.addEventListener('input', function(e) {
            let v = e.target.value.replace(/\D/g, '').substring(0, 16);
            e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
        });
    }
    
    const cardExpiry = document.getElementById('cardExpiry');
    if (cardExpiry) {
        cardExpiry.addEventListener('input', function(e) {
            let v = e.target.value.replace(/\D/g, '').substring(0, 4);
            if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
            e.target.value = v;
        });
    }
    
    // Auth navigation
    const goToSignup = document.getElementById('goToSignup');
    if (goToSignup) {
        goToSignup.addEventListener('click', () => {
            closeModal(loginModal);
            openModal(signupModal);
        });
    }
    
    const goToLogin = document.getElementById('goToLogin');
    if (goToLogin) {
        goToLogin.addEventListener('click', () => {
            closeModal(signupModal);
            openModal(loginModal);
        });
    }
    
    // Login submit
    const loginSubmit = document.getElementById('loginSubmit');
    if (loginSubmit) {
        loginSubmit.addEventListener('click', () => {
            const email = document.getElementById('loginEmail')?.value.trim();
            if (!email) {
                alert("Please enter your email address!");
                return;
            }
            const name = email.split('@')[0];
            loginUser(name, email);
            alert('✅ Login Successful!\nRedirecting to chat...');
            closeModal(loginModal);
            openChat();
        });
    }
    
    // Signup submit
    const signupSubmit = document.getElementById('signupSubmit');
    if (signupSubmit) {
        signupSubmit.addEventListener('click', () => {
            const name = document.getElementById('signupName')?.value.trim();
            const email = document.getElementById('signupEmail')?.value.trim();
            const password = document.getElementById('signupPassword')?.value;
            const confirmPassword = document.getElementById('signupConfirmPassword')?.value;
            
            if (!name) { alert('Please enter your full name!'); return; }
            if (!email) { alert('Please enter your email address!'); return; }
            if (!password) { alert('Please enter a password!'); return; }
            if (password.length < 8) { alert('Password must be at least 8 characters long!'); return; }
            if (password !== confirmPassword) { alert('Passwords do not match!'); return; }
            
            alert('✅ Account created successfully!\nProceed to payment...');
            loginUser(name, email);
            closeModal(signupModal);
            openModal(paymentModal);
        });
    }
    
    // Payment submit
    const paymentSubmit = document.getElementById('paymentSubmit');
    if (paymentSubmit) {
        paymentSubmit.addEventListener('click', () => {
            if (selectedPlan.includes('Trial')) {
                loginUser(localStorage.getItem('userName') || 'User', localStorage.getItem('userEmail') || '');
                alert(`🎉 Your 7-Day Free Trial is now Active!\nWelcome to NexusAI!`);
                closeModal(paymentModal);
                openChat();
                return;
            }
            loginUser(localStorage.getItem('userName') || 'User', localStorage.getItem('userEmail') || '');
            alert('🎉 Payment Successful!\nWelcome to NexusAI!');
            closeModal(paymentModal);
            openChat();
        });
    }
    
    // Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { 
            closeModal(loginModal); 
            closeModal(paymentModal); 
            closeModal(signupModal); closeModal(forgotModal); showForgotStep(1);
        }
    });
    
    // Chat controls
    const chatBack = document.getElementById('chatBack');
    if (chatBack) chatBack.addEventListener('click', closeChat);
    
    const chatClose = document.getElementById('chatClose');
    if (chatClose) chatClose.addEventListener('click', closeChat);
    
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);

    // Image gallery toggle
    const imgGalleryLabel = document.getElementById('imgGalleryLabel');
    if (imgGalleryLabel) {
        imgGalleryLabel.addEventListener('click', () => {
            const galleryList = document.getElementById('imgGalleryList');
            if (galleryList) {
                const isOpen = galleryList.style.display !== 'none';
                galleryList.style.display = isOpen ? 'none' : 'block';
                imgGalleryLabel.querySelector('span:first-child').textContent = isOpen ? '🎨 Generated Images' : '🎨 Generated Images ▲';
            }
        });
    }
    
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const sidebar = document.getElementById('chatSidebar');
            if (sidebar) sidebar.classList.toggle('collapsed');
        });
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSendMessage(); });
    }
    if (chatSend) chatSend.addEventListener('click', handleSendMessage);

    // Build forgot password modal entirely with JS
    createForgotModal();
    addForgotLinkToLoginModal();

    // ===== ACCOUNT AVATAR TOGGLE =====
    const accountAvatar = document.getElementById('accountAvatar');
    const navAccount = document.getElementById('navAccount');
    if (accountAvatar && navAccount) {
        accountAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            navAccount.classList.toggle('open');
        });
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            navAccount.classList.remove('open');
        });
    }

    // Logout button
    const navLogoutBtn = document.getElementById('navLogoutBtn');
    if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to log out?')) {
                logoutUser();
                alert('👋 You have been logged out.');
            }
        });
    }

    // Open Chat from dropdown
    const dropdownOpenChat = document.getElementById('dropdownOpenChat');
    if (dropdownOpenChat) {
        dropdownOpenChat.addEventListener('click', () => {
            if (navAccount) navAccount.classList.remove('open');
            openChat();
        });
    }

    // Sync nav state on init (in case user was already logged in)
    updateNavAuthState();
}

// Start everything when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
// ================================================================
// ===== PLUS BUTTON — ATTACH MENU (added) =====
// ================================================================

(function initPlusMenu() {
    // Wait until chat is ready
    const chatPlusBtn   = document.getElementById('chatPlusBtn');
    const plusMenu      = document.getElementById('plusMenu');
    const cameraInput   = document.getElementById('cameraInput');
    const photoFileInput= document.getElementById('photoFileInput');
    const videoInput    = document.getElementById('videoInput');
    const chatInputEl   = document.getElementById('chatInput');
    const chatSendEl    = document.getElementById('chatSend');

    if (!chatPlusBtn || !plusMenu) return;

    let pendingAttachments = [];

    function closePlusMenu() {
        plusMenu.classList.remove('open');
        chatPlusBtn.classList.remove('open');
    }

    chatPlusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = plusMenu.classList.toggle('open');
        chatPlusBtn.classList.toggle('open', isOpen);
    });

    document.addEventListener('click', (e) => {
        if (!plusMenu.contains(e.target) && e.target !== chatPlusBtn) closePlusMenu();
    });

    function escHtml(t) {
        const d = document.createElement('div'); d.textContent = t; return d.innerHTML;
    }

    function renderAttachmentBar() {
        let bar = document.getElementById('attachmentPreviewBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'attachmentPreviewBar';
            bar.className = 'attachment-preview-bar';
            const chatInputBar = document.querySelector('.chat-input-bar');
            const wrap = chatInputBar.querySelector('.chat-input-wrap');
            chatInputBar.insertBefore(bar, wrap);
        }
        bar.innerHTML = '';
        pendingAttachments.forEach((att, idx) => {
            const chip = document.createElement('div');
            chip.className = 'attachment-chip';
            let icon = att.type === 'image' ? `<img src="${att.dataUrl}" alt="">` :
                       att.type === 'video' ? `<span style="font-size:1.2rem">🎥</span>` :
                       `<span style="font-size:1.1rem">📄</span>`;
            const shortName = att.name.length > 18 ? att.name.substring(0,18)+'…' : att.name;
            chip.innerHTML = `${icon}<span title="${escHtml(att.name)}">${escHtml(shortName)}</span>
                <button class="attachment-chip-remove" title="Remove">✕</button>`;
            chip.querySelector('.attachment-chip-remove').addEventListener('click', () => {
                pendingAttachments.splice(idx, 1);
                renderAttachmentBar();
            });
            bar.appendChild(chip);
        });
    }

    function handleFiles(files, forceType) {
        if (!files || !files.length) return;
        Array.from(files).forEach(file => {
            const type = forceType ||
                (file.type.startsWith('image/') ? 'image' :
                 file.type.startsWith('video/') ? 'video' : 'file');
            const reader = new FileReader();
            reader.onload = (e) => {
                pendingAttachments.push({ type, file, dataUrl: e.target.result, name: file.name });
                renderAttachmentBar();
            };
            reader.readAsDataURL(file);
        });
        closePlusMenu();
    }

    // Camera
    const pmCamera = document.getElementById('pmCamera');
    if (pmCamera && cameraInput) {
        pmCamera.addEventListener('click', () => { closePlusMenu(); cameraInput.click(); });
        cameraInput.addEventListener('change', () => handleFiles(cameraInput.files, 'image'));
    }

    // Photos & Files
    const pmPhotos = document.getElementById('pmPhotos');
    if (pmPhotos && photoFileInput) {
        pmPhotos.addEventListener('click', () => { closePlusMenu(); photoFileInput.click(); });
        photoFileInput.addEventListener('change', () => handleFiles(photoFileInput.files));
    }

    // Video
    const pmVideo = document.getElementById('pmVideo');
    if (pmVideo && videoInput) {
        pmVideo.addEventListener('click', () => { closePlusMenu(); videoInput.click(); });
        videoInput.addEventListener('change', () => handleFiles(videoInput.files, 'video'));
    }

    // Create Image — prefill input
    const pmCreateImage = document.getElementById('pmCreateImage');
    if (pmCreateImage) {
        pmCreateImage.addEventListener('click', () => {
            closePlusMenu();
            if (chatInputEl) {
                if (!chatInputEl.value.toLowerCase().startsWith('create image')) {
                    chatInputEl.value = 'create image: ' + chatInputEl.value;
                }
                chatInputEl.focus();
                chatInputEl.setSelectionRange(chatInputEl.value.length, chatInputEl.value.length);
            }
        });
    }

    // Clear on send
    function clearAttachments() {
        pendingAttachments = [];
        renderAttachmentBar();
        if (cameraInput) cameraInput.value = '';
        if (photoFileInput) photoFileInput.value = '';
        if (videoInput) videoInput.value = '';
    }

    // Expose to handleSendMessage (which runs outside this IIFE scope)
    window.getPendingAttachments = () => [...pendingAttachments];
    window.clearPendingAttachments = clearAttachments;

    if (chatSendEl) chatSendEl.addEventListener('click', () => {}, { capture: true }); // send clears via handleSendMessage
    if (chatInputEl) chatInputEl.addEventListener('keypress', (e) => {}, { capture: true });
})();
