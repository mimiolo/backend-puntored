const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const app = express();
app.use(cors()); // ⚡ ESTO QUITA EL ERROR DE CORS EN FLUTTER WEB
app.use(express.json());

const SECRET_KEY = 'HPo7OLqB4Fkk4E2yGOtwqw8H5fHR9kNx67OR4g4UdlA=';
const IV = 'p5ldmBPdd/9pjC0bDC/nSg==';
const API_KEY = 'YSX1HpAFum4TpCecyFBxs4eIjAlbhKqK6fpcSQp8';

function cifrarAES(texto) {
    const key = Buffer.from(SECRET_KEY, 'base64');
    const iv = Buffer.from(IV, 'base64');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(texto, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

// 1. ENDPOINT: Obtener Token de Punto Red
app.post('/api/auth/token', async (req, res) => {
    try {
        const url = 'https://gestopago.portalventas.net/sistema/app/jwt-gp/authenticate/?idDistribuidor=83&codigoDispositivo=GPS83-TPV-17&password=12345678';
        const response = await axios.post(url, {}, { headers: { 'X-API-Key': API_KEY } });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. ENDPOINT: Hacer el Pago (SendTx Proxy)
app.post('/api/payment/sendTx', async (req, res) => {
    try {
        const { payload, token } = req.body;
        const jsonString = JSON.stringify(payload);
        const signed = cifrarAES(jsonString);
        const randomStr = Math.random().toString(36).substring(7);

        const bodyData = new URLSearchParams();
        bodyData.append('random', randomStr);
        bodyData.append('signed', signed);

        const url = 'https://gestopago.portalventas.net/sistema/service/sendTx.do';
        const response = await axios.post(url, bodyData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-API-Key': API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        res.send(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. ENDPOINT: Generar Secreto para Google Authenticator
app.get('/api/2fa/generar', async (req, res) => {
    try {
        const correo = req.query.correo || 'usuario@test.com';
        const secret = speakeasy.generateSecret({ name: `Seguridad App (${correo})` });
        const qrUrl = await QRCode.toDataURL(secret.otpauth_url);
        res.json({ secret: secret.base32, qr: qrUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. ENDPOINT: Validar Código de Google Authenticator
app.post('/api/2fa/validar', (req, res) => {
    const { secret, token } = req.body;
    const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 1
    });
    res.json({ valido: verified });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));