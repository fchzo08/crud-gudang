const cors = require('cors');
app.use(cors({
    origin: 'http://localhost',
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type,Authorization'
}));