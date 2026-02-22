var express = require('express');
var router = express.Router();
const { generateInvoice } = require('../utils/invoice');
const { sendInvoiceEmail } = require('../utils/mailer');
const PDFDocument = require('pdfkit');
const getRawBody = require('raw-body');

// GET home page
router.get('/', function(req, res, next) {
  res.json({ status: 'API running' });
});

// POST generate invoice

// POST /generate-invoice-and-email
router.post('/generate-invoice', async function(req, res) {
  // invoiceData: { rows: [{ description, rate, qty }], email: 'to@example.com' }
  try {
    const invoiceData = req.body;
    const doc = new PDFDocument();
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', async () => {
      const pdfBuffer = Buffer.concat(buffers);
      if (invoiceData.email) {
        await sendInvoiceEmail({
          to: invoiceData.email,
          subject: 'Your Transport Invoice',
          text: 'Please find attached your invoice.',
          pdfBuffer
        });
        res.json({ success: true, message: 'Invoice emailed.' });
      } else {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');
        res.end(pdfBuffer);
      }
    });
    // Render invoice
    doc.fontSize(20).text('Transport Billing Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('Description', 50, 120);
    doc.text('Rate', 250, 120);
    doc.text('Qty', 350, 120);
    doc.text('Total', 450, 120);
    doc.moveDown();
    let y = 140;
    let subTotal = 0;
    invoiceData.rows.forEach(row => {
      doc.text(row.description, 50, y);
      doc.text(row.rate.toFixed(2), 250, y);
      doc.text(row.qty, 350, y);
      const total = row.rate * row.qty;
      doc.text(total.toFixed(2), 450, y);
      subTotal += total;
      y += 20;
    });
    doc.moveDown();
    doc.text('Sub Total:', 350, y + 20);
    doc.text(subTotal.toFixed(2), 450, y + 20);
    doc.text('Total:', 350, y + 40);
    doc.text(subTotal.toFixed(2), 450, y + 40);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
