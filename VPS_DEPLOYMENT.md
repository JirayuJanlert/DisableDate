# VPS Deployment Guide

This guide will help you deploy the disabledate application on your VPS.

## Prerequisites

- A VPS with Ubuntu/Debian (or similar Linux distribution)
- SSH access to your VPS
- Domain name (optional, but recommended)
- Basic knowledge of Linux commands

## Step 1: Connect to Your VPS

```bash
ssh username@your-vps-ip
```

## Step 2: Update System and Install Node.js

### Install Node.js (using NodeSource repository for latest LTS)

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

## Step 3: Install Required System Dependencies

Puppeteer needs Chrome dependencies:

```bash
# Install Chrome dependencies
sudo apt install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils
```

## Step 4: Clone Your Repository

```bash
# Create app directory
mkdir -p ~/apps
cd ~/apps

# Clone your repository
git clone https://github.com/YOUR_USERNAME/disabledate.git
cd disabledate

# Or if you haven't pushed to GitHub yet, you can use SCP:
# On your local machine: scp -r . username@your-vps-ip:~/apps/disabledate
```

## Step 5: Install Application Dependencies

```bash
cd ~/apps/disabledate

# Install npm dependencies
npm install

# This will also download Chrome for Puppeteer
```

## Step 6: Create Environment Variables File

```bash
# Create .env file
nano .env
```

Add your environment variables:

```env
PORT=3000
WC_URL=https://your-woocommerce-site.com
WC_CONSUMER_KEY=your_consumer_key
WC_CONSUMER_SECRET=your_consumer_secret
WP_USERNAME=your_wordpress_username
WP_PASSWORD=your_wordpress_password
APP_PASSWORD=your_app_password
NODE_ENV=production
```

Save and exit (Ctrl+X, then Y, then Enter)

## Step 7: Create Screenshots Directory

```bash
mkdir -p screenshots
chmod 755 screenshots
```

## Step 8: Test the Application

```bash
# Test if the app runs
node index.js
```

If it starts successfully, press Ctrl+C to stop it.

## Step 9: Install PM2 (Process Manager)

PM2 will keep your app running and restart it if it crashes:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start your application with PM2
cd ~/apps/disabledate
pm2 start index.js --name disabledate

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the command it outputs (usually involves running a sudo command)
```

## Step 10: Configure Firewall

```bash
# Allow your application port (if using UFW)
sudo ufw allow 3000/tcp

# Or if using a different port, replace 3000
```

## Step 11: Setup Nginx Reverse Proxy (Recommended)

Install Nginx:

```bash
sudo apt install -y nginx
```

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/disabledate
```

Add this configuration (replace `your-domain.com` with your domain):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/disabledate /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

## Step 12: Setup SSL with Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Certbot will automatically configure Nginx and renew certificates
```

## Step 13: PM2 Management Commands

```bash
# View running apps
pm2 list

# View logs
pm2 logs disabledate

# Restart app
pm2 restart disabledate

# Stop app
pm2 stop disabledate

# Monitor app
pm2 monit
```

## Step 14: Update Your Application

When you need to update:

```bash
cd ~/apps/disabledate
git pull origin main
npm install
pm2 restart disabledate
```

## Troubleshooting

### Check if app is running:
```bash
pm2 list
pm2 logs disabledate
```

### Check Nginx status:
```bash
sudo systemctl status nginx
sudo nginx -t
```

### Check port usage:
```bash
sudo netstat -tulpn | grep :3000
```

### View application logs:
```bash
pm2 logs disabledate --lines 100
```

### If Puppeteer fails:
- Make sure all Chrome dependencies are installed (Step 3)
- Check that screenshots directory has write permissions
- Verify Chrome is downloaded: `ls -la ~/.cache/puppeteer/`

### Memory Issues:
If your VPS has limited RAM, you may need to adjust Puppeteer launch options or increase swap space.

## Optional: Setup Auto-Deploy with GitHub Webhook

You can set up automatic deployments when you push to GitHub. This requires additional setup with a webhook receiver service.

## Security Notes

1. Keep your `.env` file secure and never commit it to Git
2. Use strong passwords for all credentials
3. Keep your system and Node.js updated
4. Consider using a firewall to restrict access
5. Use SSL/HTTPS for production

## Backup

Regularly backup:
- `.env` file (store securely)
- `screenshots/` directory (if you want to keep old screenshots)
- Database backups (if you add database functionality later)

