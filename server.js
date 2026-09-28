const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const app = express();

const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Active RPC connections store karne ke liye map
const activeRPCs = new Map();

// 1. Home / Dashboard UI (RoxyDev jaisa clean mobile-friendly dashboard)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Custom RPC Dashboard</title>
            <style>
                body { background: #0d0f18; color: #fff; font-family: sans-serif; padding: 20px; display: flex; justify-content: center; }
                .card { background: #16192b; padding: 20px; border-radius: 12px; width: 100%; max-width: 450px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
                h2 { text-align: center; color: #a855f7; }
                .btn { display: block; width: 100%; padding: 12px; background: #5865F2; color: white; text-align: center; border-radius: 8px; text-decoration: none; font-weight: bold; margin-bottom: 15px; }
                input, select { width: 100%; padding: 10px; margin: 8px 0; background: #0d0f18; border: 1px solid #2d3348; color: #fff; border-radius: 6px; box-sizing: border-box; }
                button { width: 100%; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Custom RPC Panel</h2>
                <a class="btn" href="/login">Login with Discord</a>
                <form action="/update" method="POST">
                    <label>Token (After Login)</label>
                    <input type="text" name="token" placeholder="Enter your token here" required>
                    <label>Activity Name</label>
                    <input type="text" name="name" value="Minecraft" required>
                    <label>Details</label>
                    <input type="text" name="details" value="Playing on Server">
                    <label>State</label>
                    <input type="text" name="state" value="In Game">
                    <label>Large Image URL</label>
                    <input type="text" name="largeImage" placeholder="https://...">
                    <button type="submit">Enable RPC</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// 2. Discord Login Route
app.get('/login', (req, res) => {
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`);
});

// 3. Callback Route (Token lene ke liye)
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Authorization failed!');
    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        res.send(`<h3>Authorized Successfully!</h3><p>Lekin selfbot/RPC ke liye aapko apna user token chahiye hoga. Aapka Access Token yeh hai: <b>${tokenRes.data.access_token}</b></p><a href="/">Go Back to Dashboard</a>`);
    } catch (e) {
        res.send('Error during authentication: ' + e.message);
    }
});

// 4. Update RPC Route (Background mein WebSocket chalu karega)
app.post('/update', (req, res) => {
    const { token, name, details, state, largeImage } = req.body;
    if (!token) return res.send('Token is required!');

    // Agar pehle se koi connection hai toh use band karein
    if (activeRPCs.has(token)) {
        activeRPCs.get(token).close();
    }

    // Discord Gateway WebSocket connection
    const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
    
    ws.on('open', () => {
        ws.send(JSON.stringify({
            op: 2,
            d: { token: token, properties: { os: 'Windows', browser: 'Chrome', device: '' } }
        }));
    });

    ws.on('message', (data) => {
        const packet = JSON.parse(data);
        if (packet.op === 10) {
            setInterval(() => {
                ws.send(JSON.stringify({
                    op: 3,
                    d: {
                        since: Date.now(),
                        activities: [{
                            name: name,
                            type: 0,
                            details: details,
                            state: state,
                            assets: { large_image: largeImage || '' }
                        }],
                        status: "online",
                        afk: false
                    }
                }));
            }, 15000);
        }
    });

    activeRPCs.set(token, ws);
    res.send('<h3>RPC Enabled Successfully!</h3><p>Aapka status 24/7 cloud par live ho gaya hai. Aap ise close kar sakte hain.</p><a href="/">Back</a>');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
