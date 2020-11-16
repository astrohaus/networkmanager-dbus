import DBus = require("dbus");
import { BehaviorSubject } from "rxjs";
import { Observable } from "rxjs/internal/Observable";
import { AccessPoint, EthernetDeviceProperties } from "./dbus-types";
import { call, getAllProperties, getProperty, objectInterface, signal } from "./util";

type AccessPointMap = {
    [key: string]: AccessPoint
};

export class EthernetDevice {

    private _bus: DBus.DBusConnection;
    private _devicePath: string;

    private _deviceInterface: DBus.DBusInterface;
    private _ethernetDeviceInterface: DBus.DBusInterface;

    private _propertiesInterface: DBus.DBusInterface;
    private _properties: EthernetDeviceProperties;
    private _propertiesSubject: BehaviorSubject<EthernetDeviceProperties>;
    public properties$: Observable<EthernetDeviceProperties>;
    public get properties(): any {
        return this._properties;
    }
    
    private constructor(
        bus: DBus.DBusConnection,
        devicePath: string,
        deviceInterface: DBus.DBusInterface,
        ethernetDeviceInterface: DBus.DBusInterface,
        propertiesInterface: DBus.DBusInterface,
        initialProperties: any
        ) {

            this._bus = bus;
            this._devicePath = devicePath;

            this._deviceInterface = deviceInterface;
            this._ethernetDeviceInterface = ethernetDeviceInterface;

            this._propertiesInterface = propertiesInterface;
            this._properties = initialProperties;
            this._propertiesSubject = new BehaviorSubject<any>(this._properties);
            this.properties$ = this._propertiesSubject.asObservable();

            this._listenForPropertyChanges();
    }

    public static async init(bus: DBus.DBusConnection, devicePath: string): Promise<EthernetDevice> {
        return new Promise<EthernetDevice>(async (resolve, reject) => {
            try {
                let deviceInterface = await objectInterface(bus, devicePath, 'org.freedesktop.NetworkManager.Device');
                let ethernetDeviceInterface = await objectInterface(bus, devicePath, 'org.freedesktop.NetworkManager.Device.Wired');
                let propertiesInterface = await objectInterface(bus, devicePath, 'org.freedesktop.DBus.Properties');
                
                let deviceProperties = await getAllProperties(deviceInterface);
                let ethernetDeviceProperties = await getAllProperties(ethernetDeviceInterface);

                let initialProperties = {...deviceProperties, ...ethernetDeviceProperties};
        
                resolve(
                    new EthernetDevice(
                        bus,
                        devicePath,
                        deviceInterface,
                        ethernetDeviceInterface,
                        propertiesInterface,
                        initialProperties
                    )
                );
            } catch(error) {
                reject(`Error creating wifi device: ${error}`);
            }
        })
    }

    private _listenForPropertyChanges() {
        signal(this._propertiesInterface, "PropertiesChanged").subscribe((propertyChangeInfo: any[]) => {
            let propertyChanges = propertyChangeInfo[1];
            Object.assign(this._properties, propertyChanges);
            this._propertiesSubject.next(this._properties);
        })
    }

}