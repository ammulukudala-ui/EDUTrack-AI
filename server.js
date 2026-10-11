require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const connectDB = require('./config/db');
const { csrfProtection } = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const isProd = process.env.NODE_ENV === 'production';

function createApp() {
  const app = express();
  if (isProd) app.set('trust proxy', 1); // needed for secure cookies behind HTTPS proxies (Render, Nginx...)
  if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.startsWith('replace_me'))) throw new Error('Set a strong SESSION_SECRET in production.');

  app.use(helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://code.jquery.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"]
    } }
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.use(session({
    name: 'edutrack.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false, saveUninitialized: false, // NOTE: default MemoryStore - fine for a college project (see README limitations)
    cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: (Number(process.env.SESSION_HOURS) || 8) * 3600 * 1000 }
  }));

  // Protect HTML pages (redirect to login). Public pages stay open.
  const publicPages = new Set(['/', '/index.html', '/login.html', '/register.html']);
  const rolePages = { '/student-dashboard.html': 'student', '/faculty-dashboard.html': 'faculty', '/admin-dashboard.html': 'admin' };
  app.use(async (req, res, next) => {
    if (!req.path.endsWith('.html') || publicPages.has(req.path)) return next();
    if (!req.session.userId) return res.redirect('/login.html');
    const need = rolePages[req.path];
    if (need && req.session.role !== need) return res.redirect('/dashboard');
    next();
  });
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/login', (req, res) => res.redirect('/login.html'));
  app.get('/dashboard', (req, res) => res.redirect(req.session.userId ? `/${req.session.role}-dashboard.html` : '/login.html'));

  // API
  app.use('/api', csrfProtection);
  app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/students', require('./routes/studentRoutes'));
  app.use('/api/subjects', require('./routes/subjectRoutes'));
  app.use('/api/academic-records', require('./routes/academicRoutes'));
  app.use('/api/attendance', require('./routes/attendanceRoutes'));
  app.use('/api/study-logs', require('./routes/studyRoutes'));
  app.use('/api/tasks', require('./routes/taskRoutes'));
  app.use('/api/analytics', require('./routes/analyticsRoutes'));
  app.use('/api/recommendations', require('./routes/recommendationRoutes'));
  app.use('/api/risk', require('./routes/riskRoutes'));
  app.use('/api/reports', require('./routes/reportRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function start() {
  const port = Number(process.env.PORT) || 5000;
  try { await connectDB(); } catch (e) {
    console.error('\n[!] Could not connect to MongoDB:', e.message);
    console.error('    Is MongoDB running? Check MONGO_URI in your .env file.\n');
    process.exit(1);
  }
  const server = createApp().listen(port, () => console.log(`EDUTrack AI running at http://localhost:${port}`));
  server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is already in use. Change PORT in .env.` : e.message); process.exit(1); });
}

if (require.main === module) start();
module.exports = { createApp };
