const mysql = require('mysql');

const connection = mysql.createConnection({
  host: '34.128.126.223',
  user: 'root',
  password: '',
  database: 'gudang-cc-v3'
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database: ' + err.stack);
    return;
  }
  console.log('Connected to database as ID ' + connection.threadId);
});

module.exports = connection;
