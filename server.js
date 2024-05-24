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
    return res.status(400).json({ message: 'Access denied. Token is required'});
  }

  try {
    const response = await axios.post('https://auth-gudang-dot-f-03-415104.et.r.appspot.com/a/verifyToken', { token: token.split(' ')[1] });
    req.userId = response.data.userId;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(400).json({ message: 'Access denied. Invalid token'});
  }
}

//Endpoint /
app.get('/',(req, res) => {
  res.send('Database');
})

// Endpoint register
app.post('/db/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username or password is missing' });
  }

    // Hash password sebelum disimpan ke database
    const hashedPassword = await bcrypt.hash(password, 10);
    
    mysqlConnection.query(
      'INSERT INTO user (username, password) VALUES (?, ?)',
      [username, hashedPassword], 
      async (err, result) => {
        if(err) {
          console.error('Error registering user:', err);
          res.status(500).json({ message: 'Error registering user'});
        } else {
          res.status(201).json({ message: 'registered successfully' });
        }
    })
});

//Endpoint login

app.post('/db/login', async (req, res) => {
  const { username, password } = req.body;

  // Memeriksa apakah username atau password kosong
  if (!username || !password) {
      return res.status(400).json({ message: 'Username or password is missing' });
  }

  mysqlConnection.query(
      'SELECT * FROM user WHERE username = ?',
      [username],
      async (err, results) => {
          if (err) {
              // Database query error
              console.error('Error logging in:', err);
              res.status(500).json({ message: 'Error logging in' });
          } else {
              // Check if user with the given username exists
              if (results.length === 0) {
                  res.status(401).json({ message: 'Invalid username or password' });
                  return;
              }

              const user = results[0];

              const passwordMatch = await bcrypt.compare(password, user.password);

              if (passwordMatch) {
                  axios.post('https://auth-gudang-dot-f-03-415104.et.r.appspot.com/a/getToken', { userId: user.id_user })
                      .then(response => {
                          const { token } = response.data;
                          res.json({ message: 'Login successful', token });
                      })
                      .catch(error => {
                          console.error('Error getting token:', error);
                          res.status(500).json({ message: 'Error getting token' });
                      });
              } else {
                  // Passwords do not match
                  res.status(401).json({ message: 'Invalid username or password' });
              }
          }
      }
  );
});

// Endpoint getAllProfile
app.get('/db/profile',verifyToken, (req, res) => {
  
    mysqlConnection.query('SELECT * FROM user', (err, results) => {
      if (err) {
        res.status(500).json({ message: 'Error fetching profile' });
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
        res.status(500).json({ message: 'Error deleting user'});
      } else {
        res.status(201).json({ message: 'User deleted successfully'});
      }
    });
});

//Endpoint getAllGudang
app.get('/db/gudang',verifyToken, (req, res) => {
    mysqlConnection.query('SELECT * FROM gudang', (err, results) => {
      if (err) {
        res.status(500).json({ message: 'Error fetching warehouses'});
      } else {
        res.json(results);
      }
    });
});

//Endpoint add gudang
app.post('/db/gudang',verifyToken, (req, res) => {
  const { name, address } = req.body;
  mysqlConnection.query(
      'INSERT INTO gudang (name, address) VALUES (?, ?)',
      [name, address],
      (err, result) => {
          if (err) {
              res.status(500).json({ message: 'Error creating warehouse' });
          } else {
              res.status(201).json({ message: 'Warehouse created successfully' });
          }
      }
  );
});

//endpoint delete gudang
app.delete('/db/gudang/:id', verifyToken, (req, res) => {
    const id = req.params.id;
    mysqlConnection.query('DELETE FROM gudang WHERE id_gudang = ?', [id], (err, result) => {
      if (err) {
        console.error('Error deleting warehouse:', err);
        res.status(500).json({ message: 'Gudang Masih Disewa' });
      } else {
        res.status(201).json({ message: 'Warehouse deleted successfully' });
      }
    });
});

//Endpoint getAllSewa
app.get('/db/sewa',verifyToken, (req, res) => {
  mysqlConnection.query(
    'SELECT penyewaan.*, gudang.name AS nama_gudang FROM penyewaan JOIN gudang ON penyewaan.id_gudang = gudang.id_gudang;', (err, results) => {
    if (err) {
      res.status(500).json({ message: 'Error fetching rental'});
    } else {
      res.json(results);
    }
  });
});

//Endpoit addSewa
app.post('/db/sewa', verifyToken, (req, res) => {
  const { penyewa, id_gudang } = req.body;
  mysqlConnection.beginTransaction(err => {
    if (err) {
      return res.status(500).json({ message: 'Error beginning transaction' });
    }

    mysqlConnection.query('INSERT INTO penyewaan (penyewa, id_gudang) VALUES (?, ?)', [penyewa, id_gudang], (err, results) => {
      if (err) {
        mysqlConnection.rollback(() => {
          res.status(500).json({ message: 'Error inserting rental' });
        });
      } else {
        mysqlConnection.query('UPDATE gudang SET status = 1 WHERE id_gudang = ?', [id_gudang], (err, results) => {
          if (err) {
           res.status(500).json({ message: 'Error updating warehouse status' });
          } else {
          res.status(200).json({ message: 'Rental created successfully' });
          }
        });
      }
    });
  });
});

//Endpoit sewa by id
app.get('/db/sewa/:id', verifyToken, (req, res) => {
  const rentalId = req.params.id;
  const query = `
    SELECT penyewaan.*, gudang.name AS nama_gudang 
    FROM penyewaan 
    JOIN gudang ON penyewaan.id_gudang = gudang.id_gudang 
    WHERE penyewaan.id_penyewaan = ?;
  `;

  mysqlConnection.query(query, [rentalId], (err, results) => {
    if (err) {
      res.status(500).json({ message: 'Error fetching rental' });
    } else {
      res.json(results);
    }
  });
});

// Endpoint update sewa
app.put('/db/sewa/:id', verifyToken, (req, res) => {
    const { penyewa, status } = req.body;
    const id = req.params.id;
    if (!penyewa) {
      return res.status(400).json({ message: 'column is missing' });
  }
    mysqlConnection.query(
      'UPDATE penyewaan SET penyewa = ? WHERE id_penyewaan = ?',
      [penyewa, id],
      (err, result) => {
        if (err) {
          console.error('Error undate rental entry:', err);
          res.status(500).json({ message: 'Error rental update' });
        } else {
          res.status(201).json({ message: 'Rental update successfully' });
        }
      }
    );
});

//endpoint delete penyewaan
app.delete('/db/sewa/:id', verifyToken, (req, res) => {
  const id = req.params.id;
  mysqlConnection.query('SELECT * FROM penyewaan WHERE id_penyewaan = ?', [id], (err, result) => {
    if (err) {
      res.status(500).json({ message: 'Error getting rental' });
    } else if (result.length === 0) {
      res.status(404).json({ message: 'Rental not found' });
    } else {
      const warehouseId = result[0].id_gudang;

      mysqlConnection.query('DELETE FROM penyewaan WHERE id_penyewaan = ?', [id], (err, result) => {
        if (err) {
          res.status(500).json({ message: 'Error deleting rental' });
        } else {
          mysqlConnection.query('UPDATE gudang SET status = 0 WHERE id_gudang = ?', [warehouseId], (err, results) => {
            if (err) {
              res.status(500).json({ message: 'Error updating warehouse status' });
            } else {
              res.status(200).json({ message: 'Rental deleted successfully' });
            }
          });
        }
      });
    }
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`server listening on port ${PORT}...`);
});
