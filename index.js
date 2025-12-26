const express = require("express");
const axios = require("axios");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Optional Puppeteer - only load if available
let puppeteer = null;
try {
  puppeteer = require("puppeteer");
} catch (err) {
  console.warn("Puppeteer not available - screenshot feature will be disabled");
}

const app = express();
// Hardcoded user (in real use, store hashed password!)
const USER = {
  username: "admin",
  password: process.env.APP_PASSWORD,
};
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

app.use(
  session({
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: false,
  })
);

function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// Helper function to replace waitForTimeout (removed in Puppeteer v21+)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Capture date picker section from product page
async function captureDatePickerSection(productURL, productId) {
  // Check if Puppeteer is available
  if (!puppeteer) {
    console.warn("Puppeteer not available - skipping screenshot capture");
    return null;
  }

  let browser = null;
  try {
    // Configure Puppeteer for Render environment (similar to rendertron approach)
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to product page
    await page.goto(productURL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait a bit for page to fully load
    await delay(2000);

    // Look specifically for input with name="wt_date"
    let datePickerFound = false;
    try {
      const wtDateInput = await page.$('input[name="wt_date"]');
      if (wtDateInput) {
        // Click the date picker to open it
        await wtDateInput.click();
        // Wait for the date picker/calendar to open
        await delay(1500);
        datePickerFound = true;
        console.log("Found and clicked input[name='wt_date']");
      }
    } catch (err) {
      console.error("Error finding or clicking input[name='wt_date']:", err.message);
    }

    // Fallback: Try to find and click date picker with common selectors if wt_date not found
    if (!datePickerFound) {
      const datePickerSelectors = [
        'input[type="date"]',
        'input.date',
        '.datepicker',
        '#date',
        '.booking-date',
        '[class*="date"]',
        '[id*="date"]'
      ];

      for (const selector of datePickerSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click();
            await delay(1000); // Wait for calendar to open
            datePickerFound = true;
            break;
          }
        } catch (err) {
          // Continue to next selector
        }
      }
    }

    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const screenshotPath = path.join(screenshotsDir, `screenshot.png`);

    // Try to capture div.exwt-single-tour and h1.exwt-title together
    let elementToCapture = null;
    try {
      const titleElement = await page.$('h1.exwt-title');
      const tourElement = await page.$('div.exwt-single-tour');
      
      if (tourElement) {
        if (titleElement) {
          // Get bounding boxes of both elements
          const titleBox = await titleElement.boundingBox();
          const tourBox = await tourElement.boundingBox();
          
          if (titleBox && tourBox) {
            // Calculate combined bounding box to include both elements
            const minX = Math.min(titleBox.x, tourBox.x);
            const minY = Math.min(titleBox.y, tourBox.y);
            const maxX = Math.max(titleBox.x + titleBox.width, tourBox.x + tourBox.width);
            const maxY = Math.max(titleBox.y + titleBox.height, tourBox.y + tourBox.height);
            
            const width = maxX - minX;
            const height = maxY - minY;
            
            console.log("Found h1.exwt-title and div.exwt-single-tour, capturing combined screenshot");
            
            // Capture the combined area
            await page.screenshot({ 
              path: screenshotPath,
              type: 'png',
              clip: {
                x: minX,
                y: minY,
                width: width,
                height: height
              }
            });
          } else {
            // Fallback: capture just the tour div
            console.log("Found div.exwt-single-tour, capturing screenshot");
            await tourElement.screenshot({ 
              path: screenshotPath,
              type: 'png'
            });
          }
        } else {
          // No title found, just capture the tour div
          console.log("Found div.exwt-single-tour (no h1.exwt-title), capturing screenshot");
          await tourElement.screenshot({ 
            path: screenshotPath,
            type: 'png'
          });
        }
      } else {
        throw new Error("div.exwt-single-tour not found");
      }
    } catch (err) {
      console.warn("Could not find div.exwt-single-tour, falling back to full page screenshot:", err.message);
      // Fallback: capture full page
      await page.screenshot({ 
        path: screenshotPath,
        type: 'png',
        fullPage: true
      });
    }

    // Return relative path for serving
    return `/screenshots/${path.basename(screenshotPath)}`;
  } catch (error) {
    console.error("Error in captureDatePickerSection:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Render product select form
app.get("/", isAuthenticated, async (req, res) => {
  try {
    // Debug: Check if environment variables are loaded
    if (!process.env.WC_URL || !process.env.WC_CONSUMER_KEY || !process.env.WC_CONSUMER_SECRET) {
      return res.send("Error: Missing WooCommerce credentials. Please check your .env file.");
    }

    const response = await axios.get(
      `${process.env.WC_URL}/wp-json/wc/v3/products`,
      {
        auth: {
          username: process.env.WC_CONSUMER_KEY,
          password: process.env.WC_CONSUMER_SECRET,
        },
        params: {
          per_page: 100, // max allowed per request
          page: 1, // start with first page
          status: 'publish', // only published products
          stock_status: 'instock', // only in stock products
        },
      }
    );

    // Filter products to ensure they are active and in stock
    const filteredProducts = response.data.filter(product => 
      product.status === 'publish' && 
      product.stock_status === 'instock'
    );

    res.render("form", { products: filteredProducts, user: req.session.user });
  } catch (err) {
    console.error("WooCommerce API Error:", {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      url: err.config?.url
    });
    
    if (err.response?.status === 401) {
      res.send(`
        <h2>Authentication Error (401)</h2>
        <p><strong>Failed to authenticate with WooCommerce API</strong></p>
        <p><a href="/login">Go back to login</a></p>
      `);
    } else {
      res.send("Error fetching products: " + err.message);
    }
  }
});
// Get product meta data (wt_disabledate values)
app.get("/api/product/:id/meta", isAuthenticated, async (req, res) => {
  try {
    const productId = req.params.id;
    
    if (!process.env.WC_URL || !process.env.WC_CONSUMER_KEY || !process.env.WC_CONSUMER_SECRET) {
      return res.status(500).json({ error: "Missing WooCommerce credentials" });
    }

    const response = await axios.get(
      `${process.env.WC_URL}/wp-json/wc/v3/products/${productId}`,
      {
        auth: {
          username: process.env.WC_CONSUMER_KEY,
          password: process.env.WC_CONSUMER_SECRET,
        },
      }
    );

    // Get all wt_disabledate meta values
    const disabledDates = response.data.meta_data
      .filter(meta => meta.key === 'wt_disabledate')
      .map(meta => meta.value)
      .filter(value => value && value !== '');

    res.json({ disabledDates });
  } catch (err) {
    console.error("Error fetching product meta:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === USER.username && password === USER.password) {
    req.session.user = username;
    res.redirect("/");
  } else {
    res.render("login", { error: "Invalid credentials" });
  }
});

// Handle form submission to add duplicate key
app.post("/disabledate", async (req, res) => {
  const { product_id, meta_date } = req.body;

  try {
    // Debug: Check if environment variables are loaded
    if (!process.env.WC_URL || !process.env.WP_USERNAME || !process.env.WP_PASSWORD) {
      console.error("Missing WordPress credentials in .env file");
      return res.redirect('/?message=' + encodeURIComponent('Error: Missing WordPress credentials. Please check your .env file.') + '&type=error');
    }

    const response = await axios.post(
      `${process.env.WC_URL}/wp-json/custom-api/v1/add-meta/`,
      {
        product_id: product_id,
        meta_key: "wt_disabledate",
        value: meta_date,
      },
      {
        auth: {
          username: process.env.WP_USERNAME,
          password: process.env.WP_PASSWORD,
        },
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 200) {
      // Get product URL for screenshot
      let productURL = null;
      try {
        const productResponse = await axios.get(
          `${process.env.WC_URL}/wp-json/wc/v3/products/${product_id}`,
          {
            auth: {
              username: process.env.WC_CONSUMER_KEY,
              password: process.env.WC_CONSUMER_SECRET,
            },
          }
        );
        productURL = productResponse.data.permalink;
      } catch (err) {
        console.error("Error fetching product URL:", err.message);
      }

      // Capture date picker section if product URL is available
      let screenshotPath = null;
      if (productURL) {
        try {
          screenshotPath = await captureDatePickerSection(productURL, product_id);
        } catch (err) {
          console.error("Error capturing date picker:", err.message);
        }
      }

      // Redirect with screenshot info
      const redirectParams = new URLSearchParams({
        message: 'Successful.',
        type: 'success',
        product_id: product_id
      });
      if (screenshotPath) {
        redirectParams.append('screenshot', screenshotPath);
      }
      res.redirect('/?' + redirectParams.toString());
    } else {
      res.redirect('/?message=' + encodeURIComponent('Error: Failed to add meta.') + '&type=error');
    }
    // Step 3: PUT back all meta
  } catch (err) {
    console.error("WordPress API Error:", {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      url: err.config?.url,
      data: err.response?.data
    });

    if (err.response?.status === 401) {
      const errorMsg = "Authentication Error (401): Invalid WordPress username or password. Please check WP_USERNAME and WP_PASSWORD in your .env file.\n\nNote: You may need to use an Application Password instead of your regular WordPress password.";
      res.redirect('/?message=' + encodeURIComponent(errorMsg) + '&type=error');
    } else {
      res.redirect('/?message=' + encodeURIComponent('Error: ' + err.message) + '&type=error');
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
