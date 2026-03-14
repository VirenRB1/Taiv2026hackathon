export interface Device {
    id: string;
    name: string;
    version: string;
    user_id: string;
    status: 'active' | 'inactive';
    location: {
        latitude: number;
        longitude: number;
    };
}

export class DeviceManager {
  private devices: Map<string, Device> = new Map();

    // constructor, gets called when a new instance of the class is created
    constructor() {
    }

    addDevice(device: Device): void {
      if (!device.id) {
            throw new Error('Device must have an id');
        }
        if (this.devices.has(device.id)) {
            throw new Error(`Device with id ${device.id} already exists`);
        }
        this.devices.set(device.id, { ...device });
    }

    removeDevice(id: string): void {
      if (!this.devices.has(id)) {
            throw new Error(`Device with id ${id} not found`);
        }
        this.devices.delete(id);
    }

    getDevice(id: string): Device | null {
      return this.devices.get(id) || null;
    }

    getDevicesByVersion(version: string): Device[] | null {
      return Array.from(this.devices.values()).filter(d => d.version === version);
    }

    getDevicesByUserId(user_id: string): Device[] | null {
      return Array.from(this.devices.values()).filter(d => d.user_id === user_id);
    }

    getDevicesByStatus(status: 'active' | 'inactive' | 'pending' | 'failed'): Device[] | null {
      return Array.from(this.devices.values()).filter(d => d.status === status);
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    getDevicesInArea(latitude: number, longitude: number, radius_km: number): Device[] | null {
      // returns all devices within a radius of the given latitude and longitude
      // the radius is in kilometers
      const results: Device[] = [];
        for (const device of this.devices.values()) {
            const dist = this.calculateDistance(
                latitude, 
                longitude, 
                device.location.latitude, 
                device.location.longitude
            );
            if (dist <= radius_km) {
                results.push(device);
            }
        }
        return results;
    }

    getDevicesNearDevice(device_id: string, radius_km: number): Device[] | null {
      // returns all devices within a radius of the given device (not including the device itself)
      // the radius is in kilometers
      const sourceDevice = this.devices.get(device_id);
        if (!sourceDevice) return null;

        const results: Device[] = [];
        for (const device of this.devices.values()) {
            if (device.id === device_id) continue; // Exclude self

            const dist = this.calculateDistance(
                sourceDevice.location.latitude,
                sourceDevice.location.longitude,
                device.location.latitude,
                device.location.longitude
            );

            if (dist <= radius_km) {
                results.push(device);
            }
        }
        return results;
    }

    getAllDevices(): Device[] {
        return Array.from(this.devices.values());
    }

    getDeviceCount(): number {
        return this.devices.size;
    }
}
