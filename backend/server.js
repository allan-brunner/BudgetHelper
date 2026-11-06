require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PIN = process.env.APP_PIN || '1234';

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
          name TEXT NOT NULL
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
          date TEXT NOT NULL
        );
      `);

            const countRes = await db.execute('SELECT COUNT(*) as count FROM accounts');
            if (Number(countRes.rows[0].count) === 0) {
                await db.batch([
                    { sql: 'INSERT INTO accounts (id, name) VALUES (?, ?)', args: ['john', 'John'] },
                    { sql: 'INSERT INTO accounts (id, name) VALUES (?, ?)', args: ['jane', 'Jane'] },
                    { sql: 'INSERT INTO pockets (id, name) VALUES (?, ?)', args: ['food', 'Food'] },
                    { sql: 'INSERT INTO pockets (id, name) VALUES (?, ?)', args: ['hobbies', 'Hobbies'] },
                    { sql: 'INSERT INTO pockets (id, name) VALUES (?, ?)', args: ['transport', 'Transport'] },
                    { sql: 'INSERT INTO budget_rules (accountId, pocketId, amount, frequency) VALUES (?, ?, ?, ?)', args: ['john', 'food', 200, 'monthly'] },
                    { sql: 'INSERT INTO budget_rules (accountId, pocketId, amount, frequency) VALUES (?, ?, ?, ?)', args: ['jane', 'food', 50, 'weekly'] },
                    { sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date) VALUES (?, ?, ?, ?, ?, ?)', args: ['john', 'food', 'debit', 45.40, 'Groceries', '2026-11-04'] },
                    { sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date) VALUES (?, ?, ?, ?, ?, ?)', args: ['john', 'food', 'credit', 250.00, 'Monthly Allocation', '2026-11-01'] },
                    { sql: 'INSERT INTO transactions (accountId, pocketId, type, amount, label, date) VALUES (?, ?, ?, ?, ?, ?)', args: ['jane', 'food', 'credit', 50.00, 'Weekly Allocation', '2026-11-01'] }
                ], 'write');
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
        return res.json({ authenticated: true, token: 'mock-session-token' });
    }
    return res.status(401).json({ authenticated: false, error: 'Invalid PIN' });
});

app.get('/api/budget', async (req, res) => {
    try {
        const [accounts, pockets, budgetRules, transactions, pocketBalances] = await Promise.all([
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
      `)
        ]);

        res.json({
            accounts: accounts.rows,
            pockets: pockets.rows,
            budgetRules: budgetRules.rows,
            transactions: transactions.rows,
            pocketBalances: pocketBalances.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions', async (req, res) => {
    try {
        const { accountId, pocketId, type = 'debit', amount, label } = req.body;
        if (!accountId || !pocketId || amount === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const date = new Date().toISOString().split('T')[0];
        const cleanLabel = label || 'Quick Entry';
        const numAmount = Number(amount);

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

initDb().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Backend running on http://0.0.0.0:${PORT}`);
    });
});