import DBus from '@astrohaus/dbus-next';
import { BehaviorSubject, Observable } from 'rxjs';
import { DeviceProperties, Ip4ConfigProperties, RawDeviceProperties } from './dbus-types';
import { Signaler } from './signaler';
import { call, formatIp4Address, getAllProperties, objectInterface } from './util';

/**
 * Abstract class for all NetworkManager devices.
 */
export abstract class BaseDevice<TProperties extends DeviceProperties = DeviceProperties> extends Signaler {
    protected _bus: DBus.MessageBus;

    protected _propertiesInterface: DBus.ClientInterface;
    protected _properties: TProperties;
    protected _propertiesSubject: BehaviorSubject<TProperties>;
    public properties$: Observable<TProperties>;

    protected _deviceInterface: DBus.ClientInterface;
    public devicePath: string;

    constructor(
        bus: DBus.MessageBus,
        devicePath: string,
        deviceInterface: DBus.ClientInterface,
        propertiesInterface: DBus.ClientInterface,
        initialProperties: any,
    ) {
        super();

        this._bus = bus;

        this.devicePath = devicePath;
        this._deviceInterface = deviceInterface;

        this._propertiesInterface = propertiesInterface;
        this._properties = initialProperties;
        this._propertiesSubject = new BehaviorSubject<any>(this._properties);
        this.properties$ = this._propertiesSubject.asObservable();

        this._listenForPropertyChanges();
    }

    protected static async _init(bus: DBus.MessageBus, devicePath: string, deviceInterfaceName: string) {
        const deviceInterface = await objectInterface(bus, devicePath, 'org.freedesktop.NetworkManager.Device');
        const concreteDeviceInterface = await objectInterface(bus, devicePath, deviceInterfaceName);
        const propertiesInterface = await objectInterface(bus, devicePath, 'org.freedesktop.DBus.Properties');

        const deviceProperties = await getAllProperties(deviceInterface);
        deviceProperties.Ip4Address.value = formatIp4Address(deviceProperties.Ip4Address.value);

        const concreteDeviceProperties = await getAllProperties(concreteDeviceInterface);

        const initialProperties = { ...deviceProperties, ...concreteDeviceProperties };

        return {
            deviceInterface,
            concreteDeviceInterface,
            propertiesInterface,
            deviceProperties,
            concreteDeviceProperties,
            initialProperties,
        };
    }

    public get properties() {
        return this._properties;
    }

    /**
     * Disconnects a device and prevents the device from automatically activating further connections without user intervention.
     */
    public async disconnect(): Promise<void> {
        return await call(this._deviceInterface, 'Disconnect');
    }

    /**
     * Gets all IP4Config properties.
     */
    public async getIp4ConfigProperties(): Promise<Ip4ConfigProperties | undefined> {
        const ipConfigPath = this.properties.Ip4Config && this.properties.Ip4Config.value;

        if (!ipConfigPath) {
            return;
        }

        const ipConfigInterface = await objectInterface(
            this._bus,
            ipConfigPath,
            'org.freedesktop.NetworkManager.IP4Config',
        );

        const ipConfigProperties = await getAllProperties<Ip4ConfigProperties>(ipConfigInterface);

        return ipConfigProperties;
    }

    private _listenForPropertyChanges() {
        this.listenSignal<Partial<RawDeviceProperties>[]>(
            this._propertiesInterface,
            'PropertiesChanged',
            (propertyChangeInfo) => {
                const { Ip4Address: changedIpAddress, ...propertyChanges } = propertyChangeInfo[1];

                if (changedIpAddress) {
                    propertyChanges.Ip4Address = {
                        ...changedIpAddress,
                        value: formatIp4Address(changedIpAddress.value),
                    };
                }

                this._properties = { ...this._properties, ...propertyChanges };
                this._propertiesSubject.next(this._properties);
            },
        );
    }
}
