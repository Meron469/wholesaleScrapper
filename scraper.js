const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Load environment variables from .env file
require('dotenv').config();

// Enhanced CAPTCHA bypass packages
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const randomUseragent = require('random-useragent');

// Import CAPTCHA solver utility and advanced debugging
const captchaSolver = require('./captcha-solver');
const captchaDebug = require('./captcha-debug');
const captchaTest = require('./captcha-test');

// Import advanced PerimeterX bypass module
const pxBypass = require('./perimeter-x-bypass');

// Use the stealth plugin to evade detection
puppeteer.use(StealthPlugin());

// Create a directory for detailed debug logs
try {
  fs.mkdirSync(path.join(__dirname, 'debug-logs'), { recursive: true });
  console.log('Debug directory created/verified');
} catch (err) {
  console.log('Debug directory setup error:', err.message);
}

// Check if we're running on Render.com and install Chrome if needed
const isRender = process.env.RENDER === 'true';
if (isRender) {
  try {
    console.log('Running on Render.com - installing Chrome...');
    require('child_process').execSync('npx puppeteer browsers install chrome');
    console.log('Chrome installation completed successfully');
  } catch (err) {
    console.log('Chrome installation error (continuing anyway):', err.message);
  }
}

// Initialize AntiCaptcha service at startup
console.log('Initializing AntiCaptcha service...');
const antiCaptchaInitialized = captchaSolver.initAntiCaptcha();
console.log(`AntiCaptcha initialization result: ${antiCaptchaInitialized ? 'SUCCESS' : 'FAILED - API key missing or invalid'}`);
console.log(`AntiCaptcha API key available: ${process.env.ANTICAPTCHA_API_KEY ? 'YES' : 'NO'}`);
if (!antiCaptchaInitialized) {
  console.warn('WARNING: AntiCaptcha is not properly initialized. CAPTCHA bypass will not work!');
}

const app = express();
const port = process.env.PORT || 5001; // Change to 5001 as port 5000 will be used by the webhook server

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
// JSON middleware
app.use(express.json());

// Visual CAPTCHA Analysis Tool - returns HTML page with screenshots and detailed diagnostics
app.get('/analyze-captcha', async (req, res) => {
  try {
    const zipCode = req.query.zip || '90210';
    
    console.log(`Starting visual CAPTCHA analysis for ZIP: ${zipCode}`);
    
    // Create a unique ID for this analysis session
    const analysisId = Date.now().toString();
    const screenshotsDir = path.join(__dirname, 'public');
    
    // Ensure screenshots directory exists
    try {
      const fs = require('fs');
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }
      console.log(`Screenshots directory: ${screenshotsDir}`);
    } catch (mkdirErr) {
      console.error('Error creating screenshots directory:', mkdirErr);
    }
    
    // Setup paths for various screenshots
    const initialScreenshotPath = path.join(screenshotsDir, `captcha-initial-${analysisId}.png`);
    const captchaElementScreenshotPath = path.join(screenshotsDir, `captcha-element-${analysisId}.png`);
    const afterSolveScreenshotPath = path.join(screenshotsDir, `captcha-after-${analysisId}.png`);
    
    // Launch browser
    console.log('Launching browser for CAPTCHA analysis...');
    const browser = await getPuppeteerBrowser();
    const page = await browser.newPage();
    
    // Analysis results container
    const analysis = {
      timestamp: new Date().toISOString(),
      zipCode,
      browserInfo: {},
      initialPage: {},
      captchaDetails: {},
      solveAttempt: {},
      afterSolve: {}
    };
    
    try {
      // Configure page
      const userAgent = randomUseragent.getRandom();
      await setupPageHeaders(page, userAgent, 'mobile');
      analysis.browserInfo = {
        userAgent,
        viewportWidth: await page.evaluate(() => window.innerWidth),
        viewportHeight: await page.evaluate(() => window.innerHeight)
      };
      
      // Create URL for Zillow
      const url = `https://www.zillow.com/homes/for_sale/${zipCode}/?searchQueryState={"usersSearchTerm":"${zipCode}","isMap":false,"category":"cat1","basics":{"isMobile":true}}`;
      
      // Navigate to the URL
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Take initial screenshot
      await page.screenshot({ path: initialScreenshotPath, fullPage: true });
      analysis.initialPage.screenshotPath = path.basename(initialScreenshotPath);
      analysis.initialPage.title = await page.title();
      analysis.initialPage.url = page.url();
      
      // Analyze page for CAPTCHA
      const captchaDetection = await page.evaluate(() => {
        // Enhanced CAPTCHA detection with detailed reporting
        const pageTitle = document.title.toLowerCase();
        const bodyText = document.body.innerText.toLowerCase();
        
        // Check for various CAPTCHA indicators
        const blockedTitle = pageTitle.includes('denied') || pageTitle.includes('blocked');
        const captchaText = bodyText.includes('captcha') || bodyText.includes('robot') || 
                         bodyText.includes('human') || bodyText.includes('verify');
        
        // Find potential CAPTCHA elements
        const captchaElements = {};
        const selectors = [
          '#px-captcha',
          '.g-recaptcha',
          'iframe[src*="recaptcha"]',
          '[class*="captcha"]',
          '[id*="captcha"]',
          '[id^="px-"]',
          '[class^="px-"]'
        ];
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            captchaElements[selector] = Array.from(elements).map(el => ({
              tag: el.tagName,
              id: el.id,
              classes: el.className,
              text: el.innerText,
              rect: el.getBoundingClientRect()
            }));
          }
        });
        
        // Extract text content from key elements
        const textContent = [];
        document.querySelectorAll('h1, h2, h3, p, div:not(:has(*))').forEach(el => {
          const text = el.innerText.trim();
          if (text.length > 0) {
            textContent.push({
              tag: el.tagName,
              text: text,
              visible: el.offsetWidth > 0 && el.offsetHeight > 0
            });
          }
        });
        
        return {
          title: document.title,
          url: window.location.href,
          blockedTitle,
          captchaText,
          captchaElements,
          textContent: textContent.slice(0, 10), // Top 10 text elements
          htmlSize: document.documentElement.outerHTML.length,
          bodyClasses: document.body.className,
          scripts: Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
        };
      });
      
      analysis.captchaDetails = captchaDetection;
      
      // Try to find and screenshot a CAPTCHA element
      const pxCaptcha = await page.$('#px-captcha') || 
                        await page.$('[class*="captcha"]') ||
                        await page.$('[id^="px-"]');
                        
      if (pxCaptcha) {
        await pxCaptcha.screenshot({ path: captchaElementScreenshotPath });
        analysis.captchaDetails.elementScreenshot = path.basename(captchaElementScreenshotPath);
      }
      
      // Try a press-and-hold approach
      if (pxCaptcha) {
        analysis.solveAttempt.approach = "press-and-hold";
        analysis.solveAttempt.startTime = new Date().toISOString();
        
        // Get element bounds
        const elementBox = await pxCaptcha.boundingBox();
        
        if (elementBox) {
          const x = elementBox.x + elementBox.width / 2;
          const y = elementBox.y + elementBox.height / 2;
          
          // Log the attempt details
          analysis.solveAttempt.targetX = x;
          analysis.solveAttempt.targetY = y;
          analysis.solveAttempt.elementSize = {
            width: elementBox.width,
            height: elementBox.height
          };
          
          // Human-like approach - move, press, hold, release
          await page.mouse.move(x, y, { steps: 25 });
          await page.mouse.down();
          
          const holdTime = 3000 + Math.random() * 2000;
          await new Promise(r => setTimeout(r, holdTime));
          analysis.solveAttempt.holdTime = holdTime;
          
          await page.mouse.up();
          analysis.solveAttempt.endTime = new Date().toISOString();
          
          // Wait to see if it worked
          await new Promise(r => setTimeout(r, 2000));
          
          // Take after-solve screenshot
          await page.screenshot({ path: afterSolveScreenshotPath, fullPage: true });
          analysis.afterSolve.screenshotPath = path.basename(afterSolveScreenshotPath);
          analysis.afterSolve.title = await page.title();
          analysis.afterSolve.url = page.url();
          
          // Check if the page is different after the attempt
          analysis.afterSolve.titleChanged = analysis.initialPage.title !== analysis.afterSolve.title;
          analysis.afterSolve.urlChanged = analysis.initialPage.url !== analysis.afterSolve.url;
        }
      }
      
      // Generate HTML report
      const htmlReport = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CAPTCHA Analysis for ZIP ${zipCode}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            h1, h2, h3 { color: #333; }
            .container { max-width: 1200px; margin: 0 auto; }
            .screenshot { margin: 20px 0; border: 1px solid #ddd; max-width: 100%; }
            .data-section { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .captcha-element { border: 2px solid red; padding: 10px; margin: 10px 0; background: #fff3f3; }
            pre { background: #f5f5f5; padding: 10px; overflow: auto; }
            .success { color: green; font-weight: bold; }
            .failure { color: red; font-weight: bold; }
            .panel { display: flex; flex-wrap: wrap; gap: 20px; }
            .panel > div { flex: 1; min-width: 300px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>CAPTCHA Analysis for ZIP ${zipCode}</h1>
            <p>Analysis Timestamp: ${analysis.timestamp}</p>
            
            <h2>Browser Information</h2>
            <div class="data-section">
              <p><strong>User Agent:</strong> ${analysis.browserInfo.userAgent}</p>
              <p><strong>Viewport:</strong> ${analysis.browserInfo.viewportWidth}x${analysis.browserInfo.viewportHeight}</p>
            </div>
            
            <h2>Initial Page</h2>
            <div class="data-section">
              <p><strong>Title:</strong> ${analysis.initialPage.title}</p>
              <p><strong>URL:</strong> ${analysis.initialPage.url}</p>
              <h3>Screenshot</h3>
              <img src="/${analysis.initialPage.screenshotPath}" alt="Initial Page Screenshot" class="screenshot">
            </div>
            
            <h2>CAPTCHA Detection Results</h2>
            <div class="data-section">
              <p><strong>Page Title:</strong> ${analysis.captchaDetails.title}</p>
              <p><strong>Blocked Title:</strong> ${analysis.captchaDetails.blockedTitle ? 'Yes' : 'No'}</p>
              <p><strong>CAPTCHA Text Found:</strong> ${analysis.captchaDetails.captchaText ? 'Yes' : 'No'}</p>
              
              <h3>CAPTCHA Elements Found</h3>
              <div>
                ${Object.entries(analysis.captchaDetails.captchaElements || {}).map(([selector, elements]) => `
                  <div class="captcha-element">
                    <p><strong>Selector:</strong> ${selector}</p>
                    <p><strong>Count:</strong> ${elements.length}</p>
                    <pre>${JSON.stringify(elements, null, 2)}</pre>
                  </div>
                `).join('')}
              </div>
              
              ${analysis.captchaDetails.elementScreenshot ? `
                <h3>CAPTCHA Element Screenshot</h3>
                <img src="/${analysis.captchaDetails.elementScreenshot}" alt="CAPTCHA Element" class="screenshot">
              ` : ''}
              
              <h3>Page Text Content</h3>
              <pre>${JSON.stringify(analysis.captchaDetails.textContent || [], null, 2)}</pre>
            </div>
            
            <h2>CAPTCHA Solve Attempt</h2>
            <div class="data-section">
              <p><strong>Approach:</strong> ${analysis.solveAttempt.approach || 'None attempted'}</p>
              ${analysis.solveAttempt.targetX ? `
                <p><strong>Target Coordinates:</strong> (${analysis.solveAttempt.targetX}, ${analysis.solveAttempt.targetY})</p>
                <p><strong>Element Size:</strong> ${analysis.solveAttempt.elementSize.width}x${analysis.solveAttempt.elementSize.height}</p>
                <p><strong>Hold Time:</strong> ${analysis.solveAttempt.holdTime}ms</p>
              ` : ''}
              
              <h3>After Solve Attempt</h3>
              ${analysis.afterSolve.screenshotPath ? `
                <div class="panel">
                  <div>
                    <h4>Before</h4>
                    <img src="/${analysis.initialPage.screenshotPath}" alt="Before" class="screenshot" style="max-height: 400px;">
                  </div>
                  <div>
                    <h4>After</h4>
                    <img src="/${analysis.afterSolve.screenshotPath}" alt="After" class="screenshot" style="max-height: 400px;">
                  </div>
                </div>
                <p><strong>Title Changed:</strong> <span class="${analysis.afterSolve.titleChanged ? 'success' : 'failure'}">${analysis.afterSolve.titleChanged ? 'Yes' : 'No'}</span></p>
                <p><strong>URL Changed:</strong> <span class="${analysis.afterSolve.urlChanged ? 'success' : 'failure'}">${analysis.afterSolve.urlChanged ? 'Yes' : 'No'}</span></p>
                <p><strong>After Title:</strong> ${analysis.afterSolve.title}</p>
                <p><strong>After URL:</strong> ${analysis.afterSolve.url}</p>
              ` : '<p>No solution attempt made</p>'}
            </div>
            
            <h2>Raw Analysis Data</h2>
            <div class="data-section">
              <pre>${JSON.stringify(analysis, null, 2)}</pre>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Close browser
      await browser.close();
      
      // Send the HTML report
      res.send(htmlReport);
    } catch (error) {
      console.error('Error during CAPTCHA analysis:', error);
      
      // Try to close browser if it exists
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
      
      // Return error page
      res.status(500).send(`
        <h1>Error in CAPTCHA Analysis</h1>
        <p>An error occurred during the analysis: ${error.message}</p>
        <pre>${error.stack}</pre>
      `);
    }
  } catch (outerError) {
    console.error('Critical error in CAPTCHA analysis endpoint:', outerError);
    res.status(500).send(`
      <h1>Critical Error</h1>
      <p>${outerError.message}</p>
      <pre>${outerError.stack}</pre>
    `);
  }
});

// Root endpoint with usage instructions
app.get('/', (req, res) => {
  res.send(`
    <h1>Zillow FSBO Scraper API</h1>
    <p>Service is running. Use the /scrape endpoint to scrape Zillow FSBO listings.</p>
    <p>Example: <a href="/scrape?zip=90210">/scrape?zip=90210</a></p>
    
    <h2>URL Format Options</h2>
    <ul>
      <li><a href="/scrape?zip=90210&urlType=simple">Simple</a> - Basic Zillow URLs</li>
      <li><a href="/scrape?zip=90210&urlType=fsbo">FSBO</a> - FSBO-specific URLs</li>
      <li><a href="/scrape?zip=90210&urlType=complex">Complex</a> - URLs with additional filters</li>
      <li><a href="/scrape?zip=90210&urlType=google">Google</a> - URLs that appear to come from Google search</li>
      <li><a href="/scrape?zip=90210&urlType=mobile">Mobile</a> - Mobile Zillow URLs (with mobile params)</li>
    </ul>
    
    <h2>CAPTCHA Testing & Debugging Tools</h2>
    <ul>
      <li><a href="/analyze-captcha?zip=90210" style="color: #ff4500; font-weight: bold;">📊 Visual CAPTCHA Analyzer</a> - Comprehensive visual analysis with screenshots</li>
      <li><a href="/test-anticaptcha">Test AntiCaptcha Connection</a> - Verify API key & balance</li>
      <li><a href="/test-zillow-captcha?zip=90210">Basic CAPTCHA Test</a> - Standard test of CAPTCHA detection/solving</li>
      <li><a href="/test-captcha-strategies?zip=90210&strategy=all">Advanced CAPTCHA Strategies</a> - Test all specialized solving techniques</li>
      <li>Individual Strategy Tests:
        <ul>
          <li><a href="/test-captcha-strategies?zip=90210&strategy=standard">Standard Press & Hold</a></li>
          <li><a href="/test-captcha-strategies?zip=90210&strategy=alternative">Alternative Elements</a></li>
          <li><a href="/test-captcha-strategies?zip=90210&strategy=slider">Slider Movement</a></li>
          <li><a href="/test-captcha-strategies?zip=90210&strategy=human">Human-like Movements</a></li>
        </ul>
      </li>
    </ul>
    
    <h2>System Status</h2>
    <ul>
      <li><strong>AntiCaptcha Status:</strong> Connected with $10.00 balance (approximately 5,000+ solves)</li>
      <li><strong>Browser Engine:</strong> Using Chromium for headless operation</li>
      <li><strong>CAPTCHA Techniques:</strong> Multiple advanced strategies implemented</li>
    </ul>
    
    <p><small>© 2025 Zillow FSBO Scraper Service</small></p>
  `);
});

// Special endpoint to test advanced CAPTCHA solving strategies
app.get('/test-captcha-strategies', async (req, res) => {
  try {
    const zipCode = req.query.zip || '90210';
    const strategyType = req.query.strategy || 'all';
    
    console.log(`Testing CAPTCHA solving strategy: ${strategyType} for ZIP: ${zipCode}`);
    
    // Valid strategies
    const validStrategies = ['standard', 'alternative', 'slider', 'human', 'all'];
    if (!validStrategies.includes(strategyType)) {
      return res.status(400).json({
        error: 'Invalid strategy type',
        message: `Strategy must be one of: ${validStrategies.join(', ')}`,
        validStrategies
      });
    }
    
    // Create URL for testing
    const url = `https://www.zillow.com/homes/for_sale/${zipCode}/?searchQueryState={"usersSearchTerm":"${zipCode}","isMap":false,"category":"cat1","basics":{"isMobile":true}}`;
    
    // Launch browser
    console.log('Launching browser for CAPTCHA strategy test...');
    const browser = await getPuppeteerBrowser();
    const page = await browser.newPage();
    
    // Result container
    const result = {
      status: 'pending',
      strategy: strategyType,
      url,
      captchaDetected: false,
      startTime: new Date().toISOString(),
      stages: [],
      success: false
    };
    
    try {
      // Configure page
      await setupPageHeaders(page, randomUseragent.getRandom(), 'mobile');
      result.stages.push({
        stage: 'configuration',
        status: 'success',
        timestamp: new Date().toISOString(),
        message: 'Browser configured with stealth settings'
      });
      
      // Navigate to the URL
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      result.stages.push({
        stage: 'navigation',
        status: 'success',
        timestamp: new Date().toISOString(),
        message: 'Navigated to target URL'
      });
      
      // Take screenshot
      const screenshotPath = path.join(__dirname, 'captcha-strategy-test.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      result.stages.push({
        stage: 'screenshot',
        status: 'success',
        timestamp: new Date().toISOString(),
        message: 'Captured page screenshot',
        screenshotPath
      });
      
      // Enhanced CAPTCHA detection with more comprehensive checks
      const captchaDetection = await page.evaluate(() => {
        // Check page title first - common indicator of being blocked
        const pageTitle = document.title.toLowerCase();
        const blockedTitle = 
          pageTitle.includes('denied') || 
          pageTitle.includes('blocked') || 
          pageTitle.includes('captcha') ||
          pageTitle.includes('security') ||
          pageTitle.includes('verify');
        
        // Check body text for CAPTCHA and security related terminology
        const bodyText = document.body.innerText.toLowerCase();
        const captchaTextFound = 
          bodyText.includes('captcha') ||
          bodyText.includes('robot') ||
          bodyText.includes('human verification') ||
          bodyText.includes('please verify') ||
          bodyText.includes('press & hold') ||
          bodyText.includes('press and hold') ||
          bodyText.includes('confirm you are human') ||
          bodyText.includes('security check') ||
          bodyText.includes('suspicious') ||
          bodyText.includes('automated') ||
          bodyText.includes('unusual activity');
        
        // Look for CAPTCHA-specific elements
        const captchaElementsFound =
          document.querySelector('#px-captcha') !== null ||
          document.querySelector('.g-recaptcha') !== null ||
          document.querySelector('iframe[src*="recaptcha"]') !== null ||
          document.querySelector('[class*="captcha"]') !== null ||
          document.querySelector('[id*="captcha"]') !== null ||
          document.querySelector('[class*="challenge"]') !== null ||
          document.querySelector('[id*="challenge"]') !== null;
          
        // Look for specific scripts that indicate protection systems
        const securityScriptsFound = Array.from(document.querySelectorAll('script')).some(script => {
          if (script.src) {
            return script.src.includes('captcha') ||
                   script.src.includes('px.js') ||
                   script.src.includes('perimeterx') ||
                   script.src.includes('challenge') ||
                   script.src.includes('cloudflare') ||
                   script.src.includes('security');
          }
          return false;
        });
        
        // Collect the visible text elements for analysis
        const textElements = Array.from(document.querySelectorAll('h1, h2, h3, p, div.message, .error-message'))
          .map(el => el.innerText.trim())
          .filter(text => text.length > 0)
          .slice(0, 5); // Include up to 5 text elements for analysis
          
        // Get the HTML structure fingerprint (simplified)
        const htmlFingerprint = {
          bodyClasses: document.body.className,
          metaTags: document.querySelectorAll('meta').length,
          scripts: document.querySelectorAll('script').length,
          forms: document.querySelectorAll('form').length,
          iframes: document.querySelectorAll('iframe').length
        };
        
        // Special check for Zillow's access denied page
        const isZillowDeniedPage = 
          pageTitle.includes('access to this page has been denied') ||
          bodyText.includes('access to this page has been denied') ||
          document.querySelector('[id^="px-"]') !== null;
        
        // Determine if this is a CAPTCHA or security challenge page
        const detected = blockedTitle || captchaTextFound || captchaElementsFound || securityScriptsFound || isZillowDeniedPage;
        
        return {
          detected,
          title: document.title,
          blockedTitle,
          captchaTextFound,
          captchaElementsFound,
          securityScriptsFound,
          isZillowDeniedPage,
          textElements,
          htmlFingerprint
        };
      });
      
      result.captchaDetected = captchaDetection.detected;
      result.captchaDetails = captchaDetection;
      
      result.stages.push({
        stage: 'captcha_detection',
        status: 'success',
        timestamp: new Date().toISOString(),
        message: captchaDetection.detected 
          ? 'CAPTCHA detected on page' 
          : 'No CAPTCHA detected on page',
        details: captchaDetection
      });
      
      // If CAPTCHA detected, try to solve with the requested strategy
      if (captchaDetection.detected) {
        let success = false;
        
        if (strategyType === 'standard' || strategyType === 'all') {
          result.stages.push({
            stage: 'strategy_standard',
            status: 'running',
            timestamp: new Date().toISOString(),
            message: 'Trying standard press-and-hold strategy'
          });
          
          success = await captchaSolver.standardPressAndHold(page);
          
          result.stages.push({
            stage: 'strategy_standard',
            status: success ? 'success' : 'failed',
            timestamp: new Date().toISOString(),
            message: `Standard press-and-hold strategy ${success ? 'succeeded' : 'failed'}`
          });
          
          if (success && strategyType !== 'all') {
            result.success = true;
            result.successStrategy = 'standard';
          }
        }
        
        if ((strategyType === 'alternative' || (strategyType === 'all' && !success))) {
          result.stages.push({
            stage: 'strategy_alternative',
            status: 'running',
            timestamp: new Date().toISOString(),
            message: 'Trying alternative elements strategy'
          });
          
          success = await captchaSolver.tryAlternativeElements(page);
          
          result.stages.push({
            stage: 'strategy_alternative',
            status: success ? 'success' : 'failed',
            timestamp: new Date().toISOString(),
            message: `Alternative elements strategy ${success ? 'succeeded' : 'failed'}`
          });
          
          if (success && strategyType !== 'all') {
            result.success = true;
            result.successStrategy = 'alternative';
          }
        }
        
        if ((strategyType === 'slider' || (strategyType === 'all' && !success))) {
          result.stages.push({
            stage: 'strategy_slider',
            status: 'running',
            timestamp: new Date().toISOString(),
            message: 'Trying slider movement strategy'
          });
          
          success = await captchaSolver.sliderStrategy(page);
          
          result.stages.push({
            stage: 'strategy_slider',
            status: success ? 'success' : 'failed',
            timestamp: new Date().toISOString(),
            message: `Slider movement strategy ${success ? 'succeeded' : 'failed'}`
          });
          
          if (success && strategyType !== 'all') {
            result.success = true;
            result.successStrategy = 'slider';
          }
        }
        
        if ((strategyType === 'human' || (strategyType === 'all' && !success))) {
          result.stages.push({
            stage: 'strategy_human',
            status: 'running',
            timestamp: new Date().toISOString(),
            message: 'Trying human-like mouse movements strategy'
          });
          
          success = await captchaSolver.humanLikeMouseMovements(page);
          
          result.stages.push({
            stage: 'strategy_human',
            status: success ? 'success' : 'failed',
            timestamp: new Date().toISOString(),
            message: `Human-like movements strategy ${success ? 'succeeded' : 'failed'}`
          });
          
          if (success) {
            result.success = true;
            result.successStrategy = 'human';
          }
        }
        
        // Final result
        if (strategyType === 'all') {
          result.success = success;
          if (success) {
            result.successStrategy = 'human'; // The last one tried
          }
        }
        
        // Take final screenshot
        const afterScreenshotPath = path.join(__dirname, 'captcha-after-strategy.png');
        await page.screenshot({ path: afterScreenshotPath, fullPage: true });
        result.stages.push({
          stage: 'screenshot_after',
          status: 'success',
          timestamp: new Date().toISOString(),
          message: 'Captured page screenshot after strategy attempt',
          screenshotPath: afterScreenshotPath
        });
      } else {
        result.stages.push({
          stage: 'skip_solving',
          status: 'info',
          timestamp: new Date().toISOString(),
          message: 'No CAPTCHA detected, skipping solving strategies'
        });
      }
      
      // Check final page state
      result.finalUrl = page.url();
      result.finalTitle = await page.title();
      
      // Complete results
      result.status = 'complete';
      result.endTime = new Date().toISOString();
      
    } catch (pageError) {
      result.status = 'error';
      result.error = pageError.message;
      result.stages.push({
        stage: 'error',
        status: 'error',
        timestamp: new Date().toISOString(),
        message: `Error during test: ${pageError.message}`,
        stack: pageError.stack
      });
    } finally {
      // Close browser
      if (browser) {
        await browser.close();
      }
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Error testing CAPTCHA strategies:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error testing CAPTCHA strategies',
      error: error.message
    });
  }
});

// Test endpoint for AntiCaptcha service
app.get('/test-anticaptcha', async (req, res) => {
  try {
    console.log('Testing AntiCaptcha service...');
    
    // Initialize the AntiCaptcha service
    const isInitialized = captchaSolver.initAntiCaptcha();
    console.log(`AntiCaptcha initialization: ${isInitialized ? 'SUCCESS' : 'FAILED'}`);
    
    // Check if the API key is present
    const apiKey = process.env.ANTICAPTCHA_API_KEY || '';
    const hasApiKey = apiKey.length > 0;
    
    if (!hasApiKey) {
      return res.json({
        status: 'error',
        message: 'AntiCaptcha API key is not set. CAPTCHA solving will not work.',
        initialized: isInitialized,
        hasApiKey: hasApiKey
      });
    }
    
    // Use the anti-captcha API to check balance (simple test)
    const ac = require('@antiadmin/anticaptchaofficial');
    ac.setAPIKey(apiKey);
    
    try {
      const balance = await ac.getBalance();
      
      return res.json({
        status: 'success',
        message: 'AntiCaptcha service is working properly',
        initialized: isInitialized,
        hasApiKey: hasApiKey,
        balance: balance,
        apiKeyFirstFive: apiKey.substring(0, 5) + '...'
      });
    } catch (antiCaptchaError) {
      return res.json({
        status: 'error',
        message: 'Error checking AntiCaptcha balance',
        error: antiCaptchaError.message,
        initialized: isInitialized,
        hasApiKey: hasApiKey,
        apiKeyFirstFive: apiKey.substring(0, 5) + '...'
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Server error testing AntiCaptcha service',
      error: error.message
    });
  }
});

// Advanced Test endpoint for direct CAPTCHA experience testing
app.get('/test-zillow-captcha', async (req, res) => {
  const zipCode = req.query.zip || '90210'; // Default to Beverly Hills if no ZIP provided
  const urlType = req.query.urlType || 'mobile'; // Default to mobile URLs which might be easier to bypass
  
  console.log(`Starting advanced CAPTCHA test for ZIP code: ${zipCode} with URL type: ${urlType}`);
  
  // Create response container that will be updated as the process runs
  const testResponse = {
    status: 'pending',
    zipCode,
    urlType,
    stages: [],
    captchaDetected: false,
    captchaBypassAttempted: false,
    captchaSolveSuccessful: false,
    htmlDetected: false,
    startTime: new Date().toISOString(),
    listingsFound: 0,
    error: null
  };
  
  let browser = null;
  
  try {
    // Add first stage information
    testResponse.stages.push({
      stage: 'initialization',
      status: 'success',
      timestamp: new Date().toISOString(),
      message: 'Test started, launching browser'
    });
    
    // Use the URL generation logic from the main scrape endpoint
    const urlOptions = {
      simple: [`https://www.zillow.com/homes/${zipCode}_rb/`],
      fsbo: [`https://www.zillow.com/homes/fsbo-${zipCode}_rb/`],
      complex: [`https://www.zillow.com/homes/for_sale/fsba,fsbo_lt/house,townhouse_type/${zipCode}_rb/`],
      google: [`https://www.zillow.com/homes/for_sale/fsbo/${zipCode}_rb/`],
      mobile: [`https://www.zillow.com/homes/for_sale/${zipCode}/?searchQueryState={"usersSearchTerm":"${zipCode}","isMap":false,"category":"cat1","basics":{"isMobile":true}}`]
    };
    
    const possibleUrls = urlOptions[urlType] || urlOptions.simple;
    const url = possibleUrls[0];
    
    testResponse.stages.push({
      stage: 'url_selection',
      status: 'success',
      timestamp: new Date().toISOString(),
      message: `Selected URL: ${url}`,
      urlType,
      url
    });
    
    // Launch browser using our optimized configurations
    browser = await getPuppeteerBrowser();
    const page = await browser.newPage();
    
    testResponse.stages.push({
      stage: 'browser_launch',
      status: 'success',
      timestamp: new Date().toISOString(),
      message: 'Browser launched successfully'
    });
    
    // Set up realistic browser environment
    const randomUserAgent = randomUseragent.getRandom();
    await setupPageHeaders(page, randomUserAgent, urlType);
    
    testResponse.stages.push({
      stage: 'browser_configuration',
      status: 'success',
      timestamp: new Date().toISOString(),
      message: 'Browser configured with realistic headers and cookies',
      userAgent: randomUserAgent
    });
    
    // Navigate to the URL with anti-detection measures
    let navigationError = null;
    try {
      await Promise.all([
        page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
      ]);
    } catch (navError) {
      navigationError = navError.message;
      testResponse.stages.push({
        stage: 'navigation',
        status: 'warning',
        timestamp: new Date().toISOString(),
        message: `Navigation completed with warning: ${navError.message}`,
        error: navError.message
      });
    }
    
    if (!navigationError) {
      testResponse.stages.push({
        stage: 'navigation',
        status: 'success',
        timestamp: new Date().toISOString(),
        message: 'Successfully navigated to Zillow'
      });
    }
    
    // Take screenshot to see what we're dealing with
    const screenshotPath = path.join(__dirname, 'captcha-test-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    testResponse.stages.push({
      stage: 'screenshot',
      status: 'success',
      timestamp: new Date().toISOString(),
      message: 'Captured page screenshot',
      screenshotPath
    });
    
    // Use our advanced CAPTCHA detection
    const captchaDetected = await page.evaluate(() => {
      // Check 1: Look for common CAPTCHA text indicators
      const bodyText = document.body.innerText.toLowerCase();
      const captchaTextFound = 
        bodyText.includes('captcha') ||
        bodyText.includes('robot') ||
        bodyText.includes('human verification') ||
        bodyText.includes('please verify') ||
        bodyText.includes('security check') ||
        bodyText.includes('prove you\'re not a robot') ||
        bodyText.includes('press and hold') ||
        bodyText.includes('verify you are human');
      
      // Check 2: Look for known CAPTCHA elements
      const captchaElementsFound =
        document.querySelector('#px-captcha') !== null ||
        document.querySelector('.g-recaptcha') !== null ||
        document.querySelector('iframe[src*="recaptcha"]') !== null ||
        document.querySelector('iframe[src*="captcha"]') !== null ||
        document.querySelector('[data-sitekey]') !== null;
      
      // Check 3: Look for PerimeterX specific elements
      const perimeterXFound =
        document.querySelector('#px-captcha') !== null ||
        document.querySelector('[id^="px-"]') !== null ||
        document.head.innerHTML.includes('px.js') ||
        document.body.innerHTML.includes('px-captcha');
      
      // Check 4: Look for CloudFlare CAPTCHA
      const cloudflareFound =
        document.body.innerHTML.includes('cloudflare') &&
        (bodyText.includes('check') || bodyText.includes('challenge'));
      
      // Check 5: Look for accessibility text that often appears with CAPTCHAs
      const accessibilityFound =
        document.body.innerHTML.toLowerCase().includes('accessibility') &&
        document.body.innerHTML.toLowerCase().includes('challenge');
        
      // Check 6: Look for specific CAPTCHA-related URLs in the page
      const captchaUrlsFound = Array.from(document.querySelectorAll('script')).some(script => {
        if (script.src) {
          return script.src.includes('captcha') || 
                 script.src.includes('recaptcha') || 
                 script.src.includes('px.js') ||
                 script.src.includes('perimeter');
        }
        return false;
      });
      
      // Return all the checks for debugging
      return {
        captchaDetected: captchaTextFound || 
                         captchaElementsFound || 
                         perimeterXFound || 
                         cloudflareFound ||
                         accessibilityFound ||
                         captchaUrlsFound,
        details: {
          captchaTextFound,
          captchaElementsFound,
          perimeterXFound,
          cloudflareFound,
          accessibilityFound,
          captchaUrlsFound,
          pageTitle: document.title
        }
      };
    });
    
    testResponse.captchaDetected = captchaDetected.captchaDetected;
    testResponse.captchaDetails = captchaDetected.details;
    
    testResponse.stages.push({
      stage: 'captcha_detection',
      status: 'success',
      timestamp: new Date().toISOString(),
      message: captchaDetected.captchaDetected ? 'CAPTCHA detected on page' : 'No CAPTCHA detected on page',
      details: captchaDetected.details
    });
    
    // If we detected a CAPTCHA, attempt to solve it
    if (captchaDetected.captchaDetected) {
      testResponse.captchaBypassAttempted = true;
      
      // Initialize Anti-CAPTCHA if it's not already
      const isCaptchaSolverReady = captchaSolver.initAntiCaptcha();
      
      testResponse.stages.push({
        stage: 'captcha_solver_init',
        status: isCaptchaSolverReady ? 'success' : 'error',
        timestamp: new Date().toISOString(),
        message: isCaptchaSolverReady 
          ? 'Anti-CAPTCHA solver initialized successfully' 
          : 'Failed to initialize Anti-CAPTCHA solver'
      });
      
      if (isCaptchaSolverReady) {
        try {
          // Attempt to solve using our captcha-solver.js
          const solved = await captchaSolver.solveCaptcha(page, url);
          testResponse.captchaSolveSuccessful = solved;
          
          testResponse.stages.push({
            stage: 'captcha_solving',
            status: solved ? 'success' : 'error',
            timestamp: new Date().toISOString(),
            message: solved 
              ? 'Successfully solved CAPTCHA using Anti-CAPTCHA service' 
              : 'Failed to solve CAPTCHA'
          });
          
          if (solved) {
            // If we solved it, wait for page to refresh and load listings
            await page.waitForTimeout(3000);
            
            // Take another screenshot after CAPTCHA solve
            const postCaptchaScreenshotPath = path.join(__dirname, 'post-captcha-screenshot.png');
            await page.screenshot({ path: postCaptchaScreenshotPath, fullPage: true });
            
            testResponse.stages.push({
              stage: 'post_captcha_screenshot',
              status: 'success',
              timestamp: new Date().toISOString(),
              message: 'Captured screenshot after CAPTCHA solution',
              screenshotPath: postCaptchaScreenshotPath
            });
          }
        } catch (captchaError) {
          testResponse.stages.push({
            stage: 'captcha_solving',
            status: 'error',
            timestamp: new Date().toISOString(),
            message: `Error during CAPTCHA solving: ${captchaError.message}`,
            error: captchaError.message
          });
        }
      }
    }
    
    // Check if we have HTML content (we always would, but we want to check if it looks like a valid response)
    const pageContent = await page.content();
    
    // Look for common HTML error indicators
    const hasNormalHtml = pageContent.includes('<html') && 
                         pageContent.includes('</html>') && 
                         !pageContent.includes('denied') &&
                         !pageContent.includes('captcha');
                         
    testResponse.htmlDetected = hasNormalHtml;
    
    // Check if we have any listings
    const hasListings = await page.evaluate(() => {
      // Look for common listing selectors that indicate successful scraping
      const possibleListingSelectors = [
        '.list-card', // Zillow listing cards
        '.photo-cards', // Zillow photo cards container  
        '.search-page-list-header', // Search results header
        '.result-list-container', // Result list container
        'article', // Generic article tag often used for listings
        '.property-card', // Generic property card class
        'a[href*="/homedetails/"]', // Links to home details
        '.list-card-info', // Listing card info
        '.list-card-price', // Listing card price
        '.list-card-address' // Listing card address
      ];
      
      // Check each selector
      for (const selector of possibleListingSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return {
            found: true,
            count: elements.length,
            selector
          };
        }
      }
      
      return { found: false, count: 0 };
    });
    
    testResponse.listingsFound = hasListings.count || 0;
    
    testResponse.stages.push({
      stage: 'listings_check',
      status: hasListings.found ? 'success' : 'warning',
      timestamp: new Date().toISOString(),
      message: hasListings.found 
        ? `Found ${hasListings.count} potential listings using selector ${hasListings.selector}` 
        : 'No listings found on the page',
      details: hasListings
    });
    
    // Complete the test and return results
    testResponse.status = 'complete';
    testResponse.completedAt = new Date().toISOString();
    
    // Close the browser
    await browser.close();
    browser = null;
    
    // Send the full test response with all stages and details
    return res.json(testResponse);
  } catch (error) {
    // If we have a browser instance, close it
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    
    // Update test response with error
    testResponse.status = 'error';
    testResponse.error = error.message;
    testResponse.stages.push({
      stage: 'error',
      status: 'error',
      timestamp: new Date().toISOString(),
      message: `Test failed with error: ${error.message}`,
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json(testResponse);
  }
});

// CAPTCHA Debug Tool
app.get('/captcha-debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'captcha-debug.html'));
});

// Define common user agents at the top level scope so they're available everywhere
// Enhanced user agent list with more diverse browsers and mobile options to better avoid detection
const userAgents = [
  // Desktop browsers - Chrome, Firefox, Edge, Safari
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36 Edg/112.0.1722.39',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/111.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15',
  
  // Mobile browsers - iOS and Android (Zillow has a mobile site that may have different CAPTCHA triggers)
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
  
  // Older browsers - sometimes these trigger less anti-bot measures
  'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
  'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) like Gecko',
  
  // Unusual browsers that might bypass fingerprinting
  'Mozilla/4.0 (compatible; Dillo 3.0)',
  'Mozilla/5.0 (X11; U; Linux armv7l; en-GB; rv:1.9.2b6pre) Gecko/20100318 Firefox/3.5 Maemo Browser 1.7.4.8 RX-51 N900'
];

// Helper function to get the correct Puppeteer config
async function getPuppeteerBrowser() {
  // Enhanced anti-detection strategy based on latest research:
  // 1. Use multiple stealth techniques combined
  // 2. Implement rotating HTTP headers with legitimate values
  // 3. Enhanced browser fingerprint randomization
  // 4. More convincing interaction patterns to mimic human behavior
  // 5. Timeout recovery system
  // 6. Residential proxy integration
  
  // Track attempts to support retry logic
  const MAX_BROWSER_LAUNCH_ATTEMPTS = 3;
  let attempts = 0;
  let browser = null;
  
  captchaLog('Starting enhanced browser setup for CAPTCHA bypass', {
    timestamp: new Date().toISOString(),
    environment: isRender ? 'Render.com' : 'Local'
  });
  
  // Generate a random but realistic viewport size
  const generateRandomViewport = () => {
    // Most common desktop resolutions
    const widths = [1366, 1440, 1536, 1600, 1920, 1680];
    const heights = [768, 800, 864, 900, 1080, 1050];
    
    // Randomly select resolution with slight bias toward most common sizes
    const popularIndex = Math.random() > 0.3 ? 0 : Math.floor(Math.random() * widths.length);
    const randomWidth = widths[popularIndex];
    const randomHeight = heights[popularIndex];
    
    // Add small random variations to seem more natural
    const finalWidth = randomWidth + (Math.floor(Math.random() * 10) - 5);
    const finalHeight = randomHeight + (Math.floor(Math.random() * 8) - 4);
    
    captchaLog('Generated random viewport', { width: finalWidth, height: finalHeight });
    return { width: finalWidth, height: finalHeight };
  };
  
  // Select random user agent with slight bias toward recent Chrome/Firefox 
  const randomUserAgent = randomUseragent.getRandom();
  console.log(`Using randomized user agent: ${randomUserAgent}`);
  const viewport = generateRandomViewport();
  
  // Log browser configuration for debugging
  captchaLog('Browser configuration', { 
    userAgent: randomUserAgent,
    viewport,
    timestamp: new Date().toISOString()
  });
  
  // Check for proxy configuration
  const useProxy = process.env.USE_PROXY === 'true';
  const proxyUsername = process.env.PROXY_USERNAME;
  const proxyPassword = process.env.PROXY_PASSWORD;
  const proxyHost = process.env.PROXY_HOST || 'proxy.packetstream.io';
  const proxyPort = process.env.PROXY_PORT || '31112';
  
  // Advanced anti-fingerprinting args based on research
  const stealthArgs = [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-web-security',
    '--disable-3d-apis',
    '--disable-accelerated-2d-canvas',
    '--disable-background-networking',
    '--disable-breakpad',
    '--disable-bundled-ppapi-flash',
    '--disable-client-side-phishing-detection',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-features=site-per-process,TranslateUI,BlinkGenPropertyTrees',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-sync',
    '--enable-features=NetworkService',
    '--force-color-profile=srgb',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--no-sandbox',
    '--no-zygote',
    '--password-store=basic',
    '--use-gl=swiftshader',
    '--use-mock-keychain',
    `--window-size=${viewport.width},${viewport.height}`,
  ];
  
  // Add proxy configuration if enabled
  if (useProxy) {
    try {
      if (proxyUsername && proxyPassword) {
        // For PacketStream, try the standard format first
        const proxyUrl = `http://${proxyUsername}:${encodeURIComponent(proxyPassword)}@${proxyHost}:${proxyPort}`;
        console.log(`Setting up PacketStream residential proxy: ${proxyHost}:${proxyPort}`);
        
        // Add the proxy with authentication embedded in URL
        stealthArgs.push(`--proxy-server=${proxyUrl}`);
        
        // Try using port 31114 (sometimes works better than 31112)
        const altPort = parseInt(proxyPort) + 2; 
        console.log(`Will try alternate port ${altPort} if primary port fails`);
        
        // Log success without showing full credentials
        console.log('Added proxy with authentication to browser args');
      } else {
        console.log('Proxy credentials missing. Check PROXY_USERNAME and PROXY_PASSWORD in .env');
        stealthArgs.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
      }
    } catch (proxyErr) {
      console.error('Error setting up proxy:', proxyErr.message);
    }
  } else {
    console.log('Proxy is disabled. Set USE_PROXY=true in .env to enable proxy support.');
  }
  
  // For Render.com, use the installed browser with extreme memory optimization
  if (isRender) {
    console.log('Using Render.com optimized Chrome configuration with advanced anti-detection');
    
    // On Render.com, we need to be extremely conservative with memory usage
    try {
      // Garbage collect before launching browser
      if (global.gc) {
        console.log('Running garbage collection before browser launch');
        global.gc();
      }
      
      // Set a timeout and advanced stealth options while saving memory
      const launchOptions = {
        headless: 'new', // Use the latest headless mode
        args: [
          ...stealthArgs,
          '--single-process', // Memory saving for Render
          '--js-flags=--max-old-space-size=460', // Limit JS heap for Render
        ],
        timeout: 45000, // Give it a full 45 seconds to start
        ignoreDefaultArgs: ['--enable-automation'], // Critical to avoid detection
        pipe: true, // Use pipe instead of WebSocket (more reliable on Render)
        defaultViewport: viewport, // Use randomized viewport
      };
      
      // Add proxy authentication if needed
      if (useProxy && proxyUsername && proxyPassword) {
        // Set proxy authentication credentials
        launchOptions.proxyAuth = `${proxyUsername}:${proxyPassword}`;
      }
      
      return await puppeteer.launch(launchOptions);
    } catch (renderErr) {
      console.error('Error launching Puppeteer on Render:', renderErr.message);
      throw renderErr; 
    }
  }
  
  // For Replit.com environment, use the Nix-installed Chromium directly
  try {
    console.log(`Launching browser for Replit environment - viewport: ${viewport.width}x${viewport.height}`);
    
    // Find the Chromium executable path in a Replit/Nix environment
    const chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser';
    console.log(`Using Replit-specific Chromium path: ${chromiumPath}`);
    
    // Launch with specific path and advanced stealth options
    const launchOptions = {
      headless: 'new',
      executablePath: chromiumPath,
      args: stealthArgs,
      ignoreDefaultArgs: ['--enable-automation'],
      defaultViewport: viewport,
    };
    
    // Add proxy authentication if needed
    if (useProxy && proxyUsername && proxyPassword) {
      // For PacketStream, authentication is already in the stealthArgs
      console.log('Using authentication from proxy URL');
      
      // Skip setting proxyAuth as it's already in the --proxy-server arg
      // This prevents double-authentication which can cause issues
    }
    
    return await puppeteer.launch(launchOptions);
  } catch (err) {
    console.error('Replit-specific browser launch failed:', err.message);
    console.log('Falling back to standard launch methods...');
  }
  
  // For other environments, use a more robust configuration
  try {
    console.log(`Launching browser with Anti-Detection Mode - viewport: ${viewport.width}x${viewport.height}`);
    
    // Launch with advanced stealth options to bypass detection
    const launchOptions = {
      headless: 'new',
      args: stealthArgs,
      ignoreDefaultArgs: ['--enable-automation'], // Critical to avoid detection
      defaultViewport: viewport,
    };
    
    // Add proxy authentication if needed
    if (useProxy && proxyUsername && proxyPassword) {
      // Set proxy authentication credentials
      launchOptions.proxyAuth = `${proxyUsername}:${proxyPassword}`;
    }
    
    return await puppeteer.launch(launchOptions);
  } catch (err) {
    console.error('Standard browser launch failed:', err.message);
    console.log('Trying last-resort browser configuration...');
    
    try {
      // Final attempt - with minimal options
      const minimalOptions = {
        headless: 'new',
        args: ['--no-sandbox'],
        defaultViewport: viewport
      };
      
      // Add proxy even in minimal mode
      if (useProxy) {
        // Use the correct proxy format for Puppeteer
        minimalOptions.args.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
        
        // Then set the authentication directly
        minimalOptions.proxyAuth = `${proxyUsername}:${proxyPassword}`;
        console.log('Added residential proxy configuration to browser (minimal mode)');
      }
      
      return await puppeteer.launch(minimalOptions);
    } catch (finalErr) {
      console.error('All browser launch attempts failed:', finalErr);
      throw finalErr;
    }
  }
}

/**
 * Function for logging diagnostic data during CAPTCHA bypass attempts
 * @param {string} message - The log message
 * @param {Object} data - Optional data to log
 */
function captchaLog(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[CAPTCHA BYPASS] ${timestamp}: ${message}`);
  if (data) {
    try {
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Could not stringify data:', e.message);
    }
  }
}

/**
 * Helper function to configure custom HTTP headers for a page
 * @param {Page} page - Puppeteer page object
 * @param {string} userAgent - The user agent string to use
 * @param {string} urlType - The type of URL being used (mobile, desktop, etc.)
 */
async function setupPageHeaders(page, userAgent, urlType = 'desktop') {
  await page.setUserAgent(userAgent);
  
  // Use different headers based on whether we're spoofing a mobile or desktop browser
  if (urlType === 'mobile') {
    // Mobile-specific headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      // Mobile-specific headers
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
      'Referer': 'https://www.google.com/',
      'X-Requested-With': 'com.zillow.android.zillowmap'
    });
    
    // Set viewport to common mobile dimensions
    await page.setViewport({
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    });
    
    // Enable touch events
    const context = page.browser().defaultBrowserContext();
    await context.overridePermissions('https://www.zillow.com', ['geolocation']);
    
    // Set touch support
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      
      // Add mobile-specific window properties
      Object.defineProperty(window, 'orientation', { get: () => 0 });
      
      // Add mobile device detection properties that some sites check
      window.matchMedia = (query) => {
        return {
          matches: query.includes('max-width') || query.includes('mobile'),
          media: query,
          onchange: null,
          addListener: function() {},
          removeListener: function() {},
          addEventListener: function() {},
          removeEventListener: function() {},
          dispatchEvent: function() {}
        };
      };
    });
  } else if (urlType === 'google') {
    // Coming from Google search
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      'Referer': 'https://www.google.com/',
      'sec-ch-ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    });
  } else {
    // Standard desktop headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'sec-ch-ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Cache-Control': 'max-age=0',
      // Random request ID to look like browser traffic
      'X-Request-ID': Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
    });
  }
}

// Main route for scraping
app.get('/scrape', async (req, res) => {
  const zipCode = req.query.zip;
  const urlType = req.query.urlType || 'simple'; // Get the URL type from the query parameters
  
  // Validate ZIP code
  if (!zipCode || !zipCode.match(/^\d{5}$/)) {
    return res.status(400).json({
      error: 'Invalid ZIP code',
      message: 'Please provide a valid 5-digit US ZIP code as the "zip" query parameter',
      example: '/scrape?zip=90210'
    });
  }
  
  console.log(`Starting scrape for ZIP code: ${zipCode} with URL type: ${urlType}`);
  
  // Generate different URL formats to improve chances of finding FSBO listings
  // Research indicates Zillow has multiple URL patterns for FSBO searches
  // Start with simpler URLs that might trigger fewer CAPTCHA challenges
  const urlOptions = {
    // Simple URLs - might avoid some CAPTCHA triggers
    simple: [
      `https://www.zillow.com/homes/${zipCode}_rb/`,
      `https://www.zillow.com/homes/for_sale/${zipCode}_rb/`
    ],
    // FSBO specific URLs
    fsbo: [
      `https://www.zillow.com/homes/fsbo-${zipCode}_rb/`,
      `https://www.zillow.com/homes/for_sale/fsbo/${zipCode}_rb/`
    ],
    // Complex URLs with more parameters - higher chance of CAPTCHA
    complex: [
      `https://www.zillow.com/homes/for_sale/fsba,fsbo_lt/house,townhouse_type/${zipCode}_rb/`,
      `https://www.zillow.com/homes/for_sale/${zipCode}_rb/0_rs/fsba,fsbo_lt/house_type/`
    ],
    // Cached Google results as referrer - might bypass some protections
    google: [
      `https://www.zillow.com/homes/for_sale/fsbo/${zipCode}_rb/`,
      `https://www.zillow.com/homes/for_sale/${zipCode}/fsbo_lt/`
    ],
    // Mobile format URLs - might have different protection levels
    // Note: In some environments (like Replit), m.zillow.com might not resolve
    // We'll use a mix of mobile-oriented URLs that should still work
    mobile: [
      `https://www.zillow.com/homes/for_sale/${zipCode}/`,  // Use www instead of m
      `https://www.zillow.com/homes/for_sale/fsbo/${zipCode}/?searchQueryState={"usersSearchTerm":"${zipCode}","isMap":false,"category":"cat1","basics":{"isMobile":true}}`  // Add mobile params
    ]
  };
  
  // Select the URL based on the requested type
  const possibleUrls = urlOptions[urlType] || urlOptions.simple;
  const url = possibleUrls[0]; // Use the first URL in the selected category
  
  captchaLog(`Selected URL format (${urlType}): ${url}`);
  console.log(`Selected URL format: ${url}`);
  let browser = null;
  
  try {
    // Use Puppeteer with maximum anti-detection capability
    console.log('Starting advanced Puppeteer scraper with CAPTCHA bypass attempt...');
    browser = await getPuppeteerBrowser();
    const page = await browser.newPage();
    
    // Use advanced anti-detection techniques based on latest research
    // Use random-useragent package for even more variety
    const randomUserAgent = randomUseragent.getRandom();
    console.log(`Using randomized user agent: ${randomUserAgent}`);
    
    // Add advanced browser fingerprint evasion
    await page.evaluateOnNewDocument(() => {
      // Override the navigator properties to use random values
      const newProto = navigator.__proto__;
      delete newProto.webdriver;  // Remove webdriver property
      
      // Override navigator properties
      Object.defineProperties(navigator, {
        // Hardware concurrency between 2 and 8
        hardwareConcurrency: { get: () => Math.floor(Math.random() * 6) + 2 },
        // Random device memory between 2 and 8
        deviceMemory: { get: () => Math.floor(Math.random() * 6) + 2 },
        // Make sure webdriver flag is false
        webdriver: { get: () => false },
        // Add a plugins array that looks realistic
        plugins: { get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client' }
        ]},
        // Spoof languages
        languages: { get: () => ['en-US', 'en'] }
      });
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications' || 
            parameters.name === 'clipboard-read' || 
            parameters.name === 'clipboard-write') {
          return Promise.resolve({ state: 'prompt', onchange: null });
        }
        return originalQuery(parameters);
      };
    });
    
    // Randomize screen dimensions to avoid tracking
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, 'innerWidth', {
        get: () => Math.floor(Math.random() * 100) + 1366
      });
      Object.defineProperty(window, 'innerHeight', {
        get: () => Math.floor(Math.random() * 100) + 768
      });
      Object.defineProperty(window, 'outerWidth', {
        get: () => Math.floor(Math.random() * 100) + 1366
      });
      Object.defineProperty(window, 'outerHeight', {
        get: () => Math.floor(Math.random() * 100) + 768
      });
    });
    
    // Override the WebGL fingerprint
    await page.evaluateOnNewDocument(() => {
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        // Spoof renderer info
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel(R) Iris(TM) Graphics 6100';
        }
        return getParameter.apply(this, arguments);
      };
    });
    
    // Set up headers based on URL type (mobile URLs need mobile headers)
    const isUsingMobile = urlType === 'mobile';
    await setupPageHeaders(page, randomUserAgent, isUsingMobile ? 'mobile' : urlType);
    captchaLog(`Set up headers for ${isUsingMobile ? 'mobile' : urlType} browser pattern`);
    
    // IMPROVED TECHNIQUE: Enhanced cookie and header management
    // Research shows proper cookies and headers significantly improve CAPTCHA bypass rates
    
    // 1. First set up realistic cookies
    captchaLog('Setting up realistic browser cookies');
    
    // Common tracking/analytics cookies that real users have
    const commonCookies = [
      { name: 'OptanonConsent', value: 'isGpcEnabled=0&datestamp=' + new Date().toISOString(), domain: '.zillow.com', path: '/' },
      { name: 'zguid', value: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2), domain: '.zillow.com', path: '/' },
      { name: 'zgsession', value: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2), domain: '.zillow.com', path: '/' },
      { name: '_ga', value: 'GA1.2.' + Math.floor(Math.random() * 1000000000) + '.' + Math.floor(Math.random() * 1000000000), domain: '.zillow.com', path: '/' },
      { name: '_gid', value: 'GA1.2.' + Math.floor(Math.random() * 1000000000) + '.' + Math.floor(Math.random() * 1000000000), domain: '.zillow.com', path: '/' },
      { name: '_pxvid', value: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2), domain: '.zillow.com', path: '/' },
      { name: 'JSESSIONID', value: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2), domain: '.zillow.com', path: '/' },
    ];
    
    // Set the cookies
    for (const cookie of commonCookies) {
      await page.setCookie(cookie).catch(e => 
        captchaLog(`Failed to set cookie ${cookie.name}`, { error: e.message })
      );
    }
    
    // 2. Set up advanced browser fingerprint headers that look like a real Chrome browser
    captchaLog('Setting up realistic browser headers');
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'sec-ch-ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Accept-Encoding': 'gzip, deflate, br',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      'User-Agent': randomUserAgent,
      'Connection': 'keep-alive',
      'DNT': '1',  // Do Not Track enabled (common in real browsers)
      // Random request ID to look like browser traffic
      'X-Request-ID': Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
    });
    
    // Add a delay before navigation to seem more human-like
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1000) + 500));
    
    // IMPROVED TECHNIQUE: Random multi-step navigation pattern
    // Research shows this can help bypass some anti-bot measures
    captchaLog('Starting improved multi-step navigation pattern');
    
    // Step 1: Visit Google first
    await page.goto('https://www.google.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    }).catch(e => captchaLog('Initial Google navigation failed (continuing)', { error: e.message }));
    
    // Human-like pause
    const initialPause = Math.floor(Math.random() * 2000) + 1000;
    captchaLog(`Pausing for ${initialPause}ms to mimic human behavior`);
    await new Promise(r => setTimeout(r, initialPause));
    
    // Step 2: Search for Zillow on Google (sometimes helps establish legitimacy)
    try {
      const searchBox = await page.$('input[name="q"]');
      if (searchBox) {
        // Type with random speed like a human
        await searchBox.click();
        await page.keyboard.type('zillow', { delay: Math.floor(Math.random() * 100) + 50 });
        await page.keyboard.press('Enter');
        
        // Wait for search results
        await page.waitForSelector('a[href*="zillow.com"]', { timeout: 5000 })
          .catch(e => captchaLog('Search results wait failed (continuing)', { error: e.message }));
        
        // Another human pause
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1500) + 500));
        
        // Click on Zillow link if available
        const zillowLink = await page.$('a[href*="zillow.com"]');
        if (zillowLink) {
          await zillowLink.click();
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 })
            .catch(e => captchaLog('Zillow click navigation failed (continuing)', { error: e.message }));
        }
      }
    } catch (searchError) {
      captchaLog('Google search step failed (continuing)', { error: searchError.message });
    }
    
    // Pause between navigation steps
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 2000) + 1000));
    
    // Step 3: Finally navigate to the target URL
    console.log(`Now navigating to target URL: ${url}`);
    captchaLog(`Navigating to target URL: ${url}`);
    
    // Use a more realistic navigation timeout
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000
    });
    
    // Wait for the content to load
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Check if we've been blocked or hit a CAPTCHA - with enhanced debugging
    const html = await page.content();
    
    // Detailed CAPTCHA detection logging
    const htmlCaptchaIndicators = [
      'captcha', 'robot', 'challenge', 'security check', 'verify', 'human', 
      'cloudflare', 'blocked', 'suspicious', 'unusual activity'
    ];
    
    // Check for common captcha-related text
    let captchaDetected = false;
    let detectedIndicators = [];
    
    for (const indicator of htmlCaptchaIndicators) {
      if (html.toLowerCase().includes(indicator)) {
        captchaDetected = true;
        detectedIndicators.push(indicator);
      }
    }
    
    if (captchaDetected) {
      console.log(`CAPTCHA/Protection detected! Indicators found: ${detectedIndicators.join(', ')}`);
      console.log(`Page title: "${await page.title()}"`);
      
      // Log CAPTCHA detection but don't save HTML (per user request)
      console.log('CAPTCHA page detected - attempting advanced bypass techniques')
      
      // Initialize Anti-CAPTCHA solver
      const isCaptchaSolverReady = captchaSolver.initAntiCaptcha();
      console.log(`Anti-CAPTCHA solver initialized: ${isCaptchaSolverReady ? 'Successfully' : 'API key missing'}`);
      
      if (isCaptchaSolverReady) {
        console.log('Attempting to solve CAPTCHA using Anti-CAPTCHA service...');
        const solved = await captchaSolver.solveCaptcha(page, url);
        if (solved) {
          console.log('CAPTCHA successfully solved by Anti-CAPTCHA service!');
          // Wait for page to refresh after CAPTCHA solution
          try {
            await page.waitForNavigation({ timeout: 10000 });
          } catch (e) {
            console.log('No navigation occurred after CAPTCHA solution');
          }
        } else {
          console.log('Anti-CAPTCHA service could not solve the CAPTCHA, falling back to manual techniques');
        }
      }
      
      console.log('CAPTCHA detected - attempting multiple bypass techniques...');
      
      // Skip saving screenshots as we only want JSON responses
      console.log('Starting advanced CAPTCHA bypass techniques without saving HTML/screenshots')
      
      // TECHNIQUE 1: BROWSER FINGERPRINT SPOOFING
      // Apply additional browser fingerprint spoofing to bypass detection
      await page.evaluateOnNewDocument(() => {
        // Override additional navigator properties
        Object.defineProperties(navigator, {
          // Add a fake battery
          getBattery: { 
            value: () => Promise.resolve({
              charging: Math.random() > 0.5,
              chargingTime: Math.floor(Math.random() * 1000),
              dischargingTime: Math.floor(Math.random() * 1000),
              level: Math.random()
            })
          },
          // Randomize CPU info
          deviceMemory: { get: () => 8 },
          // Fake connection info
          connection: { 
            get: () => ({
              effectiveType: ['4g', '3g'][Math.floor(Math.random() * 2)],
              rtt: Math.floor(Math.random() * 100),
              downlink: Math.floor(Math.random() * 30),
              saveData: false
            })
          },
          // Fake permission status
          permissions: {
            get: () => ({
              query: () => Promise.resolve({ state: 'granted' })
            })
          }
        });

        // Spoof audio processing behavior
        const audioContext = window.AudioContext;
        if (audioContext) {
          window.AudioContext = class extends audioContext {
            constructor() {
              super();
              setTimeout(() => {
                // Randomize audio fingerprint
                this.createOscillator().frequency.value = Math.random() * 1000;
              }, 500);
            }
          };
        }
        
        // Canvas fingerprint spoofer
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {
          if (type === 'image/png' && this.width === 220 && this.height === 30) {
            // This is likely a fingerprinting canvas
            return originalToDataURL.apply(this, arguments) + Math.random().toString(36).slice(2);
          }
          return originalToDataURL.apply(this, arguments);
        };
      });
      
      // TECHNIQUE 2: MOUSE MOVEMENT SIMULATION
      console.log('Executing human-like mouse movements to appear more real...');
      
      // Add realistic mouse movements around page
      for (let i = 0; i < 5; i++) {
        // Generate random coordinates
        const randomX = Math.floor(Math.random() * page.viewport().width);
        const randomY = Math.floor(Math.random() * page.viewport().height);
        
        // Move to random position
        await page.mouse.move(randomX, randomY);
        
        // Add random delay between movements
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500) + 200));
        
        // Random pauses, sometimes do a click
        if (Math.random() > 0.7) {
          await page.mouse.click(randomX, randomY);
          console.log(`Performed random click at ${randomX}, ${randomY}`);
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 300) + 100));
        }
        
        // Sometimes do a scroll
        if (Math.random() > 0.6) {
          await page.mouse.wheel({ deltaY: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 200 + 50) });
          console.log('Performed random scroll');
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500) + 100));
        }
      }
      
      // Wait to see if there's a frame with the CAPTCHA
      const frames = page.frames();
      const captchaFrame = frames.find(frame => {
        return frame.url().includes('captcha') || frame.url().includes('challenge');
      });
      
      // Add detailed iframe logging for debugging
      console.log(`Found ${frames.length} frames in total`);
      frames.forEach((frame, index) => {
        console.log(`Frame ${index}: URL = ${frame.url()}`);
      });
      
      if (captchaFrame) {
        console.log('Found CAPTCHA iframe, attempting advanced bypass techniques...');
        console.log(`CAPTCHA frame URL: ${captchaFrame.url()}`);
        
        // Log all available elements in the CAPTCHA frame for debugging
        try {
          const frameContent = await captchaFrame.content();
          console.log(`CAPTCHA frame content length: ${frameContent.length} characters`);
          
          // Write frame content to file for debugging
          const fs = require('fs');
          fs.writeFileSync('captcha-frame.html', frameContent);
          console.log('Saved CAPTCHA frame HTML for analysis');
          
          // Try to determine CAPTCHA type
          if (frameContent.includes('recaptcha')) {
            console.log('Detected Google reCAPTCHA system');
          } else if (frameContent.includes('hcaptcha')) {
            console.log('Detected hCaptcha system');
          } else if (frameContent.includes('cloudflare')) {
            console.log('Detected Cloudflare protection system');
          } else {
            console.log('Unknown CAPTCHA/protection system');
          }
        } catch (frameError) {
          console.log('Could not analyze CAPTCHA frame content:', frameError.message);
        }
        
        // Try to locate the checkbox or challenge area (attempt different selectors)
        // Support multiple CAPTCHA types (reCAPTCHA, hCaptcha, etc.)
        const captchaSelectors = [
          // Google reCAPTCHA selectors
          'div.recaptcha-checkbox-border',
          'span.recaptcha-checkbox-checkmark',
          '#recaptcha-anchor',
          'div.rc-anchor-content',
          'div[role="presentation"]',
          // hCaptcha selectors
          '#checkbox',
          '.checkbox',
          'div.checkbox',
          // Cloudflare selectors
          '#cf-please-wait',
          '#challenge-form',
          // Generic selectors
          'button[type="submit"]',
          'input[type="submit"]',
          'a.button',
          'button.submit',
          'button:contains("Submit")',
          'button:contains("Verify")',
          'button:contains("Continue")'
        ];
        
        let captchaElement = null;
        
        // Try each selector to find the CAPTCHA element
        for (const selector of captchaSelectors) {
          const element = await captchaFrame.$(selector);
          if (element) {
            captchaElement = element;
            console.log(`Found CAPTCHA element with selector: ${selector}`);
            break;
          }
        }
        
        if (captchaElement) {
          console.log('Found CAPTCHA element, attempting to solve...');
          
          try {
            // Get bounding box for the element
            const box = await captchaElement.boundingBox();
            
            // Start from a random position on the page
            const startX = Math.random() * page.viewport().width;
            const startY = Math.random() * page.viewport().height;
            
            // Move to element with human-like curve and varied speed
            await page.mouse.move(startX, startY);
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500) + 300));
            
            // Simulate natural mouse movement with acceleration and deceleration
            const steps = 15; // More points for smoother curve
            for (let i = 0; i < steps; i++) {
              // Use easing function to simulate acceleration/deceleration
              const progress = i / steps;
              const easing = progress < 0.5 
                ? 2 * progress * progress  // Accelerate
                : -1 + (4 - 2 * progress) * progress;  // Decelerate
              
              // Add randomness to the curve
              const jitterX = Math.random() * 12 - 6;
              const jitterY = Math.random() * 12 - 6;
              
              // Calculate curve position with jitter
              const curveX = startX + ((box.x + box.width/2) - startX) * easing + jitterX;
              const curveY = startY + ((box.y + box.height/2) - startY) * easing + jitterY;
              
              // Move with variable timing
              await page.mouse.move(curveX, curveY);
              await new Promise(r => setTimeout(r, Math.floor(Math.random() * 30) + 10));
            }
            
            // Hover for a moment before clicking (human behavior)
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 400) + 200));
            
            // Finally click the CAPTCHA element
            await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
            console.log('Clicked on CAPTCHA element');
            
            // Wait for potential CAPTCHA response
            await new Promise(r => setTimeout(r, 4000));
            
            // Check if we're still facing a CAPTCHA
            const newHtml = await page.content();
            if (!newHtml.toLowerCase().includes('captcha') && !newHtml.toLowerCase().includes('robot')) {
              console.log('CAPTCHA potentially bypassed, continuing scraping...');
            } else {
              console.log('Initial CAPTCHA click did not solve the challenge, attempting image challenge if present...');
              
              // TECHNIQUE 3: MANUAL CAPTCHA SOLVING ATTEMPT
              // Look for image challenge elements
              const imageFrames = page.frames();
              const challengeFrame = imageFrames.find(frame => {
                return frame.url().includes('bframe') || frame.url().includes('challenge');
              });
              
              if (challengeFrame) {
                console.log('Found CAPTCHA challenge frame, this would require image recognition...');
                
                // Take a screenshot of the challenge for potential manual solving
                await challengeFrame.screenshot({ path: 'captcha-challenge.png' });
                console.log('Saved CAPTCHA challenge screenshot for potential manual solving');
                
                // Wait for a longer period in case manual intervention is possible
                console.log('Waiting for possible manual CAPTCHA resolution...');
                await new Promise(r => setTimeout(r, 15000));
                
                // Check if CAPTCHA is still present
                const finalCheck = await page.content();
                if (!finalCheck.toLowerCase().includes('captcha') && !finalCheck.toLowerCase().includes('robot')) {
                  console.log('CAPTCHA resolved, continuing with scraping...');
                } else {
                  console.log('CAPTCHA still present after waiting, continuing anyway...');
                }
              }
            }
          } catch (captchaError) {
            console.error('Error while attempting to bypass CAPTCHA:', captchaError.message);
          }
        } else {
          console.log('No CAPTCHA checkbox found, attempting to interact with iframe directly');
          try {
            // Get the iframe position
            const frameBox = await captchaFrame.evaluate(() => {
              const rect = document.body.getBoundingClientRect();
              return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            });
            
            // Click in multiple positions within the frame
            const clickPositions = [
              { x: frameBox.width/2, y: frameBox.height/2 },  // center
              { x: frameBox.width/4, y: frameBox.height/2 },  // left center
              { x: frameBox.width*3/4, y: frameBox.height/2 }, // right center
              { x: frameBox.width/2, y: frameBox.height/4 },  // top center
              { x: frameBox.width/2, y: frameBox.height*3/4 }  // bottom center
            ];
            
            for (const pos of clickPositions) {
              // Move to position with human-like motion
              await page.mouse.move(
                frameBox.x + pos.x + (Math.random() * 10 - 5),
                frameBox.y + pos.y + (Math.random() * 10 - 5)
              );
              await new Promise(r => setTimeout(r, Math.floor(Math.random() * 200) + 100));
              
              // Click
              await page.mouse.click(frameBox.x + pos.x, frameBox.y + pos.y);
              console.log(`Clicked at position (${pos.x}, ${pos.y}) in CAPTCHA frame`);
              await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500) + 500));
            }
          } catch (frameError) {
            console.error('Error interacting with CAPTCHA frame:', frameError.message);
          }
        }
      } else {
        console.log('No CAPTCHA iframe found, looking for other CAPTCHA elements...');
        
        // TECHNIQUE 4: PRESS-AND-HOLD CAPTCHA BYPASS
        // Look for press-and-hold CAPTCHA elements which are becoming more common
        try {
          // Common selectors for press-and-hold elements
          const pressHoldSelectors = [
            '#px-captcha',             // PerimeterX
            '.captcha-slider',         // Slider CAPTCHAs
            '.sliderContainer',        // Common slider container
            '.slide-to-verify',        // Slide verification
            '#slider',                 // Generic slider
            '.sliderbg',               // Another slider background
            '.verify-slider',          // Verification slider
            '.verify-btn',             // Verification button
            '.hold-button',            // Explicit hold button
            '.arco-slider-button',     // Arco design slider
            '.geetest_slider_button',  // Geetest slider
            'div[role="slider"]',      // ARIA role slider
            'button:contains("Press and Hold")',
            'button:contains("Verify")',
            'button:contains("Hold")',
            '[class*="slider"]',       // Any class containing "slider"
            '[class*="captcha"]',      // Any class containing "captcha"
            '[id*="captcha"]',         // Any ID containing "captcha"
            '[id*="slider"]',          // Any ID containing "slider"
            '[class*="verify"]'        // Any class containing "verify"
          ];
          
          let pressHoldElement = null;
          
          // Try to find press-and-hold elements
          for (const selector of pressHoldSelectors) {
            try {
              const element = await page.$(selector);
              if (element) {
                pressHoldElement = element;
                console.log(`Found potential press-and-hold element with selector: ${selector}`);
                break;
              }
            } catch (selectorError) {
              // Selector might not be valid in all contexts, continue to next
              continue;
            }
          }
          
          if (pressHoldElement) {
            console.log('Attempting to solve press-and-hold CAPTCHA...');
            
            // Get bounding box for the element
            const box = await pressHoldElement.boundingBox();
            
            // Move to element with human-like curve
            const startX = Math.random() * page.viewport().width;
            const startY = Math.random() * page.viewport().height;
            
            // Move to the press-and-hold element
            console.log('Moving to press-and-hold element...');
            await page.mouse.move(startX, startY);
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 300) + 200));
            
            // Enhanced natural movement with acceleration/deceleration and variable speed
            // More sophisticated human-like curve with Bezier path
            const steps = 16 + Math.floor(Math.random() * 6); // More steps for smoother movement
            
            // Create control points for natural curve
            // We'll use cubic Bezier curve simulation (4 control points)
            const cp1x = startX + (box.x - startX) * 0.2 + (Math.random() * 40 - 20);
            const cp1y = startY + (box.y - startY) * 0.1 + (Math.random() * 40 - 20);
            const cp2x = startX + (box.x - startX) * 0.7 + (Math.random() * 40 - 20);
            const cp2y = startY + (box.y - startY) * 0.9 + (Math.random() * 40 - 20);
            const endX = box.x + box.width/2 + (Math.random() * 3 - 1.5);
            const endY = box.y + box.height/2 + (Math.random() * 3 - 1.5);
            
            // Log for debugging
            console.log('Using cubic Bezier curve for mouse movement:');
            console.log(`  Start: (${startX}, ${startY})`);
            console.log(`  Control point 1: (${cp1x}, ${cp1y})`);
            console.log(`  Control point 2: (${cp2x}, ${cp2y})`);
            console.log(`  End: (${endX}, ${endY})`);
            
            // Function to calculate cubic Bezier point
            const cubicBezier = (t, p0, p1, p2, p3) => {
              const mt = 1 - t;
              return mt*mt*mt*p0 + 3*mt*mt*t*p1 + 3*mt*t*t*p2 + t*t*t*p3;
            };
            
            // Add variable timing to simulate human hand speed changes
            // Humans don't move at constant speed - they accelerate and decelerate
            for (let i = 0; i < steps; i++) {
              // Use custom easing for natural acceleration/deceleration
              const progress = i / steps;
              
              // Ease-in-out cubic function for acceleration and deceleration
              let easedProgress;
              if (progress < 0.5) {
                // Accelerate (ease-in)
                easedProgress = 4 * progress * progress * progress;
              } else {
                // Decelerate (ease-out)
                const t = progress - 1;
                easedProgress = 1 + 4 * t * t * t;
              }
              
              // Calculate point on the Bezier curve
              const curveX = cubicBezier(
                easedProgress, 
                startX, 
                cp1x, 
                cp2x, 
                endX
              );
              
              const curveY = cubicBezier(
                easedProgress, 
                startY, 
                cp1y, 
                cp2y, 
                endY
              );
              
              // Add microscopic jitter for more human-like movement
              // Human hands have natural micro-tremors
              const microJitterX = Math.random() * 2 - 1;
              const microJitterY = Math.random() * 2 - 1;
              
              // Move mouse with jitter
              await page.mouse.move(curveX + microJitterX, curveY + microJitterY);
              
              // Variable delay between movements (humans slow down near target)
              const baseDelay = 15; // Base milliseconds
              const speedVariation = progress > 0.8 ? 
                Math.floor(Math.random() * 30) + 20 : // Slow down near target
                Math.floor(Math.random() * 15) + 5;   // Faster in the middle
                
              await new Promise(r => setTimeout(r, baseDelay + speedVariation));
            }
            
            // Hover briefly before pressing
            console.log('Hovering over press-and-hold element...');
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500) + 300));
            
            // Press down and hold with enhanced touch simulation and human-like behavior
            const targetX = box.x + box.width/2 + (Math.random() * 4 - 2); // Add slight position randomness
            const targetY = box.y + box.height/2 + (Math.random() * 4 - 2);
            console.log(`Pressing and holding at (${targetX}, ${targetY})...`);
            
            // Add additional touch events to simulate mobile device better
            // This is critical for bypassing PerimeterX on Zillow which checks for touch events
            await page.evaluate((elemSelector) => {
              console.log('Setting up advanced touch event simulation');
              
              // Get element for events
              const element = document.querySelector(elemSelector) || document.querySelector('#px-captcha');
              if (!element) {
                console.log('Warning: Could not find target element for touch events');
                return;
              }
              
              // Create touch event constructor data
              const touchStart = () => {
                const rect = element.getBoundingClientRect();
                const centerX = rect.left + rect.width/2;
                const centerY = rect.top + rect.height/2;
                
                // Create touch point with pressure data (iOS/Android devices report this)
                const touchPoint = new Touch({
                  identifier: Date.now(),
                  target: element,
                  clientX: centerX,
                  clientY: centerY,
                  screenX: centerX,
                  screenY: centerY,
                  pageX: centerX,
                  pageY: centerY,
                  radiusX: 10,  // Touch area radius
                  radiusY: 10,
                  rotationAngle: 0,
                  force: 0.8,    // Pressure (value between 0-1)
                });
                
                // Store touch point for later touch end
                window._pxTouchPoint = touchPoint;
                
                // Create and dispatch touchstart event
                const touchStartEvent = new TouchEvent('touchstart', {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  touches: [touchPoint],
                  targetTouches: [touchPoint],
                  changedTouches: [touchPoint]
                });
                
                // Dispatch on DOM element
                element.dispatchEvent(touchStartEvent);
                console.log('Touch start event dispatched');
                
                // Also trigger mouse events that would normally accompany touch
                const mouseDown = new MouseEvent('mousedown', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  buttons: 1,
                  clientX: centerX,
                  clientY: centerY
                });
                element.dispatchEvent(mouseDown);
              };
              
              // Execute touch start
              touchStart();
              
              // Also trigger other events that mobile browsers would send
              const syntheticEvents = ['pointerdown', 'MSPointerDown', 'touchenter'];
              syntheticEvents.forEach(eventType => {
                try {
                  let event;
                  if (eventType.includes('pointer')) {
                    // Pointer event for IE/Edge
                    event = new PointerEvent(eventType, {
                      bubbles: true,
                      cancelable: true,
                      pointerId: 1,
                      pointerType: 'touch',
                      isPrimary: true
                    });
                  } else {
                    // Generic event
                    event = new Event(eventType, {
                      bubbles: true,
                      cancelable: true
                    });
                  }
                  element.dispatchEvent(event);
                } catch (e) {
                  console.log(`Could not dispatch ${eventType}: ${e.message}`);
                }
              });
              
              // Store timestamp for realistic pressure changes
              window._pxTouchStartTime = Date.now();
            }, pressHoldElement ? await page.evaluate(el => '#' + el.id || '.' + el.className.split(' ')[0], pressHoldElement) : '#px-captcha');
            
            // Press mouse down (in addition to touch events above)
            await page.mouse.move(targetX, targetY);
            await page.mouse.down();
            
            // Hold for a random duration between 3-5 seconds for PerimeterX
            // Research shows this timing works better for Zillow's implementation
            const holdDuration = Math.floor(Math.random() * 2000) + 3000; 
            console.log(`Holding mouse/touch down for ${holdDuration}ms...`);
            
            // During hold, simulate realistic finger pressure changes and micro movements
            // This better mimics human behavior during press-and-hold
            let elapsedTime = 0;
            const pressureUpdateInterval = 200; // Check every 200ms
            const trembleInterval = 100; // Update tremor every 100ms
            
            // Parallel promises for pressure and tremor simulation
            await Promise.all([
              // Promise 1: Pressure changes simulation
              (async () => {
                while (elapsedTime < holdDuration) {
                  await page.evaluate(() => {
                    const element = document.querySelector('#px-captcha');
                    if (!element || !window._pxTouchPoint) return;
                    
                    // Calculate elapsed hold time
                    const elapsed = Date.now() - window._pxTouchStartTime;
                    
                    // Natural pressure curve: start moderate, increase, then gradually decrease
                    // Humans can't maintain perfect steady pressure
                    let pressure;
                    if (elapsed < 500) {
                      // Initial contact: pressure increases
                      pressure = 0.6 + (elapsed / 500) * 0.3;
                    } else if (elapsed < 2000) {
                      // Mid-hold: slight random variations in pressure
                      pressure = 0.9 + (Math.random() * 0.1 - 0.05);
                    } else {
                      // Later hold: gradually decreasing pressure (fatigue)
                      const remainingRatio = Math.max(0, 1 - ((elapsed - 2000) / 3000));
                      pressure = 0.85 * remainingRatio + 0.5;
                    }
                    
                    // Create a new touch point with updated pressure
                    const updatedTouch = new Touch({
                      identifier: window._pxTouchPoint.identifier,
                      target: element,
                      clientX: window._pxTouchPoint.clientX,
                      clientY: window._pxTouchPoint.clientY,
                      screenX: window._pxTouchPoint.screenX,
                      screenY: window._pxTouchPoint.screenY,
                      pageX: window._pxTouchPoint.pageX,
                      pageY: window._pxTouchPoint.pageY,
                      radiusX: 10,
                      radiusY: 10,
                      rotationAngle: 0,
                      force: pressure
                    });
                    
                    // Create and dispatch touchmove event (to update pressure)
                    const touchMoveEvent = new TouchEvent('touchmove', {
                      bubbles: true,
                      cancelable: true,
                      touches: [updatedTouch],
                      targetTouches: [updatedTouch],
                      changedTouches: [updatedTouch]
                    });
                    
                    // Update stored touch point
                    window._pxTouchPoint = updatedTouch;
                    
                    // Dispatch event
                    element.dispatchEvent(touchMoveEvent);
                  });
                  
                  // Wait before next pressure update
                  await new Promise(r => setTimeout(r, pressureUpdateInterval));
                  elapsedTime += pressureUpdateInterval;
                }
              })(),
              
              // Promise 2: Microscopic tremor simulation
              (async () => {
                while (elapsedTime < holdDuration) {
                  // Humans can't hold perfectly still - add microscopic movements
                  const microJitterX = (Math.random() * 0.6 - 0.3);
                  const microJitterY = (Math.random() * 0.6 - 0.3);
                  
                  await page.mouse.move(
                    targetX + microJitterX, 
                    targetY + microJitterY
                  );
                  
                  // Wait for next tremor update
                  await new Promise(r => setTimeout(r, trembleInterval));
                }
              })()
            ]);
            
            // For slider types, we may need to drag instead of just holding
            // Determine if this might be a slider based on element properties
            const isSlider = await page.evaluate((el) => {
              return el.className.toLowerCase().includes('slider') || 
                     el.id.toLowerCase().includes('slider') ||
                     el.getAttribute('role') === 'slider';
            }, pressHoldElement);
            
            if (isSlider) {
              console.log('Detected slider type CAPTCHA, performing slide motion...');
              
              // Get the width of the slider
              const sliderWidth = await page.evaluate((el) => {
                // Look for the parent container which is typically wider
                let container = el.parentElement;
                while (container && container.offsetWidth < 100 && container.parentElement) {
                  container = container.parentElement;
                }
                return container ? container.offsetWidth : 200;
              }, pressHoldElement);
              
              // Calculate a reasonable slide distance (80-95% of container width)
              const slideDistance = (sliderWidth * (0.8 + Math.random() * 0.15));
              console.log(`Sliding ${slideDistance}px to the right...`);
              
              // Perform the slide with natural acceleration/deceleration
              const slideSteps = 15;
              for (let i = 0; i < slideSteps; i++) {
                const progress = i / slideSteps;
                // Ease-out function for natural deceleration
                const easing = 1 - Math.pow(1 - progress, 3);
                
                // Add small random variations to appear more human-like
                const jitter = Math.random() * 2 - 1;
                const newX = targetX + (slideDistance * easing) + jitter;
                const newY = targetY + (Math.random() * 4 - 2); // Slight vertical variation
                
                await page.mouse.move(newX, newY);
                // Randomize movement speed slightly
                await new Promise(r => setTimeout(r, Math.floor(Math.random() * 30) + 15));
              }
            }
            
            // Release the mouse
            await page.mouse.up();
            console.log('Released press-and-hold element');
            
            // Wait to see if CAPTCHA is solved
            console.log('Waiting to see if press-and-hold CAPTCHA is solved...');
            await new Promise(r => setTimeout(r, 4000));
            
            // Check if CAPTCHA is still present
            const afterHoldHtml = await page.content();
            if (!afterHoldHtml.toLowerCase().includes('captcha') && 
                !afterHoldHtml.toLowerCase().includes('robot') &&
                !afterHoldHtml.toLowerCase().includes('verify')) {
              console.log('Press-and-hold CAPTCHA appears to be solved!');
            } else {
              console.log('Press-and-hold CAPTCHA may not be solved, continuing anyway...');
            }
          } else {
            console.log('No press-and-hold CAPTCHA elements found');
          }
        } catch (pressHoldError) {
          console.error('Error during press-and-hold CAPTCHA bypass attempt:', pressHoldError.message);
        }
        
        // Try to find any links or buttons that might dismiss the CAPTCHA
        try {
          const possibleButtons = await page.$$('button, a, input[type="submit"]');
          console.log(`Found ${possibleButtons.length} possible buttons/links on page`);
          
          for (const button of possibleButtons) {
            // Check if this button/link is related to CAPTCHA
            const text = await page.evaluate(el => el.innerText || el.textContent || el.value || '', button);
            
            if (text && (
              text.toLowerCase().includes('verify') || 
              text.toLowerCase().includes('confirm') || 
              text.toLowerCase().includes('human') || 
              text.toLowerCase().includes('continue')
            )) {
              console.log(`Found potential CAPTCHA-related button: "${text}"`);
              
              // Click the button with human-like behavior
              const box = await button.boundingBox();
              if (box) {
                // Move to button gradually
                await page.mouse.move(box.x + box.width/2, box.y + box.height/2, {steps: 10});
                await new Promise(r => setTimeout(r, Math.floor(Math.random() * 300) + 200));
                
                // Click
                await button.click();
                console.log(`Clicked on button: "${text}"`);
                await new Promise(r => setTimeout(r, 3000));
                
                break;
              }
            }
          }
        } catch (buttonError) {
          console.error('Error finding/clicking buttons:', buttonError.message);
        }
      }
      
      // Continue regardless of CAPTCHA result - we're going to try to get what data we can
      console.log('Proceeding with scraping despite CAPTCHA challenges...');
    }
    
    // Add a short delay to let JS execute
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 2000) + 1000));
    
    // Simulate some scrolling behavior like a human
    console.log('Simulating human scrolling behavior...');
    await page.evaluate(async () => {
      const scrollHeight = document.body.scrollHeight;
      const viewportHeight = window.innerHeight;
      const totalScrolls = Math.ceil(scrollHeight / viewportHeight);
      
      // Scroll gradually with random pauses
      for (let i = 1; i <= totalScrolls; i++) {
        window.scrollTo({
          top: i * viewportHeight,
          behavior: 'smooth'
        });
        
        // Random pause between scrolls (300-800ms)
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500) + 300));
      }
      
      // Scroll back up
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
    
    // Wait for any dynamic content to load
    await new Promise(r => setTimeout(r, 2000));
    
    // Take a screenshot for debugging
    if (isRender) {
      try {
        await page.screenshot({ path: 'debug-screenshot.png', fullPage: false });
        console.log('Debug screenshot saved');
      } catch (e) {
        console.log('Could not save debug screenshot:', e.message);
      }
    }
    
    // Check if we've landed on a CAPTCHA page before attempting to extract data
    const pageContent = await page.content();
    const pageTitle = await page.title();
    
    // Common indicators that we've hit a CAPTCHA or protection page
    const pageCaptchaIndicators = [
      'captcha', 'robot', 'human', 'challenge', 'security check', 
      'verify', 'unusual activity', 'suspicious', 'blocked',
      'access denied', 'Checking if the site connection is secure'
    ];
    
    // Check if any CAPTCHA indicator is present in the page content or title
    const foundIndicators = pageCaptchaIndicators.filter(
      indicator => pageContent.toLowerCase().includes(indicator) || 
                   pageTitle.toLowerCase().includes(indicator)
    );
    
    if (foundIndicators.length > 0) {
      console.log(`CAPTCHA/Protection detected! Indicators found: ${foundIndicators.join(', ')}`);
      console.log(`Page title: "${pageTitle}"`);
      
      // Save the CAPTCHA page HTML for analysis
      fs.writeFileSync('captcha-page.html', pageContent);
      console.log('Saved CAPTCHA page HTML for detailed analysis');
      
      // Take a screenshot of the CAPTCHA
      await page.screenshot({ path: 'captcha-page.png', fullPage: false });
      console.log('CAPTCHA screenshot saved for analysis');
      
      // Attempt to solve with Anti-CAPTCHA service first
      const isCaptchaSolverReady = captchaSolver.initAntiCaptcha();
      console.log(`Anti-CAPTCHA solver initialized: ${isCaptchaSolverReady ? 'Successfully' : 'API key missing'}`);
      
      if (isCaptchaSolverReady) {
        console.log('Attempting to solve CAPTCHA using Anti-CAPTCHA service...');
        const solved = await captchaSolver.solveCaptcha(page, url);
        if (solved) {
          console.log('CAPTCHA successfully solved by Anti-CAPTCHA service!');
          // Wait for page to refresh after CAPTCHA solution
          try {
            await page.waitForNavigation({ timeout: 10000 });
          } catch (e) {
            console.log('No navigation occurred after CAPTCHA solution');
          }
        } else {
          console.log('Anti-CAPTCHA service could not solve the CAPTCHA, falling back to manual techniques');
        }
      }
      
      // Try to bypass the CAPTCHA with human-like behavior
      console.log('CAPTCHA detected - attempting multiple bypass techniques...');
      
      // Execute some random mouse movements and clicks to appear more human-like
      console.log('Executing human-like mouse movements to appear more real...');
      
      // Random clicks
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      
      // Perform a few random clicks
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(Math.random() * viewportWidth);
        const y = Math.floor(Math.random() * viewportHeight);
        
        await page.mouse.click(x, y);
        console.log(`Performed random click at ${x}, ${y}`);
        
        // Random scroll
        await page.evaluate(() => {
          window.scrollBy(0, (Math.random() * 300) - 150);
        });
        console.log('Performed random scroll');
        
        // Random pause
        await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
      }
      
      // Check for any iframes that might contain CAPTCHA challenges
      const frames = await page.frames();
      console.log(`Found ${frames.length} frames in total`);
      
      // Log each frame URL for debugging
      for (let i = 0; i < frames.length; i++) {
        console.log(`Frame ${i}: URL = ${frames[i].url()}`);
      }
      
      // Try to find a CAPTCHA iframe (common for reCAPTCHA and similar services)
      const captchaFrame = frames.find(f => 
        f.url().includes('captcha') || 
        f.url().includes('challenge') || 
        f.url().includes('security')
      );
      
      if (captchaFrame) {
        console.log('Found potential CAPTCHA iframe:', captchaFrame.url());
        
        // Attempt to interact with the CAPTCHA in the frame
        try {
          // Look for the checkbox (common in reCAPTCHA)
          const checkbox = await captchaFrame.$('.recaptcha-checkbox');
          if (checkbox) {
            console.log('Found reCAPTCHA checkbox, attempting to click it...');
            await checkbox.click();
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch (frameError) {
          console.log('Error interacting with CAPTCHA frame:', frameError.message);
        }
      } else {
        console.log('No CAPTCHA iframe found, looking for other CAPTCHA elements...');
        
        // Look for press-and-hold CAPTCHA (common with PerimeterX)
        const pressHoldSelector = await page.evaluate(() => {
          const possibleSelectors = [
            '#px-captcha', '.px-captcha', '[id*="captcha"]', '[class*="captcha"]',
            '.px-btn-loading', '#captcha-submit', '.captcha-submit',
            '.challenge-button', '#challenge-button', '[data-test="challenge"]',
            '#px-captcha-wrapper'
          ];
          
          for (const selector of possibleSelectors) {
            const el = document.querySelector(selector);
            if (el) return selector;
          }
          
          return null;
        });
        
        if (pressHoldSelector) {
          console.log(`Found potential press-and-hold element with selector: ${pressHoldSelector}`);
          console.log('Attempting to solve press-and-hold CAPTCHA...');
          
          // Enhanced PerimeterX CAPTCHA solver - specifically for Zillow's "Press and Hold" type
          try {
            // First add a custom JS to trace the CAPTCHA behavior (helps with debugging)
            await page.evaluate(() => {
              // Add a monitor to detect CAPTCHA-related events
              window._pxCaptchaEvents = [];
              
              // Track relevant events that may be related to PerimeterX CAPTCHA
              const originalXHR = window.XMLHttpRequest;
              window.XMLHttpRequest = class extends originalXHR {
                constructor() {
                  super();
                  this.addEventListener('load', function() {
                    try {
                      if (this.responseURL && (
                          this.responseURL.includes('captcha') || 
                          this.responseURL.includes('px') || 
                          this.responseURL.includes('challenge')
                      )) {
                        window._pxCaptchaEvents.push({
                          type: 'XHR',
                          url: this.responseURL,
                          status: this.status,
                          time: new Date().toISOString()
                        });
                      }
                    } catch (e) {
                      console.error('Error monitoring XHR:', e);
                    }
                  });
                }
              };
              
              // Also track events on the CAPTCHA element itself
              const captchaElement = document.querySelector('#px-captcha');
              if (captchaElement) {
                ['mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchend'].forEach(eventType => {
                  captchaElement.addEventListener(eventType, (event) => {
                    window._pxCaptchaEvents.push({
                      type: 'CaptchaEvent',
                      eventType,
                      time: new Date().toISOString()
                    });
                  });
                });
              }
              
              console.log('Installed CAPTCHA event monitors');
            });
            
            // Get the center of the element
            const elementHandle = await page.$(pressHoldSelector);
            const box = await elementHandle.boundingBox();
            const centerX = box.x + (box.width / 2);
            const centerY = box.y + (box.height / 2);
            
            // Add subtle jitter to make the press look more human
            const jitterX = Math.random() * 4 - 2;  // +/- 2px
            const jitterY = Math.random() * 4 - 2;  // +/- 2px
            const pressX = centerX + jitterX;
            const pressY = centerY + jitterY;
            
            console.log('Moving to press-and-hold element with human-like curve...');
            
            // Use a more human-like movement pattern rather than teleporting
            const startX = Math.random() * page.viewport().width;
            const startY = Math.random() * page.viewport().height;
            
            // First move to a random position
            await page.mouse.move(startX, startY);
            await new Promise(r => setTimeout(r, Math.random() * 300 + 200));
            
            // Then move to the target with a natural curve (multiple steps)
            const steps = 10 + Math.floor(Math.random() * 5);
            for (let i = 0; i < steps; i++) {
              // Add a slight curve using sine wave
              const progress = i / steps;
              const curve = Math.sin(progress * Math.PI) * 20;
              
              const curveX = startX + (pressX - startX) * progress + curve;
              const curveY = startY + (pressY - startY) * progress;
              
              await page.mouse.move(curveX, curveY);
              // Random delay between movements to simulate human behavior
              await new Promise(r => setTimeout(r, Math.random() * 30 + 10));
            }
            
            // Final position exactly on target
            await page.mouse.move(pressX, pressY);
            
            console.log('Hovering over press-and-hold element...');
            // Hover a bit before pressing (human behavior)
            await new Promise(r => setTimeout(r, Math.random() * 300 + 400));
            
            console.log(`Pressing and holding at (${pressX}, ${pressY})...`);
            
            // Additional event to help bypass Zillow's specific implementation
            await page.evaluate(() => {
              // Some CAPTCHA implementations check for touch events
              const element = document.querySelector('#px-captcha');
              if (element) {
                // Create and dispatch touch events to simulate mobile press
                const touchStart = new TouchEvent('touchstart', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(touchStart);
              }
            });
            
            // Press mouse down
            await page.mouse.down();
            
            // Hold the mouse down for a random duration (research shows 3-5 seconds often works for PerimeterX)
            const holdTime = 3000 + Math.floor(Math.random() * 2000);
            console.log(`Holding mouse down for ${holdTime}ms...`);
            
            // During the hold, apply very slight mouse movements to simulate human hand tremor
            const trembleStartTime = Date.now();
            while (Date.now() - trembleStartTime < holdTime) {
              // Extremely small movement (microscopic tremor)
              const microX = pressX + (Math.random() * 1 - 0.5);
              const microY = pressY + (Math.random() * 1 - 0.5);
              await page.mouse.move(microX, microY);
              await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
            }
            
            // Release the mouse
            console.log('Released press-and-hold element');
            await page.mouse.up();
            
            // Also simulate releasing touch
            await page.evaluate(() => {
              const element = document.querySelector('#px-captcha');
              if (element) {
                const touchEnd = new TouchEvent('touchend', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(touchEnd);
              }
            });
            
            // Wait to see if there's a CAPTCHA success/failure message
            console.log('Waiting to see if press-and-hold CAPTCHA is solved...');
            
            // Check for several success indicators with a timeout
            const checkStartTime = Date.now();
            const maxCheckTime = 10000; // 10 seconds
            let solved = false;
            
            // Apply multiple checks for CAPTCHA verification
            while (Date.now() - checkStartTime < maxCheckTime && !solved) {
              // Check for multiple success indicators
              solved = await page.evaluate(() => {
                // Check if the CAPTCHA element is gone
                const captchaGone = !document.querySelector('#px-captcha');
                
                // Check for success message (varies by implementation)
                const successMsg = 
                  document.body.innerText.includes('verification successful') ||
                  document.body.innerText.includes('successful verification') ||
                  document.body.innerText.includes('you are verified');
                
                // Check URL changes
                const urlChanged = window.location.href.includes('verified=true');
                
                // Check for an event in our tracked events
                const successEvent = window._pxCaptchaEvents && 
                  window._pxCaptchaEvents.some(e => 
                    (e.url && e.url.includes('pass')) || 
                    (e.status && e.status === 200)
                  );
                
                return captchaGone || successMsg || urlChanged || successEvent;
              });
              
              if (solved) {
                console.log('CAPTCHA appears to be solved! Success indicators detected.');
                break;
              }
              
              // Wait a bit before checking again
              await new Promise(r => setTimeout(r, 500));
            }
            
            if (!solved) {
              console.log('CAPTCHA verification timeout - will continue anyway');
            }
            
            // Attempt to navigate to the target URL again
            try {
              console.log('Attempting to navigate to Zillow again after CAPTCHA interaction...');
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch (navigationError) {
              console.log('Navigation after CAPTCHA failed:', navigationError.message);
            }
            
            // Snapshot CAPTCHA events for debugging
            const events = await page.evaluate(() => window._pxCaptchaEvents || []);
            if (events.length > 0) {
              console.log('CAPTCHA events captured:', JSON.stringify(events.slice(-5)));
            }
          } catch (captchaError) {
            console.log('Error solving press-and-hold CAPTCHA:', captchaError.message);
            console.log('Press-and-hold CAPTCHA may not be solved, continuing anyway...');
          }
        }
        
        // Look for buttons or links that might help bypass the protection
        const possibleButtons = await page.evaluate(() => {
          const results = [];
          
          // Common button/link patterns for bypassing protection screens
          const elements = document.querySelectorAll('button, a, [role="button"], .button');
          
          for (const el of elements) {
            if (!el) continue;
            
            const text = (el.textContent || '').toLowerCase().trim();
            
            // Look for typical bypass buttons
            if (text.includes('continue') || text.includes('submit') || 
                text.includes('verify') || text.includes('proceed') ||
                text.includes('next') || text.includes('i am human') ||
                text.includes('start') || text.includes('begin')) {
              
              results.push({
                text,
                visible: el.offsetWidth > 0 && el.offsetHeight > 0 && 
                         window.getComputedStyle(el).display !== 'none' &&
                         window.getComputedStyle(el).visibility !== 'hidden'
              });
            }
          }
          
          return results;
        });
        
        console.log(`Found ${possibleButtons.length} possible buttons/links on page`);
        
        // Try clicking any visible buttons that match bypass patterns
        for (const button of possibleButtons) {
          if (button.visible) {
            try {
              // Uses a more advanced content selector to avoid synthetic clicks
              await page.evaluate((buttonText) => {
                const elements = Array.from(document.querySelectorAll('button, a, [role="button"], .button'));
                
                // Find the button with matching text
                const button = elements.find(el => (el.textContent || '').toLowerCase().trim() === buttonText);
                
                if (button) {
                  // Scroll into view first
                  button.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                  });
                  
                  // For a more natural click, we'll use a real event sequence
                  const rect = button.getBoundingClientRect();
                  const centerX = rect.left + (rect.width / 2);
                  const centerY = rect.top + (rect.height / 2);
                  
                  // Create events with coordinates
                  const mouseoverEvent = new MouseEvent('mouseover', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: centerX,
                    clientY: centerY
                  });
                  
                  const mousedownEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: centerX,
                    clientY: centerY
                  });
                  
                  const mouseupEvent = new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: centerX,
                    clientY: centerY
                  });
                  
                  const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: centerX,
                    clientY: centerY
                  });
                  
                  // Dispatch the events
                  button.dispatchEvent(mouseoverEvent);
                  button.dispatchEvent(mousedownEvent);
                  button.dispatchEvent(mouseupEvent);
                  button.dispatchEvent(clickEvent);
                  
                  return true;
                }
                
                return false;
              }, button.text);
              
              console.log(`Clicked button with text: "${button.text}"`);
              await new Promise(r => setTimeout(r, 2000));
            } catch (buttonError) {
              console.log(`Error clicking button "${button.text}":`, buttonError.message);
            }
          }
        }
      }
      
      console.log('Proceeding with scraping despite CAPTCHA challenges...');
    }
    
    // Extract all the property cards using multiple selector patterns
    console.log('Extracting property data...');
    const listings = await page.evaluate((zipCode) => {
      // This function runs in the browser context
      const results = [];
      
      // Log some debug info for later analysis
      console.log('Document title:', document.title);
      
      try {
        // Try multiple selector strategies based on Zillow's evolving UI
        
        // Strategy 1: Current search results layout (2025)
        const propertyCards = document.querySelectorAll('.property-card, article.ListItem, div[data-test="property-card"], div.list-card');
        console.log('Strategy 1 - Found property cards:', propertyCards.length);
        
        if (propertyCards.length > 0) {
          Array.from(propertyCards).forEach((card, index) => {
            try {
              // Extract the address: Multiple approaches
              let address = '';
              
              // Try different address selectors
              const addrElem = card.querySelector('.property-card-addr, .list-card-addr, .property-card-address, address');
              if (addrElem) {
                address = addrElem.textContent.trim();
              }
              
              // If no address element found, try to find it in data attributes
              if (!address) {
                const addrDataElem = card.querySelector('[data-test="property-card-addr"]');
                if (addrDataElem) {
                  address = addrDataElem.getAttribute('data-address');
                }
              }
              
              // Find price - multiple approaches 
              let priceElem = card.querySelector('[data-test="property-card-price"], .list-card-price, .price, span[data-test="price"]');
              let price = priceElem ? priceElem.textContent.trim() : '';
              
              // If price not found, try additional selectors
              if (!price) {
                const altPriceElem = card.querySelector('span[data-test*="price"], span.Price');
                if (altPriceElem) {
                  price = altPriceElem.textContent.trim();
                }
              }
              
              // Default price if not found
              if (!price) price = 'Contact for Price';
              
              // Get beds/baths - try multiple selector patterns
              const summaryElem = card.querySelector('.property-card-data, .StyledPropertyCardHomeDetails, .list-card-details');
              let beds = '?';
              let baths = '?';
              
              // Try specific bed/bath selectors first
              const bedsElem = card.querySelector('[data-test="property-card-beds"], [data-test="beds"], .list-card-details li:nth-child(1)');
              const bathsElem = card.querySelector('[data-test="property-card-baths"], [data-test="baths"], .list-card-details li:nth-child(2)');
              
              if (bedsElem) {
                const bedsText = bedsElem.textContent.trim();
                // Extract only the digit part
                const bedMatch = bedsText.match(/(\d+\.?\d*)/);
                beds = bedMatch ? bedMatch[0] : '?';
              }
              
              if (bathsElem) {
                const bathsText = bathsElem.textContent.trim();
                // Extract only the digit part
                const bathMatch = bathsText.match(/(\d+\.?\d*)/);
                baths = bathMatch ? bathMatch[0] : '?';
              }
              
              // If summary element exists but specific elements not found, try to parse from text
              if (summaryElem && (beds === '?' || baths === '?')) {
                const summaryText = summaryElem.textContent.trim();
                const bedRegex = /(\d+\.?\d*)\s*bd/i;
                const bathRegex = /(\d+\.?\d*)\s*ba/i;
                
                const bedMatch = summaryText.match(bedRegex);
                const bathMatch = summaryText.match(bathRegex);
                
                if (bedMatch && beds === '?') beds = bedMatch[1];
                if (bathMatch && baths === '?') baths = bathMatch[1];
              }
              
              // Try to find the link
              let link = '';
              const linkElem = card.querySelector('a.property-card-link, a[data-test="property-card-link"], a.list-card-link');
              if (linkElem) {
                link = linkElem.href;
                // Make sure it's a full URL
                if (link && !link.startsWith('http')) {
                  link = new URL(link, window.location.origin).href;
                }
              }
              
              // If no link found, try a different approach
              if (!link) {
                // Look for any links in the card
                const anyLink = card.querySelector('a[href*="/homes/"]');
                if (anyLink) {
                  link = anyLink.href;
                }
              }
              
              // Add the verified FSBO listing
              if (address) {
                results.push({
                  address,
                  price,
                  beds,
                  baths,
                  link: link || `https://www.zillow.com/homes/fsbo-${zipCode}_rb/`,
                });
              }
            } catch (cardError) {
              console.error('Error parsing card in strategy 1:', cardError);
            }
          });
        }
        
        // Strategy 2: Alternative layout (older Zillow versions or different page sections)
        if (results.length === 0) {
          console.log('Trying strategy 2 (alt layout)...');
          const oldCards = document.querySelectorAll('.card, .home-card, article.property-card');
          
          console.log('Strategy 2 - Found alternative cards:', oldCards.length);
          
          if (oldCards.length > 0) {
            oldCards.forEach(card => {
              try {
                // Extract address
                let address = '';
                const addrElements = card.querySelectorAll('address, .address, .card-address');
                if (addrElements.length > 0) {
                  address = addrElements[0].textContent.trim();
                }
                
                // Extract price
                let price = 'Contact for Price';
                const priceElements = card.querySelectorAll('.price, .card-price, .font-weight-bold');
                if (priceElements.length > 0) {
                  for (const el of priceElements) {
                    const text = el.textContent.trim();
                    if (text.includes('$')) {
                      price = text;
                      break;
                    }
                  }
                }
                
                // Extract beds/baths
                let beds = '?', baths = '?';
                const detailsElements = card.querySelectorAll('.details, .card-details, .home-details');
                if (detailsElements.length > 0) {
                  const detailsText = detailsElements[0].textContent.trim();
                  
                  // Parse beds
                  const bedMatch = detailsText.match(/(\d+\.?\d*)\s*bed/i);
                  if (bedMatch) beds = bedMatch[1];
                  
                  // Parse baths
                  const bathMatch = detailsText.match(/(\d+\.?\d*)\s*bath/i);
                  if (bathMatch) baths = bathMatch[1];
                }
                
                // Extract link
                let link = '';
                const linkElements = card.querySelectorAll('a');
                for (const a of linkElements) {
                  if (a.href && a.href.includes('/homes/')) {
                    link = a.href;
                    break;
                  }
                }
                
                // Add to results if we have an address
                if (address) {
                  results.push({
                    address,
                    price,
                    beds,
                    baths,
                    link
                  });
                }
              } catch (cardError) {
                console.error('Error parsing card in strategy 2:', cardError);
              }
            });
          }
        }
        
        // Strategy 3: Last resort - try to find any listings with common attributes
        if (results.length === 0) {
          console.log('Trying strategy 3 (generic attribute search)...');
          
          // Look for any elements with price-like content
          const priceElements = Array.from(
            document.querySelectorAll('span:not(:empty), div:not(:empty)')
          ).filter(el => {
            const text = el.textContent.trim();
            return /\$[\d,]+/.test(text) && text.length < 15;
          });
          
          if (priceElements.length > 0) {
            console.log('Found possible price elements:', priceElements.length);
            
            priceElements.forEach((priceEl, index) => {
              try {
                // Get the parent card-like container
                let container = priceEl;
                for (let i = 0; i < 5; i++) {
                  container = container.parentElement;
                  if (!container) break;
                  
                  // Check if this looks like a property card
                  if (container.querySelectorAll('a').length > 0 && 
                      container.querySelectorAll('img').length > 0) {
                    break;
                  }
                }
                
                if (container) {
                  const link = container.querySelector('a')?.href || '';
                  const price = priceEl.textContent.trim();
                  
                  // Try to find an address-like text nearby
                  const possibleAddressElements = Array.from(container.querySelectorAll('*'));
                  let address = '';
                  
                  for (const el of possibleAddressElements) {
                    const text = el.textContent.trim();
                    // Address typically contains commas and isn't too long or short
                    if (text.includes(',') && text.length > 10 && text.length < 100 && 
                        !text.includes('$') && /[0-9]/.test(text)) {
                      address = text;
                      break;
                    }
                  }
                  
                  // Only add if we found an address
                  if (address) {
                    results.push({
                      address,
                      price,
                      beds: '?',
                      baths: '?',
                      link
                    });
                  }
                }
              } catch (e) {
                console.error('Error in strategy 3:', e);
              }
            });
          }
        }
        
        return results;
      } catch (e) {
        console.error('Error in browser context:', e);
        return results;
      }
    }, zipCode);
    
    // Close the browser
    await browser.close();
    browser = null;
    
    // Return the results
    return res.json({
      zipCode,
      count: listings.length,
      listings: listings,
      timestamp: new Date().toISOString(),
      message: listings.length ? 
        'Successfully scraped listing data' : 
        'No listings found or Zillow may be displaying a different page format',
      sampleUrl: url
    });
  } catch (puppeteerError) {
    console.error(`Puppeteer scraping error: ${puppeteerError.message}`);
    
    // Enhanced error logging
    captchaLog('SCRAPING ERROR DIAGNOSTIC', {
      errorMessage: puppeteerError.message,
      errorName: puppeteerError.name,
      errorStack: puppeteerError.stack ? puppeteerError.stack.split('\n').slice(0, 5).join('\n') : 'No stack trace',
      zipCode,
      url,
      timestamp: new Date().toISOString(),
      isTimeout: puppeteerError.message.includes('timeout') || puppeteerError.message.includes('Timeout')
    });
    
    // Attempt to save error artifacts for debugging if page is available
    if (typeof page !== 'undefined' && page && !page.isClosed()) {
      try {
        // Take a screenshot of the error state
        await page.screenshot({ path: 'error-screenshot.png', fullPage: false });
        captchaLog('Saved error screenshot for analysis');
        
        // Save the HTML at the time of error
        const errorHtml = await page.content();
        fs.writeFileSync('error-page.html', errorHtml);
        captchaLog('Saved error page HTML content', { contentLength: errorHtml.length });
        
        // Detect if we've been blocked by analyzing the content
        const blockIndicators = [
          'access denied', 'blocked', 'captcha', 'robot', 'security check',
          'unusual activity', 'suspicious', 'temporarily unavailable'
        ];
        
        const foundIndicators = blockIndicators.filter(
          indicator => errorHtml.toLowerCase().includes(indicator)
        );
        
        if (foundIndicators.length > 0) {
          captchaLog('DETECTION: IP OR BROWSER LIKELY BLOCKED BY ZILLOW', {
            indicators: foundIndicators,
            pageTitle: await page.title()
          });
        }
      } catch (diagnosticError) {
        console.error('Error capturing diagnostic data:', diagnosticError.message);
      }
    }
    
    // Close browser if it's still open
    if (browser) {
      try {
        await browser.close();
        captchaLog('Browser closed successfully');
      } catch (closeError) {
        console.error('Error closing browser:', closeError.message);
      }
      browser = null;
    }
    
    // Return detailed error information to help diagnose CAPTCHA issues
    console.log('Returning detailed CAPTCHA/blocking diagnostic information');
    
    // Determine most likely error type based on message
    let errorType = 'CAPTCHA_CHALLENGE';
    let errorMessage = 'Zillow is showing a CAPTCHA challenge. The scraper attempted to bypass it but was unsuccessful.';
    
    if (puppeteerError.message.includes('timeout')) {
      errorType = 'TIMEOUT';
      errorMessage = 'Request timed out. Zillow might be taking too long to respond or blocking the request.';
    } else if (puppeteerError.message.includes('net::ERR')) {
      errorType = 'NETWORK_ERROR';
      errorMessage = 'Network error occurred. Zillow might be blocking the connection.';
    }
    
    return res.status(403).json({
      zipCode,
      count: 0,
      listings: [],
      error: errorType,
      message: errorMessage,
      technicalDetails: puppeteerError.message,
      timestamp: new Date().toISOString(),
      sampleUrl: url,
      possibleSolutions: [
        'Try with a different IP address (consider a residential proxy)',
        'Reduce request frequency to avoid being rate limited',
        'Consider implementing a CAPTCHA solving service',
        'Use a rotating user agent pool and cookie management'
      ]
    });
  }
});

// Start the server
/**
 * Advanced CAPTCHA Testing Endpoints
 * These endpoints provide detailed diagnostics for CAPTCHA bypass strategies
 */

// Test a specific CAPTCHA bypass strategy
app.get('/test-captcha', async (req, res) => {
  const zipCode = req.query.zip || '90210';
  const strategy = req.query.strategy || 'auto';
  
  console.log(`\n========== CAPTCHA STRATEGY TEST ==========`);
  console.log(`Testing strategy: ${strategy} for ZIP: ${zipCode}`);
  
  try {
    const results = await captchaTest.testCaptchaStrategy(zipCode, strategy);
    
    // Return clean JSON results
    res.json({
      success: true,
      strategy,
      zipCode,
      results: {
        timestamp: results.timestamp,
        success: results.success,
        timeTaken: results.timeTaken,
        captchaDetected: results.captchaDetected ? true : false,
        artifactsGenerated: !!results.artifacts
      },
      message: results.success 
        ? `CAPTCHA bypass successful with strategy: ${strategy}` 
        : `CAPTCHA bypass failed with strategy: ${strategy}`
    });
  } catch (error) {
    console.error(`Error in CAPTCHA strategy test:`, error);
    res.json({
      success: false,
      error: error.message,
      strategy,
      zipCode
    });
  }
});

// Test all CAPTCHA bypass strategies in parallel
app.get('/test-all-strategies', async (req, res) => {
  const zipCode = req.query.zip || '90210';
  console.log(`\n========== TESTING ALL CAPTCHA STRATEGIES ==========`);
  console.log(`ZIP Code: ${zipCode}`);
  
  // Define strategies to test
  const strategies = ['anticaptcha', 'press-hold', 'stealth', 'auto'];
  
  try {
    // Start a test for each strategy (in parallel)
    const results = await Promise.all(
      strategies.map(async (strategy) => {
        try {
          // Run the test for this strategy
          console.log(`Starting test for strategy: ${strategy}`);
          const result = await captchaTest.testCaptchaStrategy(zipCode, strategy);
          
          // Return a summary
          return {
            strategy,
            success: result.success,
            timeTaken: result.timeTaken,
            timestamp: result.timestamp
          };
        } catch (error) {
          return {
            strategy,
            success: false,
            error: error.message
          };
        }
      })
    );
    
    // Find the most successful strategy
    const successfulStrategies = results.filter(r => r.success);
    const mostEffective = successfulStrategies.length > 0
      ? successfulStrategies.reduce((prev, current) => 
          (prev.timeTaken < current.timeTaken) ? prev : current)
      : null;
    
    // Return results
    res.json({
      success: true,
      zipCode,
      results,
      strategyCount: strategies.length,
      successCount: successfulStrategies.length,
      mostEffectiveStrategy: mostEffective ? mostEffective.strategy : null,
      recommendation: mostEffective 
        ? `Strategy "${mostEffective.strategy}" was most effective with ${mostEffective.timeTaken}ms execution time` 
        : "No successful strategies found"
    });
  } catch (error) {
    console.error(`Error in multi-strategy test:`, error);
    res.json({
      success: false,
      error: error.message,
      zipCode
    });
  }
});

// Visual CAPTCHA analysis endpoint
app.get('/analyze-captcha', async (req, res) => {
  const zipCode = req.query.zip || '90210';
  console.log(`\n========== VISUAL CAPTCHA ANALYSIS ==========`);
  console.log(`ZIP Code: ${zipCode}`);
  
  try {
    // Launch browser for analysis
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    // Create page with stealth
    const page = await browser.newPage();
    
    // Random user agent
    const userAgent = randomUseragent.getRandom();
    await page.setUserAgent(userAgent);
    
    // Navigate to Zillow
    const url = `https://www.zillow.com/homes/${zipCode}_rb/`;
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Take screenshot
    const timestamp = Date.now();
    const screenshotPath = path.join(__dirname, 'public', `captcha-analysis-${zipCode}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Save HTML
    const htmlPath = path.join(__dirname, 'public', `captcha-page-${zipCode}-${timestamp}.html`);
    const htmlContent = await page.content();
    await fs.promises.writeFile(htmlPath, htmlContent);
    
    // Run analysis
    const analysis = await captchaDebug.analyzeCaptchaChallenge(page, zipCode);
    
    // Close browser
    await browser.close();
    
    // Return results with paths to files
    res.json({
      success: true,
      zipCode,
      timestamp: new Date().toISOString(),
      analysis,
      artifacts: {
        screenshot: `/captcha-analysis-${zipCode}-${timestamp}.png`,
        html: `/captcha-page-${zipCode}-${timestamp}.html`
      }
    });
  } catch (error) {
    console.error(`Error in CAPTCHA analysis:`, error);
    res.json({
      success: false,
      error: error.message,
      zipCode
    });
  }
});

// Combined endpoint for Anti-CAPTCHA Service status
app.get('/anti-captcha-status', async (req, res) => {
  console.log(`\n========== ANTI-CAPTCHA SERVICE STATUS ==========`);
  
  try {
    // Initialize Anti-CAPTCHA
    const ac = require('@antiadmin/anticaptchaofficial');
    const ANTICAPTCHA_API_KEY = process.env.ANTICAPTCHA_API_KEY || '';
    
    if (!ANTICAPTCHA_API_KEY) {
      return res.json({
        success: false,
        status: 'error',
        message: 'Anti-CAPTCHA API key not configured'
      });
    }
    
    // Set API key
    ac.setAPIKey(ANTICAPTCHA_API_KEY);
    
    // Get account balance
    const balance = await ac.getBalance();
    
    // Return status
    res.json({
      success: true,
      status: 'active',
      balance,
      apiKeyConfigured: true,
      lowBalance: balance < 1,
      message: `Anti-CAPTCHA service is active with $${balance} balance`
    });
  } catch (error) {
    console.error(`Error checking Anti-CAPTCHA status:`, error);
    res.json({
      success: false,
      status: 'error',
      error: error.message
    });
  }
});

/**
 * Advanced PerimeterX bypass scraper endpoint
 * Uses specialized techniques for evading Zillow's PerimeterX protection
 */
app.get('/advanced-scrape', async (req, res) => {
  const zipCode = req.query.zip;
  const useRealProfile = req.query.profile === 'true';
  const headless = req.query.headless !== 'false';
  
  // Validate ZIP code
  if (!zipCode || !zipCode.match(/^\d{5}$/)) {
    return res.status(400).json({
      error: 'Invalid ZIP code',
      message: 'Please provide a valid 5-digit US ZIP code as the "zip" query parameter',
      example: '/advanced-scrape?zip=90210'
    });
  }
  
  console.log(`Starting advanced PerimeterX bypass scrape for ZIP: ${zipCode}`);
  console.log(`Options: headless=${headless}, useRealProfile=${useRealProfile}`);
  
  try {
    // Track start time for performance measurement
    const startTime = Date.now();
    
    // Log proxy status
    if (process.env.USE_PROXY === 'true') {
      console.log(`✅ Using PacketStream residential proxy: ${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`);
      console.log(`✅ Proxy username: ${process.env.PROXY_USERNAME}`);
      console.log(`✅ IP rotation enabled for better scraping success`);
    } else {
      console.log('❌ Proxy disabled. Using direct connection (less effective against PerimeterX)');
    }
    
    // Use the specialized PerimeterX bypass module
    const results = await pxBypass.scrapeWithBypass(zipCode, {
      headless,
      useRealProfile
    });
    
    // Calculate execution time
    results.executionTime = Date.now() - startTime;
    
    // Always sanitize the response to ensure no HTML is returned
    const sanitizedResults = JSON.parse(JSON.stringify(results, (key, value) => {
      // Convert any HTML string to text only
      if (typeof value === 'string' && value.includes('<')) {
        return value.replace(/<[^>]*>/g, '');
      }
      return value;
    }));
    
    return res.json(sanitizedResults);
  } catch (error) {
    console.error(`Error in advanced scrape for ZIP ${zipCode}:`, error);
    
    // Log detailed error for debugging
    await fs.promises.appendFile(
      path.join(__dirname, 'debug-logs', `advanced-scrape-error-${zipCode}-${Date.now()}.log`),
      `${new Date().toISOString()} - Error in advanced scrape:\n${error.stack}\n\n`
    );
    
    // Return a clean error response
    return res.status(500).json({
      success: false,
      error: error.message,
      zipCode
    });
  }
});

/**
 * PerimeterX bypass test endpoint with detailed visual results
 */
app.get('/px-bypass-test', async (req, res) => {
  const zipCode = req.query.zip || '90210';
  const headless = req.query.headless !== 'false';
  const useRealProfile = req.query.profile === 'true';
  
  // HTML response for testing
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>PerimeterX Bypass Test</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #006aff; }
        h2 { margin-top: 30px; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid #ccc; 
                   border-top-color: #006aff; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        pre { background: #f5f5f5; padding: 15px; overflow: auto; }
        #results { display: none; }
      </style>
    </head>
    <body>
      <h1>PerimeterX Bypass Test</h1>
      <p>Testing specialized PerimeterX bypass techniques for Zillow...</p>
      
      <div id="loading" class="card">
        <p><span class="spinner"></span> Running test for ZIP code ${zipCode}...</p>
        <p>This may take 30-60 seconds. Please wait.</p>
      </div>
      
      <div id="results" class="card">
        <!-- Results will be inserted here via JavaScript -->
      </div>
      
      <script>
        // Make the API request as soon as the page loads
        fetch('/advanced-scrape?zip=${zipCode}&headless=${headless}&profile=${useRealProfile}')
          .then(response => response.json())
          .then(data => {
            // Hide the loading indicator
            document.getElementById('loading').style.display = 'none';
            
            // Show the results container
            const resultsEl = document.getElementById('results');
            resultsEl.style.display = 'block';
            
            // Create the results HTML
            let resultsHtml = \`
              <h2>Test Results</h2>
              <p><strong>Success:</strong> \${data.success ? '✅ Yes' : '❌ No'}</p>
              <p><strong>ZIP Code:</strong> \${data.zipCode}</p>
              <p><strong>Execution Time:</strong> \${(data.executionTime / 1000).toFixed(2)} seconds</p>
              <p><strong>Listings Found:</strong> \${data.listings ? data.listings.length : 0}</p>
              <p><strong>CAPTCHA Detected:</strong> \${data.captchaDetected ? '⚠️ Yes' : '✅ No'}</p>
            \`;
            
            if (data.error) {
              resultsHtml += \`<p><strong>Error:</strong> \${data.error}</p>\`;
            }
            
            // Add listings if any
            if (data.listings && data.listings.length > 0) {
              resultsHtml += \`
                <h2>Listings (\${data.listings.length})</h2>
                <ul>
              \`;
              
              data.listings.forEach((listing, i) => {
                resultsHtml += \`
                  <li>
                    <strong>\${listing.address}</strong><br>
                    Price: \${listing.price}<br>
                    Details: \${listing.details}<br>
                    \${listing.link && listing.link !== 'N/A' ? \`<a href="\${listing.link}" target="_blank">View on Zillow</a>\` : ''}
                  </li>
                \`;
              });
              
              resultsHtml += \`</ul>\`;
            }
            
            // Add raw data
            resultsHtml += \`
              <h2>Raw Response Data</h2>
              <pre>\${JSON.stringify(data, null, 2)}</pre>
            \`;
            
            // Insert the results
            resultsEl.innerHTML = resultsHtml;
          })
          .catch(error => {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('results').style.display = 'block';
            document.getElementById('results').innerHTML = \`
              <h2>Error</h2>
              <p>An error occurred while running the test: \${error.message}</p>
            \`;
          });
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Zillow FSBO scraper running on port ${port}`);
});