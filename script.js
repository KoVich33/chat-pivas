// firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBAxHfNFTCCZUOwuHemlGeJeoQLK6Af4d8",
    authDomain: "pivas-chat.firebaseapp.com",
    databaseURL: "https://pivas-chat-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "pivas-chat",
    storageBucket: "pivas-chat.firebasestorage.app",
    messagingSenderId: "735154795152",
    appId: "1:735154795152:web:4ab51b3d7c0d795469de15"
};

// inicialisation
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// BD messages link
const messagesRef = database.ref('messages');

let currentUser = null;
let messagesListener = null;

const appContainer = document.getElementById('app');

// BBcode
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseBBCode(text) {
    if (!text) return '';
    
    let html = escapeHtml(text);

    // string
    html = html.replace(/\n/g, '<br>');

    
    // b
    html = html.replace(/\[b\](.*?)\[\/b\]/gis, '<strong>$1</strong>');
    
    // i
    html = html.replace(/\[i\](.*?)\[\/i\]/gis, '<em>$1</em>');
    
    // u
    html = html.replace(/\[u\](.*?)\[\/u\]/gis, '<u>$1</u>');
    
    // s
    html = html.replace(/\[s\](.*?)\[\/s\]/gis, '<del>$1</del>');
    
    // color
    html = html.replace(/\[color=([a-zA-Z0-9#]+)\](.*?)\[\/color\]/gis, '<span style="color:$1">$2</span>');
    
    // size
    html = html.replace(/\[size=(\d+)\](.*?)\[\/size\]/gis, (match, size, content) => {
        let fontSize = parseInt(size);
        fontSize = Math.min(Math.max(fontSize, 10), 72);
        return `<span style="font-size:${fontSize}px">${content}</span>`;
    });

    // url
    html = html.replace(/\[url\](https?:\/\/[^\s]+)\[\/url\]/gis, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // text url
    html = html.replace(/\[url=([^\]]+)\](.*?)\[\/url\]/gis, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');
    
    // img
    html = html.replace(/\[img\](https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|svg))\[\/img\]/gis, '<img src="$1" class="bb-image" loading="lazy" onclick="window.open(this.src)" alt="image">');
    
    // gif
    html = html.replace(/\[gif\](https?:\/\/[^\s]+\.gif)\[\/gif\]/gis, '<img src="$1" class="bb-gif" loading="lazy" alt="gif">');
    
    return html;
}

function render() {
    if (currentUser) {
        renderChat();
    } else {
        renderAuth();
    }
}

// Date format
function formatMessageDate(timestamp) {
    if (!timestamp) return 'только что';

    let milliseconds = timestamp;
    if (timestamp < 10000000000) {
        milliseconds = timestamp * 1000;
    }
    
    const msgDate = new Date(milliseconds);

    if (isNaN(msgDate.getTime())) {
        console.error('Invalid timestamp:', timestamp);
        return 'неверная дата';
    }
    
    const now = new Date();

    const msgDateOnly = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayOnly = new Date(todayOnly);
    yesterdayOnly.setDate(yesterdayOnly.getDate() - 1);

    const timeStr = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (msgDateOnly.getTime() === todayOnly.getTime()) {
        return timeStr; // сегодня
    }

    if (msgDateOnly.getTime() === yesterdayOnly.getTime()) {
        return `Вчера ${timeStr}`; // вчера
    }

    const month = msgDate.getMonth() + 1;
    const day = msgDate.getDate();
    const year = msgDate.getFullYear();
    const currentYear = now.getFullYear();

    if (year === currentYear) {
        return `${day}/${month} ${timeStr}`;
    }

    const shortYear = year.toString().slice(-2);
    return `${day}/${month}/${shortYear} ${timeStr}`;
}

function renderAuth() {
    let mode = 'login';
    
    const authHtml = `
        <div class="auth-overlay" id="authOverlay">
            <div class="auth-card" id="authCard">
                <h3 id="authTitle">🔐 Вход в чат</h3>
                <input type="email" id="emailInput" placeholder="Email" autocomplete="email">
                <input type="password" id="passwordInput" placeholder="Пароль (мин. 6 символов)" autocomplete="current-password">
                <div id="authError" class="error-msg" style="display: none;"></div>
                <button id="submitAuthBtn">Войти</button>
                <div class="toggle-link" id="toggleAuthMode">
                    Нет аккаунта? Создать
                </div>
            </div>
        </div>
    `;
    appContainer.innerHTML = authHtml;
    
    const emailInp = document.getElementById('emailInput');
    const passInp = document.getElementById('passwordInput');
    const submitBtn = document.getElementById('submitAuthBtn');
    const toggleLink = document.getElementById('toggleAuthMode');
    const authTitle = document.getElementById('authTitle');
    const errorDiv = document.getElementById('authError');
    
    function setMode(newMode) {
        mode = newMode;
        if (mode === 'login') {
            authTitle.innerText = 'Вход в чат';
            submitBtn.innerText = 'Войти';
            toggleLink.innerText = 'Нет аккаунта? Создать';
        } else {
            authTitle.innerText = 'Регистрация';
            submitBtn.innerText = 'Зарегистрироваться';
            toggleLink.innerText = 'Уже есть аккаунт? Войти';
        }
        errorDiv.style.display = 'none';
    }
    
    toggleLink.onclick = () => {
        setMode(mode === 'login' ? 'register' : 'login');
    };
    
    async function handleAuth() {
        const email = emailInp.value.trim();
        const password = passInp.value.trim();
        errorDiv.style.display = 'none';
        
        if (!email || !password) {
            showError('Заполните email и пароль');
            return;
        }
        if (password.length < 6 && mode === 'register') {
            showError('Пароль должен быть минимум 6 символов');
            return;
        }
        
        try {
            if (mode === 'login') {
                await auth.signInWithEmailAndPassword(email, password);
            } else {
                await auth.createUserWithEmailAndPassword(email, password);
            }
        } catch (err) {
            let msg = err.message;
            if (err.code === 'auth/user-not-found') msg = 'Пользователь не найден';
            if (err.code === 'auth/wrong-password') msg = 'Неверный пароль';
            if (err.code === 'auth/email-already-in-use') msg = 'Email уже используется';
            if (err.code === 'auth/invalid-email') msg = 'Неверный формат email';
            if (err.code === 'auth/weak-password') msg = 'Слишком слабый пароль';
            showError(msg);
            console.error('Auth error:', err);
        }
    }
    
    function showError(msg) {
        errorDiv.innerText = msg;
        errorDiv.style.display = 'block';
    }
    
    submitBtn.onclick = handleAuth;
    
    const handleEnter = (e) => {
        if (e.key === 'Enter' && document.getElementById('authOverlay')) {
            handleAuth();
        }
    };
    document.addEventListener('keypress', handleEnter);
    
    // cleanup
    window.cleanupAuthListener = () => {
        document.removeEventListener('keypress', handleEnter);
    };
}

function renderChat() {
    appContainer.innerHTML = `
        <div class="chat-container">
            <div class="chat-header">
                <img src="favicon/favicon-96x96.png" class="icon">
                <h2>Подпивасники</h2>
                <div class="user-info">
                    <span class="status-badge"></span>
                    <span class="user-email" id="userEmailSpan">${escapeHtml(currentUser.email)}</span>
                    <button class="logout-btn" id="logoutBtn">Выйти</button>
                </div>
            </div>
            <div class="messages-area" id="messagesArea">
                <div style="text-align:center; color:#6c7e8e; padding:20px;">Подключение...</div>
            </div>
            <div class="input-area">
                <input type="text" id="messageInput" placeholder="Напишите сообщение..." autocomplete="off">
                <button id="sendBtn">Отправить</button>
            </div>
        </div>
    `;
    
    const messagesContainer = document.getElementById('messagesArea');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) {
            messageInput.style.border = '2px solid #ff4444';
            setTimeout(() => {
                messageInput.style.border = '';
            }, 500);
            return;
        }
        if (!currentUser) {
            console.error('No user logged in');
            return;
        }

        sendBtn.disabled = true;
        sendBtn.textContent = 'Отправка...';
        
        try {
            const newMessageRef = messagesRef.push();
            await newMessageRef.set({
                text: text,
                uid: currentUser.uid,
                email: currentUser.email,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            messageInput.value = '';
            messageInput.focus();
            console.log('Message sent successfully');
        } catch (err) {
            console.error('Ошибка отправки:', err);
            alert('Не удалось отправить сообщение: ' + err.message);
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Отправить';
        }
    }
    
    sendBtn.onclick = sendMessage;
    
    // message sending keybind
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (!e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        }
    });
    
    logoutBtn.onclick = async () => {
        if (messagesListener) {
            messagesRef.off('value', messagesListener);
        }
        await auth.signOut();
    };
    
    // listen messages
    if (messagesListener) {
        messagesRef.off('value', messagesListener);
    }
    
    messagesListener = messagesRef.orderByChild('timestamp').limitToLast(100).on('value', (snapshot) => {
        const messages = [];
        snapshot.forEach((childSnapshot) => {
            const val = childSnapshot.val();
            if (val && val.text) {  // message validation
                messages.push({
                    id: childSnapshot.key,
                    ...val
                });
            }
        });
        
        messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        if (!messagesContainer) return;
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div style="text-align:center; color:#6c7e8e; padding:20px;">Здесь пока пусто...</div>';
            return;
        }
        
        let html = '';
        for (let msg of messages) {
            const isOwn = (currentUser && msg.uid === currentUser.uid);
            const timeStr = msg.timestamp ? formatMessageDate(msg.timestamp) : 'только что';
            const senderName = msg.email ? escapeHtml(msg.email.split('@')[0]) : 'anon';
            const fullEmail = msg.email ? escapeHtml(msg.email) : '';
            
            // BBCode parsing
            const parsedText = parseBBCode(msg.text);
            
            html += `
                <div class="message ${isOwn ? 'own' : 'other'}">
                    <div class="message-bubble">
                        ${parsedText}
                    </div>
                    <div class="message-meta">
                        <span class="message-author" title="${fullEmail}">${senderName}</span>
                        <span class="message-time">${timeStr}</span>
                    </div>
                </div>
            `;
        }
        messagesContainer.innerHTML = html;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, (error) => {
        console.error('Database error:', error);
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div style="text-align:center; color:#ff4444; padding:20px;">Ошибка подключения</div>';
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Message listener in auth mode
auth.onAuthStateChanged((user) => {
    console.log('Auth state changed:', user ? user.email : 'null');
    if (user) {
        currentUser = user;
        render();
    } else {
        if (messagesListener) {
            messagesRef.off('value', messagesListener);
            messagesListener = null;
        }
        currentUser = null;
        render();
    }
});

// run
render();