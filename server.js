const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const formidable = require('formidable');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(methodOverride('_method'));

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB', err);
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
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.render('index', { posts });
  } catch (err) {
    res.status(500).send('Error retrieving posts');
  }
});

app.get('/admin', authMiddleware, async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.render('admin', { user: req.user, posts });
  } catch (err) {
    res.status(500).send('Error retrieving posts');
  }
});

app.get('/admin/edit/:id', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    res.render('edit', { post });
  } catch (err) {
    res.status(500).send('Error retrieving post');
  }
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

app.post('/api/posts', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  const form = new formidable.IncomingForm();
  form.uploadDir = path.join(__dirname, 'uploads');
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).send('Error parsing form');
    }
    const { title, content } = fields;
    const mediaUrl = files.media ? `/uploads/${path.basename(files.media.path)}` : '';
    const post = new Post({
      title,
      content,
      imageUrl: files.media && files.media.type.startsWith('image') ? mediaUrl : '',
      videoUrl: files.media && files.media.type.startsWith('video') ? mediaUrl : '',
    });
    try {
      await post.save();
      res.redirect('/admin');
    } catch (err) {
      res.status(500).send('Error saving post');
    }
  });
});

app.put('/api/posts/:id', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  const form = new formidable.IncomingForm();
  form.uploadDir = path.join(__dirname, 'uploads');
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).send('Error parsing form');
    }
    const { title, content } = fields;
    const post = await Post.findById(req.params.id);
    post.title = title;
    post.content = content;
    if (files.media) {
      const mediaUrl = `/uploads/${path.basename(files.media.path)}`;
      if (files.media.type.startsWith('image')) {
        post.imageUrl = mediaUrl;
        post.videoUrl = '';
      } else if (files.media.type.startsWith('video')) {
        post.videoUrl = mediaUrl;
        post.imageUrl = '';
      }
    }
    try {
      await post.save();
      res.redirect('/admin');
    } catch (err) {
      res.status(500).send('Error updating post');
    }
  });
});

app.delete('/api/posts/:id', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Error deleting post');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Homepage: http://localhost:${PORT}`);
  console.log(`Admin page: http://localhost:${PORT}/admin`);
});







 