import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Wallet,
  Plus,
  Bitcoin,
  TrendingUp,
  History,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

export default function CryptoWallets() {
  const utils = trpc.useContext();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  const [showTransactionsDialog, setShowTransactionsDialog] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    walletType: 'BTC' as 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'LTC',
    walletAddress: '',
    walletName: '',
  });

  const { data: wallets, isLoading } = trpc.cryptoWallet.getMyCryptoWallets.useQuery();
  const { data: stats } = trpc.cryptoWallet.getCryptoWalletStats.useQuery();
  const { data: supportedCryptos } = trpc.cryptoWallet.getSupportedCryptos.useQuery();
  const { data: transactions } = trpc.cryptoWallet.getWalletTransactions.useQuery(
    { walletId: selectedWallet?.id || 0 },
    { enabled: !!selectedWallet }
  );

  const createWalletMutation = trpc.cryptoWallet.createCryptoWallet.useMutation({
    onSuccess: () => {
      utils.cryptoWallet.getMyCryptoWallets.invalidate();
      utils.cryptoWallet.getCryptoWalletStats.invalidate();
      setShowAddDialog(false);
      setFormData({ walletType: 'BTC', walletAddress: '', walletName: '' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createWalletMutation.mutate(formData);
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const getCryptoIcon = (symbol: string) => {
    const icons: Record<string, string> = {
      BTC: '₿',
      ETH: 'Ξ',
      USDT: '₮',
      USDC: '$',
      LTC: 'Ł',
    };
    return icons[symbol] || '₿';
  };

  const getCryptoColor = (symbol: string) => {
    const colors: Record<string, string> = {
      BTC: 'text-orange-500',
      ETH: 'text-blue-500',
      USDT: 'text-green-500',
      USDC: 'text-blue-600',
      LTC: 'text-gray-500',
    };
    return colors[symbol] || 'text-gray-500';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Bitcoin className="h-8 w-8" />
          Cryptocurrency Wallets
        </h1>
        <p className="text-muted-foreground">
          Manage your cryptocurrency wallets for payments
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Wallets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWallets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(stats.totalBalance / 100).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">USD equivalent</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Cryptocurrencies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(stats.walletsByType).length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Wallets List */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Crypto Wallets</CardTitle>
              <CardDescription>
                Add and manage your cryptocurrency wallets
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Wallet
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {wallets && wallets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="border rounded-lg p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`text-3xl ${getCryptoColor(wallet.walletType)}`}>
                        {getCryptoIcon(wallet.walletType)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{wallet.walletType}</h3>
                        <p className="text-sm text-muted-foreground">
                          {wallet.currency} Wallet
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">{wallet.walletType}</Badge>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Balance</Label>
                      <p className="text-xl font-bold">
                        {(wallet.balance / 100).toFixed(8)} {wallet.walletType}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ≈ ${(wallet.balance / 100).toFixed(2)} USD
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Wallet Address</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
                          {wallet.walletAddress}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyAddress(wallet.walletAddress)}
                        >
                          {copiedAddress === wallet.walletAddress ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setSelectedWallet(wallet);
                          setShowTransactionsDialog(true);
                        }}
                      >
                        <History className="h-4 w-4 mr-1" />
                        History
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        Deposit
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Bitcoin className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No crypto wallets yet</p>
              <p className="text-sm mb-4">Add your first cryptocurrency wallet to get started</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Wallet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supported Cryptocurrencies */}
      {supportedCryptos && (
        <Card>
          <CardHeader>
            <CardTitle>Supported Cryptocurrencies</CardTitle>
            <CardDescription>
              We support the following cryptocurrencies for payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {supportedCryptos.map((crypto) => (
                <div
                  key={crypto.symbol}
                  className="border rounded-lg p-4 text-center"
                >
                  <div className={`text-3xl mb-2 ${getCryptoColor(crypto.symbol)}`}>
                    {crypto.icon}
                  </div>
                  <h4 className="font-semibold">{crypto.symbol}</h4>
                  <p className="text-xs text-muted-foreground">{crypto.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{crypto.network}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Wallet Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Crypto Wallet</DialogTitle>
            <DialogDescription>
              Connect your cryptocurrency wallet to enable crypto payments
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="walletType">Cryptocurrency *</Label>
              <Select
                value={formData.walletType}
                onValueChange={(value: any) => setFormData({ ...formData, walletType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedCryptos?.map((crypto) => (
                    <SelectItem key={crypto.symbol} value={crypto.symbol}>
                      {crypto.icon} {crypto.name} ({crypto.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="walletAddress">Wallet Address *</Label>
              <Input
                id="walletAddress"
                value={formData.walletAddress}
                onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                placeholder="Enter your wallet address"
                required
              />
              <p className="text-xs text-muted-foreground">
                Your cryptocurrency wallet address for receiving payments
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="walletName">Wallet Name (Optional)</Label>
              <Input
                id="walletName"
                value={formData.walletName}
                onChange={(e) => setFormData({ ...formData, walletName: e.target.value })}
                placeholder="e.g., My Bitcoin Wallet"
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Make sure you have access to this wallet address. You'll need it to receive payments.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createWalletMutation.isPending}>
                {createWalletMutation.isPending ? 'Adding...' : 'Add Wallet'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={showTransactionsDialog} onOpenChange={setShowTransactionsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction History</DialogTitle>
            <DialogDescription>
              {selectedWallet?.walletType} Wallet Transactions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {transactions && transactions.length > 0 ? (
              transactions.map((tx) => (
                <div key={tx.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={tx.transactionType === 'deposit' ? 'default' : 'outline'}>
                      {tx.transactionType}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {tx.transactionType === 'deposit' ? '+' : '-'}
                      {(tx.amount / 100).toFixed(8)} {selectedWallet?.walletType}
                    </span>
                    <Badge variant="outline">{tx.status}</Badge>
                  </div>
                  {tx.transactionHash && (
                    <code className="text-xs text-muted-foreground block mt-2 overflow-hidden text-ellipsis">
                      {tx.transactionHash}
                    </code>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transactions yet</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
