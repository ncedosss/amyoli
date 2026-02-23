const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
// Middleware to protect routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}
const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { generateInvoice } = require('../utils/invoice');
const { generateStatement } = require('../utils/statement');
const { sendInvoiceEmail } = require('../utils/mailer');
const PDFDocument = require('pdfkit');
const { Readable } = require('stream');
const crypto = require('crypto');
const { sendConfirmationEmail } = require('../utils/mailer');

// POST /api/request-password-reset
router.post('/request-password-reset', async (req, res) => {
  try {
    const { emailAddress } = req.body;
    const userResult = await pool.query('SELECT * FROM am."User" WHERE EmailAddress = $1', [emailAddress]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No user found with that email address' });
    }
    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.query('UPDATE am."User" SET ConfirmationToken = $1 WHERE EmailAddress = $2', [resetCode, emailAddress]);
    await sendConfirmationEmail({
      to: emailAddress,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${resetCode}`
    });
    res.json({ success: true, message: 'Password reset code sent to your email.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { emailAddress, code, newPassword } = req.body;
    const userResult = await pool.query('SELECT * FROM am."User" WHERE EmailAddress = $1 AND ConfirmationToken = $2', [emailAddress, code]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid code or email address' });
    }
    const bcrypt = require('bcryptjs');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    await pool.query('UPDATE am."User" SET Password = $1, ConfirmationToken = NULL WHERE EmailAddress = $2', [hashedPassword, emailAddress]);
    res.json({ success: true, message: 'Password has been reset. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/confirm-email
router.post('/confirm-email', async (req, res) => {
  try {
    const { token } = req.body;
    // Find user by token
    const userResult = await pool.query('SELECT * FROM am."User" WHERE ConfirmationToken = $1', [token]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired confirmation token' });
    }
    // Update user as confirmed
    await pool.query('UPDATE am."User" SET Confirmed = TRUE, ConfirmationToken = NULL WHERE Id = $1', [userResult.rows[0].id]);
    res.json({ success: true, message: 'Email confirmed. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// POST /api/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, surname, username, emailAddress, password } = req.body;
    const bcrypt = require('bcryptjs');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // Check if email is authorized
    const authResult = await pool.query('SELECT * FROM am."AuthorizedUserEmails" WHERE EmailAddress = $1', [emailAddress]);
    if (authResult.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized to sign up' });
    }
    // Check if username or email already exists
    const userResult = await pool.query('SELECT * FROM am."User" WHERE Username = $1 OR EmailAddress = $2', [username, emailAddress]);
    if (userResult.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    // Generate 6-digit confirmation code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // Insert user with confirmed = false and code
    await pool.query(
      'INSERT INTO am."User" (Name, Surname, Username, EmailAddress, Password, Confirmed, ConfirmationToken) VALUES ($1, $2, $3, $4, $5, FALSE, $6)',
      [name, surname, username, emailAddress, hashedPassword, code]
    );
    // Send confirmation email with code
    await sendConfirmationEmail({
      to: emailAddress,
      subject: 'Confirm your email',
      text: `Your confirmation code is: ${code}`
    });
    res.status(201).json({ success: true, message: 'Account created. Please confirm your email address.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const bcrypt = require('bcryptjs');
    const userResult = await pool.query('SELECT * FROM am."User" WHERE Username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (!user.confirmed) {
      return res.status(403).json({ error: 'Please confirm your email address before logging in.' });
    }
    // Issue JWT token
    const token = jwt.sign({ id: user.id, username: user.username, emailAddress: user.emailaddress }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, surname: user.surname, username: user.username, emailAddress: user.emailaddress } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trips
router.get('/trips', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.Id, t.Direction, TO_CHAR(t.Trip_Date, 'YYYY-MM-DD') as Trip_Date, t.Deleted, TO_CHAR(t.Date_Created, 'YYYY-MM-DD') as Date_Created,
        d.Name as Driver, d.Surname as Surname, s.Name as ShiftType, r.Rate,
        uc.Username as User_Created, uu.Username as User_Updated
       FROM am."Trip" t
       JOIN am."Driver" d ON t.DriverId = d.Id
       JOIN am."ShiftType" s ON t.ShiftTypeId = s.Id
       JOIN am."ShiftRate" r ON s.Id = r.ShiftTypeId
       LEFT JOIN am."User" uc ON t.User_Created = uc.Id
       LEFT JOIN am."User" uu ON t.User_Updated = uu.Id
       WHERE t.Deleted = FALSE
       ORDER BY t.Id DESC`
    );
    // Format Trip_Date and Date_Created as YYYY-MM-DD to avoid timezone shift
    const rows = result.rows.map(row => ({
      ...row,
      Trip_Date: row.Trip_Date ? row.Trip_Date.toISOString?.().slice(0, 10) || row.Trip_Date : null,
      Date_Created: row.Date_Created ? row.Date_Created.toISOString?.().slice(0, 10) || row.Date_Created : null,
      user_created: row.user_created || row.user_created || '',
      user_updated: row.user_updated || row.user_updated || ''
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/trips/:id (soft delete)
router.delete('/trips/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('UPDATE am."Trip" SET Deleted=TRUE WHERE Id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shift-types
router.get('/shift-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT Id, Name, Description FROM am."ShiftType"');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/drivers
router.get('/drivers', async (req, res) => {
  try {
    const result = await pool.query('SELECT Id, Name, Surname FROM am."Driver"');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shift-rates
router.get('/shift-rates', async (req, res) => {
  try {
    const result = await pool.query('SELECT ShiftTypeId, Rate FROM am."ShiftRate"');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trips (add trip)
router.post('/trips', async (req, res) => {
  try {
    const { shiftType, direction, driver, tripDate, userCreated } = req.body;
    // Get ShiftTypeId
    const shiftTypeResult = await pool.query('SELECT Id FROM am."ShiftType" WHERE Name = $1', [shiftType]);
    if (shiftTypeResult.rows.length === 0) return res.status(400).json({ error: 'Invalid shiftType' });
    const shiftTypeId = shiftTypeResult.rows[0].id;
    // Get DriverId
    const driverResult = await pool.query('SELECT Id FROM am."Driver" WHERE Name = $1', [driver]);
    if (driverResult.rows.length === 0) return res.status(400).json({ error: 'Invalid driver' });
    const driverId = driverResult.rows[0].id;
    // Get UserId
    let userId = null;
    if (userCreated) {
      const userResult = await pool.query('SELECT Id FROM am."User" WHERE Username = $1', [userCreated]);
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }
    // Insert Trip
    const result = await pool.query(
      'INSERT INTO am."Trip" (ShiftTypeId, Direction, DriverId, Trip_Date, User_Created) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [shiftTypeId, direction, driverId, tripDate, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/trips/:id (update trip)
router.put('/trips/:id', async (req, res) => {
  try {
    const { shiftType, direction, driver, tripDate, userUpdated } = req.body;
    const { id } = req.params;
    // Get ShiftTypeId
    const shiftTypeResult = await pool.query('SELECT Id FROM am."ShiftType" WHERE Name = $1', [shiftType]);
    if (shiftTypeResult.rows.length === 0) return res.status(400).json({ error: 'Invalid shiftType' });
    const shiftTypeId = shiftTypeResult.rows[0].id;
    // Get DriverId
    const driverResult = await pool.query('SELECT Id FROM am."Driver" WHERE Name = $1', [driver]);
    if (driverResult.rows.length === 0) return res.status(400).json({ error: 'Invalid driver' });
    const driverId = driverResult.rows[0].id;
    // Get UserId
    let userId = null;
    if (userUpdated) {
      const userResult = await pool.query('SELECT Id FROM am."User" WHERE Username = $1', [userUpdated]);
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }
    // Update Trip
    const result = await pool.query(
      'UPDATE am."Trip" SET ShiftTypeId=$1, Direction=$2, DriverId=$3, Trip_Date=$4, Date_Updated=NOW(), User_Updated=$5 WHERE Id=$6 RETURNING *',
      [shiftTypeId, direction, driverId, tripDate, userId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoice
router.post('/invoice', async (req, res) => {

  try {
    const { invoiceData } = req.body;
    let subTotal = 0;
    invoiceData.rows.forEach(row => {
      const qty = Number(row.qty) || 0;
      const rate = Number(row.rate) || 0;
      const lineTotal = qty * rate;
      subTotal += lineTotal;
    });
    // Insert into Invoice table
    const invoiceInsertResult = await pool.query(
      `INSERT INTO am."Invoice" (Total_Amount)
       VALUES ($1)
       RETURNING Invoice_No`,
      [subTotal]
    );
    const invoiceNo = invoiceInsertResult.rows[0].invoice_no;
    invoiceData.invoiceNo = 'INV' + invoiceNo;
    // Insert each row into Invoice_Detail table
    for (const row of invoiceData.rows) {
      await pool.query(
        `INSERT INTO am."Invoice_Detail" (Invoice_No, Description, Rate, Qty, Amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [invoiceNo, row.description, row.rate, row.qty, row.qty * row.rate]
      );
    }
    // Generate PDF buffer
    const pdfBuffer = generateInvoice(invoiceData);
    // If X-View-Only header is set, just return the PDF (no email)
    if (req.headers['x-view-only'] === 'true') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=invoice_${invoiceNo}.pdf`);
      return res.end(pdfBuffer);
    }
    // Otherwise, send email as before
    let emailSent = true;
    try {
      await sendInvoiceEmail({
        to: 'ncedosss@gmail.com',
        subject: 'Your Invoice',
        text: 'Please find attached your invoice.',
        pdfBuffer
      });
    } catch (err) {
      console.error('Error sending invoice email:', err);
      emailSent = false;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoiceNo}.pdf`);
    res.setHeader('X-Email-Sent', emailSent ? 'true' : 'false');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }

});

// POST /api/statement
router.post('/statement', async (req, res) => {
  try {
    const { invoiceNo } = req.body;
    if (!invoiceNo) {
      return res.status(400).json({ error: 'invoiceNo is required' });
    }

    // Fetch invoice
    const invoiceResult = await pool.query(
      'SELECT * FROM am."Invoice" WHERE Invoice_No = $1',
      [invoiceNo]
    );
    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const invoice = invoiceResult.rows[0];

    // Prepare data for statement
    const statementData = {
      ...invoice
    };

    // Generate statement PDF using statement.js
    const pdfBuffer = generateStatement(statementData);
    // Send statement email
    let emailSent = true;
    try {
      await sendInvoiceEmail({
        to: 'ncedosss@gmail.com',
        subject: 'Your Statement',
        text: 'Please find attached your statement.',
        pdfBuffer
      });
    } catch (err) {
        console.error('Error sending statement email:', err);
      emailSent = false;
    }

    if (!emailSent) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=statement_INV${invoiceNo}.pdf`
      );
      res.setHeader('X-Email-Sent', 'false');
      res.send(pdfBuffer);
    } else {
      res.setHeader('X-Email-Sent', 'true');
      res.json({ success: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// GET /api/invoices
router.get('/invoices', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM am."Invoice" ORDER BY Invoice_No DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
