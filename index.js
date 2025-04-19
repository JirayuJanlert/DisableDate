const express = require("express");
const axios = require("axios");
const session = require("express-session");
require("dotenv").config();

const app = express();
// Hardcoded user (in real use, store hashed password!)
const USER = {
  username: "admin",
  password: process.env.APP_PASSWORD,
};
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

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

// Render product select form
app.get("/", isAuthenticated, async (req, res) => {
  try {
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
        },
      }
    );

    res.render("form", { products: response.data, user: req.session.user });
  } catch (err) {
    res.send("Error fetching products: " + err.message);
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
      res.send(  `<script>alert("Successful."); window.history.back();</script>`);
    } else {
      res.send(
        `<script>alert("Error: Failed to add meta."); window.history.back();</script>`
      );
    }
    // Step 3: PUT back all meta
  } catch (err) {
    res.send(
      `<script>alert("Error: ${err.message}"); window.history.back();</script>`
    );
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running at http://localhost:${process.env.PORT}`);
});
