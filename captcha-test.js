/**
 * Advanced CAPTCHA Testing Module
 * This module provides specialized testing for different CAPTCHA bypass strategies
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const randomUseragent = require('random-useragent');
const fs = require('fs').promises;
const path = require('path');

// Import captcha solver and debug utilities
const captchaSolver = require('./captcha-solver');
const captchaDebug = require('./captcha-debug');

// Use stealth plugin
puppeteer.use(StealthPlugin());

// Directory for storing test results
const TEST_DIR = path.join(__dirname, 'captcha-test-results');

/**
 * Benchmark a specific CAPTCHA bypass strategy
 * @param {string} zipCode - The ZIP code to test with
 * @param {string} strategy - The name of the strategy to test
 * @returns {Promise<Object>} - The test results
 */
async function testCaptchaStrategy(zipCode, strategy = 'auto') {
  // Create test directory if it doesn't exist
  await fs.mkdir(TEST_DIR, { recursive: true });
  
  console.log(`\n========== ADVANCED CAPTCHA TEST ==========`);
  console.log(`Testing strategy: ${strategy}`);
  console.log(`ZIP Code: ${zipCode}`);
  
  // Start timing
  const startTime = Date.now();
  
  // Launch browser with advanced stealth options
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--hide-scrollbars',
      '--disable-notifications',
      '--disable-extensions',
      '--disable-plugins',
      '--lang=en-US,en',
      '--disable-features=site-per-process',
      '--disable-web-security'
    ],
    ignoreHTTPSErrors: true,
    ignoreDefaultArgs: ['--enable-automation']
  });
  
  // Create a detailed log for this test
  const timestamp = Date.now();
  const logFile = path.join(TEST_DIR, `captcha-test-${strategy}-${timestamp}.log`);
  const resultsFile = path.join(TEST_DIR, `captcha-test-${strategy}-${timestamp}.json`);
  
  // Create log entries array
  const logEntries = [];
  
  // Helper to log with timestamp
  const log = (message, type = 'info', data = null) => {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      data
    };
    
    // Add to entries array
    logEntries.push(entry);
    
    // Print to console
    console.log(`[${entry.timestamp}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  };
  
  try {
    log(`Starting test for strategy: ${strategy}`);
    
    // Create a new page with random user agent
    const page = await browser.newPage();
    
    // Enable console logs from the page
    page.on('console', msg => {
      log(`BROWSER CONSOLE: ${msg.text()}`, 'browser-console');
    });
    
    // Log all network requests (helpful for understanding API calls and redirects)
    page.on('request', request => {
      log(`REQUEST: ${request.method()} ${request.url()}`, 'network-request', {
        headers: request.headers()
      });
    });
    
    // Log all network responses
    page.on('response', async response => {
      const request = response.request();
      const status = response.status();
      
      // Only log detailed info for non-200 responses to avoid too much data
      if (status !== 200) {
        let responseData = null;
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            responseData = await response.json().catch(() => null);
          } else if (contentType.includes('text/html')) {
            // For HTML, just log a snippet to avoid huge logs
            const text = await response.text().catch(() => null);
            if (text) {
              responseData = text.substring(0, 500) + '...';
            }
          }
        } catch (e) {
          // Ignore errors in response logging
        }
        
        log(`RESPONSE: ${status} ${request.method()} ${request.url()}`, 'network-response', {
          status,
          headers: response.headers(),
          data: responseData
        });
      }
    });
    
    // Set viewport
    await page.setViewport({
      width: 1366 + Math.floor(Math.random() * 100),
      height: 768 + Math.floor(Math.random() * 100)
    });
    
    // Generate random user agent
    const userAgent = randomUseragent.getRandom();
    log(`Using user agent: ${userAgent}`);
    
    // Set user agent and other browser fingerprinting
    await page.setUserAgent(userAgent);
    
    // Set extra HTTP headers to appear more legitimate
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    });
    
    // Apply additional stealth measures (inject scripts to mask automation)
    await page.evaluateOnNewDocument(() => {
      // Override WebDriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      });
      
      // Override navigator properties to appear as a normal browser
      const newProto = navigator.__proto__;
      delete newProto.webdriver;
      navigator.__proto__ = newProto;
      
      // Add realistic Chrome plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client Executable' }
          ];
          
          const pluginArray = {
            length: plugins.length,
            item: (index) => plugins[index],
            namedItem: (name) => plugins.find(p => p.name === name),
            refresh: () => {}
          };
          
          // Add indexed properties
          plugins.forEach((plugin, i) => {
            pluginArray[i] = plugin;
          });
          
          return pluginArray;
        }
      });
      
      // Mock language array to prevent fingerprinting
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true
      });
    });
    
    // Navigate to Zillow search page for the specified ZIP code
    const url = `https://www.zillow.com/homes/${zipCode}_rb/`;
    log(`Navigating to: ${url}`);
    
    // Use waitUntil: 'networkidle2' for a more reliable page load
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Take initial screenshot
    const initialScreenshotPath = path.join(TEST_DIR, `initial-page-${strategy}-${timestamp}.png`);
    await page.screenshot({ path: initialScreenshotPath, fullPage: true });
    log(`Saved initial screenshot to: ${initialScreenshotPath}`);
    
    // Check page title and URL to detect CAPTCHA/challenge page
    const pageTitle = await page.title();
    const currentUrl = page.url();
    
    log(`Current page title: "${pageTitle}"`);
    log(`Current URL: ${currentUrl}`);
    
    // Save current page HTML for analysis
    const initialHtmlPath = path.join(TEST_DIR, `initial-page-${strategy}-${timestamp}.html`);
    const initialHtml = await page.content();
    await fs.writeFile(initialHtmlPath, initialHtml);
    log(`Saved initial HTML to: ${initialHtmlPath}`);
    
    // Check if we landed on a CAPTCHA page
    const captchaDetected = await page.evaluate(() => {
      // Check for common CAPTCHA indicators
      const title = document.title.toLowerCase();
      const body = document.body.innerText.toLowerCase();
      
      const captchaKeywords = [
        'captcha', 'robot', 'human', 'verification', 'verify',
        'denied', 'access denied', 'press & hold', 'challenge'
      ];
      
      // Check title
      const hasCaptchaTitle = captchaKeywords.some(keyword => title.includes(keyword));
      
      // Check body text
      const hasCaptchaText = captchaKeywords.some(keyword => body.includes(keyword));
      
      // Check for common CAPTCHA elements
      const hasCaptchaElements = 
        document.querySelector('#px-captcha') !== null ||
        document.querySelector('[class*="captcha"]') !== null ||
        document.querySelector('[id^="px-"]') !== null;
      
      return {
        detected: hasCaptchaTitle || hasCaptchaText || hasCaptchaElements,
        title,
        textIndicators: captchaKeywords.filter(keyword => body.includes(keyword)),
        elements: {
          pxCaptcha: document.querySelector('#px-captcha') !== null,
          genericCaptcha: document.querySelector('[class*="captcha"]') !== null,
          pxElements: document.querySelectorAll('[id^="px-"]').length > 0
        }
      };
    });
    
    log('CAPTCHA detection result:', 'detection', captchaDetected);
    
    if (captchaDetected.detected) {
      log('CAPTCHA page detected! Applying advanced bypass techniques...');
      
      // Run detailed CAPTCHA analysis for debugging
      const captchaAnalysis = await captchaDebug.analyzeCaptchaChallenge(page, zipCode);
      log('Detailed CAPTCHA analysis:', 'analysis', captchaAnalysis);
      
      // Apply the selected strategy
      let bypassResult = false;
      
      switch (strategy) {
        case 'anticaptcha':
          // Try anti-captcha API solution
          log('Attempting Anti-CAPTCHA service solution...');
          bypassResult = await captchaSolver.solveRecaptchaV2(page, url);
          break;
          
        case 'press-hold':
          // Try press and hold strategy
          log('Attempting press and hold strategy...');
          bypassResult = await captchaSolver.solvePerimeterXCaptcha(page);
          break;
          
        case 'stealth':
          // Try stealth approach (human-like behavior without direct CAPTCHA interaction)
          log('Attempting stealth approach...');
          // Implement complex human-like behavior pattern
          await simulateHumanBehavior(page);
          // Check if we're past the CAPTCHA
          bypassResult = await captchaSolver.checkIfSolved(page);
          break;
          
        case 'auto':
        default:
          // Try all available strategies in sequence
          log('Attempting all available strategies in sequence...');
          
          // First try Anti-CAPTCHA service
          log('Strategy 1: Anti-CAPTCHA service...');
          bypassResult = await captchaSolver.solveRecaptchaV2(page, url);
          
          if (!bypassResult) {
            // Then try PerimeterX solution
            log('Strategy 2: PerimeterX CAPTCHA solution...');
            bypassResult = await captchaSolver.solvePerimeterXCaptcha(page);
          }
          
          if (!bypassResult) {
            // Finally try human-like behavior
            log('Strategy 3: Human-like behavior simulation...');
            await simulateHumanBehavior(page);
            bypassResult = await captchaSolver.checkIfSolved(page);
          }
          break;
      }
      
      // Take post-attempt screenshot
      const postAttemptScreenshotPath = path.join(TEST_DIR, `post-attempt-${strategy}-${timestamp}.png`);
      await page.screenshot({ path: postAttemptScreenshotPath, fullPage: true });
      log(`Saved post-attempt screenshot to: ${postAttemptScreenshotPath}`);
      
      // Save post-attempt HTML
      const postAttemptHtmlPath = path.join(TEST_DIR, `post-attempt-${strategy}-${timestamp}.html`);
      const postAttemptHtml = await page.content();
      await fs.writeFile(postAttemptHtmlPath, postAttemptHtml);
      log(`Saved post-attempt HTML to: ${postAttemptHtmlPath}`);
      
      // Check result
      log(`CAPTCHA bypass ${bypassResult ? 'SUCCEEDED' : 'FAILED'}`);
      
      // If successful, scrape some data
      if (bypassResult) {
        log('CAPTCHA bypass successful! Attempting to scrape data...');
        
        // Wait for content to load
        await page.waitForTimeout(3000);
        
        // Try to find property listings
        const listings = await page.evaluate(() => {
          // Look for common property listing elements
          const propertyCards = Array.from(document.querySelectorAll('[data-test="property-card"], .list-card, [class*="property-card"]'));
          
          return propertyCards.map(card => {
            try {
              // Extract whatever data is available
              const priceEl = card.querySelector('[data-test="property-card-price"], .list-card-price, [class*="price"]');
              const addressEl = card.querySelector('[data-test="property-card-addr"], .list-card-addr, [class*="address"]');
              const detailsEl = card.querySelector('[data-test="property-card-details"], .list-card-details, [class*="details"]');
              const linkEl = card.querySelector('a[href*="zillow.com"]');
              
              return {
                price: priceEl ? priceEl.innerText : 'N/A',
                address: addressEl ? addressEl.innerText : 'N/A',
                details: detailsEl ? detailsEl.innerText : 'N/A',
                link: linkEl ? linkEl.href : 'N/A'
              };
            } catch (e) {
              return { error: e.message };
            }
          });
        });
        
        log(`Found ${listings.length} property listings:`, 'listings', listings);
      }
    } else {
      log('No CAPTCHA detected! Page loaded normally.');
      
      // Take final screenshot
      const finalScreenshotPath = path.join(TEST_DIR, `final-page-${strategy}-${timestamp}.png`);
      await page.screenshot({ path: finalScreenshotPath, fullPage: true });
      log(`Saved final screenshot to: ${finalScreenshotPath}`);
    }
    
    // Calculate time taken
    const endTime = Date.now();
    const timeTaken = endTime - startTime;
    log(`Test completed in ${timeTaken}ms (${(timeTaken / 1000).toFixed(2)} seconds)`);
    
    // Save complete log
    await fs.writeFile(logFile, logEntries.map(entry => JSON.stringify(entry)).join('\n'));
    log(`Complete log saved to: ${logFile}`);
    
    // Prepare and save results
    const results = {
      strategy,
      zipCode,
      timestamp: new Date().toISOString(),
      timeTaken,
      captchaDetected,
      success: captchaDetected.detected ? await captchaSolver.checkIfSolved(page) : true,
      artifacts: {
        initialScreenshot: initialScreenshotPath,
        initialHtml: initialHtmlPath,
        finalScreenshot: captchaDetected.detected ? path.join(TEST_DIR, `post-attempt-${strategy}-${timestamp}.png`) : path.join(TEST_DIR, `final-page-${strategy}-${timestamp}.png`),
        logFile
      }
    };
    
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
    log(`Test results saved to: ${resultsFile}`);
    
    // Close the browser
    await browser.close();
    
    return results;
  } catch (error) {
    log(`Error in test: ${error.message}`, 'error', {
      stack: error.stack
    });
    
    // Save error log
    await fs.writeFile(logFile, logEntries.map(entry => JSON.stringify(entry)).join('\n'));
    log(`Error log saved to: ${logFile}`);
    
    // Try to close browser
    try {
      if (browser) await browser.close();
    } catch (e) {
      // Ignore browser close errors
    }
    
    return {
      strategy,
      zipCode,
      timestamp: new Date().toISOString(),
      error: error.message,
      success: false
    };
  }
}

/**
 * Simulate complex human-like behavior to try bypassing CAPTCHA detection
 * @param {Page} page - Puppeteer page object
 */
async function simulateHumanBehavior(page) {
  console.log('Executing human-like behavior to appear more real...');
  
  // 1. Perform random scrolling
  console.log('Performed random scroll');
  await page.evaluate(() => {
    window.scrollBy(0, 100 + Math.random() * 400);
  });
  await page.waitForTimeout(800 + Math.random() * 1200);
  
  // 2. Perform a random click in the page (not on any specific element)
  const viewportSize = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }));
  
  const randomX = Math.floor(Math.random() * viewportSize.width);
  const randomY = Math.floor(Math.random() * viewportSize.height);
  
  await page.mouse.click(randomX, randomY);
  console.log(`Performed random click at ${randomX}, ${randomY}`);
  await page.waitForTimeout(500 + Math.random() * 1000);
  
  // 3. More random scrolling
  console.log('Performed random scroll');
  await page.evaluate(() => {
    window.scrollBy(0, 200 + Math.random() * 300);
  });
  await page.waitForTimeout(700 + Math.random() * 1000);
  
  // 4. Another random click
  const randomX2 = Math.floor(Math.random() * viewportSize.width);
  const randomY2 = Math.floor(Math.random() * viewportSize.height);
  
  await page.mouse.click(randomX2, randomY2);
  console.log(`Performed random click at ${randomX2}, ${randomY2}`);
  await page.waitForTimeout(600 + Math.random() * 900);
  
  // 5. Final scroll
  console.log('Performed random scroll');
  await page.evaluate(() => {
    window.scrollBy(0, -100 - Math.random() * 200);
  });
  await page.waitForTimeout(800 + Math.random() * 1200);
}

// Export functions
module.exports = {
  testCaptchaStrategy,
  simulateHumanBehavior
};