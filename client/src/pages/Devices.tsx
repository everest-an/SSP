import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Smartphone, Plus, Edit, Activity, WifiOff, Wrench } from "lucide-react";

export default function Devices() {
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    deviceName: "",
    deviceType: "ipad" as "ipad" | "android_tablet" | "pos_terminal",
    deviceId: "",
    location: "",
    firmwareVersion: "",
  });

  const utils = trpc.useUtils();
  const { data: merchants } = trpc.merchants.getMyMerchants.useQuery();

  useMemo(() => {
    if (merchants && merchants.length > 0 && !selectedMerchantId) {
      setSelectedMerchantId(merchants[0].id);
    }
  }, [merchants, selectedMerchantId]);

  const { data: devices, isLoading } = trpc.devices.getByMerchant.useQuery(
    { merchantId: selectedMerchantId! },
    { enabled: !!selectedMerchantId }
  );

  const registerDeviceMutation = trpc.devices.register.useMutation({
    onSuccess: () => {
      toast.success("Device registered successfully!");
      utils.devices.getByMerchant.invalidate();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to register device: ${error.message}`);
    },
  });

  const updateDeviceMutation = trpc.devices.update.useMutation({
    onSuccess: () => {
      toast.success("Device updated successfully!");
      utils.devices.getByMerchant.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update device: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      deviceName: "",
      deviceType: "ipad",
      deviceId: "",
      location: "",
      firmwareVersion: "",
    });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchantId) return;

    registerDeviceMutation.mutate({
      merchantId: selectedMerchantId,
      ...formData,
    });
  };

  const handleStatusChange = (deviceId: number, newStatus: "online" | "offline" | "maintenance") => {
    updateDeviceMutation.mutate({
      id: deviceId,
      status: newStatus,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <Activity className="h-5 w-5 text-green-500" />;
      case "offline":
        return <WifiOff className="h-5 w-5 text-gray-500" />;
      case "maintenance":
        return <Wrench className="h-5 w-5 text-yellow-500" />;
      default:
        return <WifiOff className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      online: "bg-green-500/10 text-green-500",
      offline: "bg-gray-500/10 text-gray-500",
      maintenance: "bg-yellow-500/10 text-yellow-500",
    };
    return colors[status] || colors.offline;
  };

  const getDeviceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ipad: "iPad",
      android_tablet: "Android Tablet",
      pos_terminal: "POS Terminal",
    };
    return labels[type] || type;
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Devices</h1>
            <p className="text-muted-foreground mt-1">Manage your edge computing devices</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Register Device
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Register New Device</DialogTitle>
                <DialogDescription>Add a new edge device to your network</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deviceName">Device Name *</Label>
                  <Input
                    id="deviceName"
                    placeholder="e.g., Store Front Camera 1"
                    value={formData.deviceName}
                    onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deviceType">Device Type *</Label>
                  <select
                    id="deviceType"
                    value={formData.deviceType}
                    onChange={(e) => setFormData({ ...formData, deviceType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                    required
                  >
                    <option value="ipad">iPad</option>
                    <option value="android_tablet">Android Tablet</option>
                    <option value="pos_terminal">POS Terminal</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deviceId">Device ID *</Label>
                  <Input
                    id="deviceId"
                    placeholder="Unique device identifier"
                    value={formData.deviceId}
                    onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This should be a unique identifier for the device (e.g., serial number, MAC address)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Entrance, Aisle 3, Checkout Counter"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firmwareVersion">Firmware Version</Label>
                  <Input
                    id="firmwareVersion"
                    placeholder="e.g., 1.0.0"
                    value={formData.firmwareVersion}
                    onChange={(e) => setFormData({ ...formData, firmwareVersion: e.target.value })}
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={registerDeviceMutation.isPending}>
                    {registerDeviceMutation.isPending ? "Registering..." : "Register Device"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {merchants && merchants.length > 1 && (
          <select
            value={selectedMerchantId || ""}
            onChange={(e) => setSelectedMerchantId(Number(e.target.value))}
            className="px-4 py-2 rounded-lg border border-border bg-card text-foreground"
          >
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.businessName}
              </option>
            ))}
          </select>
        )}

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-32 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : devices && devices.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <Card key={device.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Smartphone className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{device.deviceName}</CardTitle>
                        <CardDescription>{getDeviceTypeLabel(device.deviceType)}</CardDescription>
                      </div>
                    </div>
                    {getStatusIcon(device.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(device.status)}`}>
                        {device.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Device ID:</span>
                      <span className="font-mono text-xs text-foreground">{device.deviceId}</span>
                    </div>
                    {device.location && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Location:</span>
                        <span className="text-foreground">{device.location}</span>
                      </div>
                    )}
                    {device.firmwareVersion && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Firmware:</span>
                        <span className="text-foreground">{device.firmwareVersion}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Heartbeat:</span>
                      <span className="text-foreground">{formatDate(device.lastHeartbeat)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Label className="text-xs text-muted-foreground mb-2 block">Change Status:</Label>
                    <div className="flex space-x-2">
                      <Button
                        variant={device.status === "online" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => handleStatusChange(device.id, "online")}
                      >
                        Online
                      </Button>
                      <Button
                        variant={device.status === "offline" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => handleStatusChange(device.id, "offline")}
                      >
                        Offline
                      </Button>
                      <Button
                        variant={device.status === "maintenance" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => handleStatusChange(device.id, "maintenance")}
                      >
                        Maintenance
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Smartphone className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No devices registered</h3>
              <p className="text-muted-foreground mb-6">
                Register your first edge device to start processing transactions
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Register Device
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
