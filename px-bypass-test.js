/**
 * PerimeterX Bypass Test Script
 * Tests the advanced PerimeterX bypass module against Zillow
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const pxBypass = require('./perimeter-x-bypass');

const app = express();
const port = process.env.PORT || 5002;

// Parse JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Basic route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>PerimeterX Bypass Tester</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #006aff; }
        form { margin: 20px 0; }
        label { display: block; margin-bottom: 5px; }
        input, select { padding: 8px; margin-bottom: 10px; width: 300px; }
        button { background: #006aff; color: white; border: none; padding: 10px 15px; cursor: pointer; }
        .results { margin-top: 20px; border: 1px solid #ccc; padding: 15px; border-radius: 5px; }
        pre { background: #f5f5f5; padding: 10px; overflow: auto; }
      </style>
    </head>
    <body>
      <h1>PerimeterX Bypass Tester</h1>
      <p>Test the advanced PerimeterX bypass module against Zillow.</p>
      
      <form action="/test-bypass" method="GET">
        <label for="zipCode">ZIP Code:</label>
        <input type="text" id="zipCode" name="zip" value="90210" pattern="[0-9]{5}" required>
        
        <label for="headless">Browser Mode:</label>
        <select id="headless" name="headless">
          <option value="true">Headless (Faster)</option>
          <option value="false">Visible Browser (Better for debugging)</option>
        </select>
        
        <label for="profile">Use Real Profile:</label>
        <select id="profile" name="profile">
          <option value="false">No (Fresh session each time)</option>
          <option value="true">Yes (Maintain cookies & session)</option>
        </select>
        
        <button type="submit">Run Test</button>
      </form>
      
      <p>The test will run the advanced PerimeterX bypass module and attempt to scrape Zillow listings.</p>
      <p><a href="/">Back to Home</a></p>
    </body>
    </html>
  `);
});

// Test endpoint
app.get('/test-bypass', async (req, res) => {
  try {
    const zipCode = req.query.zip || '90210';
    const headless = req.query.headless !== 'false';
    const useRealProfile = req.query.profile === 'true';
    
    console.log(`Starting PerimeterX bypass test for ZIP: ${zipCode}`);
    console.log(`Options: headless=${headless}, useRealProfile=${useRealProfile}`);
    
    // Track start time
    const startTime = Date.now();
    
    // Run the bypass test
    const results = await pxBypass.scrapeWithBypass(zipCode, {
      headless,
      useRealProfile
    });
    
    // Calculate execution time
    const executionTime = Date.now() - startTime;
    results.executionTime = executionTime;
    
    // Generate HTML response
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>PerimeterX Bypass Results</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #006aff; }
          h2 { color: #333; margin-top: 30px; }
          .success { color: green; }
          .error { color: red; }
          .card { border: 1px solid #ccc; border-radius: 5px; padding: 15px; margin: 15px 0; }
          .listing { border-bottom: 1px solid #eee; padding: 10px 0; }
          .listing:last-child { border-bottom: none; }
          pre { background: #f5f5f5; padding: 10px; overflow: auto; }
          .meta { color: #666; font-size: 14px; }
          img { max-width: 100%; border: 1px solid #ccc; margin: 10px 0; }
          .screenshots { margin-top: 20px; }
          a { color: #006aff; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>PerimeterX Bypass Results</h1>
        <p>ZIP Code: <strong>${zipCode}</strong></p>
        <p>Execution Time: <strong>${(executionTime / 1000).toFixed(2)} seconds</strong></p>
        <p>Test Run At: <strong>${results.timestamp}</strong></p>
        
        <div class="card">
          <h2>Summary</h2>
          <p class="${results.success ? 'success' : 'error'}">
            ${results.success ? '✅ Success' : '❌ Error: ' + (results.error || 'Unknown error')}
          </p>
          <p>CAPTCHA Detected: <strong>${results.captchaDetected ? 'Yes' : 'No'}</strong></p>
          ${results.captchaDetected ? 
            `<p>CAPTCHA Bypassed: <strong>${results.captchaBypassed ? 'Yes' : 'No'}</strong></p>` : ''}
          <p>Listings Found: <strong>${results.count || 0}</strong></p>
        </div>
    `;
    
    // Show listings if any
    if (results.success && results.listings && results.listings.length > 0) {
      html += `
        <h2>Listings (${results.listings.length})</h2>
        <div class="card">
      `;
      
      // Add each listing
      results.listings.forEach((listing, index) => {
        html += `
          <div class="listing">
            <h3>Listing #${index + 1}</h3>
            <p><strong>Price:</strong> ${listing.price}</p>
            <p><strong>Address:</strong> ${listing.address}</p>
            <p><strong>Details:</strong> ${listing.details}</p>
            ${listing.link && listing.link !== 'N/A' ? 
              `<p><a href="${listing.link}" target="_blank">View on Zillow</a></p>` : ''}
          </div>
        `;
      });
      
      html += `</div>`;
    }
    
    // Show screenshots if available
    const publicDir = path.join(__dirname, 'public');
    const files = await fs.readdir(publicDir);
    
    const screenshots = files.filter(file => 
      (file.startsWith('captcha-' + zipCode) || file.startsWith('result-' + zipCode)) && 
      file.endsWith('.png')
    );
    
    if (screenshots.length > 0) {
      html += `
        <h2>Screenshots</h2>
        <div class="screenshots">
      `;
      
      screenshots.forEach(screenshot => {
        html += `
          <div class="card">
            <h3>${screenshot.includes('captcha') ? 'CAPTCHA Page' : 'Results Page'}</h3>
            <img src="/${screenshot}" alt="${screenshot}" />
            <p class="meta">Filename: ${screenshot}</p>
          </div>
        `;
      });
      
      html += `</div>`;
    }
    
    // Raw JSON for debugging
    html += `
      <h2>Raw Results Data</h2>
      <div class="card">
        <pre>${JSON.stringify(results, null, 2)}</pre>
      </div>
      
      <p><a href="/test-bypass?zip=${zipCode}">Run Test Again</a> | <a href="/">Back to Home</a></p>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    res.status(500).send(`
      <h1>Error</h1>
      <p>${error.message}</p>
      <pre>${error.stack}</pre>
      <p><a href="/">Back to Home</a></p>
    `);
  }
});

// API endpoint (JSON response)
app.get('/api/bypass', async (req, res) => {
  try {
    const zipCode = req.query.zip || '90210';
    const headless = req.query.headless !== 'false';
    const useRealProfile = req.query.profile === 'true';
    
    console.log(`Starting PerimeterX bypass API request for ZIP: ${zipCode}`);
    
    // Run the bypass
    const results = await pxBypass.scrapeWithBypass(zipCode, {
      headless,
      useRealProfile
    });
    
    // Return clean JSON
    res.json(results);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`PerimeterX Bypass Test server running on port ${port}`);
});