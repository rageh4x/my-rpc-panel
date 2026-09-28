const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const WebSocket = require('ws');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const CLIENT_ID = '1552641681617326110';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'y_wrDrVqbMG1wnlWZ6rrEAbqAj0CLctF';
const REDIRECT_URI = 'https://c-panel-1.onrender.com/callback';

// Main Dashboard Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// OAuth2 Callback Route (Yahin par "Not Found" aa raha tha)
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.send('<h3>Authorization failed: No code provided from Discord.</h3><p><a href="/">Go Back</a></p>');
    }

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const oauthData = await tokenResponse.json();
        
        if (oauthData.access_token) {
            res.send(`
                <html>
                <body style="background:#0f1016;color:#fff;font-family:Arial;text-align:center;padding-top:50px;">
                    <h3 style="color:#7aa2f7;">Authorized Successfully!</h3>
                    <p>Aapka Access Token neeche diya gaya hai. Isko copy karke dashboard mein paste kar lo:</p>
                    <textarea style="width:80%;height:80px;background:#24283b;color:#fff;border-radius:6px;padding:10px;border:none;" readonly>${oauthData.access_token}</textarea><br><br>
                    <a href="/" style="color:#7aa2f7;text-decoration:none;background:#1a1b26;padding:10px 20px;border-radius:6px;display:inline-block;">Go Back to Dashboard</a>
                </body>
                </html>
            `);
        } else {
            res.send(`<h3>OAuth Error:</h3><pre>${JSON.stringify(oauthData, null, 2)}</pre><p><a href="/">Go Back</a></p>`);
        }
    } catch (err) {
        res.send(`<h3>Server Error:</h3><p>${err.message}</p><p><a href="/">Go Back</a></p>`);
    }
});

// Enable RPC WebSocket Route
app.post('/enable-rpc', async (req, res) => {
    const { token, activityType, name, details, state, largeImageURL, button1Label, button1Url, button2Label, button2Url } = req.body;
    
    try {
        const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
        let heartbeatInterval = null;

        ws.on('message', (data) => {
            const payload = JSON.parse(data);
            
            if (payload.op === 10) {
                const interval = payload.d.heartbeat_interval;
                heartbeatInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ op: 1, d: null }));
                    }
                }, interval);

                let buttons = [];
                if (button1Label && button1Url) buttons.push({ label: button1Label, url: button1Url });
                if (button2Label && button2Url) buttons.push({ label: button2Label, url: button2Url });

                ws.send(JSON.stringify({
                    op: 2,
                    d: {
                        token: token,
                        capabilities: 3713,
                        properties: { os: "Windows", browser: "Chrome", device: "" },
                        presence: {
                            status: "online",
                            since: 0,
                            activities: [{
                                name: name || "Minecraft",
                                type: parseInt(activityType) || 0,
                                details: details || "",
                                state: state || "",
                                application_id: CLIENT_ID,
                                assets: {
                                    large_image: largeImageURL || ""
                                },
                                buttons: buttons.length > 0 ? buttons : undefined
                            }],
                            afk: false
                        }
                    }
                }));
            }
        });

ws.on('close', () => {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
        });

        res.send({ success: true, message: "RPC Enabled Successfully! Status cloud par live ho gaya hai." });
    } catch (err) {
        res.send({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
