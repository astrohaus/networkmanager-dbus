import DBus from 'dbus-next';
import { BehaviorSubject } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { BaseDevice } from './base-device';
import { AccessPointProperties, ConnectionProfilePath, Properties, WifiDeviceProperties } from './dbus-types';
import { byteArrayToString, call, getAllProperties, int32ToByteArray, objectInterface, signal } from './util';

type AccessPointMap = {
    [key: string]: AccessPointProperties;
};

export class WifiDevice extends BaseDevice {
    private _wifiDeviceInterface: DBus.ClientInterface;

    private _propertiesInterface: DBus.ClientInterface;
    private _properties: WifiDeviceProperties;
    private _propertiesSubject: BehaviorSubject<WifiDeviceProperties>;

    /** Continuously updated wifi device properties */
    public properties$: Observable<WifiDeviceProperties>;
    /** Latest wifi device properties as a one-time value */
    public get properties(): any {
        return this._properties;
    }

    private _accessPoints: AccessPointMap;
    private _accessPointsSubject: BehaviorSubject<AccessPointMap>;

    /**
     * Continuously updated map of access points
     * Structured as a map where the key is the path of the access point
     * and the value is the access point data.
     * The Access Point path can be compared against the ActiveAccessPoint value of
     * WifiDevice properties to determine which Access Point is connected
     * */
    public accessPoints$: Observable<AccessPointMap>;
    /** Latest found access points as a one-time value */
    public get accessPoints(): AccessPointMap {
        return this._accessPoints;
    }

    private constructor(
        bus: DBus.MessageBus,
        devicePath: string,
        wifiDeviceInterface: DBus.ClientInterface,
        propertiesInterface: DBus.ClientInterface,
        initialProperties: any,
        initialAccessPoints: AccessPointMap,
    ) {
        super(bus, devicePath);

        this._wifiDeviceInterface = wifiDeviceInterface;

        this._propertiesInterface = propertiesInterface;
        this._properties = initialProperties;
        this._propertiesSubject = new BehaviorSubject<WifiDeviceProperties>(this._properties);
        this.properties$ = this._propertiesSubject.asObservable();

        this._accessPoints = initialAccessPoints;
        this._accessPointsSubject = new BehaviorSubject<AccessPointMap>(this._accessPoints);
        this.accessPoints$ = this._accessPointsSubject.asObservable();

        this._listenForPropertyChanges();
        this._listenForAccessPoints();
    }

    /**
     * Initializes a new WifiDevice
     * You should use networkManager.wifiDevice() unless you know what you're doing.
     * @param bus An instance of a DBus connection
     * @param devicePath The path of the wifi device DBus object
     * @returns Promise of a WifiDevice
     */
    public static async init(bus: DBus.MessageBus, devicePath: string): Promise<WifiDevice> {
        return new Promise<WifiDevice>(async (resolve, reject) => {
            try {
                let deviceInterface = await objectInterface(bus, devicePath, 'org.freedesktop.NetworkManager.Device');
                let wifiDeviceInterface = await objectInterface(
                    bus,
                    devicePath,
                    'org.freedesktop.NetworkManager.Device.Wireless',
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

                let wifiDeviceProperties = await getAllProperties(wifiDeviceInterface);

                let initialProperties = { ...deviceProperties, ...wifiDeviceProperties };

                let initialAccessPoints: AccessPointMap = {};
                const getAccessPointDataFromPaths = async () => {
                    const accessPoints = wifiDeviceProperties.AccessPoints.value;

                    for (let i = 0; i < accessPoints.length; i++) {
                        let accessPointPath = accessPoints[i];
                        let accessPointInterface = await objectInterface(
                            bus,
                            accessPointPath,
                            'org.freedesktop.NetworkManager.AccessPoint',
                        );
                        let accessPointProperties = await getAllProperties(accessPointInterface);
                        accessPointProperties.Ssid.value = byteArrayToString(accessPointProperties.Ssid.value);
                        initialAccessPoints[accessPointPath] = accessPointProperties as AccessPointProperties;
                    }
                };

                await getAccessPointDataFromPaths();

                resolve(
                    new WifiDevice(
                        bus,
                        devicePath,
                        wifiDeviceInterface,
                        propertiesInterface,
                        initialProperties,
                        initialAccessPoints,
                    ),
                );
            } catch (error) {
                reject(`Error creating wifi device: ${error}`);
            }
        });
    }

    /**
     * Ask the wifi device to start scanning.
     * Scanning is complete when the WifiDevice's LastScan property is updated
     */
    public async requestScan(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                await call(this._wifiDeviceInterface, 'RequestScan', {});
                resolve();
            } catch (err) {
                reject(`Error requesting scan: ${err}`);
            }
        });
    }

    /**
     * Activates a connection based on a connection profile path
     * @param connectionProfilePath The path to the connection profile to activate
     */
    public async activateConnection(connectionProfilePath: ConnectionProfilePath): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                let networkManagerInterface = await objectInterface(
                    this._bus,
                    '/org/freedesktop/NetworkManager',
                    'org.freedesktop.NetworkManager',
                );
                let activeConnectionPath = await call(
                    networkManagerInterface,
                    'ActivateConnection',
                    connectionProfilePath,
                    this.devicePath,
                    '/',
                );
                resolve(activeConnectionPath);
            } catch (err) {
                reject(err);
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

    private _listenForAccessPoints() {
        signal(this._wifiDeviceInterface, 'AccessPointAdded').subscribe(async (params: any[]) => {
            try {
                let apPath: string = params[0];
                let accessPointInterface = await objectInterface(
                    this._bus,
                    apPath,
                    'org.freedesktop.NetworkManager.AccessPoint',
                );
                let accessPointProperties = await getAllProperties(accessPointInterface);
                accessPointProperties.Ssid.value = byteArrayToString(accessPointProperties.Ssid.value);
                this._accessPoints[apPath] = accessPointProperties as AccessPointProperties;
                this._accessPointsSubject.next(this._accessPoints);
            } catch (_) {
                // If we can't find an access point's data, skip over it
            }
        });

        signal(this._wifiDeviceInterface, 'AccessPointRemoved').subscribe(async (params: any[]) => {
            let apPath = params[0];
            delete this._accessPoints[apPath];
            this._accessPointsSubject.next(this._accessPoints);
        });
    }
}
