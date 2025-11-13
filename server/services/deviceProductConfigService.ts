/**
 * Device-Product Configuration Service
 * 
 * Handles:
 * - Device-product associations
 * - Product display configuration
 * - Device layout management
 * - Zone/area configuration
 */

import { db } from '../_core/db';
import { deviceProducts, products, devices } from '../_core/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Device zone/area configuration
 */
export interface DeviceZone {
  id: string;
  deviceId: number;
  name: string;
  x: number; // X coordinate (0-100%)
  y: number; // Y coordinate (0-100%)
  width: number; // Width (0-100%)
  height: number; // Height (0-100%)
  productIds: number[];
  displayMode: 'grid' | 'carousel' | 'list';
  itemsPerRow?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Device product configuration
 */
export interface DeviceProductConfig {
  id: number;
  deviceId: number;
  productId: number;
  displayOrder: number;
  isActive: boolean;
  zoneId?: string;
  imageUrl?: string;
  customName?: string;
  customPrice?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Device layout configuration
 */
export interface DeviceLayout {
  deviceId: number;
  zones: DeviceZone[];
  gridColumns?: number;
  gridRows?: number;
  backgroundColor?: string;
  theme?: 'light' | 'dark';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory storage for zones (use database in production)
 */
const deviceZones = new Map<string, DeviceZone>();
const deviceLayouts = new Map<number, DeviceLayout>();

/**
 * Add product to device
 */
export async function addProductToDevice(
  deviceId: number,
  productId: number,
  displayOrder: number = 0,
  zoneId?: string
): Promise<DeviceProductConfig> {
  try {
    // Verify device exists
    const device = await db.query.devices.findFirst({
      where: eq(devices.id, deviceId),
    });
    
    if (!device) {
      throw new Error('Device not found');
    }
    
    // Verify product exists
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Create association
    const result = await db.insert(deviceProducts).values({
      deviceId,
      productId,
      displayOrder,
      isActive: 1,
    }).returning();
    
    const config = result[0];
    
    return {
      id: config.id,
      deviceId: config.deviceId,
      productId: config.productId,
      displayOrder: config.displayOrder,
      isActive: config.isActive === 1,
      zoneId,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to add product:', error);
    throw error;
  }
}

/**
 * Remove product from device
 */
export async function removeProductFromDevice(
  deviceId: number,
  productId: number
): Promise<boolean> {
  try {
    await db.delete(deviceProducts)
      .where(and(
        eq(deviceProducts.deviceId, deviceId),
        eq(deviceProducts.productId, productId)
      ));
    
    return true;
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to remove product:', error);
    throw error;
  }
}

/**
 * Get device products
 */
export async function getDeviceProducts(deviceId: number): Promise<DeviceProductConfig[]> {
  try {
    const configs = await db.query.deviceProducts.findMany({
      where: eq(deviceProducts.deviceId, deviceId),
    });
    
    return configs.map(config => ({
      id: config.id,
      deviceId: config.deviceId,
      productId: config.productId,
      displayOrder: config.displayOrder,
      isActive: config.isActive === 1,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to get products:', error);
    throw error;
  }
}

/**
 * Update product display order
 */
export async function updateProductDisplayOrder(
  deviceId: number,
  productId: number,
  displayOrder: number
): Promise<DeviceProductConfig | null> {
  try {
    await db.update(deviceProducts)
      .set({ displayOrder })
      .where(and(
        eq(deviceProducts.deviceId, deviceId),
        eq(deviceProducts.productId, productId)
      ));
    
    const result = await db.query.deviceProducts.findFirst({
      where: and(
        eq(deviceProducts.deviceId, deviceId),
        eq(deviceProducts.productId, productId)
      ),
    });
    
    if (!result) {
      return null;
    }
    
    return {
      id: result.id,
      deviceId: result.deviceId,
      productId: result.productId,
      displayOrder: result.displayOrder,
      isActive: result.isActive === 1,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to update order:', error);
    throw error;
  }
}

/**
 * Create device zone
 */
export async function createDeviceZone(
  deviceId: number,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  displayMode: 'grid' | 'carousel' | 'list' = 'grid'
): Promise<DeviceZone> {
  try {
    const id = `zone_${nanoid()}`;
    
    const zone: DeviceZone = {
      id,
      deviceId,
      name,
      x,
      y,
      width,
      height,
      productIds: [],
      displayMode,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    deviceZones.set(id, zone);
    
    return zone;
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to create zone:', error);
    throw error;
  }
}

/**
 * Get device zones
 */
export async function getDeviceZones(deviceId: number): Promise<DeviceZone[]> {
  try {
    const zones: DeviceZone[] = [];
    
    for (const [, zone] of deviceZones) {
      if (zone.deviceId === deviceId) {
        zones.push(zone);
      }
    }
    
    return zones.sort((a, b) => a.y - b.y || a.x - b.x);
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to get zones:', error);
    throw error;
  }
}

/**
 * Update zone
 */
export async function updateDeviceZone(
  zoneId: string,
  updates: Partial<DeviceZone>
): Promise<DeviceZone | null> {
  try {
    const zone = deviceZones.get(zoneId);
    
    if (!zone) {
      return null;
    }
    
    if (updates.name !== undefined) {
      zone.name = updates.name;
    }
    
    if (updates.x !== undefined) {
      zone.x = updates.x;
    }
    
    if (updates.y !== undefined) {
      zone.y = updates.y;
    }
    
    if (updates.width !== undefined) {
      zone.width = updates.width;
    }
    
    if (updates.height !== undefined) {
      zone.height = updates.height;
    }
    
    if (updates.displayMode !== undefined) {
      zone.displayMode = updates.displayMode;
    }
    
    if (updates.itemsPerRow !== undefined) {
      zone.itemsPerRow = updates.itemsPerRow;
    }
    
    zone.updatedAt = new Date();
    
    return zone;
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to update zone:', error);
    throw error;
  }
}

/**
 * Delete device zone
 */
export async function deleteDeviceZone(zoneId: string): Promise<boolean> {
  try {
    return deviceZones.delete(zoneId);
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to delete zone:', error);
    throw error;
  }
}

/**
 * Add product to zone
 */
export async function addProductToZone(
  zoneId: string,
  productId: number
): Promise<DeviceZone | null> {
  try {
    const zone = deviceZones.get(zoneId);
    
    if (!zone) {
      return null;
    }
    
    if (!zone.productIds.includes(productId)) {
      zone.productIds.push(productId);
      zone.updatedAt = new Date();
    }
    
    return zone;
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to add product to zone:', error);
    throw error;
  }
}

/**
 * Remove product from zone
 */
export async function removeProductFromZone(
  zoneId: string,
  productId: number
): Promise<DeviceZone | null> {
  try {
    const zone = deviceZones.get(zoneId);
    
    if (!zone) {
      return null;
    }
    
    const index = zone.productIds.indexOf(productId);
    
    if (index !== -1) {
      zone.productIds.splice(index, 1);
      zone.updatedAt = new Date();
    }
    
    return zone;
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to remove product from zone:', error);
    throw error;
  }
}

/**
 * Get or create device layout
 */
export async function getDeviceLayout(deviceId: number): Promise<DeviceLayout> {
  try {
    let layout = deviceLayouts.get(deviceId);
    
    if (!layout) {
      const zones = await getDeviceZones(deviceId);
      
      layout = {
        deviceId,
        zones,
        gridColumns: 3,
        gridRows: 2,
        backgroundColor: '#ffffff',
        theme: 'light',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      deviceLayouts.set(deviceId, layout);
    }
    
    return layout;
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to get layout:', error);
    throw error;
  }
}

/**
 * Update device layout
 */
export async function updateDeviceLayout(
  deviceId: number,
  updates: Partial<DeviceLayout>
): Promise<DeviceLayout> {
  try {
    let layout = deviceLayouts.get(deviceId);
    
    if (!layout) {
      layout = await getDeviceLayout(deviceId);
    }
    
    if (updates.gridColumns !== undefined) {
      layout.gridColumns = updates.gridColumns;
    }
    
    if (updates.gridRows !== undefined) {
      layout.gridRows = updates.gridRows;
    }
    
    if (updates.backgroundColor !== undefined) {
      layout.backgroundColor = updates.backgroundColor;
    }
    
    if (updates.theme !== undefined) {
      layout.theme = updates.theme;
    }
    
    layout.updatedAt = new Date();
    
    return layout;
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to update layout:', error);
    throw error;
  }
}

/**
 * Get device configuration summary
 */
export async function getDeviceConfigurationSummary(deviceId: number): Promise<{
  deviceId: number;
  totalProducts: number;
  totalZones: number;
  layout: DeviceLayout;
  products: DeviceProductConfig[];
}> {
  try {
    const products = await getDeviceProducts(deviceId);
    const zones = await getDeviceZones(deviceId);
    const layout = await getDeviceLayout(deviceId);
    
    return {
      deviceId,
      totalProducts: products.length,
      totalZones: zones.length,
      layout,
      products,
    };
  } catch (error) {
    console.error('[DeviceProductConfig] Failed to get summary:', error);
    throw error;
  }
}
