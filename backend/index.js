require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
const { nanoid } = require('nanoid')
const bodyParser = require('body-parser')
const bcrypt = require('bcrypt')
const sqlite3 = require('sqlite3').verbose()
const session = require('express-session')
const SQLiteStore = require('connect-sqlite3')(session)

const DB_FILE = './database.sqlite3'
const DATA_FILE = './mock-data.json'
if(!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ details: { bankAccountName: 'Demo Bank', bankAccountNumber: '0123456789', cryptoBtc: 'btc-demo-address' }, submissions: [] }, null, 2))

const db = new sqlite3.Database(DB_FILE)
db.serialize(()=>{
  db.run('CREATE TABLE IF NOT EXISTS admin(id INTEGER PRIMARY KEY, email TEXT UNIQUE, password TEXT)')
  db.get('SELECT * FROM admin LIMIT 1', (err,row)=>{
    if(err) return console.error(err)
    if(!row){
      const email = process.env.ADMIN_EMAIL || 'admin@example.com'
      const pass = process.env.ADMIN_PASS || 'password123'
      const hash = bcrypt.hashSync(pass, 10)
      db.run('INSERT INTO admin(email,password) VALUES(?,?)', [email, hash])
      console.log('Created default admin:', email)
    }
  })
})

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(bodyParser.json())

const uploadDir = './mock-storage'
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir)
const storage = multer.diskStorage({ destination: (req,file,cb)=> cb(null, uploadDir), filename: (req,file,cb)=> cb(null, Date.now() + '-' + file.originalname) })
const upload = multer({ storage })

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite3', dir: './' }),
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hours
}))

function readData(){ return JSON.parse(fs.readFileSync(DATA_FILE)) }
function writeData(d){ fs.writeFileSync(DATA_FILE, JSON.stringify(d,null,2)) }

function requireAuth(req,res,next){
  if(req.session && req.session.adminId) return next()
  return res.status(401).json({ message: 'Unauthorized' })
}

app.post('/admin/login', (req,res)=>{
  const { email, password } = req.body
  db.get('SELECT * FROM admin WHERE email = ?', [email], (err,row)=>{
    if(err) return res.status(500).json({ message: 'DB error' })
    if(!row) return res.status(401).json({ message: 'Invalid credentials' })
    if(!bcrypt.compareSync(password, row.password)) return res.status(401).json({ message: 'Invalid credentials' })
    req.session.adminId = row.id
    req.session.email = row.email
    res.json({ ok:true })
  })
})

app.post('/admin/logout', (req,res)=>{ req.session.destroy(()=>res.json({ ok:true })) })

app.post('/admin/change-password', requireAuth, (req,res)=>{
  const { password } = req.body
  if(!password || password.length < 6) return res.status(400).json({ message: 'Password too short' })
  const hash = bcrypt.hashSync(password, 10)
  db.get('SELECT * FROM admin WHERE id = ?', [req.session.adminId], (err,row)=>{
    if(err || !row) return res.status(500).json({ message: 'Error' })
    db.run('UPDATE admin SET password = ? WHERE id = ?', [hash, row.id], (e)=>{ if(e) return res.status(500).json({ message: 'DB error' }); res.json({ ok:true }) })
  })
})

app.get('/account-details', (req,res)=>{ const d = readData(); res.json(d.details) })
app.put('/account-details', requireAuth, (req,res)=>{ const d = readData(); d.details = req.body; writeData(d); res.json({ ok:true }) })

app.post('/submissions', upload.single('file'), (req,res)=>{
  const d = readData()
  const id = nanoid(8)
  const fileUrl = req.file ? ('/mock-storage/' + req.file.filename) : null
  const item = { id, name: req.body.name, email: req.body.email, method: req.body.method, amount: req.body.amount, txid: req.body.txid, fileUrl, status: 'pending', createdAt: new Date().toISOString() }
  d.submissions.unshift(item)
  writeData(d)
  console.log('New submission:', item)
  res.json({ id })
})

app.get('/submissions', requireAuth, (req,res)=>{ const d = readData(); res.json(d.submissions) })
app.put('/submissions/:id/status', requireAuth, (req,res)=>{ const d = readData(); const it = d.submissions.find(s=>s.id===req.params.id); if(!it) return res.status(404).json({ message:'Not found' }); it.status = req.body.status || it.status; writeData(d); res.json({ ok:true }) })

app.use('/mock-storage', express.static('mock-storage'))

const port = process.env.PORT || 4000
app.listen(port, ()=> console.log('Mock API with auth listening on', port))
