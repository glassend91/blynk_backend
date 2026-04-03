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
 * Get customer verification OTP email template
 * @param {string} otp - OTP code
 * @param {string} name - Customer's name
 * @returns {string} - HTML email template
 */
function getCustomerVerificationOTPTemplate(otp, name = 'Customer') {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Identity Verification Code - Blynk</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F8F8F8;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F8F8; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 600px;">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #401B60 0%, #5C3B86 100%); padding: 48px 40px; text-align: center;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Identity Verification</h1>
                                    <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 15px; font-weight: 400;">Blynk Customer Support</p>
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 48px 40px;">
                                    <p style="color: #0A0A0A; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; font-weight: 500;">
                                        Hello ${name},
                                    </p>
                                    
                                    <p style="color: #6F6C90; font-size: 15px; line-height: 1.7; margin: 0 0 32px 0;">
                                        We're verifying your identity to ensure the security of your account. Please use the verification code below to complete the process.
                                    </p>
                                    
                                    <!-- OTP Box -->
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td align="center" style="padding: 0 0 32px 0;">
                                                <div style="background: linear-gradient(135deg, #401B60 0%, #5C3B86 100%); border-radius: 12px; padding: 32px 24px; display: inline-block; box-shadow: 0 8px 24px rgba(64, 27, 96, 0.25);">
                                                    <div style="background-color: rgba(255,255,255,0.15); border-radius: 8px; padding: 20px 32px; backdrop-filter: blur(10px);">
                                                        <h2 style="color: #ffffff; margin: 0; font-size: 42px; letter-spacing: 12px; font-weight: 700; font-family: 'Courier New', monospace; text-align: center;">
                                                            ${otp}
                                                        </h2>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Info Box -->
                                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F8F8; border-radius: 10px; padding: 20px; margin: 0 0 32px 0;">
                                        <tr>
                                            <td>
                                                <p style="color: #6F6C90; font-size: 13px; line-height: 1.6; margin: 0; text-align: center;">
                                                    <strong style="color: #0A0A0A;">⏱️ Expires in 10 minutes</strong><br/>
                                                    <span style="color: #6F6C90;">This code is valid for one-time use only</span>
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Security Notice -->
                                    <div style="border-left: 3px solid #401B60; padding-left: 16px; margin: 32px 0 0 0;">
                                        <p style="color: #6F6C90; font-size: 13px; line-height: 1.6; margin: 0 0 8px 0;">
                                            <strong style="color: #0A0A0A;">Security reminder:</strong>
                                        </p>
                                        <p style="color: #6F6C90; font-size: 13px; line-height: 1.6; margin: 0;">
                                            If you didn't request this verification code, please ignore this email or contact our support team immediately. Never share this code with anyone.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #F8F8F8; padding: 32px 40px; text-align: center; border-top: 1px solid #DFDBE3;">
                                    <p style="color: #6F6C90; font-size: 12px; line-height: 1.6; margin: 0 0 8px 0;">
                                        This is an automated message from Blynk Customer Support.
                                    </p>
                                    <p style="color: #6F6C90; font-size: 12px; line-height: 1.6; margin: 0;">
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

/**
 * Get manual charge notification email template
 * @param {string} name - Customer's name
 * @param {number} amount - Charge amount
 * @param {string} description - Charge description
 * @param {string} invoiceNumber - Invoice number
 * @returns {string} - HTML email template
 */
function getManualChargeTemplate(name, amount, description, invoiceNumber) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Notification - Blynk</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F8F8;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F8F8; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 600px;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #19BF66 0%, #15A357 100%); padding: 48px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Manual Charges</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 15px; font-weight: 400;">Your account has been charged</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 48px 40px;">
                            <p style="color: #0A0A0A; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; font-weight: 500;">
                                Hello ${name},
                            </p>
                            
                            <p style="color: #6F6C90; font-size: 15px; line-height: 1.7; margin: 0 0 32px 0;">
                                We're writing to let you know that a successfull payment was processed on your account for the amount below.
                            </p>
                            
                            <!-- Charge Details Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border-radius: 12px; padding: 32px; border: 1px solid #F3F4F6;">
                                <tr>
                                    <td style="padding-bottom: 24px; text-align: center;">
                                        <span style="color: #6F6C90; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Amount Paid</span>
                                        <h2 style="color: #19BF66; margin: 8px 0 0 0; font-size: 42px; font-weight: 800;">$${amount.toFixed(2)} <span style="font-size: 18px; color: #6F6C90; font-weight: 500;">AUD</span></h2>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding-top: 24px; border-top: 1px solid #E5E7EB;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="color: #6F6C90; font-size: 14px; padding-bottom: 8px;">Description:</td>
                                                <td align="right" style="color: #0A0A0A; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${description}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #6F6C90; font-size: 14px; padding-bottom: 8px;">Invoice #:</td>
                                                <td align="right" style="color: #0A0A0A; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${invoiceNumber}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #6F6C90; font-size: 14px;">Date:</td>
                                                <td align="right" style="color: #0A0A0A; font-size: 14px; font-weight: 600;">${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #6F6C90; font-size: 14px; line-height: 1.6; margin: 32px 0 0 0; text-align: center;">
                                You can view your full billing history and download your invoice PDF by logging into your <a href="https://app.blynk.com/dashboard" style="color: #19BF66; text-decoration: none; font-weight: 600;">customer dashboard</a>.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #F8F8F8; padding: 32px 40px; text-align: center; border-top: 1px solid #DFDBE3;">
                            <p style="color: #6F6C90; font-size: 12px; line-height: 1.6; margin: 0 0 8px 0;">
                                If you have any questions regarding this charge, please contact our billing team.
                            </p>
                            <p style="color: #6F6C90; font-size: 12px; line-height: 1.6; margin: 0;">
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
 * Get refund notification email template
 * @param {string} name - Customer's name
 * @param {number} amount - Refund amount
 * @param {string} invoiceNumber - Original invoice number
 * @param {string} reason - Refund reason
 * @returns {string} - HTML email template
 */
function getRefundTemplate(name, amount, invoiceNumber, reason) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Refund Notification - Blynk</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F8F8;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F8F8; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 600px;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #401B60 0%, #5C3B86 100%); padding: 48px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Refund Processed</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 15px; font-weight: 400;">Funds have been released to your payment method</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 48px 40px;">
                            <p style="color: #0A0A0A; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; font-weight: 500;">
                                Hello ${name},
                            </p>
                            
                            <p style="color: #6F6C90; font-size: 15px; line-height: 1.7; margin: 0 0 32px 0;">
                                We've processed a refund for your account. Please note that it may take 5-10 business days for the funds to appear in your bank account or on your card statement.
                            </p>
                            
                            <!-- Refund Details Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border-radius: 12px; padding: 32px; border: 1px solid #F3F4F6;">
                                <tr>
                                    <td style="padding-bottom: 24px; text-align: center;">
                                        <span style="color: #6F6C90; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Refund Amount</span>
                                        <h2 style="color: #401B60; margin: 8px 0 0 0; font-size: 42px; font-weight: 800;">$${amount.toFixed(2)} <span style="font-size: 18px; color: #6F6C90; font-weight: 500;">AUD</span></h2>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding-top: 24px; border-top: 1px solid #E5E7EB;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="color: #6F6C90; font-size: 14px; padding-bottom: 8px;">Original Invoice:</td>
                                                <td align="right" style="color: #0A0A0A; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${invoiceNumber}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #6F6C90; font-size: 14px; padding-bottom: 8px;">Reason:</td>
                                                <td align="right" style="color: #0A0A0A; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${reason || 'Administrative adjustment'}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #6F6C90; font-size: 14px;">Date:</td>
                                                <td align="right" style="color: #0A0A0A; font-size: 14px; font-weight: 600;">${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #F8F8F8; padding: 32px 40px; text-align: center; border-top: 1px solid #DFDBE3;">
                            <p style="color: #6F6C90; font-size: 12px; line-height: 1.6; margin: 0 0 8px 0;">
                                If you have any questions, our support team is always here to help.
                            </p>
                            <p style="color: #6F6C90; font-size: 12px; line-height: 1.6; margin: 0;">
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
    getCustomerVerificationOTPTemplate,
    getManualChargeTemplate,
    getRefundTemplate,
};
