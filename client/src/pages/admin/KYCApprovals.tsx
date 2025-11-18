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
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  User,
  MapPin,
  FileText,
  AlertCircle,
} from 'lucide-react';

export default function KYCApprovals() {
  const utils = trpc.useContext();
  const [selectedVerification, setSelectedVerification] = useState<any>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  const { data: verifications, isLoading } = trpc.kyc.getAllKYCVerifications.useQuery({});
  const { data: stats } = trpc.kyc.getKYCStatistics.useQuery();

  const approveMutation = trpc.kyc.approveKYCVerification.useMutation({
    onSuccess: () => {
      utils.kyc.getAllKYCVerifications.invalidate();
      utils.kyc.getKYCStatistics.invalidate();
      setShowApproveDialog(false);
      setSelectedVerification(null);
      setApprovalNotes('');
    },
  });

  const rejectMutation = trpc.kyc.rejectKYCVerification.useMutation({
    onSuccess: () => {
      utils.kyc.getAllKYCVerifications.invalidate();
      utils.kyc.getKYCStatistics.invalidate();
      setShowRejectDialog(false);
      setSelectedVerification(null);
      setRejectionReason('');
    },
  });

  const handleApprove = () => {
    if (selectedVerification) {
      approveMutation.mutate({
        verificationId: selectedVerification.id,
        notes: approvalNotes,
      });
    }
  };

  const handleReject = () => {
    if (selectedVerification) {
      rejectMutation.mutate({
        verificationId: selectedVerification.id,
        reason: rejectionReason,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            <Clock className="h-3 w-3 mr-1" />
            Expired
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

  const pendingVerifications = verifications?.filter(v => v.status === 'pending') || [];
  const approvedVerifications = verifications?.filter(v => v.status === 'approved') || [];
  const rejectedVerifications = verifications?.filter(v => v.status === 'rejected') || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Shield className="h-8 w-8" />
          KYC Verification Management
        </h1>
        <p className="text-muted-foreground">
          Review and approve merchant identity verifications
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Verifications */}
      {pendingVerifications.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Verifications ({pendingVerifications.length})
            </CardTitle>
            <CardDescription>
              These verifications require your review and approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingVerifications.map((verification) => (
                <div
                  key={verification.id}
                  className="border rounded-lg p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {verification.firstName} {verification.lastName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Merchant: {verification.merchant?.businessName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Email: {verification.merchant?.user?.email}
                      </p>
                    </div>
                    {getStatusBadge(verification.status)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-4">
                    <div>
                      <span className="text-muted-foreground">Date of Birth:</span>{' '}
                      {new Date(verification.dateOfBirth).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nationality:</span>{' '}
                      {verification.nationality}
                    </div>
                    <div className="col-span-2 flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <span>
                        {verification.address}, {verification.city}, {verification.postalCode},{' '}
                        {verification.country}
                      </span>
                    </div>
                    {verification.idNumber && (
                      <div>
                        <span className="text-muted-foreground">ID Number:</span>{' '}
                        {verification.idNumber}
                      </div>
                    )}
                    {verification.taxId && (
                      <div>
                        <span className="text-muted-foreground">Tax ID:</span> {verification.taxId}
                      </div>
                    )}
                  </div>

                  {verification.documents && verification.documents.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-sm font-medium mb-2 block">Documents</Label>
                      <div className="space-y-2">
                        {verification.documents.map((doc: any) => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-2 text-sm p-2 bg-muted rounded"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="capitalize">{doc.documentType.replace('_', ' ')}</span>
                            <span className="text-muted-foreground text-xs ml-auto">
                              {new Date(doc.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedVerification(verification);
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
                        setSelectedVerification(verification);
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

      {/* Approved Verifications */}
      {approvedVerifications.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Approved Verifications ({approvedVerifications.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {approvedVerifications.map((verification) => (
                <div
                  key={verification.id}
                  className="border rounded-lg p-4 bg-green-50"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {verification.firstName} {verification.lastName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {verification.merchant?.businessName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Approved: {new Date(verification.reviewedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(verification.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejected Verifications */}
      {rejectedVerifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Rejected Verifications ({rejectedVerifications.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rejectedVerifications.map((verification) => (
                <div
                  key={verification.id}
                  className="border rounded-lg p-4 bg-red-50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {verification.firstName} {verification.lastName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {verification.merchant?.businessName}
                      </p>
                    </div>
                    {getStatusBadge(verification.status)}
                  </div>
                  {verification.reviewNotes && (
                    <div className="text-sm mt-2">
                      <span className="font-medium">Reason:</span> {verification.reviewNotes}
                    </div>
                  )}
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
            <DialogTitle>Approve KYC Verification</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve the verification for{' '}
              <strong>
                {selectedVerification?.firstName} {selectedVerification?.lastName}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="approval-notes">Notes (Optional)</Label>
            <Textarea
              id="approval-notes"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add any notes about this approval..."
              rows={3}
              className="mt-2"
            />
          </div>
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
            <DialogTitle>Reject KYC Verification</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting the verification for{' '}
              <strong>
                {selectedVerification?.firstName} {selectedVerification?.lastName}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-reason">Rejection Reason *</Label>
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
    </div>
  );
}
