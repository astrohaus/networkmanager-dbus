import DBus from 'dbus-next';
import { BaseDevice } from './base-device';
import { EthernetDeviceProperties } from './dbus-types';

/**
 * Manages an ethernet device
 */
export class EthernetDevice extends BaseDevice<EthernetDeviceProperties> {
    /**
     * The EthernetDevice class monitors and manages an ethernet device via DBus
     * It is best to initialize the EthernetDevice via the ethernetDevice() method of a NetworkManager instance
     *
     * @param bus The system dbus connection
     * @param devicePath The path to the ethernet device DBus object
     */
    public static async init(bus: DBus.MessageBus, devicePath: string): Promise<EthernetDevice> {
        try {
            const {
                concreteDeviceInterface: ethernetDeviceInterface,
                propertiesInterface,
                initialProperties,
            } = await BaseDevice._init(bus, devicePath, 'org.freedesktop.NetworkManager.Device.Wired');

            return new EthernetDevice(bus, devicePath, ethernetDeviceInterface, propertiesInterface, initialProperties);
        } catch (error) {
            throw `Error creating ethernet device: ${error}`;
        }
    }
}
