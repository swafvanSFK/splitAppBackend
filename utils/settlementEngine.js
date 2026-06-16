/**
 * Settlement Engine using Greedy Algorithm
 * Resolves balances into the minimum number of transactions.
 * 
 * balances: Object containing user_id as key and their net balance as value
 * e.g., { 'user1': -50, 'user2': 100, 'user3': -50 }
 * 
 * Returns array of transactions: 
 * [{ from_user_id, to_user_id, amount }]
 */

function calculateSettlements(balances) {
  let debtors = [];
  let creditors = [];

  // Split into debtors and creditors
  for (const [userId, balance] of Object.entries(balances)) {
    if (balance < 0) {
      debtors.push({ userId, amount: Math.abs(balance) });
    } else if (balance > 0) {
      creditors.push({ userId, amount: balance });
    }
  }

  // Sort by highest amount first to optimize (Greedy)
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let transactions = [];
  let i = 0; // debtors index
  let j = 0; // creditors index

  while (i < debtors.length && j < creditors.length) {
    let debtor = debtors[i];
    let creditor = creditors[j];

    // The settlement amount is the minimum of what debtor owes and what creditor is owed
    let amount = Math.min(debtor.amount, creditor.amount);

    transactions.push({
      from_user_id: debtor.userId,
      to_user_id: creditor.userId,
      amount: parseFloat(amount.toFixed(2))
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    // Move to next debtor/creditor if their balance is settled
    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return transactions;
}

module.exports = { calculateSettlements };
