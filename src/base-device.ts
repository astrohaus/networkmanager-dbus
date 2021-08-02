import DBus from 'dbus-next';

/**
 * Abstract class for all NetworkManager devices.
 */
export abstract class BaseDevice {
    protected _bus: DBus.MessageBus;

    public devicePath: string;

    constructor(bus: DBus.MessageBus, devicePath: string) {
        this._bus = bus;
        this.devicePath = devicePath;
    }
}
