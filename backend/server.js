require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PIN = process.env.APP_PIN || '1234';

app.use(cors());
app.use(express.json());

const mockState = {
    accounts: [
        { id: 'john', name: 'John' },
        { id: 'jane', name: 'Jane' }
    ],
    pockets: [
        { id: 'food', name: 'Food' },
        { id: 'hobbies', name: 'Hobbies' },
        { id: 'transport', name: 'Transport' }
    ],
    budgetRules: [
        { accountId: 'john', pocketId: 'food', amount: 200, frequency: 'monthly' },
        { accountId: 'jane', pocketId: 'food', amount: 50, frequency: 'weekly' }
    ],
    transactions: [
        { id: 1, accountId: 'john', pocketId: 'food', type: 'debit', amount: 45.40, label: 'Groceries', date: '2026-11-04' },
        { id: 2, accountId: 'john', pocketId: 'food', type: 'credit', amount: 250.00, label: 'Monthly Allocation', date: '2026-11-01' },
        { id: 3, accountId: 'jane', pocketId: 'food', type: 'credit', amount: 50.00, label: 'Weekly Allocation', date: '2026-11-01' }
    ]
};

// Simple PIN authentication endpoint
app.post('/api/auth', (req, res) => {
    const { pin } = req.body;
    if (pin === APP_PIN) {
        return res.json({ authenticated: true, token: 'mock-session-token' });
    }
    return res.status(401).json({ authenticated: false, error: 'Invalid PIN' });
});

// Get dashboard summary (accounts, pinned pockets, recent rows)
app.get('/api/budget', (req, res) => {
    // Generate pocket balances dynamically from transactions
    const calculatedBalances = mockState.transactions.reduce((acc, tx) => {
        const key = `${tx.accountId}-${tx.pocketId}`;
        if (!acc[key]) acc[key] = { accountId: tx.accountId, pocketId: tx.pocketId, balance: 0 };

        // Add if credit, subtract if debit
        acc[key].balance += tx.type === 'credit' ? tx.amount : -tx.amount;
        return acc;
    }, {});

    res.json({
        ...mockState,
        pocketBalances: Object.values(calculatedBalances)
    });
});

// Add credit or debit row
app.post('/api/transactions', (req, res) => {
    const { accountId, pocketId, type = 'debit', amount, label } = req.body;

    // Basic validation
    if (!accountId || !pocketId || amount === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const newTx = {
        id: Date.now(), // Generates a unique ID for the mock DB
        accountId,
        pocketId,
        type,
        amount: Number(amount),
        label: label || 'Quick Entry',
        date: new Date().toISOString().split('T')[0] // Formats as YYYY-MM-DD
    };

    // Unshift adds the new transaction to the beginning of the array (newest first)
    mockState.transactions.unshift(newTx);

    res.status(201).json({ success: true, transaction: newTx });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend running on http://0.0.0.0:${PORT}`);
});