/**
 * Device Configuration Panel
 * 
 * Provides UI for:
 * - Managing device-product associations
 * - Configuring device zones/areas
 * - Drag-and-drop product arrangement
 * - Device layout customization
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Grid3X3,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  DragDropIcon,
  Settings,
  Layout,
} from 'lucide-react';

interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl?: string;
}

interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  productIds: number[];
  displayMode: 'grid' | 'carousel' | 'list';
}

interface DeviceConfigurationPanelProps {
  deviceId: number;
  availableProducts: Product[];
  onSave?: (config: any) => void;
}

export function DeviceConfigurationPanel({
  deviceId,
  availableProducts,
  onSave,
}: DeviceConfigurationPanelProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [isEditingZone, setIsEditingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [gridColumns, setGridColumns] = useState(3);
  const [gridRows, setGridRows] = useState(2);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Create new zone
  const handleCreateZone = useCallback(() => {
    if (!newZoneName.trim()) return;

    const newZone: Zone = {
      id: `zone_${Date.now()}`,
      name: newZoneName,
      x: 0,
      y: 0,
      width: 33,
      height: 50,
      productIds: [],
      displayMode: 'grid',
    };

    setZones([...zones, newZone]);
    setNewZoneName('');
  }, [newZoneName, zones]);

  // Update zone
  const handleUpdateZone = useCallback(
    (zoneId: string, updates: Partial<Zone>) => {
      setZones(
        zones.map(z =>
          z.id === zoneId ? { ...z, ...updates } : z
        )
      );
    },
    [zones]
  );

  // Delete zone
  const handleDeleteZone = useCallback((zoneId: string) => {
    setZones(zones.filter(z => z.id !== zoneId));
    if (selectedZone === zoneId) {
      setSelectedZone(null);
    }
  }, [zones, selectedZone]);

  // Add product to zone
  const handleAddProductToZone = useCallback(
    (productId: number) => {
      if (!selectedZone) return;

      setZones(
        zones.map(z => {
          if (z.id === selectedZone && !z.productIds.includes(productId)) {
            return { ...z, productIds: [...z.productIds, productId] };
          }
          return z;
        })
      );
    },
    [zones, selectedZone]
  );

  // Remove product from zone
  const handleRemoveProductFromZone = useCallback(
    (productId: number) => {
      if (!selectedZone) return;

      setZones(
        zones.map(z => {
          if (z.id === selectedZone) {
            return {
              ...z,
              productIds: z.productIds.filter(id => id !== productId),
            };
          }
          return z;
        })
      );
    },
    [zones, selectedZone]
  );

  // Save configuration
  const handleSave = useCallback(() => {
    const config = {
      deviceId,
      zones,
      gridColumns,
      gridRows,
      backgroundColor,
      theme,
    };

    onSave?.(config);
  }, [deviceId, zones, gridColumns, gridRows, backgroundColor, theme, onSave]);

  const selectedZoneData = zones.find(z => z.id === selectedZone);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="zones" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>

        {/* Zones Tab */}
        <TabsContent value="zones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid3X3 className="w-5 h-5" />
                Device Zones
              </CardTitle>
              <CardDescription>
                Create zones to organize products on your device display
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Create new zone */}
              <div className="flex gap-2">
                <Input
                  placeholder="Zone name (e.g., Top Left, Center)"
                  value={newZoneName}
                  onChange={e => setNewZoneName(e.target.value)}
                />
                <Button onClick={handleCreateZone}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Zone
                </Button>
              </div>

              {/* Zone list */}
              <div className="space-y-2">
                {zones.map(zone => (
                  <div
                    key={zone.id}
                    className={`p-3 border rounded-lg cursor-pointer transition ${
                      selectedZone === zone.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedZone(zone.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{zone.name}</h4>
                        <p className="text-sm text-gray-600">
                          Position: ({zone.x}%, {zone.y}%) | Size: {zone.width}% × {zone.height}%
                        </p>
                        <p className="text-sm text-gray-600">
                          Products: {zone.productIds.length} | Mode: {zone.displayMode}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteZone(zone.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Zone editor */}
              {selectedZoneData && (
                <Card className="bg-gray-50">
                  <CardHeader>
                    <CardTitle className="text-base">Edit Zone: {selectedZoneData.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">X Position (%)</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedZoneData.x}
                          onChange={e =>
                            handleUpdateZone(selectedZone!, {
                              x: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Y Position (%)</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedZoneData.y}
                          onChange={e =>
                            handleUpdateZone(selectedZone!, {
                              y: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Width (%)</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedZoneData.width}
                          onChange={e =>
                            handleUpdateZone(selectedZone!, {
                              width: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Height (%)</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedZoneData.height}
                          onChange={e =>
                            handleUpdateZone(selectedZone!, {
                              height: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Display Mode</label>
                      <select
                        className="w-full px-3 py-2 border rounded-md"
                        value={selectedZoneData.displayMode}
                        onChange={e =>
                          handleUpdateZone(selectedZone!, {
                            displayMode: e.target.value as any,
                          })
                        }
                      >
                        <option value="grid">Grid</option>
                        <option value="carousel">Carousel</option>
                        <option value="list">List</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DragDropIcon className="w-5 h-5" />
                Zone Products
              </CardTitle>
              <CardDescription>
                {selectedZoneData
                  ? `Manage products in zone: ${selectedZoneData.name}`
                  : 'Select a zone to manage its products'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedZoneData ? (
                <Alert>
                  <AlertDescription>Please select a zone from the Zones tab</AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* Available products */}
                  <div>
                    <h4 className="font-medium mb-2">Available Products</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {availableProducts
                        .filter(p => !selectedZoneData.productIds.includes(p.id))
                        .map(product => (
                          <Button
                            key={product.id}
                            variant="outline"
                            className="justify-start"
                            onClick={() => handleAddProductToZone(product.id)}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            {product.name}
                          </Button>
                        ))}
                    </div>
                  </div>

                  {/* Selected products */}
                  <div>
                    <h4 className="font-medium mb-2">Products in Zone ({selectedZoneData.productIds.length})</h4>
                    <div className="space-y-2">
                      {selectedZoneData.productIds.map(productId => {
                        const product = availableProducts.find(p => p.id === productId);
                        return (
                          <div
                            key={productId}
                            className="flex items-center justify-between p-2 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{product?.name}</p>
                              <p className="text-sm text-gray-600">${product?.price}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveProductFromZone(productId)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layout Tab */}
        <TabsContent value="layout" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="w-5 h-5" />
                Device Layout
              </CardTitle>
              <CardDescription>Customize the overall device display layout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Grid Columns</label>
                  <Input
                    type="number"
                    min="1"
                    max="6"
                    value={gridColumns}
                    onChange={e => setGridColumns(parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Grid Rows</label>
                  <Input
                    type="number"
                    min="1"
                    max="6"
                    value={gridRows}
                    onChange={e => setGridRows(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Background Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={e => setBackgroundColor(e.target.value)}
                    className="w-12 h-10 rounded border"
                  />
                  <Input
                    value={backgroundColor}
                    onChange={e => setBackgroundColor(e.target.value)}
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Theme</label>
                <div className="flex gap-2">
                  {(['light', 'dark'] as const).map(t => (
                    <Button
                      key={t}
                      variant={theme === t ? 'default' : 'outline'}
                      onClick={() => setTheme(t)}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                  gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                  gap: '8px',
                  minHeight: '300px',
                }}
              >
                {zones.map(zone => (
                  <div
                    key={zone.id}
                    className={`border-2 border-dashed rounded-lg p-2 flex items-center justify-center text-sm font-medium ${
                      theme === 'dark' ? 'text-white border-gray-600' : 'text-gray-700 border-gray-400'
                    }`}
                    style={{
                      gridColumn: `span ${Math.ceil((zone.width / 100) * gridColumns)}`,
                      gridRow: `span ${Math.ceil((zone.height / 100) * gridRows)}`,
                    }}
                  >
                    {zone.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save button */}
      <Button onClick={handleSave} size="lg" className="w-full">
        <Save className="w-4 h-4 mr-2" />
        Save Configuration
      </Button>
    </div>
  );
}
