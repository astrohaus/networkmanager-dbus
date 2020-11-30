import DBus = require("dbus");
import { BehaviorSubject, Observable } from "rxjs";
import { ConnectionSettingsManager } from "./connection-settings-manager";
import { DeviceType, NetworkManagerProperties } from "./dbus-types";
import { EthernetDevice } from "./ethernet-device";
import { call, getAllProperties, objectInterface, setProperty, signal } from "./util";
import { WifiDevice } from "./wifi-device";

/**
 * Manages communication with the NetworkManager over DBus
 * Responsible for initializing various other managers/devices such as:
 * - Ethernet Device
 * - Wifi Device
 * - Connection Settings Manager
 */
export class NetworkManager {

    private static _networkManagerSingleton: NetworkManager;
    private static _ethernetDeviceSingleton: EthernetDevice;
    private static _wifiDeviceSingleton: WifiDevice;
    private static _connectionSettingsManagerSingleton: ConnectionSettingsManager;

    private static _bus: DBus.DBusConnection = DBus.getBus('system');

    private _networkManagerInterface: DBus.DBusInterface;

    private _propertiesInterface: DBus.DBusInterface;
    private _properties: NetworkManagerProperties;
    private _propertiesSubject: BehaviorSubject<NetworkManagerProperties>;

    /** Continuously updated NetworkManager properties */
    public properties$: Observable<NetworkManagerProperties>;

    /** One-time value of latest NetworkManager properties */
    public get properties(): NetworkManagerProperties {
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

    /**
     * Initializes a new NetworkManager instance
     * The NetworkManager is a singleton, so calling this twice will return the same object
     * @returns Promise of a NetworkManager instance
     */
    public static async init(): Promise<NetworkManager> {
        // If the singleton exists, return it and exit
        if(NetworkManager._networkManagerSingleton) {
            return Promise.resolve(NetworkManager._networkManagerSingleton);
        }

        return new Promise<NetworkManager>(async (resolve, reject) => {
            try {
                let networkManagerInterface = await objectInterface(this._bus, '/org/freedesktop/NetworkManager', 'org.freedesktop.NetworkManager');

                let propertiesInterface = await objectInterface(this._bus, '/org/freedesktop/NetworkManager', 'org.freedesktop.DBus.Properties');
                let initialProperties = await getAllProperties(networkManagerInterface);

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
        });
    }

    /**
     * Initializes a new WifiDevice
     * Uses the first wifi device found.
     * WifiDevice is a singleton, so subsequent calls will return the same object
     * @returns Promise of a new WifiDevice
     */
    public wifiDevice(): Promise<WifiDevice> {
        // If the singleton exists, return it and exit
        if(NetworkManager._wifiDeviceSingleton) {
            return Promise.resolve(NetworkManager._wifiDeviceSingleton);
        }

        return new Promise<WifiDevice>(async (resolve, reject) => {
            try {
                let allDevicePaths: string[] = await call(this._networkManagerInterface, "GetAllDevices", {});
                const forLoop = async () => {
                    for(let i = 0; i < allDevicePaths.length; i++) {
                        let device = await objectInterface(NetworkManager._bus, allDevicePaths[i], 'org.freedesktop.NetworkManager.Device');
                        let properties = await getAllProperties(device);
                        
                        if(properties.DeviceType === DeviceType.WIFI) {
                            let wifiDevice = await WifiDevice.init(NetworkManager._bus, allDevicePaths[i]);
                            NetworkManager._wifiDeviceSingleton = wifiDevice;
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

    /**
     * Initializes and returns a new Ethernet Device
     * Uses the first Ethernet device found
     * Ethernet Device is a singleton, so subsequent calls will return the same object
     * @returns Promise of a new Ethernet Device
     */
    public ethernetDevice(): Promise<EthernetDevice> {
        // If the singleton exists, return it and exit
        if(NetworkManager._ethernetDeviceSingleton) {
            return Promise.resolve(NetworkManager._ethernetDeviceSingleton);
        }

        return new Promise<EthernetDevice>(async (resolve, reject) => {
            try {
                let allDevicePaths: string[] = await call(this._networkManagerInterface, "GetAllDevices", {});
                const forLoop = async () => {
                    for(let i = 0; i < allDevicePaths.length; i++) {
                        let device = await objectInterface(NetworkManager._bus, allDevicePaths[i], 'org.freedesktop.NetworkManager.Device');
                        let properties = await getAllProperties(device);
                        
                        if(properties.DeviceType === DeviceType.ETHERNET) {
                            let ethernetDevice = await EthernetDevice.init(NetworkManager._bus, allDevicePaths[i]);
                            NetworkManager._ethernetDeviceSingleton = ethernetDevice;
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

    /**
     * Initializes and returns a new ConnectionSettingsManager
     * ConnectionSettingsManager is a singleton, so subsequent calls will return the same object
     * @returns Promise of a new ConnectionSettingsManager
     */
    public connectionSettingsManager(): Promise<ConnectionSettingsManager> {
        // If the singleton exists, return it and exit
        if(NetworkManager._connectionSettingsManagerSingleton) {
            return Promise.resolve(NetworkManager._connectionSettingsManagerSingleton);
        }

        return new Promise<ConnectionSettingsManager>(async (resolve, reject) => {
            try {
                let connectionSettingsManager = await ConnectionSettingsManager.init(NetworkManager._bus);
                NetworkManager._connectionSettingsManagerSingleton = connectionSettingsManager;
                resolve(connectionSettingsManager);
            } catch(err) {
                reject(err);
            }
        });
    }

    /**
     * Enables or disables wireless functionality
     * @param enable If true, enable wireless; if false, disable wireless
     */
    public enableWireless(enable: boolean) {
        setProperty(this._networkManagerInterface, "WirelessEnabled", enable);
    }

    private _listenForPropertyChanges() {
        signal(this._propertiesInterface, "PropertiesChanged").subscribe(async (propertyChangeInfo: any[]) => {
            let changedProperties: Partial<NetworkManagerProperties> = propertyChangeInfo[1];
            Object.assign(this._properties, changedProperties);
            this._propertiesSubject.next(this._properties);
        })
    }

}