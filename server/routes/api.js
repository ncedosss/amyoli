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
const fs = require("fs");
const path = require("path");
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

// Excel import dependencies
const multer = require('multer');
const xlsx = require('xlsx');
const ExcelJS = require("exceljs");

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
    const { invoiceMonth } = req.query;
    let query = `SELECT t.Id, t.Direction, TO_CHAR(t.Trip_Date, 'YYYY-MM-DD') as Trip_Date, t.Deleted, TO_CHAR(t.Date_Created, 'YYYY-MM-DD') as Date_Created,
        d.Name as Client, s.Name as ShiftType, r.Rate,
        uc.Username as User_Created, uu.Username as User_Updated,
        t.Invoice_Month, t.invoice_id
       FROM am."Trip" t
       JOIN am."Client" d ON t.ClientId = d.Id
       JOIN am."ShiftType" s ON t.ShiftTypeId = s.Id
       JOIN am."ShiftRate" r ON s.Id = r.ShiftTypeId
       LEFT JOIN am."User" uc ON t.User_Created = uc.Id
       LEFT JOIN am."User" uu ON t.User_Updated = uu.Id
       WHERE t.Deleted = FALSE`;
    let params = [];
    if (invoiceMonth) {
      query += ' AND t.Invoice_Month = $1';
      params.push(invoiceMonth);
    }
    query += ' ORDER BY t.Id DESC';
    const result = await pool.query(query, params);
    // Format Trip_Date and Date_Created as YYYY-MM-DD to avoid timezone shift
    const rows = result.rows.map(row => ({
      ...row,
      Trip_Date: row.Trip_Date ? row.Trip_Date.toISOString?.().slice(0, 10) || row.Trip_Date : null,
      Date_Created: row.Date_Created ? row.Date_Created.toISOString?.().slice(0, 10) || row.Date_Created : null,
      user_created: row.user_created || row.user_created || '',
      user_updated: row.user_updated || row.user_updated || '',
      invoice_id: row.invoice_id || null
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

// GET /api/clients
router.get('/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT Id, Name FROM am."Client"');
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
    const { shiftType, direction, clientid, tripDate, userCreated, returnTrip, invoiceMonth } = req.body;
    // Get ShiftTypeId
    const shiftTypeResult = await pool.query('SELECT Id FROM am."ShiftType" WHERE Name = $1', [shiftType]);
    if (shiftTypeResult.rows.length === 0) return res.status(400).json({ error: 'Invalid shiftType' });
    const shiftTypeId = shiftTypeResult.rows[0].id;
    // Get ClientId
    const clientResult = await pool.query('SELECT Id FROM am."Client" WHERE Name = $1', [clientid]);
    if (clientResult.rows.length === 0) return res.status(400).json({ error: 'Invalid client' });
    const clientId = clientResult.rows[0].id;
    // Get UserId
    let userId = null;
    if (userCreated) {
      const userResult = await pool.query('SELECT Id FROM am."User" WHERE Username = $1', [userCreated]);
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }
    // Insert main trip
    const result = await pool.query(
      'INSERT INTO am."Trip" (ShiftTypeId, Direction, ClientId, Trip_Date, User_Created, Invoice_Month) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [shiftTypeId, direction, clientId, tripDate, userId, invoiceMonth]
    );
    let trips = [result.rows[0]];
    // If returnTrip is true, insert return trip with special shiftType logic
    if (returnTrip) {
      let returnDirection = direction;
      let returnShiftType = shiftType;
      const shiftMap = {
        csv_toWork: 'csv_fromWork',
        csv_atlantisToWork: 'csv_atlantisFromWork',
        lesedi_ToWork: 'lesedi_ToHome',
        lesediPainters_ToWork: 'lesediPainters_ToHome',
        lesedi_ElegantRoofing_toWork: 'lesedi_ElegantRoofing_toHome',
      };
      if (direction === 'To Work') returnDirection = 'To Home';
      else if (direction === 'To Home') returnDirection = 'To Work';
      
      returnShiftType = shiftMap[shiftType] ?? shiftType;

      const returnShiftTypeResult = await pool.query('SELECT Id FROM am."ShiftType" WHERE Name = $1', [returnShiftType]);
      if (returnShiftTypeResult.rows.length === 0) return res.status(400).json({ error: 'Invalid return shiftType' });
      const returnShiftTypeId = returnShiftTypeResult.rows[0].id;
      const returnResult = await pool.query(
        'INSERT INTO am."Trip" (ShiftTypeId, Direction, ClientId, Trip_Date, User_Created, Invoice_Month) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [returnShiftTypeId, returnDirection, clientId, tripDate, userId, invoiceMonth]
      );
      trips.push(returnResult.rows[0]);
    }
    res.status(201).json(trips.length === 1 ? trips[0] : trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/trips/:id (update trip)
router.put('/trips/:id', async (req, res) => {
  try {
    const { shiftType, direction, clientid, tripDate, userUpdated } = req.body;
    const { id } = req.params;
    // Get ShiftTypeId
    const shiftTypeResult = await pool.query('SELECT Id FROM am."ShiftType" WHERE Name = $1', [shiftType]);
    if (shiftTypeResult.rows.length === 0) return res.status(400).json({ error: 'Invalid shiftType' });
    const shiftTypeId = shiftTypeResult.rows[0].id;
    // Get ClientId
    const clientResult = await pool.query('SELECT Id FROM am."Client" WHERE Name = $1', [clientid]);
    if (clientResult.rows.length === 0) return res.status(400).json({ error: 'Invalid client' });
    const clientId = clientResult.rows[0].id;
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
      'UPDATE am."Trip" SET ShiftTypeId=$1, Direction=$2, ClientId=$3, Trip_Date=$4, Date_Updated=NOW(), User_Updated=$5 WHERE Id=$6 RETURNING *',
      [shiftTypeId, direction, clientId, tripDate, userId, id]
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
    const { invoiceData, tripIds } = req.body;
    // If X-View-Only header is set, do NOT generate or insert a new invoice, just generate a receipt/preview
    if (req.headers['x-view-only'] === 'true') {
      // Optionally, you can fetch an existing invoice number if provided, or just generate a receipt preview
      // If invoiceData.invoiceNo exists, use it for the filename, otherwise use 'receipt'
      const pdfBuffer = generateInvoice(invoiceData); // Or use a generateReceipt() if you want a different format
      res.setHeader('Content-Type', 'application/pdf');
      const filename = invoiceData.invoiceNo ? `receipt_${invoiceData.invoiceNo}.pdf` : 'receipt_preview.pdf';
      res.setHeader('Content-Disposition', `inline; filename=${filename}`);
      return res.end(pdfBuffer);
    }
    // ...existing code for generating and saving a new invoice...
    const clientMap = {
      'Lesedi Painters R400': 'LNS010',
      'Atlantis Foundaries': 'AF005',
      'Lesedi CSV': 'LNS010'
    };
    const customerId = clientMap[invoiceData.client] || 'UNKNOWN';
    let subTotal = 0;
    invoiceData.rows.forEach(row => {
      const qty = Number(row.qty) || 0;
      const rate = Number(row.rate) || 0;
      const lineTotal = qty * rate;
      subTotal += lineTotal;
    });

    const existing = await pool.query(`
      SELECT id FROM am."Trip"
      WHERE id = ANY($1::int[])
      AND invoice_id IS NOT NULL
    `, [tripIds]);

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'Some trips are already invoiced'
      });
    }
    let invoiceNo;
    let invoiceId;
    await pool.query('BEGIN');
    try {
      // insert invoice
      // Insert into Invoice table
      const invoiceInsertResult = await pool.query(
        `INSERT INTO am."Invoice" (Customer_Id, Total_Amount)
        VALUES ($1, $2)
        RETURNING "invoice_no", id`,
        [customerId, subTotal]
      );
      invoiceNo = invoiceInsertResult.rows[0].invoice_no;
      invoiceId = invoiceInsertResult.rows[0].id;
      // insert details
      invoiceData.invoiceNo = 'INV' + invoiceNo;
      // Insert each row into Invoice_Detail table
      for (const row of invoiceData.rows) {
        await pool.query(
          `INSERT INTO am."Invoice_Detail" (invoice_id, Description, Rate, Qty, Amount)
          VALUES ($1, $2, $3, $4, $5)`,
          [invoiceId, row.description, row.rate, row.qty, row.qty * row.rate]
        );
      }
      // update trips
      if (tripIds && tripIds.length > 0) {
        await pool.query(`
          UPDATE am."Trip"
          SET invoice_id = $1
          WHERE id = ANY($2::int[])
          AND invoice_id IS NULL
        `, [invoiceId, tripIds]);
      }
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

    // Generate PDF buffer
    const pdfBuffer = generateInvoice(invoiceData);
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
    const { invoiceId, invoiceNo } = req.body;
    if (!invoiceId || !invoiceNo) {
      return res.status(400).json({ error: 'invoiceId and invoiceNo are required' });
    }

    // Fetch invoice
    const invoiceResult = await pool.query(
      'SELECT * FROM am."Invoice" WHERE id = $1',
      [invoiceId]
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
        pdfBuffer,
        filename: 'Account_Statement'
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

const upload = multer({ dest: "uploads/" }); // ✅ no memoryStorage

router.post("/trips/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const excelIndex = Number(req.body.excelIndex);

    const isWeekendMode =
      req.body.excelIndex !== "8" &&
      req.body.excelIndex !== "14" &&
      req.body.excelIndex === "15";

    let result = {};

    // =========================================================
    // ✅ WEEKEND MODE (UNCHANGED LOGIC)
    // =========================================================
    if (isWeekendMode) {

      const workbook = xlsx.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows = xlsx.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false
      });

      const cleanedData = rows.filter(row =>
        row.some(cell => cell !== "" && cell !== null && cell !== undefined)
      );

      if (cleanedData.length === 0) {
        return res.status(400).json({ error: "Excel file is empty" });
      }

      const headerRowIndex = 2;
      const weekendHeaderRow = cleanedData[1];

      const weekendDateColumns = [];
      // 🔥 FIXED: dynamic detection instead of i+=5
      for (let i = excelIndex; i <= excelIndex + 5; i += 5) {
        const val = weekendHeaderRow[i];
        console.log(`Checking column ${i} with value "${val}" for date pattern`);

        if (typeof val === "string" && /\d{1,2}\/\d{1,2}/.test(val)) {
          weekendDateColumns.push({
            date: val,
            startIndex: i
          });
        }
      }

      console.log("Weekend columns:", weekendDateColumns);

      result = getWeekendResults(cleanedData, weekendDateColumns, headerRowIndex);
    }

    // =========================================================
    // ✅ NORMAL MODE (STREAMING FIX)
    // =========================================================
    else {

      let rowIndex = 0;
      let headerFound = false;

      let dateRow = null;
      let dateColumns = [];

      const getCellValue = (row, index) => {
        const val = row.getCell(index).value;

        if (!val) return "";

        // ✅ handle Excel date numbers
        if (typeof val === "number") {
          return excelDateToString(val);
        }

        if (typeof val === "object") {
          return String(val.text || val.result || "");
        }

        return String(val);
      };

      const workbook = new ExcelJS.stream.xlsx.WorkbookReader(req.file.path);

      for await (const worksheet of workbook) {

        // ✅ ONLY Database tab
        if (!worksheet.name.toLowerCase().includes("database")) continue;

        for await (const row of worksheet) {

          rowIndex++;

          // ✅ FIND HEADER ROW (same idea, but dynamic position)
          if (!dateRow) {
            let matches = 0;

            for (let i = excelIndex; i <= excelIndex + 4; i++) {
              const val = getCellValue(row, i);
              console.log(`Checking row ${rowIndex} column ${i} with value "${val}" for date pattern`);

              if (/\d{1,2}\/\d{1,2}/.test(val)) {
                matches++;
              }
            }

            if (matches >= 2) {
              dateRow = row;
              console.log("Header row found at:", rowIndex);
              continue;
            }
          }

          // ✅ BUILD dateColumns EXACTLY like old version
          if (dateRow && !headerFound) {

            for (let i = excelIndex; i <= excelIndex + 4; i++) {

              let headerValue = "";

              if (req.body.excelIndex === "8") {
                const raw = getCellValue(dateRow, i);
                headerValue = normalizeDate(raw);
              } else if (req.body.excelIndex === "14") {
                headerValue = getCellValue(dateRow, i);
              } else {
                headerValue = getCellValue(dateRow, i);
              }

              if (
                typeof headerValue === "string" &&
                headerValue.match(/\d{1,2}\/\d{1,2}/)
              ) {
                dateColumns.push({
                  date: headerValue,
                  index: i
                });
              }
            }

            console.log("Date columns:", dateColumns);

            headerFound = true;
            continue;
          }

          // ✅ PROCESS DATA ROWS
          if (headerFound) {

            dateColumns.forEach(({ date, index }) => {
              const val = getCellValue(row, index).trim().toUpperCase();

              if (!result[date]) {
                result[date] = { D: 0, A: 0, N: 0 };
              }

              // ✅ YOUR ACTUAL DATA VALUES
              if (val === "D") result[date].D++;
              if (val === "A") result[date].A++;
              if (val === "N") result[date].N++;

              // ignore OFF
            });
          }
        }
      }
    }

    console.log("Result:", result);

    const tripsPerDay = isWeekendMode
      ? calculateTripsPerDay(result)
      : calculateTripsPerDay(result, "normal");

    const filteredTrips = Object.fromEntries(
      Object.entries(tripsPerDay).filter(
        ([, value]) => value.totalTrips > 0
      )
    );

    console.log("FilteredTrips:", filteredTrips);

    const invoiceMonth = getInvoiceMonth();

    const shiftTypeMap = isWeekendMode
      ? { D: 5, A: 5, N: 5, "77": 6 }
      : { D: 1, A: 2, N: 3, Staff: 7 };

    // =========================================================
    // ✅ BATCH INSERT (CRITICAL FIX)
    // =========================================================

    const BATCH_SIZE = 2000;
    let batch = [];

    const flushBatch = async () => {
      if (batch.length === 0) return;

      const query = `
        INSERT INTO am."Trip"
        (ShiftTypeId, Direction, ClientId, Trip_Date, Invoice_Month)
        VALUES ${batch.map((_, i) =>
          `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
        ).join(",")}
      `;

      await pool.query(query, batch.flat());
      batch = [];
    };

    for (const [date, shifts] of Object.entries(filteredTrips)) {
      const isoDate = convertToISO(date);

      for (const [shiftKey, shiftTypeId] of Object.entries(shiftTypeMap)) {

        const pushTrip = async (direction) => {
          batch.push([shiftTypeId, direction, 1, isoDate, invoiceMonth]);

          if (batch.length >= BATCH_SIZE) {
            await flushBatch();
          }
        };

        if (shiftKey === "D") {
          const toWork = shifts.D?.toWorkTrips || 0;
          const toHome = shifts.D?.toHomeTrips || 0;

          for (let i = 0; i < toWork; i++) await pushTrip("To Work");
          for (let i = 0; i < toHome; i++) await pushTrip("To Home");
          continue;
        }

        if (shiftKey === "Staff") {
          const staffTrips = shifts.Staff?.trips || 0;
          for (let i = 0; i < staffTrips; i++) {
            await pushTrip("To Home");
          }
          continue;
        }

        const taxis = shifts[shiftKey]?.taxis || 0;

        for (let i = 0; i < taxis; i++) {
          await pushTrip("To Work");
          await pushTrip("To Home");
        }
      }
    }

    await flushBatch();

    console.log("Trips inserted");

    // =========================================================
    // ✅ EMAIL (UNCHANGED)
    // =========================================================
    try {
    const pdfPath = await generateTripsPDF(filteredTrips);

    await sendInvoiceEmail({
      to: "ncedosss@gmail.com",
      subject: "Trips Imported",
      text: "Please find attached your trips report.",
      pdfBuffer: pdfPath,
      filename: "Trips_Report.pdf"
    });
      console.log("Email sent");
    } catch (err) {
      console.error("Email error:", err);
    }

    res.json({ success: true });

  } catch (err) {
    console.error("IMPORT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/excel-index-configuration
router.get('/excel-index-configuration', async (req, res) => {
  try {
    const result = await pool.query('SELECT index, client FROM am."ExcelIndexConfiguration" ORDER BY client');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
function normalizeDate(dateStr) {
  if (!dateStr) return null;

  // Example input: "26.01.26"
  const parts = dateStr.split(".");

  if (parts.length >= 2) {
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    return `${day}/${month}`;
  }

  return null;
}
function calculateTaxis(count) {
  if (!count || count <= 0) return 0;
  return Math.ceil(count / 12);
}
function calculateTripsPerDay(shiftCounts, shiftType = '') {

  const result = {};

  Object.entries(shiftCounts).forEach(([date, shifts]) => {

    const taxisD = calculateTaxis(shifts.D);
    const taxisA = calculateTaxis(shifts.A);
    const taxisN = calculateTaxis(shifts.N);
    const taxis77 = calculateTaxis(shifts["77"]);

    let toWorkD = taxisD;
    let toHomeD = taxisD;

    let staffTrips = 0;

    if (shiftType === "normal" && taxisD >= 2) {
      toHomeD = taxisD - 1;   // one taxi does not return
      staffTrips = 1;         // that taxi goes to fetch staff
    }

    result[date] = {

      D: {
        people: shifts.D,
        taxis: taxisD,
        toWorkTrips: toWorkD,
        toHomeTrips: toHomeD
      },

      A: {
        people: shifts.A,
        taxis: taxisA,
        trips: taxisA * 2
      },

      N: {
        people: shifts.N,
        taxis: taxisN,
        trips: taxisN * 2
      },

      "77": {
        people: shifts["77"],
        taxis: taxis77,
        trips: taxis77 * 2
      },

      Staff: {
        people: "unknown",
        taxis: staffTrips,
        trips: staffTrips
      },

      totalTrips:
        (toWorkD + toHomeD) +
        (taxisA * 2) +
        (taxisN * 2) +
        (taxis77 * 2) +
        staffTrips
    };

  });

  return result;
}
function convertToISO(dateStr) {
  const [day, month] = dateStr.split("/");
  const year = new Date().getFullYear();
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
function getInvoiceMonth() {
  const now = new Date();
  now.setMonth(now.getMonth());
  return now.toLocaleString("en-US", { month: "long", year: "numeric" });
}
function getWeekendResults(cleanedData, weekendDateColumns, headerRowIndex) {
  const weekendResult = {};

  cleanedData.slice(headerRowIndex + 1).forEach(row => {

    weekendDateColumns.forEach(({ date, startIndex }) => {

      if (!weekendResult[date]) {
        weekendResult[date] = { D: 0, A: 0, N: 0, 77: 0 };
      }

      if (row[startIndex] === "ON") weekendResult[date].D++;

      if (row[startIndex + 1] === "ON") weekendResult[date].A++;

      if (row[startIndex + 2] === "ON") weekendResult[date].N++;

      if (row[startIndex + 3] === "ON") weekendResult[date]["77"]++;

      if (row[startIndex + 4] === "ON") weekendResult[date]["77"]++;

    });

  });
  return weekendResult;
}

function generateTripsPDF(filteredTrips) {
  return new Promise((resolve, reject) => {

    const filePath = path.join("/tmp", "trips_report.pdf");
    const doc = new PDFDocument({ margin: 40 });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const startX = 40;
    let startY = 80;

    const colWidths = [100, 70, 60, 80, 80, 70];

    const drawRow = (row, y, isHeader = false) => {
      let x = startX;

      row.forEach((cell, i) => {
        const width = colWidths[i];

        // Draw border
        doc.rect(x, y, width, 20).stroke();

        // Fill header
        if (isHeader) {
          doc.rect(x, y, width, 20).fillAndStroke("#eeeeee", "black");
        }

        // Text
        doc
          .fillColor("black")
          .font(isHeader ? "Helvetica-Bold" : "Helvetica")
          .fontSize(9)
          .text(String(cell), x + 5, y + 5, {
            width: width - 10,
            align: "center"
          });

        x += width;
      });
    };

    Object.entries(filteredTrips).forEach(([date, shifts]) => {

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(`Transport Schedule - ${date}`, startX, startY);

      startY += 25;

      const table = [
        ["Shift", "People", "Taxis", "To Work", "To Home", "Total"]
      ];

      const buildRow = (label, s, type) => {
        if (type === "D") {
          return [
            "Day (D)",
            s.people,
            s.taxis,
            s.toWorkTrips || 0,
            s.toHomeTrips || 0,
            (s.toWorkTrips || 0) + (s.toHomeTrips || 0)
          ];
        }

        const taxis = s.taxis || 0;
        const trips = s.trips || 0;

        return [
          label,
          s.people,
          taxis,
          taxis,
          taxis,
          trips
        ];
      };

      table.push(buildRow("77", shifts["77"], "77"));
      table.push(buildRow("D", shifts["D"], "D"));
      table.push(buildRow("Afternoon (A)", shifts["A"], "A"));
      table.push(buildRow("Night (N)", shifts["N"], "N"));
      table.push(buildRow("Staff", shifts["Staff"], "Staff"));
      table.push(["Total Trips", "", "", "", "", shifts.totalTrips]);

      // Draw table
      table.forEach((row, i) => {
        drawRow(row, startY, i === 0);
        startY += 20;
      });

      startY += 30;

      // New page if needed
      if (startY > 700) {
        doc.addPage();
        startY = 80;
      }
    });

    doc.end();

    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

function excelDateToString(value) {
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const jsDate = new Date(excelEpoch.getTime() + value * 86400000);

    const day = String(jsDate.getDate()).padStart(2, "0");
    const month = String(jsDate.getMonth() + 1).padStart(2, "0");

    return `${day}/${month}`;
  }

  return value;
}


module.exports = router;
