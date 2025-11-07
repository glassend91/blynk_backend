/**
 * Payment Methods API Test Examples
 * 
 * This file contains example requests for testing the payment methods API.
 * Use these examples with tools like Postman, Insomnia, or curl.
 * 
 * Prerequisites:
 * 1. Server running on http://localhost:3000
 * 2. Valid JWT token from authentication
 * 3. Stripe test keys configured
 */

const BASE_URL = 'http://localhost:3000/api/payment-methods';
const AUTH_TOKEN = 'your-jwt-token-here'; // Replace with actual token

// Example requests for testing the API

console.log('=== Payment Methods API Test Examples ===\n');

console.log('1. Create Setup Intent:');
console.log(`POST ${BASE_URL}/setup-intent`);
console.log('Headers:');
console.log(`  Authorization: Bearer ${AUTH_TOKEN}`);
console.log('Response:');
console.log(`  {
    "clientSecret": "seti_xxx_secret_xxx",
    "id": "seti_xxx"
  }\n`);

console.log('2. Add Payment Method:');
console.log(`POST ${BASE_URL}`);
console.log('Headers:');
console.log(`  Authorization: Bearer ${AUTH_TOKEN}`);
console.log(`  Content-Type: application/json`);
console.log('Body:');
console.log(`  {
    "paymentMethodId": "pm_xxx",
    "billingDetails": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "address": {
        "line1": "123 Main St",
        "city": "New York",
        "state": "NY",
        "postalCode": "10001",
        "country": "US"
      }
    }
  }\n`);

console.log('3. Get All Payment Methods:');
console.log(`GET ${BASE_URL}`);
console.log('Headers:');
console.log(`  Authorization: Bearer ${AUTH_TOKEN}\n`);

console.log('4. Get Default Payment Method:');
console.log(`GET ${BASE_URL}/default`);
console.log('Headers:');
console.log(`  Authorization: Bearer ${AUTH_TOKEN}\n`);

console.log('5. Set Default Payment Method:');
console.log(`PUT ${BASE_URL}/:paymentMethodId/default`);
console.log('Headers:');
console.log(`  Authorization: Bearer ${AUTH_TOKEN}\n`);

console.log('6. Update Payment Method:');
console.log(`PUT ${BASE_URL}/:paymentMethodId`);
console.log('Headers:');
console.log(`  Authorization: Bearer ${AUTH_TOKEN}`);
console.log(`  Content-Type: application/json`);
console.log('Body:');
console.log(`  {
    "billingDetails": {
      "name": "John Smith",
      "email": "johnsmith@example.com",
      "address": {
        "line1": "456 Oak Ave",
        "city": "Los Angeles",
        "state": "CA",
        "postalCode": "90210",
        "country": "US"
      }
    }
  }\n`);

console.log('7. Delete Payment Method:');
console.log(`DELETE ${BASE_URL}/:paymentMethodId`);
console.log('Headers:');
console.log(`  Authorization: Bearer ${AUTH_TOKEN}\n`);

console.log('8. Get Auto-Pay Settings:');
console.log(`GET ${BASE_URL}/auto-pay/settings`);
console.log('Headers:');
console.log(`  Authorization: Bearer ${AUTH_TOKEN}\n`);

console.log('9. Update Auto-Pay Settings:');
console.log(`PUT ${BASE_URL}/auto-pay/settings`);
console.log('Headers:');
console.log(`  Authorization: Bearer ${AUTH_TOKEN}`);
console.log(`  Content-Type: application/json`);
console.log('Body:');
console.log(`  {
    "autoPayEnabled": true,
    "emailNotifications": true,
    "billingNotifications": true
  }\n`);

console.log('=== cURL Examples ===\n');

console.log('Create Setup Intent:');
console.log(`curl -X POST "${BASE_URL}/setup-intent" \\
  -H "Authorization: Bearer ${AUTH_TOKEN}" \\
  -H "Content-Type: application/json"\n`);

console.log('Get All Payment Methods:');
console.log(`curl -X GET "${BASE_URL}" \\
  -H "Authorization: Bearer ${AUTH_TOKEN}"\n`);

console.log('Add Payment Method:');
console.log(`curl -X POST "${BASE_URL}" \\
  -H "Authorization: Bearer ${AUTH_TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "paymentMethodId": "pm_xxx",
    "billingDetails": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  }'\n`);

console.log('=== Frontend JavaScript Examples ===\n');

console.log('// Create setup intent and add payment method');
console.log(`
async function addPaymentMethod() {
  try {
    // 1. Create setup intent
    const setupResponse = await fetch('/api/payment-methods/setup-intent', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
    const { clientSecret } = await setupResponse.json();

    // 2. Use Stripe Elements to collect payment method
    const stripe = Stripe('pk_test_...');
    const elements = stripe.elements({ clientSecret });
    const cardElement = elements.create('card');
    cardElement.mount('#card-element');

    // 3. Confirm setup intent
    const { error, setupIntent } = await stripe.confirmCardSetup(
      clientSecret,
      {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: 'John Doe',
            email: 'john@example.com'
          }
        }
      }
    );

    if (error) {
      console.error('Error:', error);
      return;
    }

    // 4. Save payment method to backend
    const saveResponse = await fetch('/api/payment-methods', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentMethodId: setupIntent.payment_method
      })
    });

    const result = await saveResponse.json();
    console.log('Payment method added:', result);
  } catch (error) {
    console.error('Error adding payment method:', error);
  }
}
`);

console.log('// Get and display payment methods');
console.log(`
async function loadPaymentMethods() {
  try {
    const response = await fetch('/api/payment-methods', {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    const { paymentMethods } = await response.json();

    // Display payment methods in UI
    paymentMethods.forEach(pm => {
      console.log(\`\${pm.displayName} - \${pm.expiryDisplay}\`);
      console.log(\`Default: \${pm.isDefault}\`);
    });
  } catch (error) {
    console.error('Error loading payment methods:', error);
  }
}
`);

console.log('=== Test Card Numbers ===\n');
console.log('Use these Stripe test card numbers:');
console.log('Success: 4242424242424242');
console.log('Decline: 4000000000000002');
console.log('Insufficient Funds: 4000000000009995');
console.log('Expired Card: 4000000000000069');
console.log('CVC Check: 4000000000000127');
console.log('Address Check: 4000000000000010\n');

console.log('=== Environment Variables ===\n');
console.log('Make sure these are set in your .env file:');
console.log('STRIPE_SECRET_KEY=sk_test_...');
console.log('STRIPE_PUBLISHABLE_KEY=pk_test_...');
console.log('JWT_SECRET=your-jwt-secret');
console.log('MONGO_URI=mongodb://localhost:27017/blynk-backend\n');

console.log('=== Notes ===\n');
console.log('- Replace AUTH_TOKEN with actual JWT token from login');
console.log('- Replace pm_xxx with actual payment method ID from Stripe');
console.log('- All endpoints require authentication');
console.log('- Use Stripe test keys for development');
console.log('- Check server logs for detailed error information');
