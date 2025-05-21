/**
 * Advanced PerimeterX Bypass Module
 * Implements proven techniques for bypassing PerimeterX protection on Zillow.com
 * 
 * Based on real-world working techniques specifically for PerimeterX protections.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const randomUseragent = require('random-useragent');
const fs = require('fs').promises;
const path = require('path');

// Apply the stealth plugin to hide automation
puppeteer.use(StealthPlugin());

// Directory for storing session data
const SESSIONS_DIR = path.join(__dirname, 'browser-sessions');

/**
 * Create a browser instance with full stealth protection against PerimeterX
 * @param {Object} options - Configuration options
 * @returns {Promise<Browser>} - Puppeteer browser instance
 */
async function createStealthBrowser(options = {}) {
  try {
    // Ensure sessions directory exists
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
    
    // Check for proxy configuration
    const useProxy = process.env.USE_PROXY === 'true';
    const proxyUsername = process.env.PROXY_USERNAME;
    const proxyPassword = process.env.PROXY_PASSWORD;
    const proxyHost = process.env.PROXY_HOST || 'proxy.packetstream.io';
    const proxyPort = process.env.PROXY_PORT || '31112';
    
    // Log proxy status
    if (useProxy) {
      console.log(`Using residential proxy: ${proxyHost}:${proxyPort}`);
      
      if (!proxyUsername || !proxyPassword) {
        console.warn('⚠️ Proxy username/password not set in environment variables. Proxy may not work correctly.');
      }
    } else {
      console.log('No proxy configured. Set USE_PROXY=true and add credentials to use residential proxies.');
    }
    
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
      
      console.log('Generated random viewport', { width: finalWidth, height: finalHeight });
      return { width: finalWidth, height: finalHeight };
    };

    // Get random viewport
    const viewport = generateRandomViewport();
    
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
    
    console.log('Using enhanced PerimeterX bypass configuration for Replit');
    
    // For Replit.com environment, use the Nix-installed Chromium directly
    try {
      console.log(`Launching browser for Replit environment - viewport: ${viewport.width}x${viewport.height}`);
      
      // Find the Chromium executable path in a Replit/Nix environment
      const chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser';
      console.log(`Using Replit-specific Chromium path: ${chromiumPath}`);
      
      // Setup browser launch options
      const launchOptions = {
        headless: 'new',
        executablePath: chromiumPath,
        args: [...stealthArgs],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: viewport,
      };
      
      // Add proxy if configured
      if (useProxy) {
        // Use the correct proxy format for Puppeteer
        launchOptions.args.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
        
        // Then set the authentication directly in browser.authenticate()
        launchOptions.proxyAuth = `${proxyUsername}:${proxyPassword}`;
        console.log('Added residential proxy configuration to browser');
      }
      
      // Launch with specific path and advanced stealth options
      return await puppeteer.launch(launchOptions);
    } catch (err) {
      console.error('Replit-specific browser launch failed:', err.message);
      console.log('Falling back to standard launch methods...');
    }
    
    // Fallback 1: Standard launch with visible browser
    try {
      console.log('Attempting visible browser launch with anti-detection features');
      
      // Setup launch options
      const launchOptions = {
        headless: false, // Try with visible browser first as research shows better success rates
        args: [...stealthArgs],
        ignoreDefaultArgs: ['--enable-automation'], // Critical to avoid detection
        defaultViewport: viewport,
      };
      
      // Add proxy if configured
      if (useProxy) {
        // Use the correct proxy format for Puppeteer
        launchOptions.args.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
        
        // Then set the authentication directly
        launchOptions.proxyAuth = `${proxyUsername}:${proxyPassword}`;
        console.log('Added residential proxy configuration to browser (visible mode)');
      }
      
      return await puppeteer.launch(launchOptions);
    } catch (err) {
      console.error('Visible browser launch failed:', err.message);
      console.log('Trying with headless browser and enhanced stealth...');
    }
    
    // Fallback 2: Headless launch
    try {
      console.log('Attempting headless launch with anti-detection features');
      
      // Setup launch options
      const launchOptions = {
        headless: 'new',
        args: [...stealthArgs],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: viewport,
      };
      
      // Add proxy if configured
      if (useProxy) {
        // Use the correct proxy format for Puppeteer
        launchOptions.args.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
        
        // Then set the authentication directly
        launchOptions.proxyAuth = `${proxyUsername}:${proxyPassword}`;
        console.log('Added residential proxy configuration to browser (headless mode)');
      }
      
      return await puppeteer.launch(launchOptions);
    } catch (err) {
      console.error('Headless launch failed:', err.message);
      console.log('Final fallback attempt...');
    }
    
    // Final fallback: Try with minimal options
    console.log('Attempting minimal browser launch');
    
    // Setup minimal launch options
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
  } catch (error) {
    console.error('All browser launch attempts failed:', error);
    throw error;
  }
}

/**
 * Applies all recommended PerimeterX bypass techniques to a page
 * @param {Page} page - Puppeteer page object
 * @param {Object} options - Optional configuration options
 * @returns {Promise<Page>} - The same page with protections applied
 */
async function applyBypassTechniques(page, options = {}) {
  try {
    console.log('Applying PerimeterX bypass techniques...');
    
    // 1. Use a believable human-like user agent
    const userAgent = options.userAgent || getHumanLikeUserAgent();
    await page.setUserAgent(userAgent);
    console.log(`Using user agent: ${userAgent}`);
    
    // 2. Set realistic viewport size (avoid standard sizes that fingerprinting detects)
    const viewportWidth = 1366 + Math.floor(Math.random() * 100); // 1366-1466
    const viewportHeight = 768 + Math.floor(Math.random() * 100); // 768-868
    await page.setViewport({
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    });
    console.log(`Using viewport: ${viewportWidth}x${viewportHeight}`);
    
    // 3. Set extra HTTP headers to appear more legitimate
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    });
    
    // 4. Inject scripts to evade detection by overriding browser fingerprinting
    await page.evaluateOnNewDocument(() => {
      // 4.1 Override WebDriver property (main fingerprinting check)
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      });
      
      // 4.2 Override navigator properties to appear as a normal browser
      const newProto = navigator.__proto__;
      delete newProto.webdriver;
      navigator.__proto__ = newProto;
      
      // 4.3 Add realistic Chrome plugins array
      const plugins = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client Executable' }
      ];
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
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
        },
        configurable: true
      });
      
      // 4.4 Override permissions API (often used to detect headless)
      const originalQuery = navigator.permissions?.query || (() => Promise.reject("Permission API not supported"));
      navigator.permissions.query = (parameters) => {
        return parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters);
      };
      
      // 4.5 Fake outerWidth/outerHeight/screenX/screenY to match normal browser
      Object.defineProperties(window, {
        'outerWidth': { get: () => window.innerWidth },
        'outerHeight': { get: () => window.innerHeight + 85 },
        'screenX': { get: () => 20 + Math.floor(Math.random() * 10) },
        'screenY': { get: () => 20 + Math.floor(Math.random() * 10) }
      });
      
      // 4.6 Fix chrome.runtime - another detection vector
      window.chrome = {
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
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
      
      // 4.7 Fix iframe contentWindow access (used for fingerprinting)
      try {
        // This won't work in all browsers but it covers an important detection case
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
          get: function() {
            return window;
          }
        });
      } catch (e) {
        // Ignore errors, as this is just a bonus protection
      }
      
      // 4.8 Fix canvas fingerprinting detection
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
    });
    
    // 5. Enable JavaScript and cookies
    await page.setJavaScriptEnabled(true);
    
    // 6. Allow media autoplay (appears more like a normal browser)
    // Note: Skip Page.setPermissions which might not be supported in all Chrome versions
    try {
      const session = await page.target().createCDPSession();
      await session.send('Page.setPermissions', {
        permissions: ['notifications', 'midi', 'camera', 'microphone', 'geolocation', 'idle-detection']
      });
      console.log('Successfully set browser permissions');
    } catch (permErr) {
      console.log('Skipping unsupported Page.setPermissions:', permErr.message);
      // Continue without setting permissions - not critical
    }
    
    console.log('All PerimeterX bypass techniques applied successfully');
    return page;
  } catch (error) {
    console.error('Error applying bypass techniques:', error);
    throw error;
  }
}

/**
 * Simulate realistic human behavior on the page
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<void>}
 */
async function simulateHumanBehavior(page) {
  try {
    console.log('Simulating human behavior...');
    
    // 1. First get the viewport size to make calculations
    const viewportSize = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    // 2. Wait a bit before any interaction (humans don't act immediately)
    await page.waitForTimeout(1000 + Math.random() * 1500);
    
    // 3. Perform some initial scrolling to view the page
    await page.evaluate(() => {
      window.scrollBy(0, 180 + Math.random() * 200);
    });
    
    // 4. Wait a natural amount of time
    await page.waitForTimeout(800 + Math.random() * 1200);
    
    // 5. Move mouse to a few random positions with realistic curves
    // This is critical for PerimeterX which analyzes mouse movement patterns
    const movePoints = [
      { x: viewportSize.width * 0.3, y: viewportSize.height * 0.2 },
      { x: viewportSize.width * 0.7, y: viewportSize.height * 0.3 },
      { x: viewportSize.width * 0.5, y: viewportSize.height * 0.5 }
    ];
    
    for (const point of movePoints) {
      await moveMouseWithHumanMotion(page, point.x, point.y);
      await page.waitForTimeout(300 + Math.random() * 700);
    }
    
    // 6. Scroll again with variable speed
    await page.evaluate(() => {
      const scrollAmount = 300 + Math.random() * 200;
      
      // Human-like scrolling with variable speed
      let scrolled = 0;
      const interval = setInterval(() => {
        const step = 10 + Math.random() * 20;
        window.scrollBy(0, step);
        scrolled += step;
        if (scrolled >= scrollAmount) {
          clearInterval(interval);
        }
      }, 30);
    });
    
    // Wait for scrolling to complete
    await page.waitForTimeout(1000 + Math.random() * 1500);
    
    // 7. Perform a random click (humans often explore pages)
    // Pick a safe area to click that won't navigate away
    const clickX = 100 + Math.random() * (viewportSize.width - 200);
    const clickY = 150 + Math.random() * (viewportSize.height / 2);
    
    // Move mouse and click
    await moveMouseWithHumanMotion(page, clickX, clickY);
    await page.mouse.down();
    await page.waitForTimeout(80 + Math.random() * 120);
    await page.mouse.up();
    
    console.log('Human behavior simulation completed');
  } catch (error) {
    console.error('Error during human behavior simulation:', error);
    // Don't throw, just log the error so the script can continue
  }
}

/**
 * Move the mouse using natural human-like motion
 * @param {Page} page - Puppeteer page object
 * @param {number} targetX - Target X coordinate
 * @param {number} targetY - Target Y coordinate
 */
async function moveMouseWithHumanMotion(page, targetX, targetY) {
  // Get current mouse position
  const currentPosition = await page.evaluate(() => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight
  }));
  
  // Generate a natural curve between the points
  const points = generateNaturalCurve(
    currentPosition.x, 
    currentPosition.y, 
    targetX, 
    targetY, 
    3 + Math.floor(Math.random() * 3) // 3-5 control points
  );
  
  // Variable speed based on distance
  const totalDistance = Math.sqrt(
    Math.pow(targetX - currentPosition.x, 2) + 
    Math.pow(targetY - currentPosition.y, 2)
  );
  
  const baseSteps = Math.max(5, Math.floor(totalDistance / 10));
  const steps = baseSteps + Math.floor(Math.random() * 10);
  
  // Execute the mouse movement with variable speed
  for (let i = 0; i < steps; i++) {
    const progress = i / steps;
    
    // Bezier curve interpolation for the path
    let x = 0;
    let y = 0;
    
    for (let j = 0; j < points.length; j++) {
      const coefficient = getBezierCoefficient(points.length - 1, j, progress);
      x += coefficient * points[j].x;
      y += coefficient * points[j].y;
    }
    
    // Apply slight natural tremor to the hand
    const tremor = Math.sin(progress * 15) * 0.5;
    
    // Move to the calculated position with tremor
    await page.mouse.move(
      Math.round(x + tremor), 
      Math.round(y + tremor)
    );
    
    // Variable delay based on beginning/middle/end of movement (humans move with variable speed)
    const delay = 5 + 
      ((progress < 0.2 || progress > 0.8) ? 
      Math.random() * 15 : // Slower at start/end
      Math.random() * 5);  // Faster in the middle
      
    await page.waitForTimeout(delay);
  }
  
  // Ensure we reach the exact target
  await page.mouse.move(Math.round(targetX), Math.round(targetY));
}

/**
 * Generate a natural curve between two points
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate 
 * @param {number} endX - Target X coordinate
 * @param {number} endY - Target Y coordinate
 * @param {number} controlPoints - Number of control points
 * @returns {Array<{x: number, y: number}>} - Points along curve
 */
function generateNaturalCurve(startX, startY, endX, endY, controlPoints) {
  const points = [{ x: startX, y: startY }];
  
  // Generate random control points that form a natural arc
  for (let i = 1; i < controlPoints; i++) {
    const ratio = i / controlPoints;
    const randomOffsetMagnitude = Math.min(
      100,
      Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)) * 0.4
    );
    
    // Calculate perpendicular offset
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx*dx + dy*dy);
    
    // Perpendicular vector
    let perpX = -dy / length;
    let perpY = dx / length;
    
    // Scale based on distance from midpoint
    const midPointDistance = Math.abs(ratio - 0.5);
    const scaleFactor = 1 - midPointDistance * 2; // 1 at midpoint, 0 at endpoints
    
    // Apply offset perpendicular to the line
    const offsetMagnitude = (Math.random() - 0.5) * 2 * randomOffsetMagnitude * scaleFactor;
    const offsetX = perpX * offsetMagnitude;
    const offsetY = perpY * offsetMagnitude;
    
    points.push({
      x: startX + (endX - startX) * ratio + offsetX,
      y: startY + (endY - startY) * ratio + offsetY,
    });
  }
  
  points.push({ x: endX, y: endY });
  return points;
}

/**
 * Calculate Bezier curve coefficient
 * @param {number} n - Degree of the curve
 * @param {number} i - Control point index
 * @param {number} t - Position along curve (0-1)
 * @returns {number} - Coefficient
 */
function getBezierCoefficient(n, i, t) {
  // Binomial coefficient * (1-t)^(n-i) * t^i
  return binomialCoefficient(n, i) * 
         Math.pow(1 - t, n - i) * 
         Math.pow(t, i);
}

/**
 * Calculate binomial coefficient (n choose k)
 * @param {number} n - Total number of items
 * @param {number} k - Number of items to choose
 * @returns {number} - Binomial coefficient
 */
function binomialCoefficient(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let res = 1;
  for (let i = 0; i < k; i++) {
    res *= (n - i);
    res /= (i + 1);
  }
  
  return res;
}

/**
 * Get a human-like user agent string
 * @returns {string} - User agent string
 */
function getHumanLikeUserAgent() {
  // Define a list of common user agents that are less likely to be blocked
  const commonUserAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  ];
  
  // Randomly select one of the predefined user agents
  return commonUserAgents[Math.floor(Math.random() * commonUserAgents.length)];
}

/**
 * Helper function to check if the page has proxy authentication errors
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} - Whether proxy authentication errors were detected
 */
async function checkForProxyErrors(page) {
  try {
    // Check for common proxy error indicators
    const proxyErrorIndicators = [
      'proxy authentication required',
      'tunnel connection failed',
      'proxy connection failed',
      'could not resolve proxy',
      'error code: 407',
      'packetstream',
      'payment required',
      'account balance',
      'insufficient funds'
    ];
    
    // Get page content, title, and URL
    const content = await page.content();
    const url = page.url();
    const title = await page.title();
    
    // Log debugging info
    console.log(`Current page URL after navigation: ${url}`);
    console.log(`Page title: "${title}"`);
    
    // Check if any indicators are present
    const hasProxyError = proxyErrorIndicators.some(indicator => 
      content.toLowerCase().includes(indicator) || 
      url.toLowerCase().includes(indicator) || 
      title.toLowerCase().includes(indicator)
    );
    
    if (hasProxyError) {
      console.log('⚠️ Proxy authentication error detected');
      
      // Try to get more specific error details
      const bodyText = await page.evaluate(() => document.body.innerText);
      
      if (bodyText.toLowerCase().includes('packetstream') && 
          (bodyText.toLowerCase().includes('payment') || 
           bodyText.toLowerCase().includes('funds') || 
           bodyText.toLowerCase().includes('balance'))) {
        console.error('⚠️ PacketStream account issue detected - please check your account balance');
        console.error('⚠️ You need to add at least $1 to your PacketStream account at packetstream.io');
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking for proxy issues:', error);
    return false;
  }
}

/**
 * Get a slightly randomized port to help with IP rotation
 * @param {string} basePort - The base proxy port
 * @returns {string} - A port with some random offset
 */
function getRotatedProxyPort(basePort) {
  // For PacketStream and similar services, adding a small random offset to the port
  // can help get different IPs from their pool
  const portNum = parseInt(basePort, 10);
  
  // No random offset if we can't parse the port
  if (isNaN(portNum)) return basePort;
  
  // Add a small random offset (typically 0-9)
  // Note: Make sure your proxy service supports this approach
  const offset = Math.floor(Math.random() * 10);
  return (portNum + offset).toString();
}

/**
 * Complete scrape of Zillow with all protections configured
 * @param {string} zipCode - ZIP code to search
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Scraped data or error object
 */
async function scrapeWithBypass(zipCode, options = {}) {
  let browser = null;
  
  try {
    console.log(`Starting advanced PerimeterX bypass scrape for ZIP: ${zipCode}`);
    
    // Check if we're using proxies
    const useProxy = process.env.USE_PROXY === 'true';
    if (useProxy) {
      // Randomize the proxy port slightly to help with IP rotation
      if (process.env.PROXY_PORT) {
        process.env.PROXY_PORT = getRotatedProxyPort(process.env.PROXY_PORT);
        console.log(`Using rotated proxy port: ${process.env.PROXY_PORT}`);
      }
    }
    
    // Create a browser with maximum protection
    browser = await createStealthBrowser({
      headless: options.headless !== false,
      useRealProfile: options.useRealProfile === true
    });
    
    // Create a new page
    const page = await browser.newPage();
    
    // Apply all bypass techniques
    await applyBypassTechniques(page, options);
    
    // Configure the page for maximum stealth
    await page.evaluateOnNewDocument(() => {
      // Disable WebRTC to prevent leaking real IP (if using proxy)
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        get: () => async () => {
          throw new Error('getUserMedia is not implemented');
        }
      });
      
      // Override the Notification API
      Object.defineProperty(window, 'Notification', {
        get: () => {
          return class MockNotification {
            static permission = 'default';
            static requestPermission() {
              return Promise.resolve('default');
            }
          };
        }
      });
    });
    
    // Navigate to Zillow search page
    const url = `https://www.zillow.com/homes/${zipCode}_rb/`;
    console.log(`Navigating to: ${url}`);
    
    try {
      // Set a longer timeout for navigation
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      // Check if we're having proxy issues (if using proxy)
      if (process.env.USE_PROXY === 'true') {
        const hasProxyErrors = await checkForProxyErrors(page);
        if (hasProxyErrors) {
          console.log('Detected proxy authentication issues - check your PacketStream credentials');
          // Take a screenshot of the proxy error
          const screenshotPath = path.join(__dirname, 'public', `proxy-error-${Date.now()}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`Saved proxy error screenshot to ${screenshotPath}`);
        }
      }
    } catch (error) {
      if (error.message.includes('net::ERR_PROXY_CONNECTION_FAILED') || 
          error.message.includes('net::ERR_TIMED_OUT') ||
          error.message.includes('net::ERR_NO_SUPPORTED_PROXIES')) {
        
        console.error('PROXY ERROR: There was an issue with the PacketStream residential proxy');
        console.error('Likely causes:');
        console.error('1. PacketStream account needs funds ($1/GB minimum)');
        console.error('2. Incorrect PacketStream credentials');
        console.error('3. PacketStream service outage or maintenance');
        
        // Save error screenshot if possible
        try {
          const screenshotPath = path.join(__dirname, 'public', `proxy-error-${Date.now()}.png`);
          await page.screenshot({ path: screenshotPath });
          console.log(`Saved error screenshot to ${screenshotPath}`);
        } catch (e) {
          console.log('Could not save error screenshot');
        }
        
        // Rethrow with more helpful message
        throw new Error(`PacketStream proxy connection failed: ${error.message} - Please check your PacketStream account has funds and credentials are correct.`);
      }
      
      // Other errors, just rethrow
      throw error;
    }
    
    // Simulate human-like behavior on the page
    await simulateHumanBehavior(page);
    
    // Check if we encountered a CAPTCHA
    const captchaDetected = await page.evaluate(() => {
      const pageTitle = document.title.toLowerCase();
      const bodyText = document.body.innerText.toLowerCase();
      
      return {
        detected: (
          pageTitle.includes('denied') || 
          pageTitle.includes('captcha') ||
          bodyText.includes('captcha') || 
          bodyText.includes('robot') || 
          bodyText.includes('human verification')
        ),
        title: document.title,
        url: window.location.href
      };
    });
    
    if (captchaDetected.detected) {
      console.log('CAPTCHA detected, attempting to solve...');
      
      // Save a screenshot for diagnosis
      const timestamp = Date.now();
      const screenshotPath = path.join(__dirname, 'public', `captcha-${zipCode}-${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      // Try to solve the CAPTCHA
      const captchaSolver = require('./captcha-solver');
      const solved = await captchaSolver.solveCaptcha(page, url);
      
      if (!solved) {
        console.log('Failed to bypass CAPTCHA protection');
        
        // Close browser and return error
        await browser.close();
        return {
          success: false,
          zipCode,
          error: 'CAPTCHA bypass failed',
          captchaDetected: true,
          timestamp: new Date().toISOString()
        };
      }
      
      console.log('CAPTCHA bypass successful');
      
      // Wait for page to load after CAPTCHA
      await page.waitForTimeout(3000);
    }
    
    // Extract property data
    console.log('Extracting property data...');
    const listings = await page.evaluate(() => {
      try {
        // Look for property card elements on the page
        const propertyCards = Array.from(document.querySelectorAll('[data-test="property-card"], .list-card, [class*="property-card"], [class*="StyledPropertyCardDataWrapper"], article'));
        
        return propertyCards.map(card => {
          try {
            // Different selectors to find price
            let price = null;
            const priceSelectors = [
              '[data-test="property-card-price"]', 
              '.list-card-price', 
              '[class*="Price"]', 
              '[class*="price"]'
            ];
            
            for (const selector of priceSelectors) {
              const priceEl = card.querySelector(selector);
              if (priceEl) {
                price = priceEl.innerText;
                break;
              }
            }
            
            // Different selectors to find address
            let address = null;
            const addressSelectors = [
              '[data-test="property-card-addr"]', 
              '.list-card-addr', 
              '[class*="Address"]', 
              '[class*="address"]'
            ];
            
            for (const selector of addressSelectors) {
              const addressEl = card.querySelector(selector);
              if (addressEl) {
                address = addressEl.innerText;
                break;
              }
            }
            
            // Different selectors to find details (beds/baths)
            let details = null;
            const detailsSelectors = [
              '[data-test="property-card-details"]', 
              '.list-card-details', 
              '[class*="StyledPropertyCardDataArea"]', 
              '[class*="detail"]'
            ];
            
            for (const selector of detailsSelectors) {
              const detailsEl = card.querySelector(selector);
              if (detailsEl) {
                details = detailsEl.innerText;
                break;
              }
            }
            
            // Find link to the property
            let link = null;
            const linkEl = card.querySelector('a[href*="zillow.com"]');
            if (linkEl) {
              link = linkEl.href;
            }
            
            return {
              price: price || 'N/A',
              address: address || 'N/A',
              details: details || 'N/A',
              link: link || 'N/A'
            };
          } catch (e) {
            return { error: e.message };
          }
        });
      } catch (error) {
        return [{ error: error.message }];
      }
    });
    
    // Take final screenshot for verification
    const finalScreenshotPath = path.join(__dirname, 'public', `result-${zipCode}-${Date.now()}.png`);
    await page.screenshot({ path: finalScreenshotPath, fullPage: true });
    
    // Close browser
    await browser.close();
    
    // Return results
    return {
      success: true,
      zipCode,
      count: listings.length,
      listings,
      timestamp: new Date().toISOString(),
      captchaDetected: captchaDetected.detected,
      captchaBypassed: captchaDetected.detected && listings.length > 0
    };
  } catch (error) {
    console.error('Error in perimeter-x-bypass scrape:', error);
    
    // Always close browser
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    
    // Return error
    return {
      success: false,
      zipCode,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Export functions
module.exports = {
  createStealthBrowser,
  applyBypassTechniques,
  simulateHumanBehavior,
  moveMouseWithHumanMotion,
  scrapeWithBypass
};