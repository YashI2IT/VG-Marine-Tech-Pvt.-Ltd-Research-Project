# ECUlytics & TrustSense-BMS: Setup Guide 

This document provides a line-by-line, step-by-step setup guide for a brand-new computer that does not have Node.js, Git, or PostgreSQL installed yet.

---

## Step 1: Install the Required Software Tools

On a fresh laptop, download and install these three essential tools:

### 1. Install Git for Windows
1. Go to the official Git download page: **[https://git-scm.com/download/win](https://git-scm.com/download/win)**
2. Download the **64-bit Git for Windows Setup**.
3. Run the downloaded installer.
4. Keep all default options and click **Next** until the installation finishes.
5. Verify installation by opening **PowerShell** or **Command Prompt** and typing:
   ```powershell
   git --version
   ```
   *(Expected output: `git version 2.x.x`)*

---

### 2. Install Node.js (Version 20+ or 22 LTS)
1. Go to the official Node.js website: **[https://nodejs.org/en/download](https://nodejs.org/en/download)**
2. Download the **Windows Installer (.msi)** for the **LTS** version (e.g. v22.x or v20.x).
3. Run the installer, accept the license, click **Next** through default paths, and click **Install**.
4. Close and reopen your **PowerShell** window, then verify:
   ```powershell
   node -v
   npm -v
   ```
   *(Expected output: `v20.x.x` or `v22.x.x` and `npm 10.x.x`)*

---

### 3. Install PostgreSQL 16 or 17 (Database)
1. Go to the official PostgreSQL Windows download page: **[https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)**
2. Click **Download the installer** (powered by EnterpriseDB).
3. Download PostgreSQL version **16** or **17** for Windows x86-64.
4. Run the installer:
   - Keep default installation directory and components (PostgreSQL Server, pgAdmin 4, Command Line Tools).
   - **Password screen (CRITICAL):** Enter a password for the `postgres` superuser (e.g., `postgres` or `admin123`) and **remember it**! You will need it in Step 3.
   - Keep port set to **`5432`**.
   - Complete the installation. (Uncheck "Stack Builder" at the finish screen).

---

## Step 2: Create the `eculytics` Database in PostgreSQL

Now create the empty database where the application will store all data:

1. Click the Windows Start menu, type **SQL Shell (psql)**, and press **Enter**.
2. Press **Enter** to accept each default:
   - `Server [localhost]:` *(Press Enter)*
   - `Database [postgres]:` *(Press Enter)*
   - `Port [5432]:` *(Press Enter)*
   - `Username [postgres]:` *(Press Enter)*
   - `Password for user postgres:` *(Type the password you set during installation and press Enter)*
3. Once the `postgres=#` prompt appears, run this command:
   ```sql
   CREATE DATABASE eculytics;
   ```
   *(It will reply: `CREATE DATABASE`)*
4. Exit the shell by typing:
   ```sql
   \q
   ```

*(Alternatively, you can open **pgAdmin 4**, right-click **Databases** $\to$ **Create** $\to$ **Database**, enter `eculytics`, and click **Save**).*

---

## Step 3: Clone the Project from GitHub

1. Open **PowerShell** or **Terminal**.
2. Navigate to your desired working folder (for example, your Documents or Desktop):
   ```powershell
   cd C:\Users\$env:USERNAME\Desktop
   ```
3. Clone the repository:
   ```powershell
   git clone https://github.com/YashI2IT/VG-Marine-Tech-Pvt.-Ltd-Research-Project.git
   ```
4. Enter the cloned project directory:
   ```powershell
   cd "VG-Marine-Tech-Pvt.-Ltd-Research-Project"
   ```

---

## Step 4: Configure the Environment Files (`.env`)

You need to create one environment file for the backend and one for the frontend.

### 1. Setup Backend `.env`
Run in PowerShell:
```powershell
Copy-Item Development\backend\.env.example Development\backend\.env
```
Now open `Development\backend\.env` in Notepad:
```powershell
notepad Development\backend\.env
```
Find the line that starts with `DATABASE_URL=` (around line 12):
```env
DATABASE_URL=postgres://postgres:your_secure_password@localhost:5432/eculytics
```
Replace `your_secure_password` with the actual password you chose when installing PostgreSQL (e.g., `postgres` or `admin123`).
Save the file (**Ctrl + S**) and close Notepad.

---

### 2. Setup Frontend `.env.local`
Run in PowerShell:
```powershell
Copy-Item Development\frontend\.env.example Development\frontend\.env.local
```
*(The default frontend configuration connects directly to `http://localhost:3001` out of the box).*

---

## Step 5: Install Project Dependencies (`npm install`)

From the root project directory in PowerShell, install both backend and frontend packages:

```powershell
# 1. Install Backend Dependencies
cd Development\backend
npm install

# 2. Install Frontend Dependencies
cd ..\frontend
npm install

# 3. Return to the Project Root
cd ..\..
```

*(This will install Next.js, React, Tailwind CSS, Express, Drizzle ORM, Lucide icons, and all required libraries).*

---

## Step 6: Start the Application

You will run the backend and the frontend in **two separate PowerShell windows**:

### Window 1: Start the Backend API
1. Open PowerShell and navigate to the project:
   ```powershell
   cd "C:\Users\$env:USERNAME\Desktop\VG-Marine-Tech-Pvt.-Ltd-Research-Project\Development\backend"
   npm run dev
   ```
2. **What happens automatically:**
   - The backend connects to your PostgreSQL database.
   - Its built-in `initDb()` routine **automatically creates all tables** (`users`, `tenants`, `vehicles`, `work_orders`, `subscriptions`, `billing_invoices`, `ledger_anchors`, etc.).
   - It **automatically seeds** the initial administrator account, fleet battery records, and diagnostic registers.
   - You will see this output:
     ```text
     [PostgreSQL] Connected to 'eculytics' as 'postgres'
     [PostgreSQL] All schema tables verified successfully.
     [API Gateway] Listening on http://localhost:3001
     ```

---

### Window 2: Start the Next.js Frontend
1. Open a **second** PowerShell window and navigate to the frontend:
   ```powershell
   cd "C:\Users\$env:USERNAME\Desktop\VG-Marine-Tech-Pvt.-Ltd-Research-Project\Development\frontend"
   npm run dev
   ```
2. You will see:
   ```text
   ▲ Next.js 16.4.3 (Turbopack)
   - Local: http://localhost:3000
   ```

---

## Step 7: Open the Application & Login

1. Open Google Chrome, Microsoft Edge, or any modern web browser.
2. Go to: **[http://localhost:3000](http://localhost:3000)**
3. The application will load. Click **Sign In** or go to **`http://localhost:3000/login`**.

### Default Logins:

| Role | Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@eculytics.com` | `password123` | Full Admin Console (`/admin`), User Pool, Traffic, Billing & Maintenance |
| **Fleet Operator** | `user@vgmarine.com` | `password123` | Fleet Dashboard (`/dashboard`), Virtual Sensor, Vehicles & Reports |
| **Create New Account** | *Self-Register* | *Custom* | Instant self-onboarding at `/register` |

---

## Step 8: (Optional) Run the Automated Verification Suite

To verify that all 14 test suites and all genuine PostgreSQL database checks pass with 100% success on the new laptop:

In PowerShell:
```powershell
cd Development\backend
npm test
```
*(All 14 test suites, including security RBAC, telemetry contract, Merkle root checks, and Admin Dashboard checks, will run and pass).*

---

## Troubleshooting Common Issues on a Fresh Laptop

### 1. `psql: error: password authentication failed for user "postgres"`
* **Cause:** The password typed in `Development\backend\.env` does not match the password entered during PostgreSQL installation.
* **Fix:** Open `Development\backend\.env` in Notepad and correct the password in:
  `DATABASE_URL=postgres://postgres:CORRECT_PASSWORD@localhost:5432/eculytics`

---

### 2. `Execution of scripts is disabled on this system` in PowerShell
* **Cause:** Default Windows PowerShell execution policy blocks running scripts.
* **Fix:** Run this one-time command in PowerShell:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

---

### 3. `Port 3000 or 3001 is already in use`
* **Cause:** A previous instance or another process is using port 3000 or 3001.
* **Fix:** Find and terminate the process on port 3000/3001:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
  ```
