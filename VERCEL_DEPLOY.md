# Vercel Deploy Guide

## 🚀 Deploy Steps

### Option 1: Via Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not installed):

```bash
npm i -g vercel
```

2. **Login to Vercel**:

```bash
vercel login
```

3. **Deploy from frontend directory**:

```bash
cd tipjar-frontend
vercel
```

4. **Follow prompts**:

   - Set up and deploy? **Y**
   - Which scope? **Your account**
   - Link to existing project? **N**
   - Project name: **tipjar-platform** (or your choice)
   - Directory: **./tipjar-frontend** or just **.**
   - Override settings? **N**

5. **Set environment variable** (if needed):

```bash
vercel env add NODE_ENV production
```

### Option 2: Via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and login
2. Click **"Add New Project"**
3. Import your Git repository (GitHub/GitLab/Bitbucket)
4. Configure:
   - Framework Preset: **Vite**
   - Root Directory: **tipjar-frontend**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Click **"Deploy"**

### Option 3: Git Integration (Automatic Deploys)

1. Push your code to GitHub/GitLab
2. Connect repo to Vercel
3. Every push to `main` branch will auto-deploy

## 🔒 HTTPS & Mobile Wallet

Once deployed, you'll get:

- ✅ **HTTPS URL** (e.g., `https://tipjar-platform.vercel.app`)
- ✅ **Phantom Mobile** will work perfectly
- ✅ **Global CDN** for fast loading

## 📱 Testing on Mobile

After deploy:

1. Open **apan app** > **Explore**
2. Navigate to: `https://your-app.vercel.app`
3. Tap **Connect** → Works! 🎉

## 🔧 Troubleshooting

### Build fails with "Module not found"

- Make sure all dependencies are in `package.json`
- Run `npm run build` locally first

### 404 on routes

- Vercel rewrites to `index.html` should be configured
- Check `vercel.json` includes the rewrites rule

### Environment variables

- Add in Vercel dashboard: Settings → Environment Variables
- Redeploy after adding

## 🌍 Custom Domain

1. Go to project settings in Vercel
2. Add your custom domain
3. Update DNS records as instructed
