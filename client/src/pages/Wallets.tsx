import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Wallet, CreditCard, Plus, ArrowUpRight, ArrowDownLeft, History } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function Wallets() {
  const { user, isAuthenticated, loading } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);

  // Fetch wallets
  const { data: wallets, isLoading: walletsLoading, refetch: refetchWallets } = trpc.wallet.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Fetch wallet transactions
  const { data: transactions, refetch: refetchTransactions } = trpc.wallet.transactions.useQuery(
    { walletId: selectedWalletId!, limit: 50 },
    { enabled: selectedWalletId !== null }
  );

  // Create wallet mutation
  const createWalletMutation = trpc.wallet.create.useMutation({
    onSuccess: () => {
      toast.success("Wallet created successfully");
      setCreateDialogOpen(false);
      refetchWallets();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Deposit mutation
  const depositMutation = trpc.wallet.deposit.useMutation({
    onSuccess: () => {
      toast.success("Deposit successful");
      setDepositDialogOpen(false);
      refetchWallets();
      if (selectedWalletId) {
        refetchTransactions();
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreateWallet = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const walletType = formData.get("walletType") as "custodial" | "non_custodial";
    const walletAddress = formData.get("walletAddress") as string;
    const isDefault = formData.get("isDefault") === "on";

    createWalletMutation.mutate({
      walletType,
      walletAddress: walletType === "non_custodial" ? walletAddress : undefined,
      currency: "USD",
      isDefault,
    });
  };

  const handleDeposit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = parseInt(formData.get("amount") as string) * 100; // Convert to cents
    const paymentMethodId = formData.get("paymentMethodId") as string;

    if (!selectedWalletId) {
      toast.error("Please select a wallet");
      return;
    }

    depositMutation.mutate({
      walletId: selectedWalletId,
      amount,
      paymentMethodId,
    });
  };

  if (loading || walletsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading wallets...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Please log in to view your wallets</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Wallets</h1>
            <p className="text-muted-foreground">Manage your custodial and non-custodial wallets</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Wallet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Wallet</DialogTitle>
                <DialogDescription>
                  Choose between custodial (platform-managed) or non-custodial (self-managed) wallet
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateWallet} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="walletType">Wallet Type</Label>
                  <Select name="walletType" defaultValue="custodial">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custodial">Custodial (Platform-managed)</SelectItem>
                      <SelectItem value="non_custodial">Non-Custodial (Self-managed)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Custodial wallets are managed by the platform and support streaming payments with lower fees.
                    Non-custodial wallets give you full control.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="walletAddress">Wallet Address (for non-custodial only)</Label>
                  <Input
                    id="walletAddress"
                    name="walletAddress"
                    placeholder="0x..."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="isDefault" name="isDefault" />
                  <Label htmlFor="isDefault">Set as default wallet</Label>
                </div>

                <Button type="submit" className="w-full" disabled={createWalletMutation.isPending}>
                  {createWalletMutation.isPending ? "Creating..." : "Create Wallet"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Wallets Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wallets?.map((wallet) => (
            <Card key={wallet.id} className="relative">
              {wallet.isDefault === 1 && (
                <Badge className="absolute top-4 right-4">Default</Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  {wallet.walletType === "custodial" ? "Custodial Wallet" : "Non-Custodial Wallet"}
                </CardTitle>
                <CardDescription>
                  {wallet.walletAddress || "Platform-managed"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="text-2xl font-bold">
                      ${(wallet.balance / 100).toFixed(2)} {wallet.currency}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={wallet.status === "active" ? "default" : "secondary"}>
                      {wallet.status}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    {wallet.walletType === "custodial" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSelectedWalletId(wallet.id);
                            setDepositDialogOpen(true);
                          }}
                        >
                          <ArrowDownLeft className="mr-2 h-4 w-4" />
                          Deposit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                        >
                          <ArrowUpRight className="mr-2 h-4 w-4" />
                          Withdraw
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedWalletId(wallet.id)}
                    >
                      <History className="mr-2 h-4 w-4" />
                      History
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Deposit Dialog */}
        <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deposit Funds</DialogTitle>
              <DialogDescription>
                Add funds to your custodial wallet using Stripe
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleDeposit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="100.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethodId">Payment Method ID</Label>
                <Input
                  id="paymentMethodId"
                  name="paymentMethodId"
                  placeholder="pm_..."
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Enter your Stripe payment method ID. You can get this from your Stripe dashboard.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={depositMutation.isPending}>
                {depositMutation.isPending ? "Processing..." : "Deposit"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Transaction History */}
        {selectedWalletId && transactions && transactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Recent transactions for selected wallet</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Badge variant="outline">{tx.type}</Badge>
                      </TableCell>
                      <TableCell className={tx.amount < 0 ? "text-red-500" : "text-green-500"}>
                        {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tx.status === "completed" ? "default" : "secondary"}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{tx.description}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {wallets?.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Wallets Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first wallet to start managing your funds
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Wallet
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
