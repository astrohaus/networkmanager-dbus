import DBus from 'dbus-next';
import { BehaviorSubject } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { EthernetDeviceProperties, Properties } from './dbus-types';
import { getAllProperties, int32ToByteArray, objectInterface, signal } from './util';

/**
 * Manages an ethernet device
 */
export class EthernetDevice {
    private _propertiesInterface: DBus.ClientInterface;
    private _properties: EthernetDeviceProperties;
    private _propertiesSubject: BehaviorSubject<EthernetDeviceProperties>;

    /** Continuously updated properties of the ethernet device */
    public properties$: Observable<EthernetDeviceProperties>;

    /** Get a one-time value of the latest ethernet device properties */
    public get properties(): any {
        return this._properties;
    }

    private constructor(propertiesInterface: DBus.ClientInterface, initialProperties: any) {
        this._propertiesInterface = propertiesInterface;
        this._properties = initialProperties;
        this._propertiesSubject = new BehaviorSubject<any>(this._properties);
        this.properties$ = this._propertiesSubject.asObservable();

        this._listenForPropertyChanges();
    }

    /**
     * The EthernetDevice class monitors and manages an ethernet device via DBus
     * It is best to initialize the EthernetDevice via the ethernetDevice() method of a NetworkManager instance
     * @constructor
     * @param bus The system dbus connection
     * @param devicePath The path to the ethernet device DBus object
     */
    public static async init(bus: DBus.MessageBus, devicePath: string): Promise<EthernetDevice> {
        return new Promise<EthernetDevice>(async (resolve, reject) => {
            try {
                let deviceInterface = await objectInterface(bus, devicePath, 'org.freedesktop.NetworkManager.Device');
                let ethernetDeviceInterface = await objectInterface(
                    bus,
                    devicePath,
                    'org.freedesktop.NetworkManager.Device.Wired',
                );
                let propertiesInterface = await objectInterface(bus, devicePath, 'org.freedesktop.DBus.Properties');

                let deviceProperties = await getAllProperties(deviceInterface);
                if (deviceProperties.Ip4Address.value === 0) {
                    deviceProperties.Ip4Address.value = null;
                } else {
                    let ipInteger = deviceProperties.Ip4Address.value;
                    let byteArray = int32ToByteArray(ipInteger);
                    deviceProperties.Ip4Address.value = byteArray.reverse().join('.');
                }
                let ethernetDeviceProperties = await getAllProperties(ethernetDeviceInterface);

                let initialProperties = { ...deviceProperties, ...ethernetDeviceProperties };

                resolve(new EthernetDevice(propertiesInterface, initialProperties));
            } catch (error) {
                reject(`Error creating wifi device: ${error}`);
            }
        });
    }

    private _listenForPropertyChanges() {
        signal(this._propertiesInterface, 'PropertiesChanged').subscribe((propertyChangeInfo: Array<Properties>) => {
            let propertyChanges = propertyChangeInfo[1];
            if (propertyChanges.Ip4Address) {
                if (propertyChanges.Ip4Address.value === 0) {
                    propertyChanges.Ip4Address.value = null;
                } else {
                    let ipInteger = propertyChanges.Ip4Address.value;
                    let byteArray = int32ToByteArray(ipInteger);
                    propertyChanges.Ip4Address.value = byteArray.reverse().join('.');
                }
            }

            Object.assign(this._properties, propertyChanges);
            this._propertiesSubject.next(this._properties);
        });
    }
}
