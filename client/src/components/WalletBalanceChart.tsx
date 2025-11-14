/**
 * Wallet Balance Chart Component
 * Displays wallet balance over time
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

interface Transaction {
  id: number;
  amount: number;
  createdAt: string;
  type: string;
}

interface WalletBalanceChartProps {
  currentBalance: number;
  transactions: Transaction[];
  currency?: string;
}

export function WalletBalanceChart({
  currentBalance,
  transactions,
  currency = "USD",
}: WalletBalanceChartProps) {
  // Calculate balance history
  const balanceHistory = calculateBalanceHistory(currentBalance, transactions);
  
  // Calculate statistics
  const totalIncome = transactions
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
  
  const totalExpense = transactions
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  
  const netChange = totalIncome - totalExpense;
  const percentChange = currentBalance > 0 ? (netChange / currentBalance) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Balance Overview</span>
          <motion.div
            className={`flex items-center gap-1 text-sm font-medium ${
              netChange >= 0 ? "text-green-600" : "text-red-600"
            }`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {netChange >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {netChange >= 0 ? "+" : ""}
            {(netChange / 100).toFixed(2)} {currency}
            <span className="text-muted-foreground ml-1">
              ({percentChange >= 0 ? "+" : ""}
              {percentChange.toFixed(1)}%)
            </span>
          </motion.div>
        </CardTitle>
        <CardDescription>Your wallet balance and transaction summary</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Balance */}
        <div className="flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-700 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
            <p className="text-4xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8" />
              {(currentBalance / 100).toFixed(2)}
              <span className="text-2xl text-muted-foreground">{currency}</span>
            </p>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Total Income</p>
            <p className="text-2xl font-semibold text-green-600">
              +${(totalIncome / 100).toFixed(2)}
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Total Expense</p>
            <p className="text-2xl font-semibold text-red-600">
              -${(totalExpense / 100).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Simple Balance History Visualization */}
        {balanceHistory.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Balance History</p>
            <div className="h-32 flex items-end gap-1">
              {balanceHistory.slice(-30).map((point, index) => {
                const maxBalance = Math.max(...balanceHistory.map((p) => p.balance));
                const height = maxBalance > 0 ? (point.balance / maxBalance) * 100 : 0;
                
                return (
                  <motion.div
                    key={index}
                    className="flex-1 bg-blue-500 rounded-t"
                    style={{ height: `${height}%`, minHeight: "4px" }}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: index * 0.02, duration: 0.3 }}
                    title={`${new Date(point.date).toLocaleDateString()}: $${(
                      point.balance / 100
                    ).toFixed(2)}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {balanceHistory.length > 0
                  ? new Date(balanceHistory[0].date).toLocaleDateString()
                  : ""}
              </span>
              <span>Today</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Calculate balance history from transactions
 */
function calculateBalanceHistory(
  currentBalance: number,
  transactions: Transaction[]
): Array<{ date: string; balance: number }> {
  if (transactions.length === 0) {
    return [{ date: new Date().toISOString(), balance: currentBalance }];
  }

  // Sort transactions by date (oldest first)
  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Calculate balance at each transaction
  let balance = currentBalance;
  const history: Array<{ date: string; balance: number }> = [];

  // Work backwards from current balance
  for (let i = sortedTx.length - 1; i >= 0; i--) {
    history.unshift({
      date: sortedTx[i].createdAt,
      balance: balance,
    });
    balance -= sortedTx[i].amount;
  }

  // Add initial balance
  if (sortedTx.length > 0) {
    history.unshift({
      date: sortedTx[0].createdAt,
      balance: balance,
    });
  }

  // Add current balance
  history.push({
    date: new Date().toISOString(),
    balance: currentBalance,
  });

  return history;
}
