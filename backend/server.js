require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@libsql/client');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PIN = process.env.APP_PIN || '1234';

// Generates a unique token tied to your secret APP_PIN
const SESSION_TOKEN = crypto
    .createHmac('sha256', APP_PIN)
    .update('budgethelper-auth-token')
    .digest('hex');

// Connects to the isolated SQLite container over db_net
const db = createClient({
    url: process.env.DB_URL || 'http://db:8080'
});

async function initDb(retries = 10) {
    for (let i = 0; i < retries; i++) {
        try {
            await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pockets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          pinned INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS budget_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          accountId TEXT NOT NULL,
          pocketId TEXT NOT NULL,
          amount REAL NOT NULL,
          frequency TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          accountId TEXT NOT NULL,
          pocketId TEXT NOT NULL,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          label TEXT NOT NULL,
          date TEXT NOT NULL,
          groupId TEXT
        );
        CREATE TABLE IF NOT EXISTS recurring_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          accountId TEXT NOT NULL,
          pocketId TEXT NOT NULL,
          targetPocketId TEXT,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          label TEXT NOT NULL,
          frequency TEXT NOT NULL,
          nextDate TEXT NOT NULL
        );
      `);

            try {
                await db.execute('ALTER TABLE transactions ADD COLUMN groupId TEXT');
            } catch (e) {
                // Column already exists, ignore
            }

            const countRes = await db.execute('SELECT COUNT(*) as count FROM accounts');
            if (Number(countRes.rows[0].count) === 0) {
                const acc1Id = process.env.ACC1_ID || 'john';
                const acc1Name = process.env.ACC1_NAME || 'John';
                const acc2Id = process.env.ACC2_ID || 'jane';
                const acc2Name = process.env.ACC2_NAME || 'Jane';

                await db.batch([
                    { sql: 'INSERT INTO accounts (id, name) VALUES (?, ?)', args: [acc1Id, acc1Name] },
                    { sql: 'INSERT INTO accounts (id, name) VALUES (?, ?)', args: [acc2Id, acc2Name] }
                ], 'write');

                if (acc1Id === 'john' && acc2Id === 'jane') {
                    await db.batch([
                        { sql: 'INSERT INTO pockets (id, name, pinned) VALUES (?, ?, 1)', args: ['food', 'Food'] },
                        { sql: 'INSERT INTO pockets (id, name, pinned) VALUES (?, ?, 1)', args: ['hobbies', 'Hobbies'] },
                        { sql: 'INSERT INTO pockets (id, name, pinned) VALUES (?, ?, 1)', args: ['transport', 'Transport'] },
                        { sql: 'INSERT INTO budget_rules (accountId, pocketId, amount, frequency) VALUES (?, ?, ?, ?)', args: ['john', 'food', 200, 'monthly'] },
                        { sql: 'INSERT INTO budget_rules (accountId, pocketId, amount, frequency) VALUES (?, ?, ?, ?)', args: ['jane', 'food', 50, 'weekly'] },
                        { sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date) VALUES (?, ?, ?, ?, ?, ?)', args: ['john', 'food', 'debit', 45.40, 'Groceries', '2026-11-04'] },
                        { sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date) VALUES (?, ?, ?, ?, ?, ?)', args: ['john', 'food', 'credit', 250.00, 'Monthly Allocation', '2026-11-01'] },
                        { sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date) VALUES (?, ?, ?, ?, ?, ?)', args: ['jane', 'food', 'credit', 50.00, 'Weekly Allocation', '2026-11-01'] }
                    ], 'write');
                }
            }
            console.log('Connected to SQLite container and initialized schema.');
            return;
        } catch (err) {
            console.log(`Waiting for DB container... (${i + 1}/${retries})`);
            await new Promise(res => setTimeout(res, 1500));
        }
    }
    console.error('Could not connect to DB container.');
    process.exit(1);
}

app.use(cors());
app.use(express.json());

app.post('/api/auth', (req, res) => {
    const { pin } = req.body;
    if (pin === APP_PIN) {
        return res.json({ authenticated: true, token: SESSION_TOKEN });
    }
    return res.status(401).json({ authenticated: false, error: 'Invalid PIN' });
});

app.use('/api', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${SESSION_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

function getNextDate(dateStr, frequency) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));

    if (frequency === 'weekly') {
        d.setUTCDate(d.getUTCDate() + 7);
    } else if (frequency === 'monthly') {
        d.setUTCMonth(d.getUTCMonth() + 1);
    } else if (frequency === 'semester') {
        d.setUTCMonth(d.getUTCMonth() + 6);
    } else if (frequency === 'yearly') {
        d.setUTCFullYear(d.getUTCFullYear() + 1);
    }
    return d.toISOString().split('T')[0];
}

async function processRecurringTransactions() {
    const today = new Date().toISOString().split('T')[0];
    const dueRes = await db.execute({
        sql: 'SELECT * FROM recurring_transactions WHERE nextDate <= ?',
        args: [today]
    });

    if (dueRes.rows.length === 0) return;

    const queries = [];
    for (const item of dueRes.rows) {
        let triggerDate = item.nextDate;

        // Catch up on all occurrences up to today
        while (triggerDate <= today) {
            if (item.type === 'transfer' && item.targetPocketId) {
                queries.push({
                    sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date) VALUES (?, ?, ?, ?, ?, ?)',
                    args: [item.accountId, item.pocketId, 'debit', Number(item.amount), `${item.label} (Auto →)`, triggerDate]
                });
                queries.push({
                    sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date) VALUES (?, ?, ?, ?, ?, ?)',
                    args: [item.accountId, item.targetPocketId, 'credit', Number(item.amount), `${item.label} (Auto ←)`, triggerDate]
                });
            } else {
                queries.push({
                    sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date) VALUES (?, ?, ?, ?, ?, ?)',
                    args: [item.accountId, item.pocketId, item.type, Number(item.amount), `${item.label} (Auto)`, triggerDate]
                });
            }
            triggerDate = getNextDate(triggerDate, item.frequency);
        }

        queries.push({
            sql: 'UPDATE recurring_transactions SET nextDate = ? WHERE id = ?',
            args: [triggerDate, item.id]
        });
    }

    if (queries.length > 0) {
        await db.batch(queries, 'write');
    }
}

app.get('/api/budget', async (req, res) => {
    try {
        await processRecurringTransactions();

        const [accounts, pockets, budgetRules, transactions, pocketBalances, recurringTransactions] = await Promise.all([
            db.execute('SELECT * FROM accounts'),
            db.execute('SELECT * FROM pockets'),
            db.execute('SELECT id, accountId, pocketId, amount, frequency FROM budget_rules'),
            db.execute('SELECT * FROM transactions ORDER BY date DESC, id DESC'),
            db.execute(`
        SELECT 
          accountId, 
          pocketId, 
          SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) as balance
        FROM transactions
        GROUP BY accountId, pocketId
      `),
            db.execute('SELECT * FROM recurring_transactions ORDER BY nextDate ASC, id ASC')
        ]);

        res.json({
            accounts: accounts.rows,
            pockets: pockets.rows,
            budgetRules: budgetRules.rows,
            transactions: transactions.rows,
            pocketBalances: pocketBalances.rows,
            recurringTransactions: recurringTransactions.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions', async (req, res) => {
    try {
        const {
            accountId,
            pocketId,
            targetAccountId,
            targetPocketId,
            splits,
            type = 'debit',
            amount,
            label
        } = req.body;

        const date = new Date().toISOString().split('T')[0];

        // 1. Handle 50/50 or Custom Bill Splits (linked by groupId)
        if (type === 'split') {
            if (!pocketId || !Array.isArray(splits) || splits.length === 0) {
                return res.status(400).json({ error: 'Missing split details' });
            }

            const cleanLabel = (label && label.trim()) ? label.trim() : 'Shared Bill';
            const groupId = crypto.randomUUID();
            const queries = splits
                .filter(s => s.accountId && Number(s.amount) > 0)
                .map(s => ({
                    sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date, groupId) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    args: [s.accountId, pocketId, 'debit', Number(s.amount), `${cleanLabel} (Split)`, date, groupId]
                }));

            if (queries.length === 0) {
                return res.status(400).json({ error: 'Split amounts must be greater than 0' });
            }

            await db.batch(queries, 'write');
            return res.status(201).json({ success: true });
        }

        if (!accountId || !pocketId || amount === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const numAmount = Number(amount);

        // 2. Handle Transfers (linked by groupId)
        if (type === 'transfer') {
            const destAccountId = targetAccountId || accountId;
            if (!targetPocketId || (accountId === destAccountId && pocketId === targetPocketId)) {
                return res.status(400).json({ error: 'Select a different destination account or pocket' });
            }

            const cleanLabel = (label && label.trim()) ? label.trim() : 'Transfer';
            const groupId = crypto.randomUUID();
            await db.batch([
                {
                    sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date, groupId) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    args: [accountId, pocketId, 'debit', numAmount, `${cleanLabel} (→)`, date, groupId]
                },
                {
                    sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date, groupId) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    args: [destAccountId, targetPocketId, 'credit', numAmount, `${cleanLabel} (←)`, date, groupId]
                }
            ], 'write');

            return res.status(201).json({ success: true });
        }

        // 3. Standard Debit (-) or Credit (+)
        const cleanLabel = (label && label.trim()) ? label.trim() : 'Quick Entry';
        const info = await db.execute({
            sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date) VALUES (?, ?, ?, ?, ?, ?)',
            args: [accountId, pocketId, type, numAmount, cleanLabel, date]
        });

        res.status(201).json({
            success: true,
            transaction: {
                id: Number(info.lastInsertRowid),
                accountId,
                pocketId,
                type,
                amount: numAmount,
                label: cleanLabel,
                date
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a transaction (and its paired transfer/split leg if it shares a groupId)
app.delete('/api/transactions/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const txRes = await db.execute({
            sql: 'SELECT groupId FROM transactions WHERE id = ?',
            args: [id]
        });

        if (txRes.rows.length > 0 && txRes.rows[0].groupId) {
            await db.execute({
                sql: 'DELETE FROM transactions WHERE groupId = ?',
                args: [txRes.rows[0].groupId]
            });
        } else {
            await db.execute({
                sql: 'DELETE FROM transactions WHERE id = ?',
                args: [id]
            });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a recurring transaction
app.post('/api/recurring', async (req, res) => {
    try {
        const {
            accountId,
            pocketId,
            targetPocketId = null,
            type = 'debit',
            amount,
            label,
            frequency = 'monthly',
            nextDate
        } = req.body;

        if (!accountId || !pocketId || amount === undefined || !nextDate || !frequency) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (type === 'transfer' && (!targetPocketId || pocketId === targetPocketId)) {
            return res.status(400).json({ error: 'Select two different buckets for transfer' });
        }

        const cleanLabel = (label && label.trim()) ? label.trim() : 'Scheduled Entry';
        const numAmount = Number(amount);

        const info = await db.execute({
            sql: `INSERT INTO recurring_transactions 
                  (accountId, pocketId, targetPocketId, type, amount, label, frequency, nextDate) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [accountId, pocketId, targetPocketId, type, numAmount, cleanLabel, frequency, nextDate]
        });

        res.status(201).json({
            success: true,
            id: Number(info.lastInsertRowid)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manually trigger a recurring transaction today and skip the next scheduled occurrence
app.post('/api/recurring/:id/trigger', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const result = await db.execute({
            sql: 'SELECT * FROM recurring_transactions WHERE id = ?',
            args: [id]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Scheduled transaction not found' });
        }

        const item = result.rows[0];
        const today = new Date().toISOString().split('T')[0];
        
        // Advance from item.nextDate (not today) so the anchor day (e.g. the 20th) never drifts
        const newNextDate = getNextDate(item.nextDate, item.frequency);
        const queries = [];

        if (item.type === 'transfer' && item.targetPocketId) {
            const groupId = crypto.randomUUID();
            queries.push({
                sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date, groupId) VALUES (?, ?, ?, ?, ?, ?, ?)',
                args: [item.accountId, item.pocketId, 'debit', Number(item.amount), `${item.label} (Auto →)`, today, groupId]
            });
            queries.push({
                sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date, groupId) VALUES (?, ?, ?, ?, ?, ?, ?)',
                args: [item.accountId, item.targetPocketId, 'credit', Number(item.amount), `${item.label} (Auto ←)`, today, groupId]
            });
        } else {
            queries.push({
                sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date) VALUES (?, ?, ?, ?, ?, ?)',
                args: [item.accountId, item.pocketId, item.type, Number(item.amount), item.label, today]
            });
        }

        // Skip the upcoming occurrence by advancing nextDate to the following cycle
        queries.push({
            sql: 'UPDATE recurring_transactions SET nextDate = ? WHERE id = ?',
            args: [newNextDate, id]
        });

        await db.batch(queries, 'write');

        res.json({
            success: true,
            triggeredDate: today,
            nextDate: newNextDate
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a recurring transaction
app.delete('/api/recurring/:id', async (req, res) => {
    try {
        await db.execute({
            sql: 'DELETE FROM recurring_transactions WHERE id = ?',
            args: [Number(req.params.id)]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new budget rule
app.post('/api/rules', async (req, res) => {
    try {
        const { accountId, pocketId, amount, frequency = 'monthly' } = req.body;
        if (!accountId || !pocketId || amount === undefined || !frequency) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const numAmount = Number(amount);
        const info = await db.execute({
            sql: 'INSERT INTO budget_rules (accountId, pocketId, amount, frequency) VALUES (?, ?, ?, ?)',
            args: [accountId, pocketId, numAmount, frequency]
        });

        res.status(201).json({
            success: true,
            rule: {
                id: Number(info.lastInsertRowid),
                accountId,
                pocketId,
                amount: numAmount,
                frequency
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a budget rule
app.delete('/api/rules/:id', async (req, res) => {
    try {
        await db.execute({
            sql: 'DELETE FROM budget_rules WHERE id = ?',
            args: [Number(req.params.id)]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new pocket
app.post('/api/pockets', async (req, res) => {
    try {
        const { name, pinned = 1 } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Pocket name is required' });
        }

        const cleanName = name.trim();
        const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const id = `${baseSlug || 'pocket'}-${Date.now().toString().slice(-4)}`;
        const isPinned = pinned ? 1 : 0;

        await db.execute({
            sql: 'INSERT INTO pockets (id, name, pinned) VALUES (?, ?, ?)',
            args: [id, cleanName, isPinned]
        });

        res.status(201).json({
            success: true,
            pocket: { id, name: cleanName, pinned: isPinned }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle pocket pinned status on Dashboard
app.patch('/api/pockets/:id', async (req, res) => {
    try {
        const { pinned } = req.body;
        await db.execute({
            sql: 'UPDATE pockets SET pinned = ? WHERE id = ?',
            args: [pinned ? 1 : 0, req.params.id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a pocket and return its transactions/balance to Main Account ('unallocated')
app.delete('/api/pockets/:id', async (req, res) => {
    try {
        const pocketId = req.params.id;
        await db.batch([
            {
                sql: "UPDATE transactions SET pocketId = 'unallocated' WHERE pocketId = ?",
                args: [pocketId]
            },
            {
                sql: 'DELETE FROM budget_rules WHERE pocketId = ?',
                args: [pocketId]
            },
            {
                sql: 'DELETE FROM recurring_transactions WHERE pocketId = ? OR targetPocketId = ?',
                args: [pocketId, pocketId]
            },
            {
                sql: 'DELETE FROM pockets WHERE id = ?',
                args: [pocketId]
            }
        ], 'write');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

initDb().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Backend running on http://0.0.0.0:${PORT}`);
    });
});