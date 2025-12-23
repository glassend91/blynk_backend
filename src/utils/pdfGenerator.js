const PDFDocument = require('pdfkit');

/**
 * Generate PDF invoice with Australian tax compliance requirements
 * @param {Object} invoice - Invoice document from database
 * @param {Object} customer - Customer document from database
 * @param {Object} options - Additional options
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateInvoicePDF(invoice, customer, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);

            // Company Information (Header)
            doc.fontSize(20).font('Helvetica-Bold').text('BILLING INVOICE', 50, 50, { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(12).font('Helvetica').text('Blynk Telecommunications', { align: 'center' });
            // doc.fontSize(10).text('ABN: 12 345 678 901', { align: 'center' });
            doc.moveDown(1);

            // Invoice Details Section - Simple layout, responsive
            doc.fontSize(10).font('Helvetica');
            const startY = doc.y;

            // Left column - Invoice details
            const labelX = 50;
            const valueX = 140;
            let invoiceDetailY = startY;

            doc.text('Invoice Number:', labelX, invoiceDetailY);
            doc.font('Helvetica-Bold').text(invoice.invoiceNumber || 'N/A', valueX, invoiceDetailY, { width: 180 });
            doc.font('Helvetica');
            invoiceDetailY += 20;

            doc.text('Issue Date:', labelX, invoiceDetailY);
            doc.text(formatDate(invoice.createdAt), valueX, invoiceDetailY, { width: 180 });
            invoiceDetailY += 20;

            doc.text('Due Date:', labelX, invoiceDetailY);
            doc.text(formatDate(invoice.dueDate), valueX, invoiceDetailY, { width: 180 });
            invoiceDetailY += 20;

            doc.text('Status:', labelX, invoiceDetailY);
            doc.font('Helvetica-Bold').text(invoice.status ? invoice.status.toUpperCase() : 'N/A', valueX, invoiceDetailY, { width: 180 });
            doc.font('Helvetica');

            // Right column - Customer details
            const rightLabelX = 350;
            const rightValueX = 410;
            let rightY = startY;

            const businessName = customer.businessDetails?.businessName ||
                (customer.businessDetails && typeof customer.businessDetails === 'object' ? customer.businessDetails.businessName : null);
            const customerName = businessName ||
                `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
                'Customer';

            doc.text('Bill To:', rightLabelX, rightY);
            doc.font('Helvetica-Bold').text(customerName, rightValueX, rightY, { width: 140 });
            doc.font('Helvetica');
            rightY += 20;

            if (customer.email) {
                doc.text(customer.email, rightValueX, rightY, { width: 140 });
                rightY += 15;
            }
            if (customer.phone) {
                doc.text(customer.phone, rightValueX, rightY, { width: 140 });
                rightY += 15;
            }
            if (customer.billingAddress || customer.serviceAddress) {
                const address = customer.billingAddress || customer.serviceAddress || '';
                const addressLines = typeof address === 'string'
                    ? address.split('\n').filter(line => line.trim())
                    : [];
                addressLines.forEach((line) => {
                    if (line.trim()) {
                        doc.text(line.trim(), rightValueX, rightY, { width: 140 });
                        rightY += 15;
                    }
                });
            }

            // Billing Period
            if (invoice.billingPeriod) {
                doc.moveDown(1.5);
                const billingY = doc.y;
                doc.fontSize(10).fillColor('#666666');
                doc.text('Billing Period:', 50, billingY);
                doc.fillColor('#333333').text(
                    `${formatDate(invoice.billingPeriod.startDate)} - ${formatDate(invoice.billingPeriod.endDate)}`,
                    140,
                    billingY,
                    { width: 200 }
                );
            }

            // Line Items Table - Simple design with proper column widths
            doc.moveDown(1.5);
            const tableTop = doc.y;
            const tableLeft = 50;
            const tableRight = 550;
            const descWidth = 280;
            const qtyWidth = 50;
            const priceWidth = 100;
            const amountWidth = 70;

            // Table Header
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text('Description', tableLeft, tableTop);
            doc.text('Qty', tableLeft + descWidth, tableTop);
            doc.text('Unit Price', tableLeft + descWidth + qtyWidth, tableTop, { width: priceWidth, align: 'right' });
            doc.text('Amount', tableLeft + descWidth + qtyWidth + priceWidth, tableTop, { width: amountWidth, align: 'right' });

            // Draw header line
            doc.moveTo(tableLeft, tableTop + 15).lineTo(tableRight, tableTop + 15).stroke();

            // Table Rows
            doc.font('Helvetica').fontSize(9);
            let currentY = tableTop + 25;

            if (invoice.lineItems && invoice.lineItems.length > 0) {
                invoice.lineItems.forEach((item) => {
                    const description = item.description || 'Service';
                    const quantity = item.quantity || 1;
                    const unitPrice = formatCurrency(item.unitPrice || 0, invoice.currency);
                    const amount = formatCurrency(item.amount || 0, invoice.currency);

                    // Handle long descriptions with wrapping
                    const descriptionHeight = doc.heightOfString(description, { width: descWidth });
                    const lineHeight = Math.max(15, descriptionHeight + 4);

                    doc.text(description, tableLeft, currentY, { width: descWidth });
                    doc.text(String(quantity), tableLeft + descWidth, currentY);
                    doc.text(unitPrice, tableLeft + descWidth + qtyWidth, currentY, { width: priceWidth, align: 'right' });
                    doc.text(amount, tableLeft + descWidth + qtyWidth + priceWidth, currentY, { width: amountWidth, align: 'right' });

                    currentY += lineHeight + 5;
                });
            } else {
                // Fallback if no line items
                doc.text('Service Charge', tableLeft, currentY, { width: descWidth });
                doc.text('1', tableLeft + descWidth, currentY);
                doc.text(formatCurrency(invoice.subtotal || 0, invoice.currency), tableLeft + descWidth + qtyWidth, currentY, { width: priceWidth, align: 'right' });
                doc.text(formatCurrency(invoice.total || 0, invoice.currency), tableLeft + descWidth + qtyWidth + priceWidth, currentY, { width: amountWidth, align: 'right' });
                currentY += 20;
            }

            // Totals Section - Fixed overflow issues with proper spacing
            const totalsY = currentY + 10;
            doc.moveTo(tableLeft, totalsY).lineTo(tableRight, totalsY).stroke();
            doc.moveDown(0.5);

            // Calculate positions to prevent overflow
            // Labels start earlier, values have more space and align with table Amount column
            const totalsLabelStartX = 380; // Moved left to give more space
            const totalsLabelWidth = 100; // Width for labels (right-aligned)
            const totalsValueStartX = tableLeft + descWidth + qtyWidth + priceWidth; // Align with Amount column
            const totalsValueWidth = tableRight - totalsValueStartX; // Use all remaining space
            let totalsCurrentY = doc.y;

            doc.fontSize(10);

            // Subtotal - right align labels, values align with Amount column
            doc.text('Subtotal:', totalsLabelStartX, totalsCurrentY, { width: totalsLabelWidth, align: 'right' });
            const subtotalText = formatCurrency(invoice.subtotal || 0, invoice.currency);
            doc.text(subtotalText, totalsValueStartX, totalsCurrentY, { width: totalsValueWidth, align: 'right' });
            totalsCurrentY += 16;

            // Discount
            if (invoice.discount && invoice.discount > 0) {
                doc.text('Discount:', totalsLabelStartX, totalsCurrentY, { width: totalsLabelWidth, align: 'right' });
                const discountText = `-${formatCurrency(invoice.discount, invoice.currency)}`;
                doc.text(discountText, totalsValueStartX, totalsCurrentY, { width: totalsValueWidth, align: 'right' });
                totalsCurrentY += 16;
            }

            // GST - ensure "GST (10%):" label doesn't overflow
            doc.moveDown(1); // Add top margin/padding for GST
            totalsCurrentY = doc.y;
            doc.text('GST (10%):', totalsLabelStartX, totalsCurrentY, { width: totalsLabelWidth, align: 'right' });
            const gstText = formatCurrency(invoice.tax || 0, invoice.currency);
            doc.text(gstText, totalsValueStartX, totalsCurrentY, { width: totalsValueWidth, align: 'right' });
            totalsCurrentY += 16;

            // Total - Bold and larger with divider line
            doc.moveDown(0.5);
            const totalDividerY = doc.y;
            doc.moveTo(totalsLabelStartX, totalDividerY).lineTo(tableRight, totalDividerY).stroke();
            doc.moveDown(0.3);
            const totalTextY = doc.y;
            doc.font('Helvetica-Bold').fontSize(12);
            doc.text('Total:', totalsLabelStartX, totalTextY, { width: totalsLabelWidth, align: 'right' });
            // Ensure total amount has maximum width - never overflow
            const totalAmount = formatCurrency(invoice.total || 0, invoice.currency);
            doc.text(totalAmount, totalsValueStartX, totalTextY, { width: totalsValueWidth, align: 'right' });
            doc.font('Helvetica').fontSize(10);
            doc.moveDown(0.5);

            // Payment Information
            if (invoice.paymentDate) {
                doc.moveDown(1);
                doc.fontSize(10);
                doc.text('Payment Information:', 50, doc.y);
                doc.moveDown(0.3);
                doc.text(`Payment Date: ${formatDate(invoice.paymentDate)}`, 50, doc.y);
                if (invoice.paymentReference) {
                    doc.text(`Payment Reference: ${invoice.paymentReference}`, 50, doc.y);
                }
            }

            // Notes
            if (invoice.notes) {
                doc.moveDown(1);
                doc.fontSize(9);
                doc.text('Notes:', 50, doc.y);
                doc.text(invoice.notes, 50, doc.y + 15, { width: 500 });
            }

            // Footer - Australian Tax Compliance
            const footerY = 750;
            doc.fontSize(8).font('Helvetica');
            doc.text(
                'This document serves as a Tax Invoice for GST purposes.',
                50,
                footerY,
                { align: 'center', width: 500 }
            );
            doc.text(
                'Blynk Telecommunications | ABN: 12 345 678 901',
                50,
                footerY + 15,
                { align: 'center', width: 500 }
            );
            doc.text(
                'For queries, contact: support@blynk.com.au',
                50,
                footerY + 30,
                { align: 'center', width: 500 }
            );

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return dateString;
    }
}

/**
 * Format currency for display
 */
function formatCurrency(amount, currency = 'AUD') {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
    }).format(amount);
}

/**
 * Generate filename for invoice PDF
 */
function generateInvoiceFilename(invoice, customer) {
    const businessName = customer.businessDetails?.businessName ||
        (customer.businessDetails && typeof customer.businessDetails === 'object' ? customer.businessDetails.businessName : null);
    const customerName = businessName ||
        `${customer.firstName || ''}_${customer.lastName || ''}`.trim() ||
        'Customer';
    const sanitizedName = customerName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const date = new Date(invoice.createdAt || Date.now());
    const dateStr = date.toISOString().split('T')[0];
    return `Invoice-${invoice.invoiceNumber}-${sanitizedName}-${dateStr}.pdf`;
}

module.exports = {
    generateInvoicePDF,
    generateInvoiceFilename,
    formatDate,
    formatCurrency
};
