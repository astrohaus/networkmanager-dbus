import DBus = require("dbus");
import { BehaviorSubject } from "rxjs";
import { Observable } from "rxjs/internal/Observable";
import { AccessPoint } from "./dbus-types";
import { byteArrayToString, call, getAllProperties, getProperty, objectInterface, signal } from "./util";

type AccessPointMap = {
    [key: string]: AccessPoint
};

export class WifiDevice {

    private _bus: DBus.DBusConnection;
    private _devicePath: string;

    private _deviceInterface: DBus.DBusInterface;
    private _wifiDeviceInterface: DBus.DBusInterface;

    private _propertiesInterface: DBus.DBusInterface;
    private _properties: any;
    private _propertiesSubject: BehaviorSubject<any>;
    public properties$: Observable<any>;
    public get properties(): any {
        return this._properties;
    }

    private _accessPoints: AccessPointMap;
    private _accessPointsSubject: BehaviorSubject<AccessPoint[]>;
    public accessPoints$: Observable<AccessPoint[]>;
    public get accessPoints(): AccessPoint[] {
        return Object.values(this._accessPoints);
    }
    
    private constructor(
        bus: DBus.DBusConnection,
        devicePath: string,
        deviceInterface: DBus.DBusInterface,
        wifiDeviceInterface: DBus.DBusInterface,
        propertiesInterface: DBus.DBusInterface,
        initialProperties: any,
        initialAccessPoints: AccessPointMap
        ) {

            this._bus = bus;
            this._devicePath = devicePath;

            this._deviceInterface = deviceInterface;
            this._wifiDeviceInterface = wifiDeviceInterface;

            this._propertiesInterface = propertiesInterface;
            this._properties = initialProperties;
            this._propertiesSubject = new BehaviorSubject<any>(this._properties);
            this.properties$ = this._propertiesSubject.asObservable();

            this._accessPoints = initialAccessPoints;
            this._accessPointsSubject = new BehaviorSubject<AccessPoint[]>(Object.values(this._accessPoints));
            this.accessPoints$ = this._accessPointsSubject.asObservable();

            this._listenForPropertyChanges();
            this._listenForAccessPoints();
    }

    public static async init(bus: DBus.DBusConnection, devicePath: string): Promise<WifiDevice> {
        return new Promise<WifiDevice>(async (resolve, reject) => {
            try {
                let deviceInterface = await objectInterface(bus, devicePath, 'org.freedesktop.NetworkManager.Device');
                let wifiDeviceInterface = await objectInterface(bus, devicePath, 'org.freedesktop.NetworkManager.Device.Wireless');
                let propertiesInterface = await objectInterface(bus, devicePath, 'org.freedesktop.DBus.Properties');
                
                let deviceProperties = await getAllProperties(deviceInterface);
                let wifiDeviceProperties = await getAllProperties(wifiDeviceInterface);

                let initialProperties = {...deviceProperties, ...wifiDeviceProperties};

                let initialAccessPoints: AccessPointMap = {};
                const getAccessPointDataFromPaths = async () => {
                    for(let i = 0; i < wifiDeviceProperties.AccessPoints.length; i++) {
                        let accessPointPath = wifiDeviceProperties.AccessPoints[i];
                        let accessPointInterface = await objectInterface(bus, accessPointPath, "org.freedesktop.NetworkManager.AccessPoint");
                        let accessPointProperties = await getAllProperties(accessPointInterface);
                        accessPointProperties.Ssid = byteArrayToString(accessPointProperties.Ssid);
                        initialAccessPoints[accessPointPath] = accessPointProperties as unknown as AccessPoint;
                    }
                }

                await getAccessPointDataFromPaths();
        
                resolve(
                    new WifiDevice(
                        bus,
                        devicePath,
                        deviceInterface,
                        wifiDeviceInterface,
                        propertiesInterface,
                        initialProperties,
                        initialAccessPoints
                    )
                );
            } catch(error) {
                reject(`Error creating wifi device: ${error}`);
            }
        })
    }

    public async requestScan(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                await call(this._wifiDeviceInterface, "RequestScan", {});
                resolve();
            } catch(err) {
                reject(`Error requesting scan: ${err}`);
            }
        });
    }

    private _listenForPropertyChanges() {
        signal(this._propertiesInterface, "PropertiesChanged").subscribe(propertyChangeInfo => {
            let propertyChanges = propertyChangeInfo[1];
            Object.assign(this._properties, propertyChanges);
            this._propertiesSubject.next(this._properties);
        })
    }

    private _listenForAccessPoints() {
        signal(this._wifiDeviceInterface, "AccessPointAdded").subscribe(async accessPointPath => {
            try {
                let accessPointInterface = await objectInterface(this._bus, accessPointPath, "org.freedesktop.NetworkManager.AccessPoint");
                let accessPointProperties = await getAllProperties(accessPointInterface);
                accessPointProperties.Ssid = byteArrayToString(accessPointProperties.Ssid);
                this._accessPoints[accessPointPath] = accessPointProperties;
                this._accessPointsSubject.next(Object.values(this._accessPoints));
            } catch(_) {
                // sometimes the access points get added/removed too quickly to get data
                // if we can't get data for a particular access point, just ignore it
            }
            
        });

        signal(this._wifiDeviceInterface, "AccessPointRemoved").subscribe(async accessPointPath => {
            delete this._accessPoints[accessPointPath];
            this._accessPointsSubject.next(Object.values(this._accessPoints));
        });
    }

}