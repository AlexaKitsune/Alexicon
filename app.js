const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const createDatabase = require('./utils/dbSetup');
createDatabase();

const app = express();
const server = http.createServer(app);

const { initSocket } = require('./utils/socket');
initSocket(server); // Socket.IO inicializado UNA VEZ aquí

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const routes = {
    api: require('./services/alexicon/api'),
    block: require('./services/alexicon/block'),
    follow: require('./services/alexicon/follow'),
    on: require('./services/alexicon/on'),
    login: require('./services/alexicon/login'),
    logout: require('./services/alexicon/logout'),
    notification_seen: require('./services/alexicon/notification_seen'),
    notifications: require('./services/alexicon/notifications'),
    register: require('./services/alexicon/register'),
    report: require('./services/alexicon/report'),
    retrieve_users: require('./services/alexicon/retrieve_users'),
    retrieve: require('./services/alexicon/retrieve'),
    update_pass: require('./services/alexicon/update_pass'),
    update_pics: require('./services/alexicon/update_pics'),
    update_profile: require('./services/alexicon/update_profile'),
    upload: require('./services/alexicon/upload'),

    comment: require('./services/yipnet/comment'),
    delete: require('./services/yipnet/delete'),
    get_messages: require('./services/yipnet/get_messages'),
    get_single_comment: require('./services/yipnet/get_single_comment'),
    get_single_post: require('./services/yipnet/get_single_post'),
    list_comments: require('./services/yipnet/list_comments'),
    list_posts: require('./services/yipnet/list_posts'),
    message: require('./services/yipnet/message'),
    newsfeed: require('./services/yipnet/newsfeed'),
    post: require('./services/yipnet/post'),
    retrieve_posts: require('./services/yipnet/retrieve_posts'),
    vote: require('./services/yipnet/vote'),
};

// Routes:
app.use('/alexicon', routes.api);
app.use('/alexicon', routes.block);
app.use('/alexicon', routes.follow);
app.use('/alexicon', routes.on);
app.use('/alexicon', routes.login);
app.use('/alexicon', routes.logout);
app.use('/alexicon', routes.notification_seen);
app.use('/alexicon', routes.notifications);
app.use('/alexicon', routes.register);
app.use('/alexicon', routes.report);
app.use('/alexicon', routes.retrieve_users);
app.use('/alexicon', routes.retrieve);
app.use('/alexicon', routes.update_pass);
app.use('/alexicon', routes.update_pics);
app.use('/alexicon', routes.update_profile);
app.use('/alexicon', routes.upload);
app.use('/yipnet', routes.comment);
app.use('/yipnet', routes.delete);
app.use('/yipnet', routes.get_messages);
app.use('/yipnet', routes.get_single_comment);
app.use('/yipnet', routes.get_single_post);
app.use('/yipnet', routes.list_comments);
app.use('/yipnet', routes.list_posts);
app.use('/yipnet', routes.message);
app.use('/yipnet', routes.newsfeed);
app.use('/yipnet', routes.post);
app.use('/yipnet', routes.retrieve_posts);
app.use('/yipnet', routes.vote);

app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Server:
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
