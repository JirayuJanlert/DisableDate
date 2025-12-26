# Deployment Guide: GitHub + Render

## Step 1: Push to GitHub

### 1.1 Initialize Git (if not already done)
```bash
git init
```

### 1.2 Add all files
```bash
git add .
```

### 1.3 Commit your changes
```bash
git commit -m "Initial commit: Disabled dates manager"
```

### 1.4 Create a new repository on GitHub
1. Go to https://github.com/new
2. Create a new repository (e.g., `disabledate`)
3. **DO NOT** initialize with README, .gitignore, or license (you already have these)

### 1.5 Link your local repository to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/disabledate.git
```

### 1.6 Push to GitHub
```bash
git branch -M main
git push -u origin main
```

## Step 2: Deploy on Render

### 2.1 Create Render Account
1. Go to https://render.com
2. Sign up or log in (you can use GitHub to sign in)

### 2.2 Create a New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub account if not already connected
3. Select your repository (`disabledate`)

### 2.3 Configure the Service

**Basic Settings:**
- **Name**: `disabledate` (or your preferred name)
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: (leave empty, or `.` if needed)
- **Runtime**: `Node`
- **Build Command**: `npm install && npx puppeteer browsers install chrome`
- **Start Command**: `npm start`

**Environment Variables:**
Add all your `.env` variables in Render's dashboard:
- `PORT` (Render will provide this, but you can set a default)
- `WC_URL`
- `WC_CONSUMER_KEY`
- `WC_CONSUMER_SECRET`
- `WP_USERNAME`
- `WP_PASSWORD`
- `APP_PASSWORD`

**Important Notes:**
- Render provides a `PORT` environment variable automatically
- Make sure your `index.js` uses `process.env.PORT || 3000` (check if it does)

### 2.4 Advanced Settings (Optional)

**Health Check Path:**
- Leave empty or set to `/` if you have a health check endpoint

**Auto-Deploy:**
- Enable "Auto-Deploy" to automatically deploy on every push to main branch

### 2.5 Create the Service
Click **"Create Web Service"** and Render will:
1. Clone your repository
2. Run `npm install`
3. Start your application with `npm start`

## Step 3: Update Your Code for Render

### 3.1 Check PORT Configuration
Make sure `index.js` uses the PORT from environment:
```javascript
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running at http://localhost:${process.env.PORT || 3000}`);
});
```

### 3.2 Puppeteer on Render
Puppeteer might need additional configuration for Render's environment. Update your Puppeteer launch options in `index.js`:

```javascript
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
```

### 3.3 Session Secret
For production, use a strong random secret for sessions. You can generate one and add it to your environment variables.

## Step 4: Verify Deployment

1. Once deployed, Render will provide a URL like: `https://your-app.onrender.com`
2. Test your application
3. Check logs in Render dashboard if there are any issues

## Troubleshooting

### Common Issues:

1. **Build fails**: Check that all dependencies are in `package.json`
2. **App crashes**: Check Render logs for errors
3. **Puppeteer issues**: May need to add more Chrome args or use a different approach
4. **Environment variables**: Make sure all are set in Render dashboard
5. **Port issues**: Ensure you're using `process.env.PORT`

## Updating Your App

After making changes:
```bash
git add .
git commit -m "Your commit message"
git push origin main
```

Render will automatically redeploy if auto-deploy is enabled.

