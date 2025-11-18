import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import {
  Store,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  MapPin,
  Phone,
  Mail,
  AlertCircle,
  Ban,
} from 'lucide-react';

export default function MerchantApprovals() {
  const utils = trpc.useContext();
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [suspensionReason, setSuspensionReason] = useState('');

  const { data: merchants, isLoading } = trpc.merchant.getAllMerchants.useQuery({});
  const { data: stats } = trpc.merchant.getMerchantStatistics.useQuery();

  const approveMutation = trpc.merchant.approveMerchant.useMutation({
    onSuccess: () => {
      utils.merchant.getAllMerchants.invalidate();
      utils.merchant.getMerchantStatistics.invalidate();
      setShowApproveDialog(false);
      setSelectedMerchant(null);
    },
  });

  const rejectMutation = trpc.merchant.rejectMerchant.useMutation({
    onSuccess: () => {
      utils.merchant.getAllMerchants.invalidate();
      utils.merchant.getMerchantStatistics.invalidate();
      setShowRejectDialog(false);
      setSelectedMerchant(null);
      setRejectionReason('');
    },
  });

  const suspendMutation = trpc.merchant.suspendMerchant.useMutation({
    onSuccess: () => {
      utils.merchant.getAllMerchants.invalidate();
      utils.merchant.getMerchantStatistics.invalidate();
      setShowSuspendDialog(false);
      setSelectedMerchant(null);
      setSuspensionReason('');
    },
  });

  const handleApprove = () => {
    if (selectedMerchant) {
      approveMutation.mutate({ merchantId: selectedMerchant.id });
    }
  };

  const handleReject = () => {
    if (selectedMerchant) {
      rejectMutation.mutate({
        merchantId: selectedMerchant.id,
        reason: rejectionReason,
      });
    }
  };

  const handleSuspend = () => {
    if (selectedMerchant) {
      suspendMutation.mutate({
        merchantId: selectedMerchant.id,
        reason: suspensionReason,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'inactive':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'suspended':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <Ban className="h-3 w-3 mr-1" />
            Suspended
          </Badge>
        );
      default:
        return null;
    }
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

  const pendingMerchants = merchants?.filter(m => m.status === 'inactive') || [];
  const activeMerchants = merchants?.filter(m => m.status === 'active') || [];
  const suspendedMerchants = merchants?.filter(m => m.status === 'suspended') || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Store className="h-8 w-8" />
          Merchant Management
        </h1>
        <p className="text-muted-foreground">
          Review and manage merchant applications and accounts
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.inactive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.suspended}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Applications */}
      {pendingMerchants.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Applications ({pendingMerchants.length})
            </CardTitle>
            <CardDescription>
              These applications require your review and approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingMerchants.map((merchant) => (
                <div
                  key={merchant.id}
                  className="border rounded-lg p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {merchant.businessName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {merchant.businessType || 'Business Type Not Specified'}
                      </p>
                    </div>
                    {getStatusBadge(merchant.status)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-4">
                    {merchant.address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {merchant.address}
                      </div>
                    )}
                    {merchant.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {merchant.phone}
                      </div>
                    )}
                    {merchant.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {merchant.email}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedMerchant(merchant);
                        setShowApproveDialog(true);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setSelectedMerchant(merchant);
                        setShowRejectDialog(true);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Merchants */}
      {activeMerchants.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Active Merchants ({activeMerchants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeMerchants.map((merchant) => (
                <div
                  key={merchant.id}
                  className="border rounded-lg p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {merchant.businessName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {merchant.businessType || 'Business Type Not Specified'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(merchant.status)}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedMerchant(merchant);
                          setShowSuspendDialog(true);
                        }}
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Suspend
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {merchant.address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {merchant.address}
                      </div>
                    )}
                    {merchant.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {merchant.phone}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suspended Merchants */}
      {suspendedMerchants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-600" />
              Suspended Merchants ({suspendedMerchants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {suspendedMerchants.map((merchant) => (
                <div
                  key={merchant.id}
                  className="border rounded-lg p-4 bg-red-50"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {merchant.businessName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {merchant.businessType || 'Business Type Not Specified'}
                      </p>
                    </div>
                    {getStatusBadge(merchant.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Merchant Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve <strong>{selectedMerchant?.businessName}</strong>?
              The merchant will be notified via email and gain access to the merchant dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isLoading ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Merchant Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting <strong>{selectedMerchant?.businessName}</strong>.
              The merchant will be notified via email.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-reason">Rejection Reason</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              rows={4}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isLoading || !rejectionReason}
            >
              {rejectMutation.isLoading ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Merchant Account</DialogTitle>
            <DialogDescription>
              Please provide a reason for suspending <strong>{selectedMerchant?.businessName}</strong>.
              The merchant will be notified via email and their account will be deactivated.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="suspension-reason">Suspension Reason</Label>
            <Textarea
              id="suspension-reason"
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              placeholder="Enter the reason for suspension..."
              rows={4}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspendDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={suspendMutation.isLoading || !suspensionReason}
            >
              {suspendMutation.isLoading ? 'Suspending...' : 'Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
