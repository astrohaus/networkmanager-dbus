import DBus from 'dbus-next';
import { BehaviorSubject, Observable } from 'rxjs';
import { DeepPartial } from 'utility-types';
import { AgentManager } from './agent-manager';
import { BaseDevice } from './base-device';
import { ConnectionSettingsManager } from './connection-settings-manager';
import { ConnectionProfile, DeviceType, NetworkManagerProperties, Properties } from './dbus-types';
import { EthernetDevice } from './ethernet-device';
import { Signaler } from './signaler';
import { call, getAllProperties, objectInterface, setProperty } from './util';
import { WifiDevice } from './wifi-device';

/**
 * Manages communication with the NetworkManager over DBus
 * Responsible for initializing various other managers/devices such as:
 * - Ethernet Device
 * - Wifi Device
 * - Connection Settings Manager
 */
export class NetworkManager extends Signaler {
    private static _networkManagerSingleton?: NetworkManager;
    private static _ethernetDeviceSingleton?: EthernetDevice;
    private static _wifiDeviceSingleton?: WifiDevice;
    private static _connectionSettingsManagerSingleton?: ConnectionSettingsManager;
    private static _agentManagerSingleton?: AgentManager;

    private static _bus?: DBus.MessageBus;

    private _bus: DBus.MessageBus;
    private _networkManagerInterface: DBus.ClientInterface;

    private _propertiesInterface: DBus.ClientInterface;
    private _properties: NetworkManagerProperties;
    private _propertiesSubject: BehaviorSubject<NetworkManagerProperties>;

    /** Continuously updated NetworkManager properties */
    public properties$: Observable<NetworkManagerProperties>;

    /** One-time value of latest NetworkManager properties */
    public get properties(): NetworkManagerProperties {
        return this._properties;
    }

    private constructor(
        bus: DBus.MessageBus,
        networkManagerInterface: DBus.ClientInterface,
        propertiesInterface: DBus.ClientInterface,
        initialProperties: any,
    ) {
        super();

        this._bus = bus;
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
        if (NetworkManager._networkManagerSingleton) {
            return Promise.resolve(NetworkManager._networkManagerSingleton);
        }

        return new Promise<NetworkManager>(async (resolve, reject) => {
            try {
                NetworkManager._bus = DBus.systemBus();

                const networkManagerInterface = await objectInterface(
                    NetworkManager._bus,
                    '/org/freedesktop/NetworkManager',
                    'org.freedesktop.NetworkManager',
                );

                const propertiesInterface = await objectInterface(
                    NetworkManager._bus,
                    '/org/freedesktop/NetworkManager',
                    'org.freedesktop.DBus.Properties',
                );
                const initialProperties = await getAllProperties(networkManagerInterface);

                const networkManager = new NetworkManager(
                    NetworkManager._bus,
                    networkManagerInterface,
                    propertiesInterface,
                    initialProperties,
                );

                NetworkManager._networkManagerSingleton = networkManager;

                resolve(networkManager);
            } catch (err) {
                reject(`Error initializing network manager: ${err}`);
            }
        });
    }

    /**
     * Destroys NetworkManager intance. It removes all singleton instances
     * and disconnects from DBus.
     */
    public static destroy() {
        if (NetworkManager._networkManagerSingleton) {
            NetworkManager._networkManagerSingleton.destroyAgentManager();
            NetworkManager._networkManagerSingleton.destroyConnectionSettingsManager();
            NetworkManager._networkManagerSingleton.destroyEthernetDevice();
            NetworkManager._networkManagerSingleton.destroyWifiDevice();

            NetworkManager._networkManagerSingleton.unsubscribeAll();
            NetworkManager._networkManagerSingleton = undefined;

            NetworkManager._bus && NetworkManager._bus.disconnect();
            NetworkManager._bus = undefined;
        }
    }

    public destroyAgentManager() {
        if (NetworkManager._agentManagerSingleton) {
            NetworkManager._agentManagerSingleton = undefined;
        }
    }

    public destroyConnectionSettingsManager() {
        if (NetworkManager._connectionSettingsManagerSingleton) {
            NetworkManager._connectionSettingsManagerSingleton.unsubscribeAll();
            NetworkManager._connectionSettingsManagerSingleton = undefined;
        }
    }

    public destroyEthernetDevice() {
        if (NetworkManager._ethernetDeviceSingleton) {
            NetworkManager._ethernetDeviceSingleton.unsubscribeAll();
            NetworkManager._ethernetDeviceSingleton = undefined;
        }
    }

    public destroyWifiDevice() {
        if (NetworkManager._wifiDeviceSingleton) {
            NetworkManager._wifiDeviceSingleton.unsubscribeAll();
            NetworkManager._wifiDeviceSingleton = undefined;
        }
    }

    /**
     * Initializes a new WifiDevice
     * Uses the first wifi device found.
     * WifiDevice is a singleton, so subsequent calls will return the same object
     * @returns Promise of a new WifiDevice
     */
    public wifiDevice(): Promise<WifiDevice> {
        // If the singleton exists, return it and exit
        if (NetworkManager._wifiDeviceSingleton) {
            return Promise.resolve(NetworkManager._wifiDeviceSingleton);
        }

        return new Promise<WifiDevice>(async (resolve, reject) => {
            try {
                let allDevicePaths: string[] = await call(this._networkManagerInterface, 'GetAllDevices');
                const forLoop = async () => {
                    for (let i = 0; i < allDevicePaths.length; i++) {
                        let device = await objectInterface(
                            NetworkManager._bus,
                            allDevicePaths[i],
                            'org.freedesktop.NetworkManager.Device',
                        );
                        let properties = await getAllProperties(device);

                        if (properties.DeviceType.value === DeviceType.WIFI) {
                            let wifiDevice = await WifiDevice.init(this._bus, allDevicePaths[i]);
                            NetworkManager._wifiDeviceSingleton = wifiDevice;
                            resolve(wifiDevice);
                            return;
                        }
                    }
                };

                await forLoop();
                reject(`No wifi device`);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Initializes and returns a new Ethernet Device
     * Uses the first Ethernet device found
     * Ethernet Device is a singleton, so subsequent calls will return the same object
     * @returns Promise of a new Ethernet Device
     */
    public ethernetDevice(): Promise<EthernetDevice> {
        // If the singleton exists, return it and exit
        if (NetworkManager._ethernetDeviceSingleton) {
            return Promise.resolve(NetworkManager._ethernetDeviceSingleton);
        }

        return new Promise<EthernetDevice>(async (resolve, reject) => {
            try {
                let allDevicePaths: string[] = await call(this._networkManagerInterface, 'GetAllDevices');
                const forLoop = async () => {
                    for (let i = 0; i < allDevicePaths.length; i++) {
                        let device = await objectInterface(
                            NetworkManager._bus,
                            allDevicePaths[i],
                            'org.freedesktop.NetworkManager.Device',
                        );
                        let properties = await getAllProperties(device);

                        if (properties.DeviceType.value === DeviceType.ETHERNET) {
                            let ethernetDevice = await EthernetDevice.init(this._bus, allDevicePaths[i]);
                            NetworkManager._ethernetDeviceSingleton = ethernetDevice;
                            resolve(ethernetDevice);
                            return;
                        }
                    }
                };

                await forLoop();
                reject(`No ethernet device`);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Initializes and returns a new ConnectionSettingsManager
     * ConnectionSettingsManager is a singleton, so subsequent calls will return the same object
     * @returns Promise of a new ConnectionSettingsManager
     */
    public connectionSettingsManager(): Promise<ConnectionSettingsManager> {
        // If the singleton exists, return it and exit
        if (NetworkManager._connectionSettingsManagerSingleton) {
            return Promise.resolve(NetworkManager._connectionSettingsManagerSingleton);
        }

        return new Promise<ConnectionSettingsManager>(async (resolve, reject) => {
            try {
                let connectionSettingsManager = await ConnectionSettingsManager.init(this._bus);
                NetworkManager._connectionSettingsManagerSingleton = connectionSettingsManager;
                resolve(connectionSettingsManager);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Initializes and retusn a new AgentManager.
     *
     * AgentManager is a singleton, so subsequent calls will return the same object.
     *
     * @returns Promise of a new AgentManager
     */
    public async agentManager(): Promise<AgentManager> {
        // If the singleton exists, return it and exit
        if (NetworkManager._agentManagerSingleton) {
            return Promise.resolve(NetworkManager._agentManagerSingleton);
        }

        const agentManager = await AgentManager.init(this._bus);
        NetworkManager._agentManagerSingleton = agentManager;

        return agentManager;
    }

    /**
     * Enables or disables wireless functionality
     * @param enable If true, enable wireless; if false, disable wireless
     */
    public enableWireless(enable: boolean) {
        setProperty(this._networkManagerInterface, 'WirelessEnabled', enable);
    }

    /**
     * Adds a new connection using the given details (if any) as a template (automatically
     * filling in missing settings with the capabilities of the given device and specific
     * object), then activate the new connection. Cannot be used for VPN connections at this time.
     *
     * @param connectionSettings
     * Connection settings and properties; if incomplete missing settings will be
     * automatically completed using the given device and specific object.
     * @param device
     * The object path of device to be activated using the given connection.
     * @param objectPath
     * The path of a connection-type-specific object this activation should use. This
     * parameter is currently ignored for wired and mobile broadband connections, and the
     * value of "/" should be used (ie, no specific object). For Wi-Fi connections, pass
     * the object path of a specific AP from the card's scan list, which will be used to
     * complete the details of the newly added connection.
     */
    public addAndActivateConnection(
        connectionSettings: DeepPartial<ConnectionProfile>,
        device: BaseDevice,
        objectPath: string,
    ) {
        return call(
            this._networkManagerInterface,
            'AddAndActivateConnection',
            connectionSettings,
            device.devicePath,
            objectPath,
        );
    }

    private _listenForPropertyChanges() {
        this.listenSignal(
            this._propertiesInterface,
            'PropertiesChanged',
            async (propertyChangeInfo: Array<Properties>) => {
                let changedProperties: Partial<NetworkManagerProperties> = propertyChangeInfo[1];
                Object.assign(this._properties, changedProperties);
                this._propertiesSubject.next(this._properties);
            },
        );
    }
}
