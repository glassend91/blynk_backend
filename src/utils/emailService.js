const transporter = require('../config/email');
const { getOTPEmailTemplate, getOrderConfirmationTemplate } = require('./emailTemplates');

/**
 * Send OTP email to user
 * @param {string} email - Recipient email address
 * @param {string} otp - OTP code
 * @param {string} name - User's name
 * @returns {Promise} - Email sending result
 */
async function sendOTPEmail(email, otp, name = 'User') {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'Blynk'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your OTP Verification Code',
            html: getOTPEmailTemplate(otp, name),
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('OTP email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw new Error('Failed to send OTP email');
    }
}

/**
 * Send welcome email to new user
 * @param {string} email - Recipient email address
 * @param {string} name - User's name
 * @returns {Promise} - Email sending result
 */
async function sendWelcomeEmail(email, name) {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'Blynk'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Welcome to Blynk!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">Welcome to Blynk!</h1>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                        <p style="font-size: 16px;">Hi ${name},</p>
                        <p style="font-size: 16px;">Thank you for joining Blynk! We're excited to have you on board.</p>
                        <p style="font-size: 16px;">Your account has been successfully created and you can now enjoy all our services.</p>
                        <div style="margin: 30px 0; text-align: center;">
                            <p style="font-size: 14px; color: #666;">If you have any questions, feel free to reach out to our support team.</p>
                        </div>
                        <p style="font-size: 14px; color: #666; margin-top: 30px;">Best regards,<br>The Blynk Team</p>
                    </div>
                </body>
                </html>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Welcome email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending welcome email:', error);
        // Don't throw error for welcome email, just log it
        return { success: false, error: error.message };
    }
}

/**
 * Send order confirmation email to customer
 * @param {string} email - Recipient email address
 * @param {string} name - Customer's name
 * @param {string} planName - Plan name
 * @param {number} amount - Order amount
 * @param {string} orderId - Order ID (optional)
 * @returns {Promise} - Email sending result
 */
async function sendOrderConfirmationEmail(email, name, planName, amount, orderId = null) {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'Blynk'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your Order Confirmation - Blynk',
            html: getOrderConfirmationTemplate(name, planName, amount, orderId),
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Order confirmation email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending order confirmation email:', error);
        // Don't throw error for confirmation email, just log it
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendOTPEmail,
    sendWelcomeEmail,
    sendOrderConfirmationEmail,
};

