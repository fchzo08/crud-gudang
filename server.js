const express = require('express');
const bodyParser = require('body-parser');
const mysqlConnection = require('./db');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const app = express();
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE, PATCH");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});
app.use(bodyParser.json());

async function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).send('Access denied. Token is required');
  }

  try {
    const response = await axios.post('https://auth-gudang-dot-f-03-415104.et.r.appspot.com/a/verifyToken', { token: token.split(' ')[1] });
    req.userId = response.data.userId;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(403).send('Access denied. Invalid token');
  }
}

//Endpoint /
app.get('/',(req, res) => {
  res.send('Database');
})

// Endpoint register
app.post('/db/register', async (req, res) => {
    const { username, password } = req.body;
    
    // Hash password sebelum disimpan ke database
    const hashedPassword = await bcrypt.hash(password, 10);
  
    const query = 'INSERT INTO user (username, password) VALUES (?, ?)';
    try {
      await mysqlConnection.query(query, [username, hashedPassword]);
      res.status(201).send('User registered successfully');
      const { response } = "Sukses";
              res.json({ response });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).send('Error registering user');
    }
});

//Endpoint login
app.post('/db/login', (req, res) => {
    const { username, password } = req.body;
    
    // Retrieve user from the database by username
    mysqlConnection.query(
      'SELECT * FROM user WHERE username = ?',
      [username],
      async (err, results) => {
        if (err) {
          // Database query error
          console.error('Error logging in:', err);
          res.status(500).send('Error logging in');
        } else {
          // Check if user with the given username exists
          if (results.length === 0) {
            res.status(401).send('Invalid username');
            return;
          }
  
          const user = results[0];
  
          const passwordMatch = await bcrypt.compare(password, user.password);
  
          if (passwordMatch) {
            axios.post('https://auth-gudang-dot-f-03-415104.et.r.appspot.com/a/getToken', { userId: user.id_user })
            .then(response => {
              const { token } = response.data;
              res.json({ token });
            })
            .catch(error => {
              console.error('Error getting token:', error);
              res.status(500).send('Error getting token');
            });
          } else {
            // Passwords do not match
            res.status(401).send('Invalid password');
          }
        }
      }
    );
});


// Endpoint getAllProfile
app.get('/db/allprofile', (req, res) => {
  
    mysqlConnection.query('SELECT * FROM user', (err, results) => {
      if (err) {
        res.status(500).send('Error fetching profile');
      } else {
        res.json(results);
      }
    })
});

// Endpont deleteProfile
app.delete('/db/profile/:id',verifyToken, (req, res)=> {
    const id = req.params.id
    mysqlConnection.query('DELETE FROM user WHERE id_user = ?', [id], (err, result)=> {
      if (err) {
        res.status(500).send('Error deleting user');
      } else {
        res.send('User deleted successfully');
      }
    });
});


//Endpoint getAllGudang
app.get('/db/gudang', (req, res) => {
    mysqlConnection.query('SELECT * FROM gudang', (err, results) => {
      if (err) {
        res.status(500).send('Error fetching warehouses');
      } else {
        res.json(results);
      }
    });
});

//Endpoint add gudang
app.post('/db/gudang',verifyToken, (req, res) => {
    const { nama, status, penyewaan } = req.body;
    mysqlConnection.query(
      'INSERT INTO gudang (nama, status, penyewaan) VALUES (?, ?, ?)',
      [nama, status, penyewaan],
      (err, result) => {
        if (err) {
          res.status(500).send('Error creating warehouse');
        } else {
          res.status(201).send('Warehouse created successfully');
        }
      }
    );
});

//Endpoint update gudang
app.put('/db/gudang/:id',verifyToken, (req, res) => {
    const { nama, status, penyewaan } = req.body;
    const id = req.params.id;
    mysqlConnection.query(
      'UPDATE gudang SET nama = ?, status = ?, penyewaan = ? WHERE id_gudang = ?',
      [nama, status, penyewaan, id],
      (err, result) => {
        if (err) {
          res.status(500).send('Error updating warehouse');
        } else {
          res.send('Warehouse updated successfully');
        }
      }
    );
});

//endpoint delete gudang
app.delete('/db/gudang/:id',verifyToken, (req, res) => {
    const id = req.params.id;
    mysqlConnection.query('DELETE FROM gudang WHERE id_gudang = ?', [id], (err, result) => {
      if (err) {
        res.status(500).send('Error deleting warehouse');
      } else {
        res.send('Warehouse deleted successfully');
      }
    });
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`server listening on port ${PORT}...`);
});
