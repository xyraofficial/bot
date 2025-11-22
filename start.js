const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

// --- KONFIGURASI DATABASE JSON ---
const dbFile = './database.json';
let db = { users: {}, settings: { botName: 'XyraBot', startTime: Date.now() } };

// Fungsi Load Database
if (fs.existsSync(dbFile)) {
    try {
        db = JSON.parse(fs.readFileSync(dbFile));
    } catch(e) { console.error("Database korup, membuat baru."); }
}

// Fungsi Save Database
const saveDB = () => {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
};

// --- SERVER SETUP ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// --- TAMPILAN WEB (DASHBOARD UI) ---
const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bot Dashboard Control</title>
    <style>
        :root { --primary: #008069; --bg: #eef2f5; --card: #ffffff; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: var(--bg); margin: 0; padding: 20px; color: #333; }
        
        .container { max-width: 800px; margin: 0 auto; }
        
        /* Header */
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: var(--primary); margin: 0; }
        .badge { background: #ccc; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; vertical-align: middle; }
        .badge.online { background: #25D366; }
        
        /* Grid Cards */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .card { background: var(--card); padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); text-align: center; }
        .card h3 { margin: 0; font-size: 30px; color: var(--primary); }
        .card p { margin: 5px 0 0; color: #666; font-size: 14px; }

        /* Control Panel */
        .control-panel { background: var(--card); padding: 25px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center; }
        input { width: 70%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 10px; font-size: 16px; }
        button { padding: 12px 25px; background: var(--primary); color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; transition: 0.3s; }
        button:hover { background: #00604f; }

        /* Pairing Code Display */
        #code-display { margin-top: 20px; display: none; }
        .code-box { background: #111; color: #0f0; font-family: monospace; font-size: 28px; padding: 15px; border-radius: 8px; letter-spacing: 5px; display: inline-block; }
        
        /* Logs */
        .logs-container { margin-top: 20px; background: #1e1e1e; color: #ccc; padding: 15px; border-radius: 10px; height: 200px; overflow-y: auto; font-family: monospace; font-size: 12px; text-align: left; }
        .log-item { margin-bottom: 5px; border-bottom: 1px solid #333; padding-bottom: 2px; }
        .log-time { color: #888; margin-right: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 WhatsApp Bot Panel</h1>
            <span id="status-badge" class="badge">OFFLINE</span>
        </div>

        <div class="stats-grid">
            <div class="card">
                <h3 id="user-count">0</h3>
                <p>Total User Database</p>
            </div>
            <div class="card">
                <h3 id="msg-count">0</h3>
                <p>Pesan Diterima</p>
            </div>
            <div class="card">
                <h3 id="runtime">0m</h3>
                <p>Runtime</p>
            </div>
        </div>

        <div class="control-panel" id="panel-login">
            <h3>Hubungkan Bot</h3>
            <p>Masukkan nomor WhatsApp (Format: 628xxx)</p>
            <input type="number" id="phoneNumber" placeholder="628123456789">
            <br>
            <button onclick="startPairing()">Minta Kode Pairing</button>
            
            <div id="code-display">
                <p>Masukkan kode ini di Perangkat Tertaut:</p>
                <div class="code-box" id="pairing-code">Loading...</div>
            </div>
        </div>

        <div class="logs-container" id="logs"></div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        
        // Update Stats Realtime
        socket.on('stats_update', (data) => {
            document.getElementById('user-count').innerText = data.totalUsers;
            document.getElementById('msg-count').innerText = data.totalHits || 0;
        });

        socket.on('status_update', (status) => {
            const badge = document.getElementById('status-badge');
            badge.innerText = status.toUpperCase();
            badge.className = status === 'online' ? 'badge online' : 'badge';
            
            if(status === 'online') {
                document.getElementById('panel-login').style.display = 'none'; // Sembunyikan login jika sudah on
            }
        });

        function startPairing() {
            const num = document.getElementById('phoneNumber').value;
            if(!num) return alert("Isi nomor dulu!");
            document.getElementById('code-display').style.display = 'block';
            socket.emit('request_pairing', num);
        }

        socket.on('pairing_code', (code) => {
            document.getElementById('pairing-code').innerText = code;
        });

        socket.on('log', (msg) => {
            const logs = document.getElementById('logs');
            const div = document.createElement('div');
            div.className = 'log-item';
            div.innerHTML = \`<span class="log-time">[\${new Date().toLocaleTimeString()}]</span> \${msg}\`;
            logs.appendChild(div);
            logs.scrollTop = logs.scrollHeight;
        });
    </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(htmlContent));

// --- LOGIKA BOT ---
let sock;
let totalHits = 0; // Hitungan pesan sementara (reset kalau restart)

async function startBot(socket = null, targetPhone = null) {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true
    });

    // Broadcast Stats Awal
    const broadcastStats = () => {
        io.emit('stats_update', { 
            totalUsers: Object.keys(db.users).length,
            totalHits: totalHits
        });
    };

    // Handler Pairing
    if (targetPhone && !sock.authState.creds.me && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(targetPhone);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                if(socket) socket.emit('pairing_code', code);
            } catch (e) {
                if(socket) socket.emit('log', 'Error Pairing: ' + e.message);
            }
        }, 3000);
    }

    // Connection Update
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            io.emit('status_update', 'offline');
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            io.emit('status_update', 'online');
            io.emit('log', `Bot Terhubung sebagai: ${sock.user.id.split(':')[0]}`);
            broadcastStats();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- MESSAGE HANDLER (FITUR UTAMA) ---
    sock.ev.on('messages.upsert', async chatUpdate => {
        try {
            if (chatUpdate.type !== 'notify') return;
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            if (m.key.fromMe) return;

            const remoteJid = m.key.remoteJid;
            const pushName = m.pushName || 'User';
            const messageType = Object.keys(m.message)[0];
            const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
            
            // 1. DATABASE USER LOGIC
            if (!db.users[remoteJid]) {
                db.users[remoteJid] = { 
                    name: pushName, 
                    joined: Date.now(), 
                    hit: 0,
                    premium: false 
                };
                io.emit('log', `User Baru Terdeteksi: ${pushName}`);
            }
            db.users[remoteJid].hit += 1;
            db.users[remoteJid].name = pushName; // Update nama jika berubah
            saveDB(); // Simpan ke JSON

            // Update Web Stats
            totalHits++;
            broadcastStats();

            // 2. COMMAND HANDLER
            const prefix = '.';
            if (!text.startsWith(prefix)) return;
            
            const command = text.slice(prefix.length).trim().split(' ')[0].toLowerCase();
            
            // Helper Reply
            const reply = (txt) => sock.sendMessage(remoteJid, { text: txt }, { quoted: m });

            switch (command) {
                case 'menu':
                case 'help':
                    reply(`🤖 *${db.settings.botName} Menu*\n\n👋 Halo ${pushName}!\n📊 Total Hits Kamu: ${db.users[remoteJid].hit}\n\n*Commands:*\n• .ping\n• .me (Cek Info User)\n• .info (Info Server)`);
                    break;

                case 'ping':
                    const start = Date.now();
                    await reply('Testing speed...');
                    const latensi = Date.now() - start;
                    reply(`Pong! 🏓\nKecepatan: ${latensi}ms`);
                    break;

                case 'me':
                case 'cek':
                    const user = db.users[remoteJid];
                    reply(`👤 *INFO USER*\n\nNama: ${user.name}\nStatus: ${user.premium ? 'Premium 🌟' : 'Free'}\nTotal Chat: ${user.hit}\nBergabung: ${new Date(user.joined).toLocaleDateString()}`);
                    break;

                case 'info':
                    reply(`💻 *INFO SERVER*\n\nRuntime: ${Math.floor(process.uptime())} detik\nTotal User Database: ${Object.keys(db.users).length}\nRAM Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
                    break;

                default:
                    reply('Perintah tidak ditemukan. Ketik .menu');
            }

        } catch (err) {
            console.error(err);
        }
    });
}

// Socket.io Events
io.on('connection', (socket) => {
    socket.emit('log', 'Terhubung ke Control Panel.');
    
    // Kirim data awal saat web dibuka
    socket.emit('stats_update', { 
        totalUsers: Object.keys(db.users).length,
        totalHits: totalHits 
    });

    if (sock && sock.user) {
         socket.emit('status_update', 'online');
    } else {
         socket.emit('status_update', 'offline');
    }

    socket.on('request_pairing', (phone) => {
        socket.emit('log', `Meminta pairing code untuk ${phone}...`);
        startBot(socket, phone);
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`✅ Server & Bot siap! Buka http://localhost:${PORT}`);
});
