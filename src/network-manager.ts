import DBus = require("dbus");
import { BehaviorSubject, Observable, Subscribable, Subscription } from "rxjs";
import { ConnectionSettingsManager } from "./connection-settings-manager";
import { DeviceType, NetworkManagerProperties, NetworkManagerState } from "./dbus-types";
import { EthernetDevice } from "./ethernet-device";
import { call, getAllProperties, objectInterface, signal } from "./util";
import { WifiDevice } from "./wifi-device";

export class NetworkManager {

    private static _networkManagerSingleton: NetworkManager;
    private static _bus: DBus.DBusConnection = DBus.getBus('system');

    private _networkManagerInterface: DBus.DBusInterface;

    private _propertiesInterface: DBus.DBusInterface;
    private _properties: NetworkManagerProperties;
    private _propertiesSubject: BehaviorSubject<NetworkManagerProperties>;
    public properties$: Observable<NetworkManagerProperties>;
    public get properties(): NetworkManagerProperties {
        return this._properties;
    }

    private _activatingConnectionSubscription: Subscription | null = null;

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

            if(initialProperties.ActivatingConnection) {
                this._listenToActivatingConnection(initialProperties.ActivatingConnection);
            }
    }

    public static async init(): Promise<NetworkManager> {
        return new Promise<NetworkManager>(async (resolve, reject) => {
            if(NetworkManager._networkManagerSingleton) {
                resolve(NetworkManager._networkManagerSingleton);
            } else {
                try {
                    let networkManagerInterface = await objectInterface(this._bus, '/org/freedesktop/NetworkManager', 'org.freedesktop.NetworkManager');

                    let propertiesInterface = await objectInterface(this._bus, '/org/freedesktop/NetworkManager', 'org.freedesktop.DBus.Properties');
                    let initialProperties = await getAllProperties(networkManagerInterface);

                    if(initialProperties.ActivatingConnection === "/") {
                        initialProperties.ActivatingConnection = null;
                    } else {
                        let activeConnectionInterface = await objectInterface(NetworkManager._bus, initialProperties.ActivatingConnection, "org.freedesktop.NetworkManager.Connection.Active");
                        initialProperties.ActivatingConnection = await getAllProperties(activeConnectionInterface);
                    }

                    let networkManager = new NetworkManager(
                        networkManagerInterface, 
                        propertiesInterface,
                        initialProperties
                    );

                    NetworkManager._networkManagerSingleton = networkManager;
    
                    resolve(networkManager);
                } catch(err) {
                    reject(`Error initializing network manager: ${err}`);
                }
            }
        });
    }

    public wifiDevice(): Promise<WifiDevice> {
        return new Promise<WifiDevice>(async (resolve, reject) => {
            try {
                let allDevicePaths: string[] = await call(this._networkManagerInterface, "GetAllDevices", {});
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

    public ethernetDevice(): Promise<EthernetDevice> {
        return new Promise<EthernetDevice>(async (resolve, reject) => {
            try {
                let allDevicePaths: string[] = await call(this._networkManagerInterface, "GetAllDevices", {});
                const forLoop = async () => {
                    for(let i = 0; i < allDevicePaths.length; i++) {
                        let device = await objectInterface(NetworkManager._bus, allDevicePaths[i], 'org.freedesktop.NetworkManager.Device');
                        let properties = await getAllProperties(device);
                        
                        if(properties.DeviceType === DeviceType.ETHERNET) {
                            let ethernetDevice = await EthernetDevice.init(NetworkManager._bus, allDevicePaths[i]);
                            resolve(ethernetDevice);
                            return;
                        }
                    }
                }
    
                await forLoop();
                reject(`No ethernet device`);
            } catch(err) {
                reject(err);
            }
            
        })
    }

    public connectionSettingsManager(): Promise<ConnectionSettingsManager> {
        return new Promise<ConnectionSettingsManager>(async (resolve, reject) => {
            try {
                let connectionSettingsManager = await ConnectionSettingsManager.init(NetworkManager._bus);
                resolve(connectionSettingsManager);
            } catch(err) {
                reject(err);
            }
        });
    }

    private _listenForPropertyChanges() {
        signal(this._propertiesInterface, "PropertiesChanged").subscribe(async (propertyChangeInfo: any[]) => {
            let changedProperties: Partial<NetworkManagerProperties> = propertyChangeInfo[1];
            if(changedProperties.ActivatingConnection && changedProperties.ActivatingConnection !== this._properties.ActivatingConnection) {
                if(changedProperties.ActivatingConnection === "/") {
                    this._stopListeningToActivatingConnection();
                    changedProperties.ActivatingConnection = null;
                } else {
                    try {
                        this._listenToActivatingConnection(changedProperties.ActivatingConnection as string);
                        let activatingConnectionInterface = await objectInterface(NetworkManager._bus, changedProperties.ActivatingConnection, 'org.freedesktop.NetworkManager.Connection.Active');
                        changedProperties.ActivatingConnection = await getAllProperties(activatingConnectionInterface);
                    } catch(err) {
                        console.error("Error listening to active connection:");
                        console.error(err);
                    }
                }
            }

            Object.assign(this._properties, changedProperties);
            this._propertiesSubject.next(this._properties);
        })
    }

    private async _listenToActivatingConnection(activatingConnectionPath: string) {
        this._stopListeningToActivatingConnection();

        let activatingConnectionInterface = await objectInterface(NetworkManager._bus, activatingConnectionPath, "org.freedesktop.DBus.Properties");
        this._activatingConnectionSubscription = signal(activatingConnectionInterface, "PropertiesChanged").subscribe((propertyChangeInfo: any[]) => {
            let changedProperties = propertyChangeInfo[1];
            Object.assign(this._properties.ActivatingConnection, changedProperties);
            this._propertiesSubject.next(this._properties);
        });
    }

    private _stopListeningToActivatingConnection() {
        if(this._activatingConnectionSubscription) {
            this._activatingConnectionSubscription.unsubscribe();
        }
    }

}