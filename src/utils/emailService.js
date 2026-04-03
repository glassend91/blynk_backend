const transporter = require('../config/email');
const {
    getOTPEmailTemplate,
    getOrderConfirmationTemplate,
    getCustomerVerificationOTPTemplate,
    getManualChargeTemplate,
    getRefundTemplate
} = require('./emailTemplates');

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
 * Send admin invitation email when an admin creates a new staff user
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.name
 * @param {string} params.role
 * @param {string} params.inviteLink
 */
async function sendAdminInviteEmail({ email, name, role, inviteLink, password }) {
    const safeName = name || 'Team Member';
    const safeRole = role || 'team member';
    const link = inviteLink || process.env.ADMIN_INVITE_URL || 'https://app.blynk.com/login';
    const passwordBlock = password
        ? `<div style="background:#F3F4F6; border-radius:12px; padding:16px; margin:24px 0;">
                <p style="margin:0 0 8px; font-size:15px; color:#4B5563;">Temporary Password</p>
                <code style="display:block; font-size:18px; font-weight:600; color:#111827;">${password}</code>
                <p style="margin:12px 0 0; font-size:13px; color:#6B7280;">Use this password with your email address to log in. You can change it after signing in.</p>
           </div>`
        : '';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1F2933; max-width: 600px; margin: 0 auto; padding: 24px; background:#F7F7FA;">
            <div style="background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(31,41,51,0.08);">
                <div style="padding:32px; background:linear-gradient(135deg,#5B2DEE,#8F6BFA); color:#fff;">
                    <h1 style="margin:0; font-size:24px; font-weight:600;">You're invited to Blynk Admin</h1>
                    <p style="margin:8px 0 0; font-size:15px;">${safeRole}</p>
                </div>
                <div style="padding:32px; background:#fff;">
                    <p style="font-size:16px;">Hi ${safeName},</p>
                    <p style="font-size:15px; margin-bottom:16px;">
                        You've been invited to join the Blynk admin console. Click the button below to set up your password and access the dashboard.
                    </p>
                    ${passwordBlock}
                    <div style="text-align:center; margin:32px 0;">
                        <a href="${link}" style="display:inline-block; padding:14px 28px; background:#5B2DEE; color:#fff; font-size:16px; font-weight:600; border-radius:12px; text-decoration:none;">
                            Set Up Your Account
                        </a>
                    </div>
                    <p style="font-size:14px; color:#4B5563;">
                        If the button doesn't work, copy and paste this link into your browser:<br />
                        <a href="${link}" style="color:#5B2DEE;">${link}</a>
                    </p>
                    <p style="font-size:14px; color:#4B5563; margin-top:24px;">
                        This invite was sent to you because an administrator added you to the Blynk team. If you believe this was a mistake, you can ignore this email.
                    </p>
                    <p style="font-size:14px; color:#4B5563; margin-top:32px;">— The Blynk Team</p>
                </div>
            </div>
        </body>
        </html>
    `;

    try {
        const info = await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME || 'Blynk'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'You’ve been invited to Blynk Admin',
            html,
        });
        console.log('Admin invite email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending admin invite email:', error);
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

/**
 * Send customer verification OTP email
 * @param {string} email - Recipient email address
 * @param {string} otp - OTP code
 * @param {string} name - Customer's name
 * @returns {Promise} - Email sending result
 */
async function sendCustomerVerificationOTPEmail(email, otp, name = 'Customer') {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'Blynk Customer Support'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Identity Verification Code - Blynk',
            html: getCustomerVerificationOTPTemplate(otp, name),
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Customer verification OTP email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending customer verification OTP email:', error);
        throw new Error('Failed to send verification OTP email');
    }
}

/**
 * Send manual charge notification email
 * @param {string} email - Recipient email address
 * @param {string} name - Customer's name
 * @param {number} amount - Charge amount
 * @param {string} description - Charge description
 * @param {string} invoiceNumber - Invoice number
 */
async function sendManualChargeEmail(email, name, amount, description, invoiceNumber) {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'Blynk Billing'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Manual Charges - Invoice ${invoiceNumber}`,
            html: getManualChargeTemplate(name, amount, description, invoiceNumber),
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Manual charge email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending manual charge email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send refund notification email
 * @param {string} email - Recipient email address
 * @param {string} name - Customer's name
 * @param {number} amount - Refund amount
 * @param {string} invoiceNumber - Original invoice number
 * @param {string} reason - Refund reason
 */
async function sendRefundEmail(email, name, amount, invoiceNumber, reason) {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'Blynk Billing'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Refund Processed - Invoice ${invoiceNumber}`,
            html: getRefundTemplate(name, amount, invoiceNumber, reason),
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Refund email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending refund email:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendOTPEmail,
    sendWelcomeEmail,
    sendOrderConfirmationEmail,
    sendAdminInviteEmail,
    sendCustomerVerificationOTPEmail,
    sendManualChargeEmail,
    sendRefundEmail,
};
