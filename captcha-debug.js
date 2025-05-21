/**
 * Advanced CAPTCHA Debugging Module
 * This module provides enhanced debugging for CAPTCHA bypass attempts
 */

const fs = require('fs').promises;
const path = require('path');

// Directory for storing debug information
const DEBUG_DIR = path.join(__dirname, 'captcha-debug');

// Ensure debug directory exists
async function ensureDebugDir() {
  try {
    await fs.mkdir(DEBUG_DIR, { recursive: true });
    return true;
  } catch (error) {
    console.error('Failed to create debug directory:', error);
    return false;
  }
}

/**
 * Save detailed diagnostic information about the CAPTCHA challenge
 * @param {Page} page - Puppeteer page object
 * @param {string} stage - The stage of CAPTCHA solving (e.g., 'detection', 'attempt', 'failure')
 * @param {Object} details - Additional details about the stage
 */
async function logCaptchaDebug(page, stage, details = {}) {
  try {
    await ensureDebugDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const debugInfo = {
      timestamp,
      stage,
      url: page.url(),
      ...details
    };

    // Create a timestamped debug file
    const debugFile = path.join(DEBUG_DIR, `captcha-debug-${stage}-${timestamp}.json`);
    await fs.writeFile(debugFile, JSON.stringify(debugInfo, null, 2));

    // Take a screenshot of the page
    const screenshotFile = path.join(DEBUG_DIR, `captcha-${stage}-${timestamp}.png`);
    await page.screenshot({ path: screenshotFile, fullPage: true });

    // If there's a CAPTCHA element, screenshot it as well
    try {
      const captchaElement = await page.$('#px-captcha') || 
                             await page.$('[class*="captcha"]') ||
                             await page.$('[id^="px-"]');
      
      if (captchaElement) {
        const elementScreenshotFile = path.join(DEBUG_DIR, `captcha-element-${stage}-${timestamp}.png`);
        await captchaElement.screenshot({ path: elementScreenshotFile });
      }
    } catch (elementError) {
      console.log('Could not screenshot CAPTCHA element:', elementError.message);
    }

    // Save HTML content for analysis
    const htmlFile = path.join(DEBUG_DIR, `captcha-page-${stage}-${timestamp}.html`);
    const htmlContent = await page.content();
    await fs.writeFile(htmlFile, htmlContent);
    
    console.log(`[CAPTCHA DEBUG] Saved ${stage} debug data to ${debugFile}`);
    return true;
  } catch (error) {
    console.error('Error saving CAPTCHA debug information:', error);
    return false;
  }
}

/**
 * Analyze CAPTCHA challenge details and log information
 * @param {Page} page - Puppeteer page object
 * @param {string} zipCode - ZIP code being scraped
 */
async function analyzeCaptchaChallenge(page, zipCode) {
  try {
    console.log('\n========== CAPTCHA CHALLENGE ANALYSIS ==========');
    console.log(`Analyzing CAPTCHA challenge for ZIP: ${zipCode}`);
    console.log(`Page URL: ${page.url()}`);
    
    // Check page title
    const title = await page.title();
    console.log(`Page title: "${title}"`);
    
    // Extract key page information
    const pageInfo = await page.evaluate(() => {
      return {
        // General page information
        title: document.title,
        url: window.location.href,
        
        // CAPTCHA elements
        hasPxCaptcha: document.querySelector('#px-captcha') !== null,
        hasGenericCaptcha: document.querySelector('[class*="captcha"]') !== null,
        hasPxElements: document.querySelectorAll('[id^="px-"]').length > 0,
        
        // Text indicators
        bodyText: document.body.innerText,
        
        // Look for specific PerimeterX indicators
        pxScripts: Array.from(document.querySelectorAll('script'))
          .filter(s => s.src && s.src.includes('px'))
          .map(s => s.src),
          
        // Headers - attempt to get some headers via DOM
        metaTags: Array.from(document.querySelectorAll('meta')).map(m => ({
          name: m.getAttribute('name'),
          content: m.getAttribute('content')
        })),
        
        // Detect CAPTCHA type
        captchaType: document.body.innerText.toLowerCase().includes('press & hold') ? 'press-and-hold' :
                     document.body.innerText.toLowerCase().includes('slide') ? 'slider' : 
                     document.body.innerText.toLowerCase().includes('select') ? 'selection' : 'unknown',
                     
        // Find any error messages
        errorMessages: Array.from(document.querySelectorAll('.error, [class*="error"], .message, [class*="message"]'))
          .map(el => el.innerText),
          
        // Find any challenge instructions
        instructions: Array.from(document.querySelectorAll('h1, h2, h3, p'))
          .map(el => el.innerText)
          .filter(text => text.toLowerCase().includes('captcha') || 
                          text.toLowerCase().includes('human') || 
                          text.toLowerCase().includes('robot') ||
                          text.toLowerCase().includes('verify') ||
                          text.toLowerCase().includes('press'))
      };
    });
    
    console.log('\n----- CAPTCHA Challenge Details -----');
    console.log(`CAPTCHA Type: ${pageInfo.captchaType}`);
    console.log(`Has PX-CAPTCHA Element: ${pageInfo.hasPxCaptcha}`);
    console.log(`Has Generic CAPTCHA Elements: ${pageInfo.hasGenericCaptcha}`);
    console.log(`Has PerimeterX Elements: ${pageInfo.hasPxElements}`);
    
    if (pageInfo.instructions && pageInfo.instructions.length > 0) {
      console.log('\n----- Challenge Instructions -----');
      pageInfo.instructions.forEach(inst => console.log(`- ${inst}`));
    }
    
    // Log the full page metadata for detailed review
    const debugPath = path.join(DEBUG_DIR, `captcha-analysis-${zipCode}-${Date.now()}.json`);
    await fs.writeFile(debugPath, JSON.stringify(pageInfo, null, 2));
    
    // Extract all visible interactive elements
    const interactiveElements = await page.evaluate(() => {
      const elements = [];
      
      // Target elements that might be part of the CAPTCHA
      const selectors = [
        '#px-captcha', '.px-captcha', '[id^="px-"]', '[class^="px-"]',
        'button', '[role="button"]', '[class*="captcha"]', '[id*="captcha"]',
        '[class*="slider"]', '[role="slider"]', 'div[tabindex]',
        '[style*="cursor: pointer"]'
      ];
      
      // Combine results from all selectors
      selectors.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {  // Only visible elements
              elements.push({
                selector,
                tagName: el.tagName,
                id: el.id,
                className: el.className,
                text: el.innerText.substring(0, 100),
                attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`),
                dimensions: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                }
              });
            }
          });
        } catch (e) {
          // Ignore errors for individual selectors
        }
      });
      
      return elements;
    });
    
    console.log('\n----- Interactive Elements -----');
    console.log(`Found ${interactiveElements.length} potentially interactive elements`);
    interactiveElements.forEach((el, i) => {
      console.log(`\nElement #${i+1}: ${el.tagName}${el.id ? '#'+el.id : ''}`);
      console.log(`Selector: ${el.selector}`);
      console.log(`Position: (${el.dimensions.x}, ${el.dimensions.y}) - Size: ${el.dimensions.width}x${el.dimensions.height}`);
      if (el.text) console.log(`Text: "${el.text}"`);
    });
    
    // Check for iframe-based CAPTCHAs
    const frames = await page.frames();
    console.log('\n----- Frames -----');
    console.log(`Found ${frames.length} frames in total`);
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const frameUrl = frame.url();
      console.log(`Frame ${i}: URL = ${frameUrl}`);
      
      // If a frame looks like it might contain a CAPTCHA, analyze it
      if (frameUrl.includes('captcha') || frameUrl.includes('challenge') || frameUrl.includes('recaptcha')) {
        console.log(`Analyzing potential CAPTCHA frame: ${frameUrl}`);
        
        try {
          // Check for CAPTCHA elements within the frame
          const frameCaptchaElements = await frame.evaluate(() => {
            const elements = [];
            ['#px-captcha', '[class*="captcha"]', '[id^="px-"]', 'iframe[src*="captcha"]'].forEach(selector => {
              document.querySelectorAll(selector).forEach(el => {
                elements.push({
                  selector,
                  id: el.id,
                  className: el.className,
                  text: el.innerText
                });
              });
            });
            return elements;
          });
          
          console.log(`Found ${frameCaptchaElements.length} CAPTCHA elements in frame ${i}`);
          frameCaptchaElements.forEach((el, j) => {
            console.log(`Frame Element #${j+1}: ${el.selector}`);
            if (el.text) console.log(`Text: "${el.text}"`);
          });
        } catch (frameError) {
          console.log(`Could not analyze frame ${i}: ${frameError.message}`);
        }
      }
    }
    
    // Check if the page has a detected PerimeterX CAPTCHA
    if (pageInfo.hasPxCaptcha || (interactiveElements.some(el => el.id && el.id.includes('px-'))) || title.includes('denied')) {
      console.log('\nPerimeterX CAPTCHA detected! Setting up for bypass attempt...');
      return {
        hasCaptcha: true,
        captchaType: pageInfo.captchaType,
        interactiveElements,
        instructions: pageInfo.instructions
      };
    } else {
      console.log('\nNo clear CAPTCHA found - page might be clean or using a hidden protection mechanism');
      return {
        hasCaptcha: false,
        possibleElements: interactiveElements
      };
    }
    
  } catch (error) {
    console.error('Error during CAPTCHA analysis:', error);
    return {
      hasCaptcha: true,
      error: error.message
    };
  }
}

/**
 * Log post-attempt results and detailed diagnostics
 * @param {boolean} success - Whether the bypass succeeded
 * @param {Object} details - Details about the attempt
 */
async function logBypassResult(success, details = {}) {
  try {
    await ensureDebugDir();
    
    const resultDetails = {
      timestamp: new Date().toISOString(),
      success,
      ...details
    };
    
    // Log to file with unique name
    const filename = `bypass-result-${success ? 'success' : 'failure'}-${Date.now()}.json`;
    const filePath = path.join(DEBUG_DIR, filename);
    
    await fs.writeFile(filePath, JSON.stringify(resultDetails, null, 2));
    
    // Print summary to console
    console.log(`\n========== CAPTCHA BYPASS ${success ? 'SUCCEEDED' : 'FAILED'} ==========`);
    console.log(`Timestamp: ${resultDetails.timestamp}`);
    
    if (details.timeTaken) {
      console.log(`Time taken: ${details.timeTaken.toFixed(2)}ms`);
    }
    
    if (details.strategy) {
      console.log(`Successful strategy: ${details.strategy}`);
    }
    
    if (details.attempts) {
      console.log(`Attempts made: ${details.attempts}`);
    }
    
    if (details.error) {
      console.log(`Error: ${details.error}`);
    }
    
    console.log(`Full details logged to: ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error logging bypass result:', error);
    return false;
  }
}

/**
 * Log statistics and details about page/DOM before and after CAPTCHA solving
 * @param {Page} page - Puppeteer page object
 * @param {string} status - Status identifier (pre, post, etc.)
 */
async function logPageState(page, status) {
  try {
    // Extract key metrics about the page
    const metrics = await page.metrics();
    
    // Get important page information
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        cookies: document.cookie,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        // DOM metrics
        elementsCount: document.querySelectorAll('*').length,
        scriptCount: document.querySelectorAll('script').length,
        frameCount: window.frames.length,
        // Check for errors in console
        hasErrors: window.hasOwnProperty('__consoleErrors') && window.__consoleErrors.length > 0,
        // Local storage length as indicator
        localStorageItems: Object.keys(localStorage).length,
        // Headers we can access
        userAgent: navigator.userAgent,
      };
    });
    
    console.log(`\n----- PAGE STATE [${status}] -----`);
    console.log(`Title: ${pageInfo.title}`);
    console.log(`URL: ${pageInfo.url}`);
    console.log(`DOM Elements: ${pageInfo.elementsCount}`);
    console.log(`Scripts: ${pageInfo.scriptCount}`);
    console.log(`Frames: ${pageInfo.frameCount}`);
    console.log(`User Agent: ${pageInfo.userAgent}`);
    
    // Log JS event counts from metrics
    console.log('\n----- BROWSER METRICS -----');
    console.log(`JS Event Listeners: ${metrics.JSEventListeners}`);
    console.log(`Documents: ${metrics.Documents}`);
    console.log(`Frames: ${metrics.Frames}`);
    console.log(`Navigation: ${metrics.NavigationStart}`);
    
    return {
      timestamp: new Date().toISOString(),
      status,
      pageInfo,
      metrics
    };
  } catch (error) {
    console.error(`Error logging page state [${status}]:`, error);
    return {
      error: error.message,
      status
    };
  }
}

/**
 * Detailed debugging for mouse/keyboard interactions during CAPTCHA solving
 * @param {Object} action - Details about the action being performed
 */
function logInteractionEvent(action) {
  const timestamp = new Date().toISOString();
  const timestampMs = Date.now();
  
  console.log(`[${timestamp}] INTERACTION: ${action.type} at ${JSON.stringify(action.position)}`);
  
  return {
    timestamp,
    timestampMs,
    ...action
  };
}

// Export all debugging functions
module.exports = {
  logCaptchaDebug,
  analyzeCaptchaChallenge,
  logBypassResult,
  logPageState,
  logInteractionEvent,
  ensureDebugDir
};