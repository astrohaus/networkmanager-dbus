import DBus from "dbus";
import { BehaviorSubject, Observable } from "rxjs";
import { DeviceType } from "./dbus-types";
import { call, getAllProperties, objectInterface, signal } from "./util";
import { WifiDevice } from "./wifi-device";

export class NetworkManager {

    private static _bus: DBus.DBusConnection = DBus.getBus('system');

    private _networkManagerInterface: DBus.DBusInterface;

    private _propertiesInterface: DBus.DBusInterface;
    private _properties: any;
    private _propertiesSubject: BehaviorSubject<any>;
    public properties$: Observable<any>;
    public get properties(): any {
        return this._properties;
    }

    private constructor(
        networkManagerInterface: DBus.DBusInterface,
        propertiesInterface: DBus.DBusInterface,
        initialProperties: any
        ) {
        
            this._networkManagerInterface = networkManagerInterface;

            this._propertiesInterface = propertiesInterface;
            this._properties = initialProperties;
            this._propertiesSubject = new BehaviorSubject<any>(this._properties);
            this.properties$ = this._propertiesSubject.asObservable();

            this._listenForPropertyChanges();
    }

    public static async init(): Promise<NetworkManager> {
        return new Promise<NetworkManager>(async (resolve, reject) => {
            try {
                let networkManagerInterface = await objectInterface(this._bus, '/org/freedesktop/NetworkManager', 'org.freedesktop.NetworkManager');
                let propertiesInterface = await objectInterface(this._bus, '/org/freedesktop/NetworkManager', 'org.freedesktop.DBus.Properties');

                let initialProperties = await getAllProperties(networkManagerInterface);

                resolve(
                    new NetworkManager(
                        networkManagerInterface, 
                        propertiesInterface,
                        initialProperties
                    )
                    );
            } catch(err) {
                reject(`Error initializing network manager: ${err}`);
            }
        });
    }

    public wifiDevice(): Promise<WifiDevice> {
        return new Promise<WifiDevice>(async (resolve, reject) => {
            try {
                let allDevicePaths: string[] = await call(this._networkManagerInterface, "GetAllDevices", {}); // can replace with "GetDeviceByIpIface"
                const forLoop = async () => {
                    for(let i = 0; i < allDevicePaths.length; i++) {
                        let device = await objectInterface(NetworkManager._bus, allDevicePaths[i], 'org.freedesktop.NetworkManager.Device');
                        let properties = await getAllProperties(device);
                        
                        if(properties.DeviceType === DeviceType.WIFI) {
                            let wifiDevice = await WifiDevice.init(NetworkManager._bus, allDevicePaths[i]);
                            resolve(wifiDevice);
                            return;
                        }
                    }
                }
    
                await forLoop();
                reject(`No wifi device`);
            } catch(err) {
                reject(err);
            }
            
        })
    }

    private _listenForPropertyChanges() {
        signal(this._propertiesInterface, "PropertiesChanged").subscribe(propertyChangeInfo => {
            let changedProperties = propertyChangeInfo[1];
            Object.assign(this._properties, changedProperties);
            this._propertiesSubject.next(this._properties);
        })
    }

}