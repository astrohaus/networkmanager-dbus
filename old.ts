import DBus from "dbus";
import { BehaviorSubject, Observable } from "rxjs";
import { v4 as uuidv4 } from "uuid";
import { AccessPointPath, DevicePath, DeviceType, SettingsPath } from "./dbus-types";


export interface AccessPoint {
    flags: number,
    wpaFlags: number,
    rsnFlags: number,
    ssid: string,
    frequency: number,
    hwAddress: string,
    mode: number,
    maxBitrate: number,
    strength: number,
    lastSeen: number,
    accessPointPath: AccessPointPath
}

type AnyObjectMap = {
    [key: string]: any
};

type AccessPointMap = {
    [key: string]: AccessPoint
};

export class NetworkManager {

    bus: DBus.DBusConnection;
    //wifiDevice: Device;
    //ethernetDevice: Device;

    // private _connectedNetwork: BehaviorSubject<AccessPoint | null>;
    // public connectedNetwork: Observable<AccessPoint | null>;

    private _savedWifiSettings: AnyObjectMap;
    private _savedWifiSettingsSubject: BehaviorSubject<AnyObjectMap>;
    public savedWifiSettings: Observable<AnyObjectMap>;

    private _accessPoints: AccessPointMap;
    private _accessPointsSubject: BehaviorSubject<AccessPoint[]>;
    public accessPoints: Observable<AccessPoint[]>;

    private _wifiDevice: DBus.DBusInterface;

    private constructor(wifiDevice: DBus.DBusInterface, ) {
        this.bus = DBus.getBus('system');

        this._wifiDevice = wifiDevice;
        this._savedWifiSettings = {};
        this._savedWifiSettingsSubject = new BehaviorSubject<AnyObjectMap>({});
        this.savedWifiSettings = this._savedWifiSettingsSubject.asObservable();

        this._accessPoints = {};
        this._accessPointsSubject = new BehaviorSubject<AccessPoint[]>([]);
        this.accessPoints = this._accessPointsSubject.asObservable();

        this.setupAccessPointEvents(this._wifiDevice);
    }

    public async init(): Promise<NetworkManager> {
        return new Promise<NetworkManager>(async (resolve, reject) => {
            try {
                let wifiDevice = await this.getWifiDevice();
                let networkManager = new NetworkManager(wifiDevice);
                resolve(networkManager);
            } catch(err) {
                reject(err);
            }


            // await this.setupNetworkManagerEvents();
            // await this.setupAccessPointEvents();
            // this._accessPoints = await this.getDiscoveredAccessPoints();
            // this._accessPointsSubject.next(Object.values(this._accessPoints));
    
            // this._savedWifiSettings = await this.getSavedWifiSettings();
            // this._savedWifiSettingsSubject.next(this._savedWifiSettings);
    
            //this.getSavedWifiConnections();
        });
    }

    public addConnection(ssid: string, password:  string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let ssidByteArray = this.stringToByteArray(ssid);
            let connectionSettings = {
                "connection": {
                    "type": "802-11-wireless",
                    "uuid": uuidv4(),
                    "id": ssid
                },
                "802-11-wireless": {
                    "mode": "infrastructure",
                    "ssid": ssidByteArray,
                    "hidden": true
                },
                "802-11-wireless-security":  {
                    "key-mgmt": "wpa-psk",
                    "auth-alg": "open",
                    "psk": password
                },
                "ipv4": {
                    "method": "auto"
                },
                "ipv6": {
                    "method": "auto"
                }
            }

            let settingsInterface = await this.getInterface('/org/freedesktop/NetworkManager/Settings', 'org.freedesktop.NetworkManager.Settings');
            settingsInterface.AddConnection(connectionSettings, (err: any, connectionSettingsPath: any) => {
                if(err) {
                    reject(err);
                } else {
                    this._savedWifiSettings[connectionSettingsPath] = connectionSettings;
                    this._savedWifiSettingsSubject.next(this._savedWifiSettings);
                    resolve(connectionSettingsPath);
                }
            });
        });
    }

    public activateConnection(connectionPath: string, accessPointPath: string, ) {

    }

    public async requestScan(wifiDevice: DBus.DBusInterface): Promise<null> {
        return new Promise<null>(async (resolve, reject) => {
            wifiDevice.RequestScan({}, (err: any, result: any) => {
                if(err) {
                    reject(`Scan Error: ${err}`);
                    return;
                } else {
                    resolve();
                }
            });
        });
    }

    // private async getDiscoveredAccessPoints(wifiDevice: DBus.DBusInterface): Promise<AccessPointMap> {
    //     return new Promise<AccessPointMap>(async (resolve, reject) => {
    //         wifiDevice.GetAllAccessPoints({}, async (err: any, accessPointPaths: any) => {
    //             if(err) {
    //                 reject(`Error Getting Access Points: ${err}`);
    //             } else {
    //                 let accessPointPropertiesMap: AccessPointMap = {};
    //                 const forLoop = async () => {
    //                     for(let i = 0; i < accessPointPaths.length; i++) {
    //                         let accessPoint = await this.getAccessPointProperties(accessPointPaths[i]);
    //                         accessPointPropertiesMap[accessPointPaths[i]] = accessPoint;
    //                     }
    //                 }
    //                 await forLoop();

    //                 resolve(accessPointPropertiesMap);
    //             }
    //         });
    //     });
    // }

    // private async getSavedWifiSettings(): Promise<AnyObjectMap> {
    //     return new Promise<AnyObjectMap>(async (resolve, reject) => {
    //         try {

    //             let settingsInterface = await this.getInterface('/org/freedesktop/NetworkManager/Settings', 'org.freedesktop.NetworkManager.Settings');
    //             settingsInterface.getProperty("Connections", async (err, settingsPaths) => {
    //                 if(err) {
    //                     reject(err);
    //                     return;
    //                 }

    //                 let wifiSettingsMap: AnyObjectMap = {};
    //                 const forLoop = async () => {
    //                     for(let i = 0; i < settingsPaths.length; i++) {
    //                         let connectionSettingsInterface = await this.getInterface(settingsPaths[i], 'org.freedesktop.NetworkManager.Settings.Connection');
    //                         connectionSettingsInterface.GetSettings({}, (err: any, settings: any) => {
    //                             if(err) {
    //                                 reject(err);
    //                             } else {
    //                                if(settings['802-11-wireless']) {
    //                                    settings['802-11-wireless'].ssid = this.byteArrayToString(settings['802-11-wireless'].ssid);
    //                                     wifiSettingsMap[settingsPaths[i]] = settings;
    //                                }
    //                             }
    //                         });
    //                     }
    //                 }

    //                 await forLoop();
    //                 resolve(wifiSettingsMap);
    //             });
    //         } catch(err) {
    //             reject(err);
    //         }
    //     });
    // }

    // private async setupNetworkManagerEvents() {
    //     let networkManagerInterface = await this.getInterface('/org/freedesktop/NetworkManager', 'org.freedesktop.DBus.Properties');
    //     networkManagerInterface.on('PropertiesChanged', (event: any) => {
    //         console.log(`Properties changed:`);
    //         console.log(event);
    //     });

    //     let settingsInterface = await this.getInterface('/org/freedesktop/NetworkManager/Settings', 'org.freedesktop.NetworkManager.Settings');
    //     settingsInterface.on("NewConnection", (err: any, settingsPath: any) => {
    //         if(err) {
    //             console.error(err);
    //             return;
    //         }

    //         console.log(`Added settings: ${settingsPath}`);

    //     });
    // }

    private setupAccessPointEvents(wifiDevice: DBus.DBusInterface) {
        wifiDevice.on('AccessPointAdded', async (accessPointPath: string) => {
            let accessPoint = await this.getAccessPointProperties(accessPointPath);
            this._accessPoints[accessPointPath] = accessPoint;
            this._accessPointsSubject.next(Object.values(this._accessPoints));
        });

        wifiDevice.on('AccessPointRemoved', (accessPointPath: string) => {
            if(this._accessPoints[accessPointPath]) {
                delete this._accessPoints[accessPointPath];
            }
            this._accessPointsSubject.next(Object.values(this._accessPoints));
        });
    }

    private async getAccessPointProperties(accessPointPath: string): Promise<AccessPoint> {
        return new Promise<AccessPoint>(async (resolve, reject) => {
            let accessPoint = await this.getInterface(accessPointPath, 'org.freedesktop.NetworkManager.AccessPoint');
            accessPoint.getProperties((err, properties) => {
                if(err) {
                    reject(`Error getting access point properties: ${err}`);
                    return;
                } else {
                    properties.Ssid = this.byteArrayToString(properties.Ssid);
                    let lowercaseProps: AnyObjectMap = {};
                    for (const [key, value] of Object.entries(properties)) {
                        let camelcaseKey: string = key.charAt(0).toLowerCase() + key.slice(1);
                        lowercaseProps[camelcaseKey] = value;
                    }

                    let accessPoint = lowercaseProps as AccessPoint;
                    accessPoint.accessPointPath = accessPointPath;

                    resolve(accessPoint);
                }
            });
        })
    }

    private async getWifiDevice(): Promise<DBus.DBusInterface> {
        return new Promise<DBus.DBusInterface>(async (resolve, reject) => {
            let networkManager = await this.getInterface('/org/freedesktop/NetworkManager', 'org.freedesktop.NetworkManager');
            networkManager.GetAllDevices({}, async (err: string, devicePaths: DevicePath[]) => {
                if(err) {
                    reject(`Get All Devices Err: ${err}`);
                    return;
                }

                const forLoop = async () => {
                    for(let i = 0; i < devicePaths.length; i++) {
                        let device = await this.getInterface(devicePaths[i], 'org.freedesktop.NetworkManager.Device');
                        device.getProperties(async (err, properties) => {
                            if(err) {
                                reject(`Get device properties error: ${err}`);
                            } else if(properties.DeviceType === DeviceType.WIFI) {
                                resolve(device);
                                return;
                            }
                        })
                    }
                }
    
                await forLoop();
                reject(`No wifi device`);
            });
        });
    }

    private async getInterface(object: string, iface: string): Promise<DBus.DBusInterface> {
        return new Promise<DBus.DBusInterface>((resolve, reject) => {
            this.bus.getInterface(
                'org.freedesktop.NetworkManager',
                object,
                iface,
                (err, iface) => {
                    if(err) {
                        reject(`Interface error: ${err}`);
                    } else {
                        resolve(iface);
                    }
                }
        )});
    }

    private byteArrayToString(array: number[]): string {
        return String.fromCharCode.apply(String, array);
    }

    private stringToByteArray(input: string): number[] {
        let byteArray: number[] = [];
        for(let i = 0; i < input.length; i++) {
            byteArray[i] = input.charCodeAt(i);
        }

        return byteArray;
    }

}