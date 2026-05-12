# Mock Data Injection Script

This script populates your database with realistic test data for development and testing purposes.

## What It Creates

- **50 customers per branch** - Qatari names with phone numbers
- **8 workers** (4 per branch) - Tailors and Master Cutters with wage rates
- **100 orders** - Distributed across branches with realistic statuses
  - Order items and measurements
  - Tasks (cutting & sewing) assigned to workers
  - Payments (70% have partial/full payments)
  - Invoices for ready/delivered orders
- **Worker payments** - 2-8 salary payments per worker
- **Expenses** - 15-30 expenses per branch across categories
- **Daily production records** - 5-15 entries per worker

## How to Use

### Prerequisites

1. **Run the app at least once** to initialize the database
2. The app must have been launched so the database file exists

### Run the Script

```bash
npm run mock-data
```

### Custom Database Path

If your database is in a non-standard location:

```bash
# macOS/Linux
DB_PATH=/path/to/app.db npm run mock-data

# Windows (PowerShell)
$env:DB_PATH="C:\path\to\app.db"; npm run mock-data

# Windows (CMD)
set DB_PATH=C:\path\to\app.db && npm run mock-data
```

## Test Credentials

After running the script, you can log in with:

### Admin Account
- **Username:** `admin`
- **Password:** `admin123`

### Worker Accounts
All workers use:
- **Password:** `password123`

The script will display all created worker usernames at the end.

## Database Location

The script automatically finds the database based on your OS:

| OS | Path |
|----|------|
| **macOS** | `~/Library/Application Support/etiquette-tailor/app.db` |
| **Windows** | `%APPDATA%/etiquette-tailor/app.db` |
| **Linux** | `~/.config/etiquette-tailor/app.db` |

## Business Rules Followed

✅ Order numbers follow branch prefixes (A-001, B-001)
✅ Balance = Price - Paid (auto-calculated)
✅ Worker wages = Price × (rate/100) or fixed amount
✅ Order statuses: intake → cutting → sewing → ready → delivered
✅ Payment types: cash or card only
✅ All required fields populated
✅ Arabic customer names supported
✅ Branch-specific data isolation

## Clean Up

To remove mock data and start fresh:

```bash
# Delete the database file
rm ~/Library/Application Support/etiquette-tailor/app.db  # macOS
rm %APPDATA%\etiquette-tailor\app.db                     # Windows
rm ~/.config/etiquette-tailor/app.db                      # Linux

# Then run the app to reinitialize
npm start
```

## Troubleshooting

**"Failed to open database"**
- Make sure you've run the app at least once
- Check that the database file exists
- Verify file permissions

**"No branches found"**
- Run the app first to initialize the database
- The database initialization script creates branches automatically

**Order numbers overlap**
- The script respects existing branch sequences
- Delete and recreate the database if you want completely fresh data
