/**
 * Device Product Configuration Page
 * Allows merchants to configure which products are available on each device
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Smartphone,
  Package,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle,
  Search,
  Grid3x3,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function DeviceProductConfig() {
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);

  const utils = trpc.useUtils();

  // Fetch merchants
  const { data: merchants } = trpc.merchants.getMyMerchants.useQuery();

  // Auto-select first merchant
  useMemo(() => {
    if (merchants && merchants.length > 0 && !selectedMerchantId) {
      setSelectedMerchantId(merchants[0].id);
    }
  }, [merchants, selectedMerchantId]);

  // Fetch devices for selected merchant
  const { data: devices } = trpc.devices.getByMerchant.useQuery(
    { merchantId: selectedMerchantId! },
    { enabled: !!selectedMerchantId }
  );

  // Auto-select first device
  useMemo(() => {
    if (devices && devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  // Fetch all products for the merchant
  const { data: allProducts } = trpc.products.getByMerchant.useQuery(
    { merchantId: selectedMerchantId! },
    { enabled: !!selectedMerchantId }
  );

  // Fetch configured products for selected device
  const { data: deviceProducts, isLoading: isLoadingDeviceProducts } =
    trpc.deviceProduct.list.useQuery(
      { deviceId: selectedDeviceId! },
      { enabled: !!selectedDeviceId }
    );

  // Mutations
  const addProductMutation = trpc.deviceProduct.add.useMutation({
    onSuccess: () => {
      toast.success("Product added successfully");
      utils.deviceProduct.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add product");
    },
  });

  const removeProductMutation = trpc.deviceProduct.remove.useMutation({
    onSuccess: () => {
      toast.success("Product removed successfully");
      utils.deviceProduct.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove product");
    },
  });

  // Note: updateDisplayOrder API not available yet, remove this mutation for now
  // const updateDisplayOrderMutation = trpc.deviceProduct.updateDisplayOrder.useMutation({
  //   onSuccess: () => {
  //     toast.success("Display order updated");
  //     utils.deviceProduct.list.invalidate();
  //   },
  //   onError: (error) => {
  //     toast.error(error.message || "Failed to update display order");
  //   },
  // });

  // Filter available products (not already added to device)
  const availableProducts = useMemo(() => {
    if (!allProducts || !deviceProducts) return [];
    const deviceProductIds = deviceProducts.map((dp) => dp.productId);
    return allProducts.filter((p) => !deviceProductIds.includes(p.id));
  }, [allProducts, deviceProducts]);

  // Filter products by search query
  const filteredAvailableProducts = useMemo(() => {
    if (!searchQuery) return availableProducts;
    return availableProducts.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableProducts, searchQuery]);

  const handleAddProducts = async () => {
    if (!selectedDeviceId || selectedProducts.length === 0) return;

    // Add products one by one
    try {
      for (let i = 0; i < selectedProducts.length; i++) {
        const productId = selectedProducts[i];
        await addProductMutation.mutateAsync({
          deviceId: selectedDeviceId,
          productId,
          displayOrder: (deviceProducts?.length || 0) + i,
        });
      }
      toast.success(`${selectedProducts.length} product(s) added successfully`);
      setSelectedProducts([]);
      setIsAddDialogOpen(false);
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const handleRemoveProduct = (productId: number) => {
    if (!selectedDeviceId) return;
    removeProductMutation.mutate({
      deviceId: selectedDeviceId,
      productId,
    });
  };

  const handleToggleProduct = (productId: number) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const selectedDevice = devices?.find((d) => d.id === selectedDeviceId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Device Product Configuration</h1>
          <p className="text-muted-foreground">
            Configure which products are available on each device
          </p>
        </div>

        {/* Merchant & Device Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Device</CardTitle>
            <CardDescription>Choose a device to configure its products</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Merchant</Label>
                <Select
                  value={selectedMerchantId?.toString()}
                  onValueChange={(value) => {
                    setSelectedMerchantId(parseInt(value));
                    setSelectedDeviceId(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants?.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id.toString()}>
                        {merchant.businessName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Device</Label>
                <Select
                  value={selectedDeviceId?.toString()}
                  onValueChange={(value) => setSelectedDeviceId(parseInt(value))}
                  disabled={!devices || devices.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices?.map((device) => (
                      <SelectItem key={device.id} value={device.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          {device.deviceName} ({device.deviceId})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedDevice && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>
                      Device: <strong>{selectedDevice.deviceName}</strong> |
                      Location: <strong>{selectedDevice.location || "N/A"}</strong> |
                      Status:{" "}
                      <Badge
                        variant={
                          selectedDevice.status === "online" ? "default" : "secondary"
                        }
                      >
                        {selectedDevice.status}
                      </Badge>
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {selectedDeviceId && (
          <>
            {/* Configured Products */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Configured Products</CardTitle>
                    <CardDescription>
                      Products available on this device ({deviceProducts?.length || 0})
                    </CardDescription>
                  </div>
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Products
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add Products to Device</DialogTitle>
                        <DialogDescription>
                          Select products to make available on this device
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                        </div>

                        {/* Product List */}
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {filteredAvailableProducts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              {searchQuery
                                ? "No products found matching your search"
                                : "All products are already added to this device"}
                            </div>
                          ) : (
                            filteredAvailableProducts.map((product) => (
                              <div
                                key={product.id}
                                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer"
                                onClick={() => handleToggleProduct(product.id)}
                              >
                                <Checkbox
                                  checked={selectedProducts.includes(product.id)}
                                  onCheckedChange={() => handleToggleProduct(product.id)}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{product.name}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    ${product.price.toFixed(2)} | SKU: {product.sku}
                                  </p>
                                </div>
                                {product.stock !== null && (
                                  <Badge variant={product.stock > 0 ? "default" : "secondary"}>
                                    Stock: {product.stock}
                                  </Badge>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Selected Count */}
                        {selectedProducts.length > 0 && (
                          <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                            <span className="text-sm font-medium">
                              {selectedProducts.length} product(s) selected
                            </span>
                            <Button onClick={() => setSelectedProducts([])}>
                              Clear Selection
                            </Button>
                          </div>
                        )}

                        {/* Add Button */}
                        <Button
                          onClick={handleAddProducts}
                          disabled={
                            selectedProducts.length === 0 || addProductMutation.isPending
                          }
                          className="w-full"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {addProductMutation.isPending
                            ? "Adding..."
                            : `Add ${selectedProducts.length} Product(s)`}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDeviceProducts ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading products...
                  </div>
                ) : !deviceProducts || deviceProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Grid3x3 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No products configured</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click "Add Products" to get started
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {deviceProducts.map((deviceProduct) => {
                      const product = allProducts?.find(
                        (p) => p.id === deviceProduct.productId
                      );
                      if (!product) return null;

                      return (
                        <Card key={deviceProduct.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-muted-foreground" />
                                <span className="font-medium">{product.name}</span>
                              </div>
                              {deviceProduct.isActive && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                            </div>

                            <div className="space-y-1 text-sm text-muted-foreground mb-3">
                              <p>Price: ${product.price.toFixed(2)}</p>
                              <p>SKU: {product.sku}</p>
                              <p>Display Order: {deviceProduct.displayOrder}</p>
                            </div>

                            <Separator className="my-2" />

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleRemoveProduct(product.id)}
                                disabled={removeProductMutation.isPending}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Remove
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!selectedDeviceId && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please select a merchant and device to configure products
            </AlertDescription>
          </Alert>
        )}
      </div>
    </DashboardLayout>
  );
}
