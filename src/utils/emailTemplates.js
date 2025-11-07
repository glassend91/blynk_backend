/**
 * Get OTP email template
 * @param {string} otp - OTP code
 * @param {string} name - User's name
 * @returns {string} - HTML email template
 */
function getOTPEmailTemplate(otp, name = 'User') {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OTP Verification</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Email Verification</h1>
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px 30px;">
                                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                        Hi <strong>${name}</strong>,
                                    </p>
                                    
                                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                        Thank you for signing up! Please use the following One-Time Password (OTP) to verify your email address:
                                    </p>
                                    
                                    <!-- OTP Box -->
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td align="center" style="padding: 20px 0;">
                                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; padding: 25px; display: inline-block;">
                                                    <h2 style="color: #ffffff; margin: 0; font-size: 36px; letter-spacing: 8px; font-weight: 700;">
                                                        ${otp}
                                                    </h2>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                                        This OTP will expire in <strong>10 minutes</strong>
                                    </p>
                                    
                                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                                        If you didn't request this verification code, please ignore this email.
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #eeeeee;">
                                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0;">
                                        This is an automated message, please do not reply to this email.
                                    </p>
                                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 10px 0 0 0;">
                                        © ${new Date().getFullYear()} Blynk. All rights reserved.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
}

/**
 * Get password reset email template
 * @param {string} resetLink - Password reset link
 * @param {string} name - User's name
 * @returns {string} - HTML email template
 */
function getPasswordResetTemplate(resetLink, name = 'User') {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <tr>
                                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Password Reset</h1>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 40px 30px;">
                                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                        Hi <strong>${name}</strong>,
                                    </p>
                                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                        We received a request to reset your password. Click the button below to reset it:
                                    </p>
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td align="center" style="padding: 20px 0;">
                                                <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 5px; font-size: 16px; font-weight: 600; display: inline-block;">
                                                    Reset Password
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                                        If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #eeeeee;">
                                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0;">
                                        © ${new Date().getFullYear()} Blynk. All rights reserved.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
}

/**
 * Get order confirmation email template
 * @param {string} name - User's name
 * @param {string} planName - Plan name
 * @param {number} amount - Order amount
 * @param {string} orderId - Order ID
 * @returns {string} - HTML email template
 */
function getOrderConfirmationTemplate(name, planName, amount, orderId) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #401B60 0%, #5C3B86 100%); padding: 40px 30px; text-align: center;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Order Confirmation</h1>
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px 30px;">
                                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                        Hi <strong>${name}</strong>,
                                    </p>
                                    
                                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                        Thank you for your order! We're excited to have you as part of the Blynk family.
                                    </p>
                                    
                                    <!-- Order Details Box -->
                                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 10px; padding: 20px; margin: 20px 0;">
                                        <tr>
                                            <td style="padding-bottom: 15px;">
                                                <h2 style="color: #401B60; margin: 0; font-size: 20px; font-weight: 600;">Order Details</h2>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
                                                <table width="100%" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td style="color: #666666; font-size: 14px;">Plan:</td>
                                                        <td align="right" style="color: #333333; font-size: 14px; font-weight: 600;">${planName}</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
                                                <table width="100%" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td style="color: #666666; font-size: 14px;">Order ID:</td>
                                                        <td align="right" style="color: #333333; font-size: 14px; font-weight: 600;">${orderId || 'N/A'}</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0;">
                                                <table width="100%" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td style="color: #333333; font-size: 16px; font-weight: 600;">Total:</td>
                                                        <td align="right" style="color: #401B60; font-size: 18px; font-weight: 700;">$${amount.toFixed(2)} AUD</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 30px 0 0 0;">
                                        Your order has been successfully processed. We'll be in touch shortly with setup instructions and next steps.
                                    </p>
                                    
                                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                                        If you have any questions or need assistance, please don't hesitate to contact our support team.
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #eeeeee;">
                                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0;">
                                        This is an automated message, please do not reply to this email.
                                    </p>
                                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 10px 0 0 0;">
                                        © ${new Date().getFullYear()} Blynk. All rights reserved.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
}

module.exports = {
    getOTPEmailTemplate,
    getPasswordResetTemplate,
    getOrderConfirmationTemplate,
};

