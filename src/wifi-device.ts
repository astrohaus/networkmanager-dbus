import DBus from "dbus";
import { BehaviorSubject } from "rxjs";
import { Observable } from "rxjs/internal/Observable";
import { AccessPoint } from "./dbus-types";
import { call, getAllProperties, getProperty, objectInterface, signal } from "./util";

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
    
    private constructor(
        bus: DBus.DBusConnection,
        devicePath: string,
        deviceInterface: DBus.DBusInterface,
        wifiDeviceInterface: DBus.DBusInterface,
        propertiesInterface: DBus.DBusInterface,
        initialProperties: any
        ) {

            this._bus = bus;
            this._devicePath = devicePath;

            this._deviceInterface = deviceInterface;
            this._wifiDeviceInterface = wifiDeviceInterface;

            this._propertiesInterface = propertiesInterface;
            this._properties = initialProperties;
            this._propertiesSubject = new BehaviorSubject<any>(this._properties);
            this.properties$ = this._propertiesSubject.asObservable();

            this._listenForDeviceStateChanges();
            this._listenForPropertyChanges();
    }

    public static async init(bus: DBus.DBusConnection, wifiDevicePath: string): Promise<WifiDevice> {
        return new Promise<WifiDevice>(async (resolve, reject) => {
            try {
                let deviceInterface = await objectInterface(bus, wifiDevicePath, 'org.freedesktop.NetworkManager.Device');
                let wifiDeviceInterface = await objectInterface(bus, wifiDevicePath, 'org.freedesktop.NetworkManager.Device.Wireless');
                let propertiesInterface = await objectInterface(bus, wifiDevicePath, 'org.freedesktop.DBus.Properties');
                
                let deviceProperties = await getAllProperties(deviceInterface);
                let wifiDeviceProperties = await getAllProperties(wifiDeviceInterface);

                let initialProperties = {...deviceProperties, ...wifiDeviceProperties};
        
                resolve(
                    new WifiDevice(
                        bus,
                        wifiDevicePath,
                        deviceInterface,
                        wifiDeviceInterface,
                        propertiesInterface,
                        initialProperties
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

    private _listenForDeviceStateChanges() {
        signal(this._deviceInterface, "StateChanged").subscribe(stateChange => {
            console.log("Wifi device changed state:");
            console.log(stateChange);
        })
    }




}