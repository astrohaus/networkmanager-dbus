import DBus from 'dbus-next';
import { BehaviorSubject } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { BaseDevice } from './base-device';
import {
    AccessPointProperties,
    ConnectionProfilePath,
    RawAccessPointProperties,
    WifiDeviceProperties,
} from './dbus-types';
import { byteArrayToString, call, getAllProperties, objectInterface, signal } from './util';

type AccessPointMap = {
    [key: string]: AccessPointProperties;
};

export class WifiDevice extends BaseDevice<WifiDeviceProperties> {
    private _wifiDeviceInterface: DBus.ClientInterface;

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
        deviceInterface: DBus.ClientInterface,
        wifiDeviceInterface: DBus.ClientInterface,
        propertiesInterface: DBus.ClientInterface,
        initialProperties: any,
        initialAccessPoints: AccessPointMap,
    ) {
        super(bus, devicePath, deviceInterface, propertiesInterface, initialProperties);

        this._wifiDeviceInterface = wifiDeviceInterface;

        this._accessPoints = initialAccessPoints;
        this._accessPointsSubject = new BehaviorSubject<AccessPointMap>(this._accessPoints);
        this.accessPoints$ = this._accessPointsSubject.asObservable();

        this._listenForAccessPoints();
    }

    /**
     * Initializes a new WifiDevice
     * You should use networkManager.wifiDevice() unless you know what you're doing.
     *
     * @param bus An instance of a DBus connection
     * @param devicePath The path of the wifi device DBus object
     * @returns Promise of a WifiDevice
     */
    public static async init(bus: DBus.MessageBus, devicePath: string): Promise<WifiDevice> {
        try {
            const {
                concreteDeviceInterface: wifiDeviceInterface,
                concreteDeviceProperties: wifiDeviceProperties,
                deviceInterface,
                propertiesInterface,
                initialProperties,
            } = await BaseDevice._init(bus, devicePath, 'org.freedesktop.NetworkManager.Device.Wireless');

            const initialAccessPoints: AccessPointMap = {};

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

            return new WifiDevice(
                bus,
                devicePath,
                deviceInterface,
                wifiDeviceInterface,
                propertiesInterface,
                initialProperties,
                initialAccessPoints,
            );
        } catch (error) {
            throw `Error creating wifi device: ${error}`;
        }
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

    private _listenForAccessPoints() {
        signal(this._wifiDeviceInterface, 'AccessPointAdded').subscribe(async (params: any[]) => {
            try {
                const apPath: string = params[0];
                const accessPointInterface = await objectInterface(
                    this._bus,
                    apPath,
                    'org.freedesktop.NetworkManager.AccessPoint',
                );
                const rawAccessPointProperties = await getAllProperties<RawAccessPointProperties>(accessPointInterface);
                const accessPointProperties: AccessPointProperties = {
                    ...rawAccessPointProperties,
                    Ssid: {
                        ...rawAccessPointProperties.Ssid,
                        value: byteArrayToString(rawAccessPointProperties.Ssid.value),
                    },
                };

                this._accessPoints = { ...this._accessPoints, [apPath]: accessPointProperties };
                this._accessPointsSubject.next(this._accessPoints);
            } catch (_) {
                // If we can't find an access point's data, skip over it
            }
        });

        signal(this._wifiDeviceInterface, 'AccessPointRemoved').subscribe(async (params: any[]) => {
            const apPath = params[0];
            const { [apPath]: deletedAp, ...filteredAccessPoints } = this._accessPoints;

            this._accessPoints = filteredAccessPoints;
            this._accessPointsSubject.next(this._accessPoints);
        });
    }
}
