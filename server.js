const express = require('express');
const fs = require('fs');
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

// Utility functions for file operations
const readPostsFromFile = () => {
  const data = fs.readFileSync('posts.json');
  return JSON.parse(data);
};

const writePostsToFile = (posts) => {
  fs.writeFileSync('posts.json', JSON.stringify(posts, null, 2));
};

// Initialize posts file if it doesn't exist
if (!fs.existsSync('posts.json')) {
  writePostsToFile([]);
}

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

app.get('/', (req, res) => {
  const posts = readPostsFromFile();
  res.render('index', { posts });
});

app.get('/admin', authMiddleware, (req, res) => {
  const posts = readPostsFromFile();
  res.render('admin', { user: req.user, posts });
});

app.get('/admin/edit/:id', authMiddleware, (req, res) => {
  const posts = readPostsFromFile();
  const post = posts.find(post => post.id === req.params.id);
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

app.post('/api/posts', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  const form = new formidable.IncomingForm();
  form.uploadDir = path.join(__dirname, 'uploads');
  form.keepExtensions = true;

  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(500).send('Error parsing form');
    }
    const { title, content } = fields;
    const mediaUrl = files.media ? `/uploads/${path.basename(files.media.path)}` : '';
    const posts = readPostsFromFile();
    const newPost = {
      id: Date.now().toString(),
      title,
      content,
      imageUrl: files.media && files.media.type.startsWith('image') ? mediaUrl : '',
      videoUrl: files.media && files.media.type.startsWith('video') ? mediaUrl : '',
      createdAt: new Date()
    };
    posts.push(newPost);
    writePostsToFile(posts);
    res.redirect('/admin');
  });
});

app.put('/api/posts/:id', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  const form = new formidable.IncomingForm();
  form.uploadDir = path.join(__dirname, 'uploads');
  form.keepExtensions = true;

  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(500).send('Error parsing form');
    }
    const { title, content } = fields;
    const posts = readPostsFromFile();
    const postIndex = posts.findIndex(post => post.id === req.params.id);
    if (postIndex !== -1) {
      posts[postIndex].title = title;
      posts[postIndex].content = content;
      if (files.media) {
        const mediaUrl = `/uploads/${path.basename(files.media.path)}`;
        if (files.media.type.startsWith('image')) {
          posts[postIndex].imageUrl = mediaUrl;
          posts[postIndex].videoUrl = '';
        } else if (files.media.type.startsWith('video')) {
          posts[postIndex].videoUrl = mediaUrl;
          posts[postIndex].imageUrl = '';
        }
      }
      writePostsToFile(posts);
      res.redirect('/admin');
    } else {
      res.status(404).send('Post not found');
    }
  });
});

app.delete('/api/posts/:id', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  const posts = readPostsFromFile();
  const filteredPosts = posts.filter(post => post.id !== req.params.id);
  writePostsToFile(filteredPosts);
  res.redirect('/admin');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Homepage: http://localhost:${PORT}`);
  console.log(`Admin page: http://localhost:${PORT}/admin`);
});









 