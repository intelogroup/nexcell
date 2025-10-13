/**
 * Helper script to get an authentication token for testing
 * 
 * Run this in the browser console while signed in to get a JWT token:
 * 
 * 1. Open http://localhost:5173 in your browser
 * 2. Sign in with your test account
 * 3. Open Developer Tools (F12)
 * 4. Go to Console tab
 * 5. Paste and run this code
 * 6. Copy the token that's logged
 * 7. Set environment variable: $env:TEST_AUTH_TOKEN="<token>"
 * 8. Run the E2E test: pnpm test:ai-e2e
 */

// Browser console script:
/*
(async () => {
  try {
    const token = await window.Clerk.session.getToken();
    console.log('\n🔑 Auth Token (valid for 1 hour):\n');
    console.log(token);
    console.log('\n📋 Copy this token and set it as TEST_AUTH_TOKEN environment variable\n');
    console.log('PowerShell: $env:TEST_AUTH_TOKEN="' + token + '"');
    console.log('Bash: export TEST_AUTH_TOKEN="' + token + '"');
    
    // Also decode and show expiry
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = new Date(payload.exp * 1000);
    console.log('\n⏰ Token expires at:', expiry.toLocaleString());
  } catch (error) {
    console.error('Error getting token:', error);
    console.log('Make sure you are signed in!');
  }
})();
*/

console.log('Copy the code above and run it in the browser console while signed in')
console.log('Then use the token to run: pnpm test:ai-e2e')
