const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
require('dotenv').config(); // Подключаем dotenv

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(methodOverride('_method'));

mongoose.connect(process.env.MONGODB_URI);

mongoose.connection.on('connected', () => {
  console.log(`Connected to MongoDB at ${process.env.MONGODB_URI}`);
});

mongoose.connection.on('error', (err) => {
  console.log('Error connecting to MongoDB:', err);
});

const PostSchema = new mongoose.Schema({
  title: String,
  content: String,
  imageUrl: String,
  videoUrl: String,
  createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model('Post', PostSchema);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        res.clearCookie('token');
        return res.redirect('/admin');
      }
      req.user = decoded;
      next();
    });
  } else {
    next();
  }
};

app.get('/', async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.render('index', { posts });
});

app.get('/admin', authMiddleware, async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.render('admin', { user: req.user, posts });
});

app.get('/admin/edit/:id', authMiddleware, async (req, res) => {
  const post = await Post.findById(req.params.id);
  res.render('edit', { post });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/admin');
  } else {
    res.status(401).send('Invalid credentials');
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

app.post('/api/posts', authMiddleware, upload.single('media'), async (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  const { title, content } = req.body;
  const mediaUrl = req.file ? `/uploads/${req.file.filename}` : '';
  const post = new Post({
    title,
    content,
    imageUrl: req.file && req.file.mimetype.startsWith('image') ? mediaUrl : '',
    videoUrl: req.file && req.file.mimetype.startsWith('video') ? mediaUrl : '',
  });
  await post.save();
  res.redirect('/admin');
});

app.put('/api/posts/:id', authMiddleware, upload.single('media'), async (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  const { title, content } = req.body;
  const post = await Post.findById(req.params.id);
  post.title = title;
  post.content = content;
  if (req.file) {
    const mediaUrl = `/uploads/${req.file.filename}`;
    if (req.file.mimetype.startsWith('image')) {
      post.imageUrl = mediaUrl;
      post.videoUrl = '';
    } else if (req.file.mimetype.startsWith('video')) {
      post.videoUrl = mediaUrl;
      post.imageUrl = '';
    }
  }
  await post.save();
  res.redirect('/admin');
});

app.delete('/api/posts/:id', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  await Post.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Homepage: http://localhost:${PORT}`);
  console.log(`Admin page: http://localhost:${PORT}/admin`);
});







 