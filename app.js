const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const createDatabase = require('./utils/dbSetup');
createDatabase();

const routes = {
    api: require('./services/alexicon/api'),
    block: require('./services/alexicon/block'),
    follow: require('./services/alexicon/follow'),
    on: require('./services/alexicon/on'),
    login: require('./services/alexicon/login'),
    register: require('./services/alexicon/register'),
    retrieve: require('./services/alexicon/retrieve'),
    update_pass: require('./services/alexicon/update_pass'),
    update_pics: require('./services/alexicon/update_pics'),
    upload: require('./services/alexicon/upload'),
    comment: require('./services/yipnet/comment'),
    get_single_comment: require('./services/yipnet/get_single_comment'),
    get_single_post: require('./services/yipnet/get_single_post'),
    list_comments: require('./services/yipnet/list_comments'),
    list_posts: require('./services/yipnet/list_posts'),
    newsfeed: require('./services/yipnet/newsfeed'),
    post: require('./services/yipnet/post'),
    vote: require('./services/yipnet/vote'),
};

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Routes:
app.use('/alexicon', routes.api);
app.use('/alexicon', routes.block);
app.use('/alexicon', routes.follow);
app.use('/alexicon', routes.on);
app.use('/alexicon', routes.login);
app.use('/alexicon', routes.register);
app.use('/alexicon', routes.retrieve);
app.use('/alexicon', routes.update_pass);
app.use('/alexicon', routes.update_pics);
app.use('/alexicon', routes.upload);
app.use('/yipnet', routes.comment);
app.use('/yipnet', routes.get_single_comment);
app.use('/yipnet', routes.get_single_post);
app.use('/yipnet', routes.list_comments);
app.use('/yipnet', routes.list_posts);
app.use('/yipnet', routes.newsfeed);
app.use('/yipnet', routes.post);
app.use('/yipnet', routes.vote);

app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Server:
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
