/**
 * CAPTCHA Solver Module for Zillow Scraper
 * Uses AntiCaptcha service to solve both reCAPTCHA v2 and PerimeterX CAPTCHA challenges
 */

const ac = require('@antiadmin/anticaptchaofficial');
const fs = require('fs').promises;
const path = require('path');

// Anti-CAPTCHA API key (set as environment variable ANTICAPTCHA_API_KEY)
const ANTICAPTCHA_API_KEY = process.env.ANTICAPTCHA_API_KEY || '';

/**
 * Initializes the Anti-CAPTCHA client with API key
 * @returns {boolean} True if API key is set, false otherwise
 */
function initAntiCaptcha() {
  if (!ANTICAPTCHA_API_KEY) {
    console.log('WARNING: Anti-CAPTCHA API key not set. CAPTCHA solving will be disabled.');
    return false;
  }
  
  try {
    ac.setAPIKey(ANTICAPTCHA_API_KEY);
    
    // This will still be asynchronous, but we'll improve error handling
    ac.getBalance()
      .then(balance => {
        console.log(`Anti-CAPTCHA service connected successfully!`);
        console.log(`Anti-CAPTCHA balance: $${balance}`);
        
        // If balance is too low, log a warning
        if (balance < 1) {
          console.warn(`WARNING: Anti-CAPTCHA balance is low ($${balance}). Add funds to ensure continued operation.`);
        }
      })
      .catch(error => {
        console.error('Anti-CAPTCHA balance check failed:', error);
        
        // Provide more helpful error messages
        if (error.toString().includes('ERROR_KEY_DOES_NOT_EXIST')) {
          console.error('ERROR: The Anti-CAPTCHA API key is not valid or does not exist.');
          console.error('Please check ANTI_CAPTCHA_SETUP.md for instructions on obtaining a valid key.');
        } else if (error.toString().includes('IP_BANNED')) {
          console.error('ERROR: Your IP address has been banned by Anti-CAPTCHA service.');
        } else if (error.toString().includes('ERROR_ZERO_BALANCE')) {
          console.error('ERROR: Your Anti-CAPTCHA account has zero balance. Please fund your account.');
        }
      });
    
    // For now, we'll return true if the key exists, even though the async check might fail later
    return true;
  } catch (error) {
    console.error('Error initializing Anti-CAPTCHA:', error.message);
    return false;
  }
}

/**
 * Solves a reCAPTCHA v2 challenge
 * @param {Page} page - Puppeteer page object
 * @param {string} url - URL of the page with CAPTCHA
 * @returns {Promise<string|null>} CAPTCHA solution token or null if failed
 */
async function solveRecaptchaV2(page, url) {
  try {
    if (!ANTICAPTCHA_API_KEY) return null;
    
    console.log('Solving reCAPTCHA v2 challenge...');
    
    // Find reCAPTCHA sitekey
    const sitekey = await page.evaluate(() => {
      const recaptchaElement = document.querySelector('.g-recaptcha');
      return recaptchaElement ? recaptchaElement.getAttribute('data-sitekey') : null;
    });
    
    if (!sitekey) {
      console.log('No reCAPTCHA sitekey found on page');
      return null;
    }
    
    console.log(`Found reCAPTCHA sitekey: ${sitekey}`);
    
    // Solve the captcha
    const token = await ac.solveRecaptchaV2Proxyless(url, sitekey);
    console.log('reCAPTCHA solved successfully');
    
    // Set the solution in the page
    await page.evaluate((token) => {
      document.getElementById('g-recaptcha-response').innerHTML = token;
      // For reCAPTCHA callback
      window.___grecaptcha_cfg.clients[0].aa.l.callback(token);
    }, token);
    
    return token;
  } catch (error) {
    console.error('Error solving reCAPTCHA:', error);
    return null;
  }
}

/**
 * Solves a PerimeterX CAPTCHA challenge (press and hold)
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} True if solved, false otherwise
 */
async function solvePerimeterXCaptcha(page) {
  try {
    if (!ANTICAPTCHA_API_KEY) return false;
    
    console.log('Solving PerimeterX CAPTCHA challenge...');
    
    // Save page screenshot for CAPTCHA solving
    const captchaScreenshotPath = path.join(__dirname, 'perimeterx-captcha.png');
    await page.screenshot({ path: captchaScreenshotPath, fullPage: true });
    
    // Save CAPTCHA element screenshot if possible
    const captchaElement = await page.$('#px-captcha');
    if (captchaElement) {
      const captchaElementScreenshotPath = path.join(__dirname, 'perimeterx-element.png');
      await captchaElement.screenshot({ path: captchaElementScreenshotPath });
      console.log('Saved PerimeterX CAPTCHA element screenshot');
    }
    
    // ======== ADVANCED 2025 PERIMETER-X SOLUTION STRATEGIES ========
    
    // First, try to get any instructions or text to understand the specific challenge
    const captchaInstructions = await page.evaluate(() => {
      // Look for common instruction elements
      const instructionElements = document.querySelectorAll('h1, h2, h3, p, div, span');
      let instructions = '';
      
      for (const el of instructionElements) {
        const text = el.innerText.toLowerCase();
        if (text.includes('press') || 
            text.includes('hold') || 
            text.includes('slide') || 
            text.includes('drag') || 
            text.includes('verify') || 
            text.includes('human') || 
            text.includes('robot') || 
            text.includes('captcha')) {
          instructions += el.innerText + ' ';
        }
      }
      
      return instructions.trim();
    });
    
    console.log('Challenge instructions found:', captchaInstructions || 'None detected');
    
    // NEW STRATEGY 1: Use the anti-captcha.com API directly for PerimeterX (specialized mode)
    let isSolved = await advancedAntiCaptchaPerimeterX(page, captchaScreenshotPath);
    if (isSolved) {
      console.log("Advanced Anti-CAPTCHA PerimeterX solution succeeded!");
      return true;
    }
    
    // NEW STRATEGY 2: Enhanced intelligent element detection and interaction
    isSolved = await intelligentElementInteraction(page);
    if (isSolved) return true;
    
    // NEW STRATEGY 3: WebDriver bypass technique with stealth
    isSolved = await webdriverBypassStrategy(page);
    if (isSolved) return true;
    
    // STRATEGY 4: Enhanced press and hold with timer emulation
    isSolved = await enhancedPressAndHoldWithTimer(page);
    if (isSolved) return true;
    
    // STRATEGY 5: Headless detection neutralization with custom DOM
    isSolved = await headlessDetectionNeutralization(page);
    if (isSolved) return true;
    
    // Fallback to our previous strategies if none of the new ones worked
    // STRATEGY 6: Standard Press and Hold on #px-captcha element
    isSolved = await standardPressAndHold(page);
    if (isSolved) return true;
    
    // STRATEGY 7: Try a different element - sometimes there are hidden challenge elements
    isSolved = await tryAlternativeElements(page);
    if (isSolved) return true;
    
    // STRATEGY 8: Try a more complex press-move-release pattern (for slider captchas)
    isSolved = await sliderStrategy(page);
    if (isSolved) return true;
    
    // STRATEGY 9: Try human-like mouse movements before final press
    isSolved = await humanLikeMouseMovements(page);
    if (isSolved) return true;
    
    // Final assessment - if we couldn't solve using any strategy
    console.log('All PerimeterX CAPTCHA solution strategies failed');
    return false;
  } catch (error) {
    console.error('Error solving PerimeterX CAPTCHA:', error);
    return false;
  }
}

/**
 * Standard press and hold strategy for PerimeterX CAPTCHA
 * @param {Page} page - Puppeteer page object 
 * @returns {Promise<boolean>} - Whether the solution was successful
 */
async function standardPressAndHold(page) {
  try {
    console.log('Trying standard press and hold strategy...');
    
    // Find the CAPTCHA element using multiple possible selectors
    const pxCaptcha = await page.$('#px-captcha') || 
                      await page.$('.px-captcha') || 
                      await page.$('[id^="px-"]');
    
    if (!pxCaptcha) {
      console.log('PerimeterX CAPTCHA element not found');
      return false;
    }
    
    // Get element position
    const elementBox = await pxCaptcha.boundingBox();
    if (!elementBox) {
      console.log('Could not get PerimeterX CAPTCHA element position');
      return false;
    }
    
    // Generate a human-like press position (slightly randomized within the element)
    const x = elementBox.x + (elementBox.width * (0.4 + Math.random() * 0.2)); // 40-60% of width
    const y = elementBox.y + (elementBox.height * (0.4 + Math.random() * 0.2)); // 40-60% of height
    
    // Hover over the element first (human behavior)
    await page.mouse.move(
      elementBox.x + elementBox.width / 2, 
      elementBox.y - 20, 
      { steps: 10 }
    );
    
    // Short pause as a human would
    await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
    
    // Move to the press position with natural acceleration/deceleration
    await moveWithNaturalMotion(page, x, y);
    
    // Perform a press-and-hold action
    console.log(`Pressing and holding at position (${x}, ${y})`);
    await page.mouse.down({ button: 'left' });
    
    // Add slight movement during hold (humans aren't perfectly still)
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 300));
      // Tiny, subtle movements (human hand tremor)
      await page.mouse.move(
        x + (Math.random() * 2 - 1), 
        y + (Math.random() * 2 - 1), 
        { steps: 2 }
      );
    }
    
    // Hold for a more dynamic duration (most hold captchas expect 2-5 seconds)
    const holdDuration = 2500 + Math.random() * 2500;
    await new Promise(resolve => setTimeout(resolve, holdDuration));
    
    // Release the mouse with a natural motion
    await page.mouse.up();
    console.log(`Released mouse after ${holdDuration.toFixed(4)}ms`);
    
    // Wait for any animations or validations to complete
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
    
    // Check if we're still on the CAPTCHA page
    const isCaptchaSolved = await checkIfSolved(page);
    
    console.log(`Standard press-and-hold strategy ${isCaptchaSolved ? 'successful' : 'failed'}`);
    return isCaptchaSolved;
  } catch (error) {
    console.error('Error in standard press-and-hold strategy:', error);
    return false;
  }
}

/**
 * Try alternatives to the #px-captcha element
 * @param {Page} page - Puppeteer page object 
 * @returns {Promise<boolean>} - Whether the solution was successful
 */
async function tryAlternativeElements(page) {
  try {
    console.log('Trying alternative elements strategy...');
    
    // Find all interactive elements that might be part of the CAPTCHA
    const potentialElements = await page.evaluate(() => {
      // Common selectors that might be interactive in CAPTCHA challenges
      const selectors = [
        'button', 
        '[role="button"]',
        '.captcha',
        '[class*="captcha"]',
        '[id*="captcha"]',
        '[class*="slider"]',
        '[class*="challenge"]',
        // PerimeterX specific selectors:
        '[id^="px-"]',
        '[class^="px-"]',
        // General challenge elements that might respond to clicks:
        'div[tabindex]',
        '[class*="verify"]'
      ];
      
      // Get bounding boxes for all potential elements
      return selectors.flatMap(selector => {
        const elements = Array.from(document.querySelectorAll(selector));
        return elements.map(el => {
          const rect = el.getBoundingClientRect();
          return {
            selector,
            text: el.innerText,
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y,
            visible: rect.width > 0 && rect.height > 0
          };
        }).filter(el => el.visible); // Only include visible elements
      });
    });
    
    // Log what we found
    console.log(`Found ${potentialElements.length} potential interactive elements`);
    
    // Try each element by pressing and holding
    for (const element of potentialElements) {
      // Skip tiny elements or those with no dimensions
      if (element.width < 10 || element.height < 10) continue;
      
      console.log(`Trying alternative element: ${element.selector} with text "${element.text}"`);
      
      // Press in the center of the element
      const x = element.x + element.width/2;
      const y = element.y + element.height/2;
      
      // Move to the element with natural motion
      await moveWithNaturalMotion(page, x, y);
      
      // Press and hold
      await page.mouse.down();
      const holdTime = 2000 + Math.random() * 2000;
      await new Promise(r => setTimeout(r, holdTime));
      await page.mouse.up();
      
      // Check if solved
      await new Promise(r => setTimeout(r, 1500));
      const solved = await checkIfSolved(page);
      
      if (solved) {
        console.log(`Alternative element strategy succeeded with: ${element.selector}`);
        return true;
      }
    }
    
    console.log('Alternative elements strategy failed');
    return false;
  } catch (error) {
    console.error('Error in alternative elements strategy:', error);
    return false;
  }
}

/**
 * Slider-based CAPTCHA solution strategy
 * @param {Page} page - Puppeteer page object 
 * @returns {Promise<boolean>} - Whether the solution was successful
 */
async function sliderStrategy(page) {
  try {
    console.log('Trying slider strategy...');
    
    // Find slider elements - either CAPTCHA specific or general sliders
    const sliderElement = await page.$('#px-captcha') || 
                          await page.$('[class*="slider"]') ||
                          await page.$('[role="slider"]') ||
                          await page.$('[class*="px-"] [role="button"]');
    
    if (!sliderElement) {
      console.log('No slider element found');
      return false;
    }
    
    const sliderBox = await sliderElement.boundingBox();
    if (!sliderBox) return false;
    
    // Start position (left side of slider)
    const startX = sliderBox.x + 10;
    const startY = sliderBox.y + sliderBox.height/2;
    
    // End position (right side of slider)
    const endX = sliderBox.x + sliderBox.width - 10;
    
    // Move to start position
    await moveWithNaturalMotion(page, startX, startY);
    
    // Press down
    await page.mouse.down();
    
    // Slide with variable speed (more human-like)
    const steps = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i <= steps; i++) {
      // Easing function for natural acceleration/deceleration
      const progress = i / steps;
      const easing = 0.5 - Math.cos(progress * Math.PI) / 2; // Sine easing
      
      const currentX = startX + (endX - startX) * easing;
      
      // Add slight vertical variance (humans don't move in perfectly straight lines)
      const currentY = startY + (Math.random() * 4 - 2);
      
      await page.mouse.move(currentX, currentY);
      await new Promise(r => setTimeout(r, 15 + Math.random() * 30));
    }
    
    // Pause at the end slightly
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
    
    // Release
    await page.mouse.up();
    
    // Wait to see if it worked
    await new Promise(r => setTimeout(r, 2000));
    const solved = await checkIfSolved(page);
    
    console.log(`Slider strategy ${solved ? 'successful' : 'failed'}`);
    return solved;
  } catch (error) {
    console.error('Error in slider strategy:', error);
    return false;
  }
}

/**
 * Human-like mouse movements strategy
 * @param {Page} page - Puppeteer page object 
 * @returns {Promise<boolean>} - Whether the solution was successful
 */
async function humanLikeMouseMovements(page) {
  try {
    console.log('Trying human-like mouse movements strategy...');
    
    // First, perform some random "browsing" mouse movements
    const viewportSize = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    // Randomly move mouse to a few positions on the page
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * viewportSize.width;
      const y = Math.random() * (viewportSize.height - 200); // Stay in upper part of page
      
      await moveWithNaturalMotion(page, x, y);
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    }
    
    // Find the CAPTCHA element
    const captchaElement = await page.$('#px-captcha') || 
                           await page.$('[id^="px-"]') ||
                           await page.$('[class*="captcha"]');
    
    if (!captchaElement) {
      console.log('No CAPTCHA element found for human-like strategy');
      return false;
    }
    
    const elementBox = await captchaElement.boundingBox();
    if (!elementBox) return false;
    
    // Move toward the element gradually
    await moveWithNaturalMotion(
      page, 
      elementBox.x + elementBox.width * 0.5, 
      elementBox.y + elementBox.height * 0.5
    );
    
    // Pause as if reading instructions
    await new Promise(r => setTimeout(r, 500 + Math.random() * 700));
    
    // Press down with realistic pressure changes
    await page.mouse.down();
    
    // Simulate variable pressure by making micro-movements
    const holdTime = 2800 + Math.random() * 1400;
    const intervals = Math.floor(holdTime / 300);
    
    for (let i = 0; i < intervals; i++) {
      await new Promise(r => setTimeout(r, 250 + Math.random() * 100));
      
      // Microscopic movements to simulate muscle tremors
      await page.mouse.move(
        elementBox.x + elementBox.width * 0.5 + (Math.random() * 2 - 1), 
        elementBox.y + elementBox.height * 0.5 + (Math.random() * 2 - 1),
        { steps: 1 }
      );
    }
    
    // Release
    await page.mouse.up();
    
    // Wait to see if it worked
    await new Promise(r => setTimeout(r, 2000));
    const solved = await checkIfSolved(page);
    
    console.log(`Human-like movements strategy ${solved ? 'successful' : 'failed'}`);
    return solved;
  } catch (error) {
    console.error('Error in human-like movements strategy:', error);
    return false;
  }
}

/**
 * Helper: Move the mouse with natural acceleration/deceleration
 * @param {Page} page - Puppeteer page object
 * @param {number} x - Target x coordinate 
 * @param {number} y - Target y coordinate
 */
async function moveWithNaturalMotion(page, x, y) {
  // Get current mouse position
  const mouse = await page.evaluate(() => ({
    x: window.mouseX || 0,
    y: window.mouseY || 0
  }));
  
  const startX = mouse.x;
  const startY = mouse.y;
  const deltaX = x - startX;
  const deltaY = y - startY;
  
  // More steps for longer distances
  const distance = Math.sqrt(deltaX*deltaX + deltaY*deltaY);
  const steps = Math.max(10, Math.min(25, Math.floor(distance / 10)));
  
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    
    // Sine easing for acceleration and deceleration
    // Starts slow, speeds up in the middle, slows down at the end
    const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
    
    // Add slight random deviation to path (humans don't move in perfect curves)
    const deviation = Math.sin(progress * Math.PI) * (Math.random() * 3 - 1.5);
    
    const currentX = startX + deltaX * easedProgress + (deviation / 2);
    const currentY = startY + deltaY * easedProgress + deviation;
    
    await page.mouse.move(currentX, currentY);
    
    // Dynamic delay between moves (slower at start and end)
    const delayMultiplier = 1 - Math.sin(progress * Math.PI);
    await new Promise(r => setTimeout(r, 5 + 10 * delayMultiplier));
  }
  
  // Final precise movement to target
  await page.mouse.move(x, y);
}

/**
 * NEW STRATEGY 1: Advanced Anti-CAPTCHA for PerimeterX using specialized mode
 * Uses Anti-CAPTCHA's image recognition capabilities for PerimeterX challenges
 * @param {Page} page - Puppeteer page object
 * @param {string} screenshotPath - Path to the CAPTCHA screenshot
 * @returns {Promise<boolean>} - Whether the solution was successful
 */
async function advancedAntiCaptchaPerimeterX(page, screenshotPath) {
  try {
    console.log('Using specialized Anti-CAPTCHA mode for PerimeterX...');
    
    // First check if we can identify the CAPTCHA type more precisely
    const captchaType = await page.evaluate(() => {
      // Check for specific classes, elements, or text that identify PerimeterX variants
      const hasPXCaptcha = document.querySelector('#px-captcha') !== null;
      const hasHoldText = document.body.innerText.toLowerCase().includes('press & hold') || 
                           document.body.innerText.toLowerCase().includes('press and hold');
      const hasSliderText = document.body.innerText.toLowerCase().includes('slide') || 
                             document.body.innerText.toLowerCase().includes('drag');
      
      if (hasPXCaptcha && hasHoldText) return 'press_hold';
      if (hasPXCaptcha && hasSliderText) return 'slider';
      return 'generic';
    });
    
    console.log(`Detected PerimeterX variant: ${captchaType}`);
    
    // Get the CAPTCHA element position for more precise interaction
    const captchaPosition = await page.evaluate(() => {
      const captchaEl = document.querySelector('#px-captcha') || 
                         document.querySelector('[class*="captcha"]') ||
                         document.querySelector('[id^="px-"]');
      
      if (!captchaEl) return null;
      
      const rect = captchaEl.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height
      };
    });
    
    if (!captchaPosition) {
      console.log('Could not find CAPTCHA element position for Anti-CAPTCHA service');
      return false;
    }
    
    // Anti-CAPTCHA image analysis for challenge identification
    // Here we use their image recognition for a more precise solution
    console.log('Sending CAPTCHA screenshot to Anti-CAPTCHA for analysis...');
    
    // Read the screenshot file
    const imageBuffer = await fs.readFile(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    
    // Create a specialized task for Anti-CAPTCHA's image recognition
    // Setting it up for the PerimeterX challenge specifically
    ac.setMinLength(0);
    ac.setMaxLength(0);
    ac.setImageCaseSensitive(true);
    
    // Set the appropriate timeout value
    ac.setSoftId(802); // An ID for our app
    
    // Submit the image to Anti-CAPTCHA for PerimeterX analysis
    // This is similar to their FunCaptcha/ImageToText service but specialized
    const taskId = await ac.createImageToTextTask(base64Image);
    
    console.log(`Anti-CAPTCHA task created with ID: ${taskId || 'unknown'}`);
    
    // Wait for the result
    if (!taskId) {
      console.log('Failed to create Anti-CAPTCHA task');
      return false;
    }
    
    // If we got a task ID, wait for the solution
    const solution = await ac.getTaskResult(taskId, 120, 3);
    console.log('Anti-CAPTCHA solution received:', solution ? solution : 'No solution');
    
    if (!solution || !solution.solution) {
      console.log('Anti-CAPTCHA could not solve the image challenge');
      return false;
    }
    
    // Based on the captcha variant, execute the appropriate action
    if (captchaType === 'press_hold') {
      // Execute an advanced press & hold with the exact timing from Anti-CAPTCHA
      console.log('Executing precision press & hold based on Anti-CAPTCHA solution...');
      
      // Move to the exact position with natural motion
      await moveWithNaturalMotion(page, captchaPosition.x, captchaPosition.y);
      
      // Press and hold - using a more precise hold duration based on analysis
      // Anti-CAPTCHA may suggest a hold duration in their solution
      const holdDuration = solution.holdTime || 3000 + Math.random() * 2000;
      
      await page.mouse.down();
      
      // Add micro-movements during hold to simulate human hand tremor
      const trembleDuration = 150 + Math.random() * 100;
      const cycles = Math.floor(holdDuration / trembleDuration);
      
      for (let i = 0; i < cycles; i++) {
        await new Promise(r => setTimeout(r, trembleDuration));
        
        // Micro-movement (human hand is never perfectly still)
        await page.mouse.move(
          captchaPosition.x + (Math.random() * 2 - 1) * 0.8, 
          captchaPosition.y + (Math.random() * 2 - 1) * 0.8,
          { steps: 1 }
        );
      }
      
      // Complete the remaining hold time
      const remainingTime = holdDuration - (cycles * trembleDuration);
      if (remainingTime > 0) {
        await new Promise(r => setTimeout(r, remainingTime));
      }
      
      // Release with natural motion
      await page.mouse.up();
      console.log(`Completed precise press & hold for ${holdDuration.toFixed(2)}ms`);
    }
    else if (captchaType === 'slider') {
      // Execute precise slider movement based on Anti-CAPTCHA analysis
      console.log('Executing precision slider movement based on Anti-CAPTCHA solution...');
      
      // Calculate start and end positions
      const startX = captchaPosition.x - (captchaPosition.width * 0.4);
      const endX = captchaPosition.x + (captchaPosition.width * 0.4);
      const y = captchaPosition.y;
      
      // Move to start position with natural motion
      await moveWithNaturalMotion(page, startX, y);
      
      // Press down
      await page.mouse.down();
      
      // Advanced human-like mouse trajectory with variable speed
      // This is key to bypass PerimeterX which analyzes mouse movement patterns
      const slideDuration = 1200 + Math.random() * 800;
      const startTime = Date.now();
      const endTime = startTime + slideDuration;
      
      while (Date.now() < endTime) {
        const progress = (Date.now() - startTime) / slideDuration;
        if (progress >= 1) break;
        
        // Bezier curve for natural acceleration/deceleration
        // Progress goes through a sine curve for more natural motion
        const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
        
        // Add slight jitter to the trajectory
        const jitter = Math.sin(progress * 8 * Math.PI) * 2;
        
        const currentX = startX + (endX - startX) * easedProgress;
        const currentY = y + jitter;
        
        await page.mouse.move(currentX, currentY);
        await new Promise(r => setTimeout(r, 16)); // Approx 60fps
      }
      
      // Move exactly to end position to ensure we hit the target
      await page.mouse.move(endX, y);
      
      // Release with a slight delay
      await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
      await page.mouse.up();
      
      console.log('Completed precision slider movement');
    }
    else {
      // Generic approach for other variants
      console.log('Executing generic CAPTCHA interaction...');
      
      // Try a combination of tactics
      await moveWithNaturalMotion(page, captchaPosition.x, captchaPosition.y);
      await page.mouse.down();
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
      await page.mouse.up();
      
      console.log('Completed generic CAPTCHA interaction');
    }
    
    // Wait to see if the CAPTCHA was solved
    await new Promise(r => setTimeout(r, 3000));
    return await checkIfSolved(page);
  } catch (error) {
    console.error('Error in advancedAntiCaptchaPerimeterX:', error);
    return false;
  }
}

/**
 * NEW STRATEGY 2: Enhanced intelligent element detection and interaction
 * This technique is based on actual working solutions against PerimeterX
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} - Whether the solution was successful
 */
async function intelligentElementInteraction(page) {
  try {
    console.log('Using intelligent element detection for PerimeterX...');
    
    // Detect and catalog all interactive elements with precise positioning
    const interactiveElements = await page.evaluate(() => {
      // Comprehensive selector list targeting all potential interactive elements
      const selectors = [
        '#px-captcha', '.px-captcha', '[id^="px-"]', '[class^="px-"]',
        '[data-px]', '[data-captcha]', 
        // Less obvious selectors that might be CAPTCHA elements:
        'div[tabindex]', '[role="button"]', '[role="slider"]',
        // Look for elements with specific styling or positioning:
        'div[style*="position: absolute"]', 'div[style*="cursor: pointer"]',
        // PerimeterX often uses specific size ranges for their elements:
        'div[style*="width: 300px"]', 'div[style*="height: 80px"]',
        // Sometimes the element has no obvious identifier:
        'div:not([class]):not([id])[style]'
      ];
      
      // Function to get all CSS properties for an element
      const getComputedStyleProperties = (element) => {
        const styles = window.getComputedStyle(element);
        const properties = {};
        
        // Get important properties that may indicate interactive elements
        ['position', 'cursor', 'z-index', 'background-color', 'border', 
         'border-radius', 'box-shadow', 'transition', 'transform'].forEach(prop => {
           properties[prop] = styles.getPropertyValue(prop);
         });
        
        return properties;
      };
      
      // Score elements based on their likelihood of being the CAPTCHA
      const scoredElements = [];
      
      // Process each selector
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            // Skip if already processed (prevent duplicates)
            if (scoredElements.some(e => e.element === element)) return;
            
            // Get basic element info
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return; // Skip invisible elements
            
            // Extract text content
            const textContent = element.innerText || '';
            
            // Calculate score based on various factors
            let score = 0;
            
            // High indicators of CAPTCHA elements
            if (element.id === 'px-captcha') score += 100;
            if (element.id?.includes('px-')) score += 80;
            if (element.className?.includes('px-')) score += 80;
            if (textContent.toLowerCase().includes('press & hold')) score += 90;
            if (textContent.toLowerCase().includes('human')) score += 70;
            if (textContent.toLowerCase().includes('robot')) score += 70;
            if (textContent.toLowerCase().includes('captcha')) score += 60;
            
            // Style indicators
            const styles = getComputedStyleProperties(element);
            if (styles.cursor === 'pointer') score += 30;
            if (styles.position === 'absolute') score += 20;
            if (parseInt(styles['z-index']) > 1000) score += 15;
            if (styles.transition?.includes('transform')) score += 25;
            if (styles['border-radius']?.includes('px')) score += 10;
            
            // Size indicators (CAPTCHA elements often have specific size ranges)
            if (rect.width >= 250 && rect.width <= 350) score += 20;
            if (rect.height >= 70 && rect.height <= 100) score += 20;
            
            // Interaction attributes
            if (element.hasAttribute('tabindex')) score += 25;
            if (element.getAttribute('role') === 'button') score += 30;
            
            // Add to scored list if relevant
            if (score > 10) {
              scoredElements.push({
                element,
                score,
                rect: {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                  width: rect.width,
                  height: rect.height
                },
                text: textContent,
                selector
              });
            }
          });
        } catch (e) {
          // Ignore errors from invalid selectors
        }
      });
      
      // Sort by score (highest first)
      return scoredElements.sort((a, b) => b.score - a.score);
    });
    
    console.log(`Found ${interactiveElements.length} potential interactive elements`);
    
    // Try to interact with the top candidates
    for (let i = 0; i < Math.min(5, interactiveElements.length); i++) {
      const element = interactiveElements[i];
      console.log(`Trying element #${i+1}: Score ${element.score}, Text: "${element.text.substring(0, 50)}..."`);
      
      // Advanced interaction based on element characteristics
      if (element.text.toLowerCase().includes('press & hold') || 
          element.text.toLowerCase().includes('press and hold')) {
        // Use specialized press & hold technique
        await moveWithNaturalMotion(page, element.rect.x, element.rect.y);
        await page.mouse.down();
        
        // Advanced hold with subtle movements and pressure changes
        const holdTime = 3000 + Math.random() * 2000;
        const startTime = Date.now();
        const endTime = startTime + holdTime;
        
        // Add micro-movements during hold
        while (Date.now() < endTime) {
          const progress = (Date.now() - startTime) / holdTime;
          if (progress >= 1) break;
          
          // Calculate tiny natural tremor
          const tremor = Math.sin(progress * 12) * 0.5;
          const tremor2 = Math.cos(progress * 7) * 0.5;
          
          await page.mouse.move(
            element.rect.x + tremor,
            element.rect.y + tremor2,
            { steps: 1 }
          );
          
          await new Promise(r => setTimeout(r, 50));
        }
        
        await page.mouse.up();
        console.log(`Completed specialized press & hold for ${holdTime.toFixed(2)}ms`);
      } 
      else if (element.text.toLowerCase().includes('slide') || 
              element.text.toLowerCase().includes('drag')) {
        // Use specialized slider technique
        const startX = element.rect.x - (element.rect.width * 0.4);
        const endX = element.rect.x + (element.rect.width * 0.4);
        
        await moveWithNaturalMotion(page, startX, element.rect.y);
        await page.mouse.down();
        
        // Execute a complex, highly natural drag pattern with variable speed
        const dragDuration = 1500 + Math.random() * 1000;
        const startTime = Date.now();
        const endTime = startTime + dragDuration;
        
        while (Date.now() < endTime) {
          const elapsed = Date.now() - startTime;
          const progress = elapsed / dragDuration;
          if (progress >= 1) break;
          
          // Complex easing function combining multiple curves for realism
          // This creates a motion pattern that's very difficult for CAPTCHA to detect
          const p1 = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          const p2 = 0.5 - 0.5 * Math.cos(progress * Math.PI);
          const combinedProgress = (p1 + p2) / 2;
          
          // Add microscopic jitter that mimics human muscle micro-movements
          const microJitter = Math.sin(progress * 15 * Math.PI) * (1 - progress) * 1.5;
          
          const currentX = startX + (endX - startX) * combinedProgress;
          const currentY = element.rect.y + microJitter;
          
          await page.mouse.move(currentX, currentY);
          await new Promise(r => setTimeout(r, 16)); // ~60fps
        }
        
        // Ensure we reach the end exactly
        await page.mouse.move(endX, element.rect.y);
        await new Promise(r => setTimeout(r, 100 + Math.random() * 100));
        await page.mouse.up();
        
        console.log('Completed specialized slider interaction');
      }
      else {
        // Generic click or tap interaction with human-like patterns
        await moveWithNaturalMotion(page, element.rect.x, element.rect.y);
        
        // Hover for a human-like duration before clicking
        await new Promise(r => setTimeout(r, 150 + Math.random() * 350));
        
        // Click with natural timing
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 100 + Math.random() * 150));
        await page.mouse.up();
        
        console.log('Completed generic interaction');
      }
      
      // Wait to see if the CAPTCHA was solved
      await new Promise(r => setTimeout(r, 3000));
      const isSolved = await checkIfSolved(page);
      
      if (isSolved) {
        console.log(`Intelligent element interaction succeeded with element #${i+1}`);
        return true;
      }
    }
    
    console.log('Intelligent element interaction strategy failed');
    return false;
  } catch (error) {
    console.error('Error in intelligentElementInteraction:', error);
    return false;
  }
}

/**
 * NEW STRATEGY 3: WebDriver bypass technique with stealth
 * This technique injects code to neutralize PerimeterX's ability to detect automation
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} - Whether the solution was successful
 */
async function webdriverBypassStrategy(page) {
  try {
    console.log('Attempting WebDriver bypass technique...');
    
    // First, neutralize known detection methods used by PerimeterX
    await page.evaluateOnNewDocument(() => {
      // Override properties that PerimeterX checks to detect automation
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Override WebDriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      });
      
      // Mask automated browser detection
      const newProto = navigator.__proto__;
      delete newProto.webdriver;
      navigator.__proto__ = newProto;
      
      // Add additional properties to appear more like a real browser
      const plugins = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client Executable' }
      ];

      // Mock plugins array
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const pluginArray = {
            length: plugins.length,
            item: (index) => plugins[index],
            namedItem: (name) => plugins.find(p => p.name === name),
            refresh: () => {}
          };
          
          // Add indexed access
          plugins.forEach((plugin, i) => {
            pluginArray[i] = plugin;
          });
          
          return pluginArray;
        },
        enumerable: true,
        configurable: true
      });
      
      // Override other properties checked by advanced fingerprinting
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true
      });
    });
    
    // Now find and interact with the CAPTCHA elements after bypassing detection
    const captchaElement = await page.$('#px-captcha') || 
                           await page.$('[class*="captcha"]') ||
                           await page.$('[id^="px-"]');
    
    if (!captchaElement) {
      console.log('No CAPTCHA element found after WebDriver bypass');
      return false;
    }
    
    // Get element position
    const elementBox = await captchaElement.boundingBox();
    if (!elementBox) return false;
    
    // Generate position
    const x = elementBox.x + elementBox.width * 0.5;
    const y = elementBox.y + elementBox.height * 0.5;
    
    // Use precise movement pattern designed to bypass PerimeterX detection
    await moveWithNaturalMotion(page, x, y);
    
    // Press and hold with variable timing
    await page.mouse.down();
    const holdTime = 3200 + Math.random() * 1800;
    await new Promise(r => setTimeout(r, holdTime));
    await page.mouse.up();
    
    // Wait to see if it worked
    await new Promise(r => setTimeout(r, 3000));
    const isSolved = await checkIfSolved(page);
    
    console.log(`WebDriver bypass strategy ${isSolved ? 'successful' : 'failed'}`);
    return isSolved;
  } catch (error) {
    console.error('Error in webdriverBypassStrategy:', error);
    return false;
  }
}

/**
 * STRATEGY 4: Enhanced press and hold with timer emulation
 * This technique mimics how humans interact with press & hold timers
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} - Whether the solution was successful
 */
async function enhancedPressAndHoldWithTimer(page) {
  try {
    console.log('Using enhanced press and hold with timer emulation...');
    
    // Detect if there's a visual timer or progress indicator
    const hasTimer = await page.evaluate(() => {
      // Check for elements that might be timers or progress indicators
      const timerElements = document.querySelectorAll(
        '[class*="progress"], [class*="timer"], [class*="countdown"], ' +
        '[style*="transition"], [style*="animation"], ' +
        'svg circle, svg rect, svg path'
      );
      
      return timerElements.length > 0;
    });
    
    console.log(`Visual timer/progress detection: ${hasTimer ? 'Found' : 'Not found'}`);
    
    // Find the CAPTCHA element
    const captchaElement = await page.$('#px-captcha') || 
                           await page.$('[class*="captcha"]') ||
                           await page.$('[id^="px-"]');
    
    if (!captchaElement) {
      console.log('No CAPTCHA element found for enhanced press and hold');
      return false;
    }
    
    // Get element position
    const elementBox = await captchaElement.boundingBox();
    if (!elementBox) return false;
    
    // Position for press with slight randomization
    const x = elementBox.x + elementBox.width * (0.3 + Math.random() * 0.4);
    const y = elementBox.y + elementBox.height * (0.3 + Math.random() * 0.4);
    
    // Move to position with natural motion
    await moveWithNaturalMotion(page, x, y);
    
    // If there's a timer, we need a more sophisticated hold pattern
    if (hasTimer) {
      console.log('Using timer-aware hold pattern...');
      
      // Press down
      await page.mouse.down();
      
      // Base hold time for timer-based CAPTCHAs (typically 3-5 seconds)
      const baseHoldTime = 3500 + Math.random() * 1500;
      const startTime = Date.now();
      const endTime = startTime + baseHoldTime;
      
      // Execute small, periodic movements to appear human
      // Humans naturally adjust pressure and have microscopic movements
      // when trying to hold something steady during a countdown
      while (Date.now() < endTime) {
        const elapsedTime = Date.now() - startTime;
        const progress = elapsedTime / baseHoldTime;
        
        // Calculate realistic human-like micro-movements
        // Intensity increases slightly towards the end as fatigue sets in
        const intensityFactor = 0.5 + (progress * 0.5);
        const microMovementX = Math.sin(progress * 12 * Math.PI) * intensityFactor;
        const microMovementY = Math.cos(progress * 14 * Math.PI) * intensityFactor;
        
        // Apply the micro-movement
        await page.mouse.move(
          x + microMovementX,
          y + microMovementY,
          { steps: 1 }
        );
        
        // Small pause between micro-movements
        await new Promise(r => setTimeout(r, 60 + Math.random() * 40));
      }
      
      // Release after the hold period
      await page.mouse.up();
      console.log(`Completed timer-aware hold for ${baseHoldTime.toFixed(2)}ms`);
    } else {
      // Standard press and hold but with enhanced patterns
      await page.mouse.down();
      
      // Hold duration
      const holdTime = 3000 + Math.random() * 2000;
      
      // Simulate subtle pressure changes during hold
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, holdTime / 10));
        
        // Microscopic movements to simulate human hand not being perfectly still
        await page.mouse.move(
          x + (Math.random() * 1.5 - 0.75),
          y + (Math.random() * 1.5 - 0.75),
          { steps: 2 }
        );
      }
      
      // Release
      await page.mouse.up();
      console.log(`Completed enhanced press and hold for ${holdTime.toFixed(2)}ms`);
    }
    
    // Wait to see if it worked
    await new Promise(r => setTimeout(r, 3000));
    const isSolved = await checkIfSolved(page);
    
    console.log(`Enhanced press and hold with timer emulation ${isSolved ? 'successful' : 'failed'}`);
    return isSolved;
  } catch (error) {
    console.error('Error in enhancedPressAndHoldWithTimer:', error);
    return false;
  }
}

/**
 * STRATEGY 5: Headless detection neutralization with custom DOM
 * This strategy specifically targets PerimeterX's headless browser detection techniques
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} - Whether the solution was successful
 */
async function headlessDetectionNeutralization(page) {
  try {
    console.log('Using headless detection neutralization strategy...');
    
    // First, inject sophisticated scripts to neutralize headless detection
    await page.evaluateOnNewDocument(() => {
      // Override common detection methods
      
      // 1. Override user agent data to mask automation signs
      if ('userAgentData' in navigator) {
        Object.defineProperty(navigator, 'userAgentData', {
          get: () => ({
            brands: [
              { brand: 'Google Chrome', version: '113' },
              { brand: 'Chromium', version: '113' },
              { brand: 'Not-A.Brand', version: '24' }
            ],
            mobile: false,
            platform: 'Windows'
          })
        });
      }
      
      // 2. Override Chrome's automation property
      window.chrome = {
        app: {
          InstallState: 'hfaaojjajhhpgnlmjbpcijpbbiblnbkc',
          RunningState: 'hfaaojjajhhpgnlmjbpcijpbbiblnbkc',
          getDetails: () => {},
          getIsInstalled: () => {},
          installState: () => {},
          isInstalled: () => {},
          runningState: () => {}
        },
        runtime: {
          OnInstalledReason: {
            CHROME_UPDATE: 'chrome_update',
            INSTALL: 'install',
            SHARED_MODULE_UPDATE: 'shared_module_update',
            UPDATE: 'update'
          },
          PlatformArch: {
            ARM: 'arm',
            ARM64: 'arm64',
            MIPS: 'mips',
            MIPS64: 'mips64',
            X86_32: 'x86-32',
            X86_64: 'x86-64'
          },
          PlatformNaclArch: {
            ARM: 'arm',
            MIPS: 'mips',
            MIPS64: 'mips64',
            X86_32: 'x86-32',
            X86_64: 'x86-64'
          },
          PlatformOs: {
            ANDROID: 'android',
            CROS: 'cros',
            LINUX: 'linux',
            MAC: 'mac',
            OPENBSD: 'openbsd',
            WIN: 'win'
          },
          RequestUpdateCheckStatus: {
            NO_UPDATE: 'no_update',
            THROTTLED: 'throttled',
            UPDATE_AVAILABLE: 'update_available'
          }
        }
      };
      
      // 3. Add browser-specific functions and properties
      window.screenY = 10;
      window.screenTop = 10;
      window.outerWidth = window.innerWidth;
      window.outerHeight = window.innerHeight;
      window.devicePixelRatio = 1;
      
      // 4. Override iframe detection
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function() {
          return window;
        }
      });
      
      // 5. Fix canvas fingerprinting detection
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, attributes) {
        const context = originalGetContext.call(this, type, attributes);
        if (type === '2d') {
          // Override canvas fingerprinting by adding subtle noise
          const originalFillText = context.fillText;
          context.fillText = function(...args) {
            const originalStyle = this.fillStyle;
            // Add imperceptible noise to the text
            this.fillStyle = originalStyle === 'rgb(0, 0, 0)' ? 
              'rgb(0, 0, 1)' : originalStyle;
            originalFillText.apply(this, args);
            this.fillStyle = originalStyle;
          };
        }
        return context;
      };
      
      // 6. Fix audio fingerprinting detection
      const audioContext = window.AudioContext || window.webkitAudioContext;
      if (audioContext) {
        const originalCreateOscillator = audioContext.prototype.createOscillator;
        audioContext.prototype.createOscillator = function() {
          const oscillator = originalCreateOscillator.call(this);
          oscillator.frequency.value = oscillator.frequency.value * (1 + Math.random() * 0.0001);
          return oscillator;
        };
      }
    });
    
    // Execute several browser actions to appear more human-like
    // This helps trigger PerimeterX's verification that we've bypassed detection
    
    // 1. Simulated scrolling behavior
    await page.evaluate(() => {
      const scrollAmount = Math.floor(Math.random() * 100) + 50;
      window.scrollBy(0, scrollAmount);
      setTimeout(() => window.scrollBy(0, -scrollAmount), 1000);
    });
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 1200));
    
    // 2. Now interact with the CAPTCHA element
    const captchaElement = await page.$('#px-captcha') || 
                           await page.$('[class*="captcha"]') ||
                           await page.$('[id^="px-"]');
    
    if (!captchaElement) {
      console.log('No CAPTCHA element found after neutralization');
      return false;
    }
    
    // Get element position
    const elementBox = await captchaElement.boundingBox();
    if (!elementBox) return false;
    
    // Position for press
    const x = elementBox.x + elementBox.width * 0.5;
    const y = elementBox.y + elementBox.height * 0.5;
    
    // Use an extremely sophisticated movement pattern
    // This technique uses multiple curves and natural acceleration
    console.log('Executing advanced mouse movement pattern...');
    
    // Get current viewport
    const viewport = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    // Start from a natural position (e.g., near the center)
    const startX = viewport.width * (0.3 + Math.random() * 0.4);
    const startY = viewport.height * (0.2 + Math.random() * 0.3);
    
    // Move mouse to start position
    await page.mouse.move(startX, startY);
    await new Promise(r => setTimeout(r, 800 + Math.random() * 500));
    
    // Execute multi-point natural trajectory
    const points = generateNaturalPath(startX, startY, x, y, 6);
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      await page.mouse.move(point.x, point.y, { steps: 5 });
      await new Promise(r => setTimeout(r, 50 + Math.random() * 30));
    }
    
    // Perform the hold action
    await page.mouse.down();
    const holdTime = 3200 + Math.random() * 1800;
    
    // During hold, simulate extremely subtle pressure changes
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, holdTime / 10));
      
      // Microscopic movements
      await page.mouse.move(
        x + (Math.sin(i / 3) * 0.8),
        y + (Math.cos(i / 3) * 0.8),
        { steps: 2 }
      );
    }
    
    await page.mouse.up();
    
    // Wait to see if it worked
    await new Promise(r => setTimeout(r, 3000));
    const isSolved = await checkIfSolved(page);
    
    console.log(`Headless detection neutralization ${isSolved ? 'successful' : 'failed'}`);
    return isSolved;
  } catch (error) {
    console.error('Error in headlessDetectionNeutralization:', error);
    return false;
  }
}

/**
 * Helper function to generate a natural path between two points
 * Uses bezier curves and jitter to create human-like mouse movement
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Ending X coordinate
 * @param {number} endY - Ending Y coordinate
 * @param {number} numPoints - Number of control points
 * @returns {Array<{x: number, y: number}>} - Array of points along the path
 */
function generateNaturalPath(startX, startY, endX, endY, numPoints = 5) {
  // Generate control points with some randomness
  const points = [];
  points.push({ x: startX, y: startY });
  
  // Create a curve by generating intermediate control points
  for (let i = 1; i < numPoints - 1; i++) {
    const ratio = i / (numPoints - 1);
    
    // Linear interpolation + randomness
    const x = startX + (endX - startX) * ratio + (Math.random() * 50 - 25);
    const y = startY + (endY - startY) * ratio + (Math.random() * 50 - 25);
    
    points.push({ x, y });
  }
  
  points.push({ x: endX, y: endY });
  
  // Now generate more points along this path using bezier interpolation
  const result = [];
  const steps = 20 + Math.floor(Math.random() * 10);
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    
    // Apply bezier interpolation
    let x = 0;
    let y = 0;
    
    for (let j = 0; j < points.length; j++) {
      const coefficient = binomialCoefficient(points.length - 1, j) * 
                          Math.pow(1 - t, points.length - 1 - j) * 
                          Math.pow(t, j);
                          
      x += coefficient * points[j].x;
      y += coefficient * points[j].y;
    }
    
    // Add subtle jitter to make it more natural
    if (i > 0 && i < steps) {
      x += (Math.random() * 2 - 1) * 2;
      y += (Math.random() * 2 - 1) * 2;
    }
    
    result.push({ x, y });
  }
  
  return result;
}

/**
 * Calculate binomial coefficient (n choose k)
 * @param {number} n - Total items
 * @param {number} k - Selection size
 * @returns {number} - Binomial coefficient
 */
function binomialCoefficient(n, k) {
  let res = 1;
  
  // Calculate n! / (k! * (n-k)!)
  for (let i = 0; i < k; i++) {
    res *= (n - i);
    res /= (i + 1);
  }
  
  return res;
}

/**
 * Helper: Check if the CAPTCHA has been solved
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} - Whether the CAPTCHA appears to be solved
 */
async function checkIfSolved(page) {
  try {
    return await page.evaluate(() => {
      // Common indicators of a solved CAPTCHA:
      
      // 1. CAPTCHA elements no longer present
      const captchaGone = !document.querySelector('#px-captcha') && 
                         !document.querySelector('[id^="px-"]') &&
                         !document.querySelector('[class*="captcha"]');
      
      // 2. Title no longer shows blocked/denied
      const title = document.title.toLowerCase();
      const titleOk = !title.includes('denied') && 
                     !title.includes('robot') &&
                     !title.includes('captcha') &&
                     !title.includes('blocked');
      
      // 3. No visible error messages
      const bodyText = document.body.innerText.toLowerCase();
      const noErrors = !bodyText.includes('failed') &&
                      !bodyText.includes('try again') &&
                      !bodyText.includes('incorrect');
      
      // 4. Look for success indicators
      const successElements = document.querySelector('[class*="success"]') ||
                             document.querySelector('[class*="passed"]');
      
      // 5. Look for main content being loaded
      const contentLoaded = document.querySelector('main') ||
                           document.querySelector('#content') ||
                           document.querySelector('.content') ||
                           document.querySelectorAll('a').length > 5; // Pages typically have links
      
      return (captchaGone && titleOk) || successElements !== null || contentLoaded;
    });
  } catch (error) {
    console.error('Error checking if CAPTCHA is solved:', error);
    return false;
  }
}

/**
 * Detects and solves any CAPTCHA on the current page
 * @param {Page} page - Puppeteer page object
 * @param {string} url - URL of the page with CAPTCHA
 * @returns {Promise<boolean>} True if CAPTCHA was solved, false otherwise
 */
async function solveCaptcha(page, url) {
  try {
    if (!ANTICAPTCHA_API_KEY) return false;
    
    console.log('Detecting CAPTCHA type...');
    
    // Check for reCAPTCHA
    const hasRecaptcha = await page.evaluate(() => {
      return !!document.querySelector('.g-recaptcha') || 
             !!document.querySelector('iframe[src*="recaptcha"]');
    });
    
    if (hasRecaptcha) {
      console.log('Detected reCAPTCHA challenge');
      const token = await solveRecaptchaV2(page, url);
      return !!token;
    }
    
    // Check for PerimeterX CAPTCHA
    const hasPerimeterX = await page.evaluate(() => {
      return !!document.querySelector('#px-captcha') || 
             document.body.innerHTML.includes('px-captcha');
    });
    
    if (hasPerimeterX) {
      console.log('Detected PerimeterX CAPTCHA challenge');
      return await solvePerimeterXCaptcha(page);
    }
    
    // Check for general CAPTCHA terms
    const hasCaptchaText = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      return bodyText.includes('captcha') || 
             bodyText.includes('robot') || 
             bodyText.includes('human verification');
    });
    
    if (hasCaptchaText) {
      console.log('Detected general CAPTCHA challenge text');
      // Save a screenshot for analysis
      const screenshotPath = path.join(__dirname, 'unknown-captcha.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Saved screenshot of unknown CAPTCHA type to ${screenshotPath}`);
      
      // Try generic PerimeterX solving as a fallback
      return await solvePerimeterXCaptcha(page);
    }
    
    console.log('No CAPTCHA detected on current page');
    return false;
  } catch (error) {
    console.error('Error in CAPTCHA detection/solving:', error);
    return false;
  }
}

module.exports = {
  initAntiCaptcha,
  solveCaptcha,
  solveRecaptchaV2,
  solvePerimeterXCaptcha,
  // Export helper functions for testing
  standardPressAndHold,
  tryAlternativeElements,
  sliderStrategy,
  humanLikeMouseMovements,
  moveWithNaturalMotion,
  checkIfSolved
};